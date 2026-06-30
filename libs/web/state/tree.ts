import { isEmpty, map, reduce } from 'lodash';
import { genId } from 'libs/shared/id';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createContainer } from 'unstated-next';
import TreeActions, {
    DEFAULT_TREE,
    MovePosition,
    ROOT_ID,
    TreeItemModel,
    TreeModel,
} from 'libs/shared/tree';
import useNoteAPI from '../api/note';
import noteCache from '../cache/note';
import useTreeAPI from '../api/tree';
import { NOTE_DELETED, NOTE_STATUS } from 'libs/shared/meta';
import { NoteModel } from 'libs/shared/note';
import { useToast } from '../hooks/use-toast';
import { uiCache } from '../cache';
import UIState from './ui';

const TREE_CACHE_KEY = 'tree';

const findParentTreeItems = (tree: TreeModel, note: NoteModel) => {
    const parents = [] as TreeItemModel[];

    let tempNote = note;
    while (tempNote.pid && tempNote.pid !== ROOT_ID) {
        const curData = tree.items[tempNote.pid];
        if (curData?.data) {
            tempNote = curData.data;
            parents.push(curData);
        } else {
            break;
        }
    }

    return parents;
};

const useNoteTree = (initData: TreeModel = DEFAULT_TREE) => {
    const { mutate, loading, fetch: fetchTree } = useTreeAPI();
    const [tree, setTree] = useState<TreeModel>(initData);
    const [archivedTree, setArchivedTree] = useState<TreeModel>({ rootId: ROOT_ID, items: {} });
    const [starredTree, setStarredTree] = useState<TreeModel>({ rootId: ROOT_ID, items: {} });
    const [initLoaded, setInitLoaded] = useState<boolean>(false);
    const { fetch: fetchNote } = useNoteAPI();
    const fetchNoteRef = useRef(fetchNote);
    const treeRef = useRef(tree);
    const toast = useToast();
    const { settings } = UIState.useContainer();

    useEffect(() => {
        treeRef.current = tree;
    }, [tree]);

    useEffect(() => {
        fetchNoteRef.current = fetchNote;
    }, [fetchNote]);

    const initTree = useCallback(async () => {
        const cache = await uiCache.getItem<TreeModel>(TREE_CACHE_KEY);
        if (cache) {
            setTree(cache);
            setInitLoaded(true);
        }

        // Phase 6: fetch tree with status=0 (NORMAL)
        const tree = await fetchTree(0);

        if (!tree) {
            if (!cache) {
                toast('Failed to load tree', 'error');
            }
            return;
        }

        // Only update if tree data actually changed
        const cacheJSON = cache ? JSON.stringify(cache.items) : '';
        const treeJSON = JSON.stringify(tree.items);
        if (cacheJSON !== treeJSON) {
            setTree(tree);
        }
        await Promise.all([
            uiCache.setItem(TREE_CACHE_KEY, tree),
            noteCache.checkItems(tree.items),
        ]);

        setInitLoaded(true);

        // Preload top-level notes content in background (skip history folders and their snapshots)
        const HISTORY_FOLDER_TITLE = '历史版本';
        const preloadCount = settings?.settings?.preload_notes_count ?? 10;
        const topLevelIds = (tree.items[ROOT_ID]?.children || [])
            .filter(id => {
                const item = tree.items[id];
                return item?.data && item.data.title !== HISTORY_FOLDER_TITLE;
            })
            .sort((a, b) => {
                const timeA = tree.items[a]?.data?.updated_at ? new Date(tree.items[a].data!.updated_at!).getTime() : 0;
                const timeB = tree.items[b]?.data?.updated_at ? new Date(tree.items[b].data!.updated_at!).getTime() : 0;
                return timeB - timeA;
            })
            .slice(0, preloadCount);

        for (const id of topLevelIds) {
            try {
                const cached = await noteCache.getItem(id);
                if (cached && tree.items[id]?.data?.updated_at &&
                    cached.updated_at === tree.items[id]?.data?.updated_at) {
                    continue;
                }
                await fetchNoteRef.current(id);
            } catch {}
        }

        // Preload STARRED tree + top-level starred notes content in background
        fetchTree(NOTE_STATUS.STARRED).then(async (starredTree) => {
            if (starredTree) {
                setStarredTree(starredTree);
                // Preload top-level starred notes content (skip history folders)
                const starredTopLevelIds = (starredTree.items[ROOT_ID]?.children || [])
                    .filter(id => {
                        const item = starredTree.items[id];
                        return item?.data && item.data.title !== HISTORY_FOLDER_TITLE;
                    });
                await Promise.all(
                    starredTopLevelIds.map(async (id) => {
                        try {
                            const cached = await noteCache.getItem(id);
                            if (cached && starredTree.items[id]?.data?.updated_at &&
                                cached.updated_at === starredTree.items[id]?.data?.updated_at) {
                                return;
                            }
                            await fetchNoteRef.current(id);
                        } catch {}
                    })
                );
            }
        }).catch(() => {});

        // Preload ARCHIVED tree structure only (content loaded on demand)
        fetchTree(NOTE_STATUS.ARCHIVED).then((archivedTree) => {
            if (archivedTree) {
                setArchivedTree(archivedTree);
            }
        }).catch(() => {});
    }, [fetchTree, toast]);

    const loadArchivedTree = useCallback(async () => {
        const tree = await fetchTree(NOTE_STATUS.ARCHIVED);
        if (tree) {
            setArchivedTree(tree);
        }
    }, [fetchTree]);

    const loadStarredTree = useCallback(async () => {
        const tree = await fetchTree(NOTE_STATUS.STARRED);
        if (tree) {
            setStarredTree(tree);
        }
    }, [fetchTree]);

    const loadNoteOnDemand = useCallback(async (noteId: string) => {
        const currentItem = treeRef.current.items[noteId];
        if (!currentItem) {
            console.error(`Note ${noteId} not found in tree`);
            return null;
        }

        const cache = await noteCache.getItem(noteId);
        const serverMeta = currentItem.data;

        if (cache && serverMeta?.updated_at && cache.updated_at !== serverMeta.updated_at) {
            await noteCache.removeItem(noteId);
        }

        if (currentItem.data && currentItem.data.content !== undefined &&
            cache && serverMeta?.updated_at && cache.updated_at === serverMeta.updated_at) {
            return currentItem.data;
        }

        try {
            const noteData = await fetchNoteRef.current(noteId);
            const updatedTree = TreeActions.mutateItem(treeRef.current, noteId, {
                data: noteData
            });
            setTree(updatedTree);
            return noteData;
        } catch (error) {
            console.error(`Failed to load note ${noteId}:`, error);
            toast('Failed to load note', 'error');
            return null;
        }
    }, [toast]);

    const addItem = useCallback((item: NoteModel) => {
        const tree = TreeActions.addItem(treeRef.current, item.id, item.pid);
        tree.items[item.id].data = item;
        setTree(tree);
    }, []);

    const removeItem = useCallback(async (id: string) => {
        const tree = TreeActions.removeItem(treeRef.current, id);
        setTree(tree);
        await Promise.all(
            map(
                TreeActions.flattenTree(tree, id),
                async (item) =>
                    await noteCache.mutateItem(item.id, {
                        deleted: NOTE_DELETED.DELETED,
                    })
            )
        );
    }, []);

    const genNewId = useCallback(() => {
        let newId = genId();
        while (treeRef.current.items[newId]) {
            newId = genId();
        }
        return newId;
    }, []);

    const moveItem = useCallback(
        async (data: { source: MovePosition; destination: MovePosition }) => {
            const sourceParentId = String(data.source.parentId);
            const destParentId = String(data.destination.parentId);

            // Phase 6: optimistically update local tree
            const updatedTree = TreeActions.moveItem(
                treeRef.current,
                data.source,
                data.destination
            );
            setTree(updatedTree);

            // Build sibling IDs from the already-computed updatedTree
            const destSiblingIds = updatedTree.items[destParentId]?.children || [];
            const sourceSiblingIds = updatedTree.items[sourceParentId]?.children || [];

            // Phase 6: send to server with new format
            const sourceId = treeRef.current.items[sourceParentId]?.children[data.source.index];
            await mutate({
                action: 'move',
                data: {
                    sourceId,
                    destinationPid: destParentId,
                    destinationIndex: data.destination.index,
                    destSiblingIds,
                    sourceParentId,
                    sourceSiblingIds,
                },
            });
        },
        [mutate]
    );

    const mutateItem = useCallback(
        async (id: string, data: Partial<TreeItemModel>) => {
            setTree(TreeActions.mutateItem(treeRef.current, id, data));
            // Phase 6: isExpanded is client-only, no server mutation needed
            // Only send non-data mutations to server (e.g., isExpanded)
            const { data: _, ...dataWithoutData } = data;
            if (!isEmpty(dataWithoutData)) {
                await mutate({
                    action: 'mutate',
                    data: {
                        ...dataWithoutData,
                        id,
                    },
                });
            }
        },
        [mutate]
    );

    const restoreItem = useCallback(async (id: string, pid: string) => {
        const tree = TreeActions.restoreItem(treeRef.current, id, pid);
        setTree(tree);
        await Promise.all(
            map(
                TreeActions.flattenTree(tree, id),
                async (item) =>
                    await noteCache.mutateItem(item.id, {
                        deleted: NOTE_DELETED.NORMAL,
                    })
            )
        );
    }, []);

    const deleteItem = useCallback(async (id: string) => {
        setTree(TreeActions.deleteItem(treeRef.current, id));
    }, []);

    const getPaths = useCallback((note: NoteModel) => {
        const tree = treeRef.current;
        return findParentTreeItems(tree, note).map(
            (listItem) => listItem.data!
        );
    }, []);

    const setItemsExpandState = useCallback(
        async (items: TreeItemModel[], newValue: boolean) => {
            const newTree = reduce(
                items,
                (tempTree, item) =>
                    TreeActions.mutateItem(tempTree, item.id, {
                        isExpanded: newValue,
                    }),
                treeRef.current
            );
            setTree(newTree);

            for (const item of items) {
                await mutate({
                    action: 'mutate',
                    data: {
                        isExpanded: newValue,
                        id: item.id,
                    },
                });
            }
        },
        [mutate]
    );

    const showItem = useCallback(
        (note: NoteModel) => {
            const parents = findParentTreeItems(treeRef.current, note);
            setItemsExpandState(parents, true)
                ?.catch((v) => console.error('Error whilst expanding item: %O', v));
        },
        [setItemsExpandState]
    );

    const checkItemIsShown = useCallback((note: NoteModel) => {
        const parents = findParentTreeItems(treeRef.current, note);
        return reduce(
            parents,
            (value, item) => value && !!item.isExpanded,
            true
        );
    }, []);

    const collapseAllItems = useCallback(() => {
        const expandedItems = TreeActions.flattenTree(treeRef.current).filter(
            (item) => item.isExpanded
        );
        setItemsExpandState(expandedItems, false)
            .catch((v) => console.error('Error whilst collapsing item: %O', v));
    }, [setItemsExpandState]);

    return {
        tree,
        archivedTree,
        starredTree,
        initTree,
        genNewId,
        addItem,
        removeItem,
        moveItem,
        mutateItem,
        restoreItem,
        deleteItem,
        getPaths,
        showItem,
        checkItemIsShown,
        collapseAllItems,
        loadNoteOnDemand,
        loadArchivedTree,
        loadStarredTree,
        loading,
        initLoaded,
    };
};

const NoteTreeState = createContainer(useNoteTree);

export default NoteTreeState;

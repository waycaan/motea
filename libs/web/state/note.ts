import { useCallback, useState } from 'react';
import { createContainer } from 'unstated-next';
import NoteTreeState from 'libs/web/state/tree';
import { NOTE_ARCHIVED, NOTE_DELETED, NOTE_SHARED, NOTE_STARRED, NOTE_STATUS } from 'libs/shared/meta';
import useNoteAPI from '../api/note';
import noteCache from '../cache/note';
import { NoteModel } from 'libs/shared/note';
import { useToast } from '../hooks/use-toast';
import { isEmpty, map } from 'lodash';

const useNote = (initData?: NoteModel) => {
    const [note, setNote] = useState<NoteModel | undefined>(initData);
    const { find, abort: abortFindNote } = useNoteAPI();
    const { create, error: createError } = useNoteAPI();
    const { mutate, loading, abort, updateStatus } = useNoteAPI();
    const { addItem, removeItem, mutateItem, genNewId, initTree, loadArchivedTree, loadStarredTree } =
        NoteTreeState.useContainer();
    const toast = useToast();

    const fetchNote = useCallback(
        async (id: string) => {
            const cache = await noteCache.getItem(id);
            if (cache) {
                setNote(cache);
            }
            const result = await find(id);

            if (!result) {
                return;
            }

            result.content = result.content || '\n';
            setNote(result);
            await noteCache.setItem(id, result);

            return result;
        },
        [find]
    );

    const removeNote = useCallback(
        async (id: string) => {
            const payload = {
                deleted: NOTE_DELETED.DELETED,
            };

            setNote((prev) => {
                if (prev?.id === id) {
                    return { ...prev, ...payload };
                }
                return prev;
            });
            await mutate(id, payload);
            await noteCache.mutateItem(id, payload);
            await removeItem(id);
        },
        [mutate, removeItem]
    );

    const mutateNote = useCallback(
        async (id: string, payload: Partial<NoteModel>) => {
            const note = await noteCache.getItem(id);

            if (!note) {
                // todo
                console.error('mutate note error');
                return;
            }

            const diff: Partial<NoteModel> = {};
            map(payload, (value: any, key: keyof NoteModel) => {
                if (note[key] !== value) {
                    diff[key] = value;
                }
            });

            if (isEmpty(diff)) {
                return;
            }

            setNote((prev) => {
                if (prev?.id === id) {
                    return { ...prev, ...payload };
                }
                return prev;
            });
            await mutate(id, payload);
            await noteCache.mutateItem(id, payload);
            await mutateItem(id, {
                data: {
                    ...note,
                    ...payload,
                },
            });
        },
        [mutate, mutateItem]
    );

    const createNote = useCallback(
        async (body: Partial<NoteModel>) => {
            const result = await create(body);

            if (!result) {
                toast(createError, 'error');
                return;
            }

            result.content = result.content || '\n';

            await noteCache.setItem(result.id, result);
            setNote(result);

            addItem(result);

            return result;
        },
        [create, addItem, toast, createError]
    );

    const createNoteWithTitle = useCallback(
        async (title: NoteModel['title']) => {
            const id = genNewId();
            const result = await create({
                id,
                title,
            });

            if (!result) {
                return;
            }

            result.content = result.content || '\n';
            await noteCache.setItem(result.id, result);
            addItem(result);

            return { id };
        },
        [addItem, create, genNewId]
    );

    const updateNote = useCallback(
        async (data: Partial<NoteModel>) => {
            abort();

            if (!note?.id) {
                toast('Not found id', 'error');
                return;
            }

            const localNote = await noteCache.getItem(note.id);
            const noteToUpdate = localNote || note;

            const updateData = {
                ...data,
                content: data.content || noteToUpdate.content, 
            };

            const newNote = {
                ...noteToUpdate,
                ...data,
            };

            setNote(newNote);
            await mutateItem(newNote.id, {
                data: newNote,
            });

            const result = await mutate(note.id, updateData);
            await noteCache.mutateItem(note.id, updateData);

            // If version history was created, refresh the appropriate tree
            const resultWithVersion = result as (typeof result & { createdVersion?: any }) | null;
            if (resultWithVersion?.createdVersion) {
                // Refresh main tree (status=0) if note is NORMAL
                if ((newNote.status ?? 0) === NOTE_STATUS.NORMAL) {
                    await initTree();
                }
                // Refresh starred tree if note is STARRED
                else if ((newNote.status ?? 0) === NOTE_STATUS.STARRED) {
                    await loadStarredTree();
                }
                // Refresh archived tree if note is ARCHIVED
                else if ((newNote.status ?? 0) === NOTE_STATUS.ARCHIVED) {
                    await loadArchivedTree();
                }
            }

            return result;
        },
        [abort, toast, note, mutate, mutateItem, initTree, loadArchivedTree, loadStarredTree]
    );

    const initNote = useCallback((note: Partial<NoteModel>) => {
        setNote({
            deleted: NOTE_DELETED.NORMAL,
            shared: NOTE_SHARED.PRIVATE,
            archived: NOTE_ARCHIVED.UNARCHIVED,
            starred: NOTE_STARRED.UNSTARRED,
            status: NOTE_STATUS.NORMAL,
            editorsize: null,
            id: '-1',
            title: '',
            ...note,
        });
    }, []);

    // Phase 8: Batch status update via /api/notes/status
    const updateNotesStatus = useCallback(
        async (ids: string[], status: NOTE_STATUS, pid?: string) => {
            const result = await updateStatus(ids, status, pid);

            if (!result) {
                throw new Error('Failed to update notes status');
            }

            // Update local cache for each affected note (skip if not in cache)
            for (const id of result.ids) {
                try {
                    await noteCache.mutateItem(id, { status });
                } catch {
                    // Note may not be in cache (e.g. archived/starred notes)
                }
            }

            return result;
        },
        [updateStatus]
    );

    const archiveNote = useCallback(
        async (id: string) => {
            await updateNotesStatus([id], NOTE_STATUS.ARCHIVED);
            await removeItem(id);
            await Promise.all([initTree(), loadArchivedTree()]);
        },
        [updateNotesStatus, removeItem, initTree, loadArchivedTree]
    );

    const unarchiveNote = useCallback(
        async (id: string) => {
            await updateNotesStatus([id], NOTE_STATUS.NORMAL);
            await Promise.all([initTree(), loadArchivedTree()]);
        },
        [updateNotesStatus, initTree, loadArchivedTree]
    );

    const starNote = useCallback(
        async (id: string) => {
            await updateNotesStatus([id], NOTE_STATUS.STARRED);
            await removeItem(id);
            await Promise.all([initTree(), loadStarredTree()]);
        },
        [updateNotesStatus, removeItem, initTree, loadStarredTree]
    );

    const unstarNote = useCallback(
        async (id: string) => {
            await updateNotesStatus([id], NOTE_STATUS.NORMAL);
            await Promise.all([initTree(), loadStarredTree()]);
        },
        [updateNotesStatus, initTree, loadStarredTree]
    );

    const findOrCreateNote = useCallback(
        async (id: string, note: Partial<NoteModel>) => {
            try {
                const data = await fetchNote(id);
                if (!data) {
                    throw data;
                }
            } catch (e) {
                await createNote({
                    id,
                    ...note,
                });
            }
        },
        [createNote, fetchNote]
    );

    return {
        note,
        fetchNote,
        abortFindNote,
        createNote,
        findOrCreateNote,
        createNoteWithTitle,
        updateNote,
        removeNote,
        mutateNote,
        initNote,
        archiveNote,
        unarchiveNote,
        starNote,
        unstarNote,
        updateNotesStatus,
        loading,
    };
};

const NoteState = createContainer(useNote);

export default NoteState;

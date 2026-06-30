import { api } from 'libs/server/connect';
import { useAuth } from 'libs/server/middlewares/auth';
import { useStore } from 'libs/server/middlewares/store';
import { readRateLimit } from 'libs/server/middlewares/rate-limit';
import { TreeModel, TreeItemModel, ROOT_ID } from 'libs/shared/tree';
import { StorePostgreSQL } from 'libs/server/store/providers/postgresql';
import { NOTE_DELETED } from 'libs/shared/meta';

// Helper function to add timeout to promises
function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
        promise,
        new Promise<T>((_, reject) =>
            setTimeout(() => reject(new Error('Operation timed out')), timeoutMs)
        )
    ]);
}

/**
 * Phase 2: Build tree from notes table by status
 * Replaces tree_data JSONB read + enrichTreeWithMetadata
 */
async function buildTreeByStatus(store: StorePostgreSQL, status: number): Promise<TreeModel> {
    const notes = await store.getNotesByStatus(status);

    const items: Record<string, TreeItemModel> = {
        [ROOT_ID]: { id: ROOT_ID, children: [] as string[] },
    };

    // Use parent_id column directly (no need to decode metadata)
    const sortOrderCache = new Map<string, number>();

    for (const note of notes) {
        if (!note.path.startsWith('notes/')) continue;

        sortOrderCache.set(note.id, note.sort_order);

        items[note.id] = {
            id: note.id,
            children: [] as string[],
            data: {
                id: note.id,
                title: note.title || '',
                pid: note.parent_id,
                updated_at: new Date().toISOString(),
                deleted: note.deleted ?? NOTE_DELETED.NORMAL,
                shared: note.shared,
                starred: note.starred,
                status: note.status,
            } as any,
        };
    }

    // Build parent-child relationships using parent_id column
    for (const note of notes) {
        if (!note.path.startsWith('notes/')) continue;
        if (!items[note.id]) continue;
        const pid = note.parent_id || ROOT_ID;
        if (items[pid]) {
            items[pid].children.push(note.id);
        } else {
            items[ROOT_ID].children.push(note.id);
        }
    }

    // Sort children of each parent by sort_order
    for (const item of Object.values(items)) {
        if (item.children.length > 1) {
            item.children.sort((a, b) => {
                return (sortOrderCache.get(a) ?? 0) - (sortOrderCache.get(b) ?? 0);
            });
        }
    }

    return { rootId: ROOT_ID, items };
}

export default api()
    .use(readRateLimit)
    .use(useAuth)
    .use(useStore)
    .get(async (req, res) => {
        try {
            const status = Number(req.query.status) || 0;
            const store = req.state.store as StorePostgreSQL;

        

            const tree = await withTimeout(
                buildTreeByStatus(store, status),
                8000
            );



            const style = req.query['style'];
            switch (style) {
                case 'hierarchy':
                    // For hierarchy style, flatten back to nested structure
                    res.json(tree);
                    break;
                case 'list':
                default:
                    res.json(tree);
                    break;
            }
        } catch (error) {
            console.error('Error in GET /api/tree:', error);
            res.status(500).json({
                error: error instanceof Error ? error.message : 'Failed to get tree',
                timestamp: new Date().toISOString()
            });
        }
    })
    .post(async (req, res) => {
        try {
            const { action, data } = req.body as {
                action: 'move' | 'mutate' | 'reorder';
                data: any;
            };
            const store = req.state.store as StorePostgreSQL;



            switch (action) {
                case 'move': {
                    // Phase 3: Move note by updating pid
                    const { sourceId, destinationPid } = data;
                    await withTimeout(
                        (async () => {
                            // Update the moved note's pid
                            await store.updateNotePid(sourceId, destinationPid);
                            // Reorder siblings at destination
                            if (data.destSiblingIds) {
                                await store.reorderSiblings(destinationPid, data.destSiblingIds);
                            }
                            // Reorder siblings at source (after note removed)
                            if (data.sourceParentId && data.sourceSiblingIds) {
                                await store.reorderSiblings(data.sourceParentId, data.sourceSiblingIds);
                            }
                        })(),
                        8000
                    );
                    break;
                }

                case 'mutate': {
                    // Update tree item properties (e.g., isExpanded)
                    // isExpanded is client-only, no server action needed
                    break;
                }

                case 'reorder': {
                    // Reorder siblings
                    const { parentId, childIds } = data;
                    await withTimeout(
                        store.reorderSiblings(parentId, childIds),
                        8000
                    );
                    break;
                }

                default:
                    return res.APIError.NOT_SUPPORTED.throw('action not found');
            }

            res.status(204).end();
        } catch (error) {
            console.error('Error in POST /api/tree:', error);
            res.status(500).json({
                error: error instanceof Error ? error.message : 'Failed to update tree',
                timestamp: new Date().toISOString()
            });
        }
    });

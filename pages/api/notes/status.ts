import { api } from 'libs/server/connect';
import { useAuth } from 'libs/server/middlewares/auth';
import { useStore } from 'libs/server/middlewares/store';
import { notesRateLimit } from 'libs/server/middlewares/rate-limit';
import { StorePostgreSQL } from 'libs/server/store/providers/postgresql';
import { NOTE_STATUS } from 'libs/shared/meta';
import { ROOT_ID } from 'libs/shared/tree';

/**
 * POST /api/notes/status
 * Batch update note status (archive/unarchive/star/unstar)
 *
 * Body: {
 *   ids: string[],           // Note IDs to update
 *   status: NOTE_STATUS,     // Target status
 *   pid?: string,            // Optional: set pid for all notes (used for unarchive)
 * }
 */
export default api()
    .use(notesRateLimit)
    .use(useAuth)
    .use(useStore)
    .post(async (req, res) => {
        try {
            const { ids, status } = req.body as {
                ids: string[];
                status: NOTE_STATUS;
                pid?: string;
            };

            if (!ids || !Array.isArray(ids) || ids.length === 0) {
                return res.status(400).json({ error: 'ids array is required' });
            }

            if (status === undefined || status === null) {
                return res.status(400).json({ error: 'status is required' });
            }

            const store = req.state.store as StorePostgreSQL;

            // 1. Collect all descendants (BFS)
            const allIds = await store.collectDescendants(ids);

            // 2. Batch update status
            await store.updateNotesStatus(allIds, status);

            // 3. If unarchiving/unstarring (status=NORMAL):
            //    - Only the top-level notes (the ones directly in `ids`) become root-level
            //    - Children keep their original pid (hierarchy preserved)
            if (status === NOTE_STATUS.NORMAL) {
                for (const id of ids) {
                    await store.updateNotePid(id, ROOT_ID);
                }
            }

            res.status(200).json({
                updated: allIds.length,
                ids: allIds,
            });
        } catch (error) {
            console.error('Error in POST /api/notes/status:', error);
            res.status(500).json({
                error: error instanceof Error ? error.message : 'Failed to update note status',
            });
        }
    });

import { api, ApiRequest } from 'libs/server/connect';
import { useAuth } from 'libs/server/middlewares/auth';
import { useStore } from 'libs/server/middlewares/store';
import { getPathNoteById } from 'libs/server/note-path';
import { ROOT_ID } from 'libs/shared/tree';
import { StorePostgreSQL } from 'libs/server/store/providers/postgresql';

export default api()
    .use(useAuth)
    .use(useStore)
    .post(async (req, res) => {
        const { action, data } = req.body as {
            action: 'delete' | 'restore';
            data: {
                id: string;
                parentId?: string;
            };
        };

        switch (action) {
            case 'delete':
                await deleteNote(req, data.id);
                break;

            case 'restore':
                await restoreNote(req, data.id, data.parentId);
                break;

            default:
                return res.APIError.NOT_SUPPORTED.throw('action not found');
        }

        res.status(204).end();
    });

async function deleteNote(req: ApiRequest, id: string) {
    await req.state.store.deleteObject(getPathNoteById(id));
}

async function restoreNote(req: ApiRequest, id: string, parentId = ROOT_ID) {
    const store = req.state.store as StorePostgreSQL;

    // Update deleted column to 0 (normal)
    if ('updateNoteColumns' in store) {
        await store.updateNoteColumns(id, { deleted: 0 });
    }

    // Restore parent position in tree
    await store.updateNotePid(id, parentId);
}

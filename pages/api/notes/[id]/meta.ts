import { api } from 'libs/server/connect';
import { useAuth } from 'libs/server/middlewares/auth';
import { useStore } from 'libs/server/middlewares/store';
import { getPathNoteById } from 'libs/server/note-path';

export default api()
    .use(useAuth)
    .use(useStore)
    .post(async (req, res) => {
        const id = req.body.id || req.query.id;
        const notePath = getPathNoteById(id);

        // Read old note
        let oldNote: any = null;
        if ('getNoteById' in req.state.store) {
            oldNote = await (req.state.store as any).getNoteById(id);
        }

        const oldTitle = oldNote?.title || '';
        const oldDeleted = oldNote?.deleted ?? 0;
        const oldShared = oldNote?.shared ?? 0;
        const oldStarred = oldNote?.starred ?? 0;
        const oldHasVersions = oldNote?.has_versions ?? false;

        // Extract denormalized columns from request
        const newTitle = req.body.title ?? oldTitle;
        const newDeleted = req.body.deleted !== undefined ? (req.body.deleted === '1' || req.body.deleted === 1 ? 1 : 0) : oldDeleted;
        const newShared = req.body.shared !== undefined ? (req.body.shared === '1' || req.body.shared === 1 ? 1 : 0) : oldShared;
        const newStarred = req.body.starred !== undefined ? (req.body.starred === '1' || req.body.starred === 1 ? 1 : 0) : oldStarred;
        const newHasVersions = req.body.hasVersions !== undefined ? req.body.hasVersions === true : oldHasVersions;

        const existingContent = await req.state.store.getObject(notePath);

        const putOptions: any = {
            contentType: 'text/markdown',
            title: newTitle,
            deleted: newDeleted,
            shared: newShared,
            starred: newStarred,
            has_versions: newHasVersions,
        };
        if (req.body.pid) {
            putOptions.parent_id = req.body.pid;
        }

        await req.state.store.putObject(notePath, existingContent || '\n', putOptions);

        const updatedNote = {
            id,
            content: existingContent || '\n',
            title: newTitle,
            deleted: newDeleted,
            shared: newShared,
            starred: newStarred,
            hasVersions: newHasVersions,
            updated_at: new Date().toISOString(),
        };

        res.json(updatedNote);
    })
    .get(async (req, res) => {
        const id = req.body.id || req.query.id;

        if ('getNoteById' in req.state.store) {
            const row = await (req.state.store as any).getNoteById(id);
            if (!row) return res.status(404).json({ error: 'Note not found' });
            return res.json({
                title: row.title,
                deleted: row.deleted,
                shared: row.shared,
                starred: row.starred,
                hasVersions: row.has_versions,
            });
        }

        res.status(404).json({ error: 'Not supported' });
    });

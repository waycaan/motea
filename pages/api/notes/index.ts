import { api } from 'libs/server/connect';
import { useAuth } from 'libs/server/middlewares/auth';
import { useStore } from 'libs/server/middlewares/store';
import { createNote } from 'libs/server/note';
import { notesRateLimit } from 'libs/server/middlewares/rate-limit';

export default api()
    .use(notesRateLimit)
    .use(useAuth)
    .use(useStore)
    .post(async (req, res) => {
        const note = await createNote(req.body, req.state);
        // Phase 5: tree is now built from notes.pid, no need for treeStore.addItem()

        res.json(note);
    });

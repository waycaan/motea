import { useAuth } from 'libs/server/middlewares/auth';
import { useStore } from 'libs/server/middlewares/store';
import { api } from 'libs/server/connect';
import { NOTE_DELETED } from 'libs/shared/meta';
import { convertLexicalToMarkdown } from 'libs/shared/lexical-to-markdown';

export default api()
    .use(useAuth)
    .use(useStore)
    .get(async (req, res) => {
        const id = req.query.id as string;
        const store = req.state.store as any;

        if (!id) {
            return res.status(400).json({ error: 'Note ID required' });
        }

        const noteData = await store.getNoteById(id);
        if (!noteData) {
            return res.status(404).json({ error: 'Note not found' });
        }

        if (noteData.deleted === NOTE_DELETED.DELETED) {
            return res.status(404).json({ error: 'Note is deleted' });
        }

        const title = noteData.title || 'Untitled';
        let content = noteData.content || '';
        let markdown = '';

        if (content) {
            const trimmed = content.trim();
            if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
                markdown = convertLexicalToMarkdown(content);
            } else {
                markdown = content;
            }
        }

        const fullMarkdown = `# ${title}\n\n${markdown}`;

        res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${title}.md"`);
        res.send(fullMarkdown);
    });

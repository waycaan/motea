import { NoteModel } from 'libs/shared/note';
import { genId } from 'libs/shared/id';
import { getPathNoteById } from 'libs/server/note-path';
import { ServerState } from './connect';
import { ROOT_ID } from 'libs/shared/tree';

export const createNote = async (note: NoteModel, state: ServerState) => {
    const { content = '\n', ...meta } = note;

    let noteId = note.id;
    if (!noteId) {
        noteId = genId();
    }

    while (await state.store.hasObject(getPathNoteById(noteId))) {
        noteId = genId();
    }

    const isJSON = content.trim().startsWith('{') && content.trim().endsWith('}');
    const contentType = isJSON ? 'application/json' : 'text/markdown';

    await state.store.putObject(getPathNoteById(noteId), content, {
        contentType,
        parent_id: note.pid || ROOT_ID,
        title: note.title || '',
        deleted: Number(note.deleted) || 0,
        shared: Number(note.shared) || 0,
        starred: Number(note.starred) || 0,
        status: note.status ?? 0,
        has_versions: !!(note as any).hasVersions,
    });

    const completeNote = {
        ...meta,
        id: noteId,
        content,
        date: note.date ?? new Date().toISOString(),
        updated_at: new Date().toISOString(),
    };

    return completeNote as NoteModel;
};

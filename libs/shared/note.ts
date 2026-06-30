import { EDITOR_SIZE, NOTE_ARCHIVED, NOTE_DELETED, NOTE_SHARED, NOTE_STARRED, NOTE_STATUS } from './meta';

export interface NoteModel {
    id: string;
    title: string;
    pid?: string;
    content?: string;
    pic?: string;
    date?: string;
    deleted: NOTE_DELETED;
    shared: NOTE_SHARED;
    archived: NOTE_ARCHIVED;
    starred: NOTE_STARRED;
    status: NOTE_STATUS;
    editorsize: EDITOR_SIZE | null;
    isDailyNote?: boolean; 
    updated_at?: string; 
    hasVersions?: boolean;
}


export const isNoteLink = (str: string) => {
    return new RegExp(`^/${NOTE_ID_REGEXP}$`).test(str);
};

export const NOTE_ID_REGEXP = '[A-Za-z0-9_-]+';

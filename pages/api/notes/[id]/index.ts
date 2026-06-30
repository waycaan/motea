/**
 * Notes CRUD API
 *
 * Copyright (c) 2025 waycaan
 * Licensed under the MIT License
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 */

import { api } from 'libs/server/connect';
import { useAuth } from 'libs/server/middlewares/auth';
import { useStore } from 'libs/server/middlewares/store';
import { getPathNoteById } from 'libs/server/note-path';
import { NoteModel } from 'libs/shared/note';
import { StoreProvider } from 'libs/server/store';
import { API } from 'libs/server/middlewares/error';
import { ROOT_ID } from 'libs/shared/tree';
import { genId } from 'libs/shared/id';

const HISTORY_FOLDER_TITLE = '历史版本';
const MAX_VERSIONS = 4;

function formatDateForVersion(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const h = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    const s = String(date.getSeconds()).padStart(2, '0');
    return `${y}-${m}-${d}-${h}-${min}-${s}`;
}

async function findHistoryFolder(store: StoreProvider, noteId: string, status?: number): Promise<string | null> {
    if ('findHistoryFolder' in store && typeof (store as any).findHistoryFolder === 'function') {
        return (store as any).findHistoryFolder(noteId, HISTORY_FOLDER_TITLE, status);
    }
    // Fallback: search all statuses (not just 0) to find history folders for archived/starred notes
    for (const s of [0, 1, 2]) {
        if (status !== undefined && s !== status) continue;
        const allNotes = await store.getNotesByStatus(s);
        for (const note of allNotes) {
            const title = (note as any).title || '';
            const pid = (note as any).parent_id || '';
            if (title === HISTORY_FOLDER_TITLE && pid === noteId) {
                return note.id;
            }
        }
    }
    return null;
}

async function createHistoryFolder(store: StoreProvider, noteId: string, status: number = 0): Promise<string> {
    const folderId = genId();
    await store.putObject(getPathNoteById(folderId), '', {
        contentType: 'text/markdown',
        parent_id: noteId,
        title: HISTORY_FOLDER_TITLE,
        status,
    });
    return folderId;
}

async function trimOldVersions(store: StoreProvider, historyFolderId: string): Promise<void> {
    if ('trimOldVersions' in store && typeof (store as any).trimOldVersions === 'function') {
        return (store as any).trimOldVersions(historyFolderId, MAX_VERSIONS);
    }
    // Fallback: search all statuses to find version snapshots
    const versionNotes: Array<{ id: string; created_at: string }> = [];
    for (const status of [0, 1, 2]) {
        const allNotes = await store.getNotesByStatus(status);
        for (const note of allNotes) {
            const pid = (note as any).parent_id || '';
            const deleted = (note as any).deleted ?? 0;
            if (pid === historyFolderId && note.id !== historyFolderId && deleted === 0) {
                versionNotes.push({ id: note.id, created_at: (note as any).updated_at || '' });
            }
        }
    }
    versionNotes.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    if (versionNotes.length > MAX_VERSIONS) {
        for (const v of versionNotes.slice(MAX_VERSIONS)) {
            await store.deleteObject(getPathNoteById(v.id));
        }
    }
}

export async function getNote(store: StoreProvider, id: string): Promise<NoteModel> {
    if ('getNoteById' in store && typeof (store as any).getNoteById === 'function') {
        const row = await (store as any).getNoteById(id);
        if (!row) throw API.NOT_FOUND.throw();
        return {
            id: row.id,
            content: row.content || '',
            title: row.title || '',
            deleted: row.deleted ?? 0,
            shared: row.shared ?? 0,
            starred: row.starred ?? 0,
            status: row.status ?? 0,
            hasVersions: row.has_versions ?? false,
            updated_at: row.updated_at,
        } as NoteModel;
    }
    throw API.NOT_FOUND.throw();
}

export default api()
    .use(useAuth)
    .use(useStore)
    .delete(async (req, res) => {
        const id = req.query.id as string;
        await req.state.store.deleteObject(getPathNoteById(id));
        res.end();
    })
    .get(async (req, res) => {
        const id = req.query.id as string;
        if (id === ROOT_ID) return res.json({ id });
        const note = await getNote(req.state.store, id);
        res.json(note);
    })
    .post(async (req, res) => {
        const id = req.query.id as string;
        const { content } = req.body;
        const notePath = getPathNoteById(id);

        // Read old note
        let oldNote: any = null;
        if ('getNoteById' in req.state.store) {
            oldNote = await (req.state.store as any).getNoteById(id);
        }
        const oldTitle = oldNote?.title || '';
        const oldHasVersions = oldNote?.has_versions ?? false;

        // Version snapshot
        let createdVersion: { id: string; title: string; pid: string; status: number } | null = null;
        if (oldHasVersions && content) {
            try {
                const snapshotContent = await req.state.store.getObject(notePath);
                if (snapshotContent) {
                    const noteStatus = oldNote?.status ?? 0;
                    let historyFolderId = await findHistoryFolder(req.state.store, id, noteStatus);
                    if (!historyFolderId) {
                        historyFolderId = await createHistoryFolder(req.state.store, id, noteStatus);
                    }
                    const timestamp = formatDateForVersion(new Date());
                    const snapshotTitle = `${timestamp} ${oldTitle}`;
                    const snapshotId = genId();
                    await req.state.store.putObject(getPathNoteById(snapshotId), snapshotContent, {
                        contentType: 'text/markdown',
                        parent_id: historyFolderId,
                        title: snapshotTitle,
                        status: noteStatus,
                    });
                    createdVersion = { id: snapshotId, title: snapshotTitle, pid: historyFolderId, status: noteStatus };
                    await trimOldVersions(req.state.store, historyFolderId);
                }
            } catch (e) {
                console.error('Failed to create version snapshot:', e);
            }
        }

        // Extract denormalized columns — preserve original values unless explicitly changed
        const newTitle = req.body.title ?? oldTitle;
        const newDeleted = req.body.deleted !== undefined ? (req.body.deleted === '1' || req.body.deleted === 1 ? 1 : 0) : (oldNote?.deleted ?? 0);
        const newShared = req.body.shared !== undefined ? (req.body.shared === '1' || req.body.shared === 1 ? 1 : 0) : (oldNote?.shared ?? 0);
        const newStarred = req.body.starred !== undefined ? (req.body.starred === '1' || req.body.starred === 1 ? 1 : 0) : (oldNote?.starred ?? 0);
        const newHasVersions = req.body.hasVersions !== undefined ? req.body.hasVersions === true : oldHasVersions;
        const newStatus = req.body.status !== undefined ? req.body.status : (oldNote?.status ?? 0);

        // Determine parent_id — preserve existing if not changing
        const parentId = (() => {
            if (req.body.pid) return req.body.pid;
            return oldNote ? undefined : ROOT_ID;
        })();

        const isJSON = content && content.trim().startsWith('{') && content.trim().endsWith('}');
        const contentType = isJSON ? 'application/json' : 'text/markdown';

        const putOptions: any = {
            contentType,
            title: newTitle,
            deleted: newDeleted,
            shared: newShared,
            starred: newStarred,
            status: newStatus,
            has_versions: newHasVersions,
        };
        if (parentId !== undefined) {
            putOptions.parent_id = parentId;
        }

        await req.state.store.putObject(notePath, content, putOptions);

        const updatedNote: any = {
            id,
            content,
            title: newTitle,
            deleted: newDeleted,
            shared: newShared,
            starred: newStarred,
            status: newStatus,
            hasVersions: newHasVersions,
            updated_at: new Date().toISOString(),
        };

        if (createdVersion) {
            updatedNote.createdVersion = createdVersion;
        }

        res.json(updatedNote);
    });

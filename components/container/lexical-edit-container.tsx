/**
 * Lexical Edit Container Component
 * Migrated from TipTap to Lexical
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

import { FC, useEffect } from 'react';
import { useRouter } from 'next/router';
import { has } from 'lodash';
import LexicalMainEditor from 'components/editor/lexical-main-editor';
import LexicalEditorState from 'libs/web/state/lexical-editor';
import NoteState from 'libs/web/state/note';
import NoteTreeState from 'libs/web/state/tree';
import UIState from 'libs/web/state/ui';
import { useToast } from 'libs/web/hooks/use-toast';
import useAutoSaveOnLeave from 'libs/web/hooks/use-auto-save-on-leave';
import noteCache from 'libs/web/cache/note';
import NoteNav from 'components/note-nav';
import DeleteAlert from 'components/editor/delete-alert';

/**
 * 创建空的 Lexical 编辑器 JSON 状态
 */
function createEmptyEditorJSON(): string {
    return JSON.stringify({
        root: {
            children: [
                {
                    children: [],
                    direction: null,
                    format: "",
                    indent: 0,
                    type: "paragraph",
                    version: 1
                }
            ],
            direction: null,
            format: "",
            indent: 0,
            type: "root",
            version: 1
        }
    });
}

const LexicalEditContainer: FC = () => {
    const router = useRouter();
    const { id, pid } = router.query;
    const isNew = has(router.query, 'new');
    const { initNote, fetchNote } = NoteState.useContainer();
    const { loadNoteOnDemand } = NoteTreeState.useContainer();
    const {
        settings: { settings },
    } = UIState.useContainer();
    const toast = useToast();

    useAutoSaveOnLeave({
        enabled: true,
    });

    useEffect(() => {
        const initializeEditor = async () => {
            if (!id || Array.isArray(id)) return;

            if (isNew) {
                const dailyDate = router.query.daily as string;

                if (dailyDate && /^\d{4}-\d{1,2}-\d{1,2}$/.test(dailyDate)) {
                    initNote({
                        id,
                        title: dailyDate,
                        content: createEmptyEditorJSON(),
                        pid: settings.daily_root_id,
                        isDailyNote: true,
                    });
                } else {
                    const cachedNote = await noteCache.getItem(id);
                    if (cachedNote) {
                        initNote(cachedNote);
                        return;
                    }

                    initNote({
                        id,
                        title: '',
                        content: createEmptyEditorJSON(),
                        pid: (typeof pid === 'string' ? pid : undefined) || 'root'
                    });
                }
            } else {
                try {
                    const noteData = await loadNoteOnDemand(id);

                    if (noteData) {
                        initNote(noteData);
                    } else {

                        await fetchNote(id);
                    }
                } catch (error) {
                    console.error('Failed to load note:', error);
                    toast('Failed to load note', 'error');
                }
            }
        };

        initializeEditor();
    }, [
        id,
        isNew,
        pid,
        router.query.daily,
        settings.daily_root_id,
        initNote,
        fetchNote,
        loadNoteOnDemand,
        toast,
    ]);

    if (!id || Array.isArray(id)) {
        return <div>Loading...</div>;
    }

    return (
        <LexicalEditorState.Provider>
            <NoteNav />
            <DeleteAlert />
            <section className="h-full">
                <LexicalMainEditor readOnly={false} />
            </section>
        </LexicalEditorState.Provider>
    );
};

export default LexicalEditContainer;

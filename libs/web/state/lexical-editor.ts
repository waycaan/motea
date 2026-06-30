import NoteState from 'libs/web/state/note';
import { useRouter } from 'next/router';
import {
    useCallback,
    useEffect,
    MouseEvent as ReactMouseEvent,
    useState,
    useRef,
} from 'react';
import { isNoteLink, NoteModel } from 'libs/shared/note';
import { useToast } from 'libs/web/hooks/use-toast';
import { NoteCacheItem } from 'libs/web/cache';
import noteCache from 'libs/web/cache/note';
import { createContainer } from 'unstated-next';
import { LexicalEditorRef } from 'components/editor/lexical-editor';
import { has } from 'lodash';

const ROOT_ID = 'root';

const useLexicalEditor = (initNote?: NoteModel) => {
    let note = initNote;
    let createNoteWithTitle: any, updateNote: any, createNote: any;

    try {
        const noteState = NoteState.useContainer();
        createNoteWithTitle = noteState.createNoteWithTitle;
        updateNote = noteState.updateNote;
        createNote = noteState.createNote;

        if (!note) {
            note = noteState.note;
        }
    } catch (error) {
        console.warn('NoteState not available in LexicalEditorState, using initNote only');
        createNoteWithTitle = async () => undefined;
        updateNote = async () => undefined;
        createNote = async () => undefined;
    }

    const router = useRouter();
    const toast = useToast();
    const editorEl = useRef<LexicalEditorRef>(null);
    const hasSyncedToServerRef = useRef(false);

    useEffect(() => {
        hasSyncedToServerRef.current = false;
    }, [note?.id]);

    const saveToIndexedDB = useCallback(
        async (data: Partial<NoteModel>) => {
            if (!note?.id) return;

            const existingNote = await noteCache.getItem(note.id);
            const baseNote = existingNote || note;

            const updatedNote = { ...baseNote, ...data };

            await noteCache.setItem(note.id, updatedNote);
        },
        [note]
    );

    const syncToServer = useCallback(
        async () => {
            if (!note?.id) return false;

            // 始终从 IndexedDB 获取最新内容
            const localNote = await noteCache.getItem(note.id);
            const noteToSave = localNote || note;

            if (hasSyncedToServerRef.current) {
                const updatedNote = await updateNote(noteToSave);
                if (updatedNote) {
                    await noteCache.setItem(updatedNote.id, updatedNote);
                    toast('Note updated on server', 'success');
                    return true;
                }
                return false;
            }

            const isNew = has(router.query, 'new');

            try {

                if (isNew) {
                    const noteData = {
                        ...noteToSave,
                        pid: (router.query.pid as string) || ROOT_ID
                    };

                    const item = await createNote(noteData);

                    if (item) {
                        hasSyncedToServerRef.current = true;
                        const noteUrl = `/${item.id}`;
                        if (router.asPath !== noteUrl) {
                            await router.replace(noteUrl, undefined, { shallow: true });
                        }
                        toast('Note saved to server', 'success');
                        return true;
                    }
                } else {
                    hasSyncedToServerRef.current = true;
                    const updatedNote = await updateNote(noteToSave);

                    if (updatedNote) {
                        await noteCache.setItem(updatedNote.id, updatedNote);
                        toast('Note updated on server', 'success');
                        return true;
                    }
                }
            } catch (error) {
                toast('Failed to save note to server', 'error');
                return false;
            }

            return false;
        },
        [note, router, createNote, updateNote, toast]
    );

    const onCreateLink = useCallback(
        async (title: string) => {
            if (!createNoteWithTitle) return '';

            const result = await createNoteWithTitle(title);
            if (result?.id) {
                return `/${result.id}`;
            }
            return '';
        },
        [createNoteWithTitle]
    );

    const onSearchLink = useCallback(
        async (_term: string) => {
            return [];
        },
        []
    );

    const onClickLink = useCallback(
        (href: string, event: ReactMouseEvent) => {
            let notePath = href
            try {
                const url = new URL(href)
                if (url.origin === window.location.origin) {
                    notePath = url.pathname
                }
            } catch {}
            if (isNoteLink(notePath)) {
                event.preventDefault();
                router.push(notePath);
            } else {
                window.open(href, '_blank', 'noopener,noreferrer');
            }
        },
        [router]
    );

    const onUploadImage = useCallback(
        async (_file: File, _id?: string) => {
            toast('Image upload is not supported in this version', 'error');
            throw new Error('Image upload is not supported');
        },
        [toast]
    );

    const onHoverLink = useCallback((_event: ReactMouseEvent) => {
        return true;
    }, []);

    const [backlinks, setBackLinks] = useState<NoteCacheItem[]>();

    const getBackLinks = useCallback(async () => {
        const linkNotes: NoteCacheItem[] = [];
        if (!note?.id) return linkNotes;
        setBackLinks([]);
        await noteCache.iterate<NoteCacheItem, void>((value) => {
            if (value.linkIds?.includes(note?.id || '')) {
                linkNotes.push(value);
            }
        });
        setBackLinks(linkNotes);
    }, [note?.id]);

    const onEditorChange = useCallback(
        async (jsonContent: string): Promise<void> => {
            if (!note?.id) {
                return;
            }

            try {
                let title: string;
                if (note?.isDailyNote) {
                    title = note.title;
                } else {
                    const titleInput = document.querySelector('h1 textarea') as HTMLTextAreaElement;
                    if (titleInput && titleInput.value.trim()) {
                        title = titleInput.value.trim();
                    } else {
                        title = extractTitleFromJSON(jsonContent) || note.title || 'Untitled';
                    }
                }

                await saveToIndexedDB({
                    content: jsonContent,
                    title,
                    updated_at: new Date().toISOString()
                });

            } catch (error) {
                console.error('Error in onEditorChange:', error);
            }
        },
        [saveToIndexedDB, note?.isDailyNote, note?.id, note?.title]
    );

    const onTitleChange = useCallback(
        (title: string): void => {
            saveToIndexedDB({
                title,
                updated_at: new Date().toISOString()
            })?.catch((v) => console.error('Error whilst saving title to IndexedDB: %O', v));
        },
        [saveToIndexedDB]
    );

    return {
        onCreateLink,
        onSearchLink,
        onClickLink,
        onUploadImage,
        onHoverLink,
        getBackLinks,
        onEditorChange,
        onTitleChange,
        saveToIndexedDB,
        syncToServer,
        backlinks,
        editorEl,
        note,
    };
};

function extractTitleFromJSON(jsonContent: string): string | null {
    try {
        const editorState = JSON.parse(jsonContent);
        const root = editorState.root;

        if (!root || !root.children) return null;

        function findFirstHeading(children: any[]): string | null {
            for (const child of children) {
                if (child.type === 'heading' && child.children) {
                    const text = extractTextFromChildren(child.children);
                    if (text) return text;
                }

                if (child.children) {
                    const result = findFirstHeading(child.children);
                    if (result) return result;
                }
            }
            return null;
        }

        function extractTextFromChildren(children: any[]): string {
            if (!Array.isArray(children)) return '';

            return children
                .filter(child => child && child.type === 'text')
                .map(child => child.text || '')
                .join('')
                .trim();
        }

        return findFirstHeading(root.children);

    } catch (error) {
        console.error('Failed to extract title from JSON:', error);
        return null;
    }
}

const LexicalEditorState = createContainer(useLexicalEditor);

export default LexicalEditorState;

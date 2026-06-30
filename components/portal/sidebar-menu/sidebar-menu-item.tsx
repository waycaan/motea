import { EDITOR_SIZE } from 'libs/shared/meta';
import { NoteModel } from 'libs/shared/note';
import NoteState from 'libs/web/state/note';
import PortalState from 'libs/web/state/portal';
import { forwardRef, useCallback, useMemo } from 'react';
import { MenuItem } from '@material-ui/core';
import UIState from 'libs/web/state/ui';
import noteCache from 'libs/web/cache/note';
import { convertLexicalToMarkdown } from 'libs/shared/lexical-to-markdown';

export enum MENU_HANDLER_NAME {
    REMOVE_NOTE,
    COPY_LINK,
    ADD_TO_ARCHIVE,
    REMOVE_FROM_ARCHIVE,
    ADD_TO_STAR,
    REMOVE_FROM_STAR,
    SWITCH_EDITOR_WIDTH,
    EXPORT_MD,
}

export interface Item {
    text: string;
    icon: JSX.Element;
    handler: MENU_HANDLER_NAME;
    enable?: (data?: NoteModel) => boolean;
}

interface ItemProps {
    item: Item;
}

export const SidebarMenuItem = forwardRef<HTMLLIElement, ItemProps>(
    ({ item }, ref) => {
        const {
            settings: { settings },
        } = UIState.useContainer();
        const { removeNote, mutateNote, archiveNote, unarchiveNote, starNote, unstarNote } = NoteState.useContainer();
        const {
            menu: { close, data },
        } = PortalState.useContainer();

        const doRemoveNote = useCallback(() => {
            close();
            if (data?.id) {
                // TODO: merge with mutateNote
                removeNote(data.id)
                    ?.catch((v) => console.error('Error whilst removing note: %O', v));
            }
        }, [close, data, mutateNote, removeNote]);

        const doCopyLink = useCallback(() => {
            navigator.clipboard.writeText(location.origin + '/' + data?.id)
                ?.catch((v) => console.error('Error whilst writing to clipboard: %O', v));
            close();
        }, [close, data?.id]);

        const doArchived = useCallback(() => {
            close();
            if (data?.id) {
                archiveNote(data.id)
                    ?.catch((v) => console.error('Error whilst archiving note: %O', v));
            }
        }, [close, data, archiveNote]);

        const doUnarchived = useCallback(() => {
            close();
            if (data?.id) {
                unarchiveNote(data.id)
                    ?.catch((v) => console.error('Error whilst unarchiving note: %O', v));
            }
        }, [close, data, unarchiveNote]);

        const doStarred = useCallback(() => {
            close();
            if (data?.id) {
                starNote(data.id)
                    ?.catch((v) => console.error('Error whilst starring note: %O', v));
            }
        }, [close, data, starNote]);

        const doUnstarred = useCallback(() => {
            close();
            if (data?.id) {
                unstarNote(data.id)
                    ?.catch((v) => console.error('Error whilst unstarring note: %O', v));
            }
        }, [close, data, unstarNote]);

        const switchEditorWidth = useCallback(() => {
            close();
            if (data?.id) {
                const resolvedNoteWidth =
                    data.editorsize ?? settings.editorsize;
                const editorSizesCount = Object.values(EDITOR_SIZE).length / 2; // contains both string & int values

                mutateNote(data.id, {
                    editorsize: (resolvedNoteWidth + 1) % editorSizesCount,
                })
                    .catch((v) => console.error('Error whilst mutating note (editor width): %O', v));
            }
        }, [close, data, mutateNote, settings.editorsize]);

        const doExportMd = useCallback(async () => {
            close();
            if (data?.id) {
                try {
                    const note = await noteCache.getItem(data.id);
                    if (!note) {
                        console.error('Note not found in cache');
                        return;
                    }

                    const title = note.title || 'Untitled';
                    let content = note.content || '';
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
                    const blob = new Blob([fullMarkdown], { type: 'text/markdown;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${title}.md`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                } catch (e) {
                    console.error('Error exporting MD:', e);
                }
            }
        }, [close, data]);

        const MENU_HANDLER = useMemo(
            () => ({
                [MENU_HANDLER_NAME.REMOVE_NOTE]: doRemoveNote,
                [MENU_HANDLER_NAME.COPY_LINK]: doCopyLink,
                [MENU_HANDLER_NAME.ADD_TO_ARCHIVE]: doArchived,
                [MENU_HANDLER_NAME.REMOVE_FROM_ARCHIVE]: doUnarchived,
                [MENU_HANDLER_NAME.ADD_TO_STAR]: doStarred,
                [MENU_HANDLER_NAME.REMOVE_FROM_STAR]: doUnstarred,
                [MENU_HANDLER_NAME.SWITCH_EDITOR_WIDTH]: switchEditorWidth,
                [MENU_HANDLER_NAME.EXPORT_MD]: doExportMd,
            }),
            [doCopyLink, doRemoveNote, doArchived, doUnarchived, doStarred, doUnstarred, switchEditorWidth, doExportMd]
        );

        return (
            <MenuItem ref={ref} onClick={MENU_HANDLER[item.handler]}>
                <span className="text-xs w-4 mr-2">{item.icon}</span>
                <span className="text-xs">{item.text}</span>
            </MenuItem>
        );
    }
);

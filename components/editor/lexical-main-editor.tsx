/**
 * Lexical Main Editor Component
 * Migrated from TipTap to Lexical
 */

import EditTitle from './edit-title';
import LexicalEditor, { LexicalEditorProps } from './lexical-editor';
import Backlinks from './backlinks';
import UIState from 'libs/web/state/ui';
import { FC } from 'react';
import { NoteModel } from 'libs/shared/note';
import { EDITOR_SIZE } from 'libs/shared/meta';
import LexicalEditorState from 'libs/web/state/lexical-editor';

const LexicalMainEditor: FC<
    LexicalEditorProps & {
        note?: NoteModel;
        isPreview?: boolean;
        className?: string;
    }
> = ({ className, note, isPreview, ...props }) => {
    const {
        settings: { settings },
    } = UIState.useContainer();

    const {
        onSearchLink,
        onCreateLink,
        onClickLink,
        onHoverLink,
        onEditorChange,
        editorEl,
        note: editorNote,
    } = LexicalEditorState.useContainer();

    const currentEditorSize = note?.editorsize ?? settings.editorsize;

    let editorWidthClass: string;
    switch (currentEditorSize) {
        case EDITOR_SIZE.SMALL:
            editorWidthClass = 'max-w-400';
            break;
        case EDITOR_SIZE.LARGE:
            editorWidthClass = 'max-w-4xl';
            break;
        case EDITOR_SIZE.FULL:
            editorWidthClass = 'max-w-full mx-4';
            break;
        default:
            editorWidthClass = 'max-w-400';
            break;
    }

    const articleClassName =
        className || `pt-16 md:pt-40 px-6 m-auto h-full ${editorWidthClass}`;

    return (
        <article className={articleClassName}>
            <EditTitle readOnly={props.readOnly} />
            <LexicalEditor
                ref={editorEl}
                value={editorNote?.content}
                onChange={onEditorChange}
                onCreateLink={onCreateLink}
                onSearchLink={onSearchLink}
                onClickLink={onClickLink}
                onHoverLink={onHoverLink}
                isPreview={isPreview}
                className="px-4 md:px-0"
                noteId={editorNote?.id}
                {...(props as any)}
            />
            {!isPreview && <Backlinks />}
        </article>
    );
};

export default LexicalMainEditor;

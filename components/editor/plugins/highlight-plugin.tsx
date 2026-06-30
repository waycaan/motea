/**
 * Highlight Plugin for Lexical
 * Provides text highlighting functionality
 */

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
    $getSelection,
    $isRangeSelection,
    COMMAND_PRIORITY_LOW,
    createCommand,
    LexicalCommand,
} from 'lexical';
import { useEffect } from 'react';

export const TOGGLE_HIGHLIGHT_COMMAND: LexicalCommand<string | undefined> = createCommand(
    'TOGGLE_HIGHLIGHT_COMMAND',
);

export default function HighlightPlugin(): null {
    const [editor] = useLexicalComposerContext();

    useEffect(() => {
        const removeToggleHighlightCommand = editor.registerCommand(
            TOGGLE_HIGHLIGHT_COMMAND,
            (_color = '#ffeb3b') => {
                const selection = $getSelection();
                if ($isRangeSelection(selection)) {
                    // 使用Lexical内置的highlight格式，这样就能与HIGHLIGHT转换器兼容
                    if (selection.hasFormat('highlight')) {
                        // 移除高亮
                        selection.formatText('highlight');
                    } else {
                        // 添加高亮
                        selection.formatText('highlight');
                    }
                }
                return true;
            },
            COMMAND_PRIORITY_LOW,
        );

        return () => {
            removeToggleHighlightCommand();
        };
    }, [editor]);

    return null;
}

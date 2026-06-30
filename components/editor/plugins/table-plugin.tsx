/**
 * Table Plugin for Lexical
 * Provides table functionality with custom row/column configuration
 */

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { TablePlugin as LexicalTablePlugin } from '@lexical/react/LexicalTablePlugin';
import { useEffect } from 'react';
import {
    COMMAND_PRIORITY_EDITOR,
    createCommand,
    LexicalCommand,
    $getSelection,
    $isRangeSelection,
} from 'lexical';
import { $createTableNodeWithDimensions } from '@lexical/table';
import { $insertNodeToNearestRoot } from '@lexical/utils';

// 创建自定义的插入表格命令
export const INSERT_CUSTOM_TABLE_COMMAND: LexicalCommand<{rows: number, columns: number}> = createCommand(
    'INSERT_CUSTOM_TABLE_COMMAND'
);

export default function TablePlugin(): JSX.Element {
    const [editor] = useLexicalComposerContext();

    useEffect(() => {
        return editor.registerCommand(
            INSERT_CUSTOM_TABLE_COMMAND,
            ({ rows, columns }) => {
                editor.update(() => {
                    const selection = $getSelection();
                    if (!$isRangeSelection(selection)) {
                        return;
                    }

                    const tableNode = $createTableNodeWithDimensions(rows, columns, true);
                    $insertNodeToNearestRoot(tableNode);
                });
                return true;
            },
            COMMAND_PRIORITY_EDITOR
        );
    }, [editor]);

    return <LexicalTablePlugin hasCellMerge={true} hasCellBackgroundColor={false} />;
}

/**
 * Code Block Plugin for Lexical
 * Handles code block insertion and formatting
 */

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
    $getSelection,
    $isRangeSelection,
    COMMAND_PRIORITY_LOW,
    createCommand,
    LexicalCommand,
    $createTextNode,
} from 'lexical';
import { $createCodeNode, $isCodeNode } from '@lexical/code';
import { $insertNodeToNearestRoot } from '@lexical/utils';
import { useEffect } from 'react';

export const INSERT_CODE_BLOCK_COMMAND: LexicalCommand<string | undefined> = createCommand(
    'INSERT_CODE_BLOCK_COMMAND',
);

// 检查当前选择是否在代码块中
export function $isSelectionInCodeBlock(): boolean {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) {
        return false;
    }

    const nodes = selection.getNodes();
    if (nodes.length === 0) {
        return false;
    }

    // 检查第一个节点是否在代码块中
    const firstNode = nodes[0];
    let currentNode: any = firstNode;

    // 向上遍历找到父节点
    while (currentNode) {
        if ($isCodeNode(currentNode)) {
            return true;
        }
        currentNode = currentNode.getParent();
    }

    return false;
}

export default function CodeBlockPlugin(): null {
    const [editor] = useLexicalComposerContext();

    useEffect(() => {
        const removeInsertCodeBlockCommand = editor.registerCommand(
            INSERT_CODE_BLOCK_COMMAND,
            (language = '') => {
                const selection = $getSelection();
                if (!$isRangeSelection(selection)) {
                    return false;
                }

                // 获取选中的文本内容，保持原有的换行和格式
                const selectedText = selection.getTextContent();

                if (selectedText.trim() === '') {
                    // 如果没有选中内容，创建一个空的代码块
                    const codeNode = $createCodeNode(language);
                    const textNode = $createTextNode('// Enter your code here');
                    codeNode.append(textNode);
                    $insertNodeToNearestRoot(codeNode);

                    // 选中占位符文本
                    setTimeout(() => {
                        editor.update(() => {
                            textNode.select();
                        });
                    }, 0);
                } else {
                    // 如果有选中内容，将其包装在代码块中
                    const codeNode = $createCodeNode(language);
                    const textNode = $createTextNode(selectedText);
                    codeNode.append(textNode);

                    // 删除原有选择并插入代码块
                    selection.removeText();
                    $insertNodeToNearestRoot(codeNode);
                }

                return true;
            },
            COMMAND_PRIORITY_LOW,
        );

        return () => {
            removeInsertCodeBlockCommand();
        };
    }, [editor]);

    return null;
}

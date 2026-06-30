/**
 * Text Align Plugin for Lexical
 * Provides text alignment functionality (left, center, right, justify)
 */

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useEffect } from 'react';
import {
    $getSelection,
    $isRangeSelection,
    COMMAND_PRIORITY_EDITOR,
    createCommand,
    LexicalCommand,
    ElementFormatType,
    $isParagraphNode,
} from 'lexical';
import { $isHeadingNode } from '@lexical/rich-text';
import { $isListItemNode } from '@lexical/list';

export type TextAlignType = 'left' | 'center' | 'right' | 'justify';

// 将我们的对齐类型转换为Lexical的ElementFormatType
function convertToElementFormat(align: TextAlignType): ElementFormatType {
    switch (align) {
        case 'left':
            return 'left';
        case 'center':
            return 'center';
        case 'right':
            return 'right';
        case 'justify':
            return 'justify';
        default:
            return 'left';
    }
}

// 创建文本对齐命令
export const FORMAT_TEXT_ALIGN_COMMAND: LexicalCommand<TextAlignType> = createCommand(
    'FORMAT_TEXT_ALIGN_COMMAND'
);

// 获取当前选区的文本对齐方式
export function $getTextAlign(): TextAlignType | null {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) {
        return null;
    }

    const nodes = selection.getNodes();
    if (nodes.length === 0) {
        return null;
    }

    // 检查第一个节点的对齐方式
    const firstNode = nodes[0];
    let targetNode: any = firstNode;

    // 如果是文本节点，获取其父节点
    if (targetNode.getType() === 'text') {
        targetNode = targetNode.getParent();
    }

    // 对于段落、标题和列表项节点
    if ($isParagraphNode(targetNode) || $isHeadingNode(targetNode) || $isListItemNode(targetNode)) {
        const format = targetNode.getFormatType();
        return format as TextAlignType;
    }

    return 'left'; // 默认左对齐
}

// 设置文本对齐
export function $setTextAlign(align: TextAlignType): void {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) {
        return;
    }

    const nodes = selection.getNodes();
    if (nodes.length === 0) {
        return;
    }

    const formatType = convertToElementFormat(align);

    // 获取所有需要设置对齐的节点
    const nodesToFormat = new Set();

    for (const node of nodes) {
        let targetNode: any = node;

        // 如果是文本节点，获取其父节点
        if (targetNode.getType() === 'text') {
            targetNode = targetNode.getParent();
        }

        // 如果是列表项或段落/标题节点，添加到格式化列表
        if ($isListItemNode(targetNode) || $isParagraphNode(targetNode) || $isHeadingNode(targetNode)) {
            nodesToFormat.add(targetNode);
        }
    }

    // 应用格式
    for (const node of nodesToFormat) {
        const targetNode = node as any;
        if ($isListItemNode(targetNode) || $isParagraphNode(targetNode) || $isHeadingNode(targetNode)) {
            targetNode.setFormat(formatType);
        }
    }
}

export default function TextAlignPlugin(): null {
    const [editor] = useLexicalComposerContext();

    useEffect(() => {
        return editor.registerCommand(
            FORMAT_TEXT_ALIGN_COMMAND,
            (align: TextAlignType) => {
                editor.update(() => {
                    $setTextAlign(align);
                });
                return true;
            },
            COMMAND_PRIORITY_EDITOR
        );
    }, [editor]);

    return null;
}

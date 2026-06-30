import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useEffect } from 'react';
import {
    $getSelection,
    $isRangeSelection,
    COMMAND_PRIORITY_LOW,
    KEY_SPACE_COMMAND,
    KEY_ENTER_COMMAND,
    $isTextNode,
    $createTextNode,
    LexicalEditor,
} from 'lexical';
import { $isCodeNode } from '@lexical/code';
import { $createHorizontalRuleNode } from '@lexical/react/LexicalHorizontalRuleNode';
import { $createHeadingNode, HeadingTagType } from '@lexical/rich-text';
import { $createQuoteNode } from '@lexical/rich-text';
import { INSERT_UNORDERED_LIST_COMMAND, INSERT_ORDERED_LIST_COMMAND } from '@lexical/list';
import { INSERT_CHECK_LIST_COMMAND } from '@lexical/list';
import { $createImageNode } from '../nodes/image-node';

function $processBlockAtLineEnd(node: import('lexical').TextNode, editor: LexicalEditor): boolean {
    const text = node.getTextContent();
    const trimmed = text.trim();
    const parent = node.getParent();
    if (!parent) return false;

    // 分割线
    if (/^-{3,}$/.test(trimmed) || /^\*{3,}$/.test(trimmed) || /^_{3,}$/.test(trimmed)) {
        const hrNode = $createHorizontalRuleNode();
        node.insertBefore(hrNode);
        node.remove();
        hrNode.selectNext();
        return true;
    }

    // 标题
    const headingMatch = trimmed.match(/^(#{1,6})\s/);
    if (headingMatch) {
        const level = ('h' + headingMatch[1].length) as HeadingTagType;
        const headingNode = $createHeadingNode(level);
        const textContent = trimmed.replace(/^#{1,6}\s+/, '');
        headingNode.append($createTextNode(textContent));
        node.replace(headingNode);
        headingNode.selectEnd();
        return true;
    }

    // 引用
    if (trimmed.startsWith('> ')) {
        const quoteNode = $createQuoteNode();
        const textContent = trimmed.slice(2);
        quoteNode.append($createTextNode(textContent));
        node.replace(quoteNode);
        quoteNode.selectEnd();
        return true;
    }

    // 无序列表
    if (/^[-*+]\s/.test(trimmed)) {
        editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
        node.setTextContent(trimmed.replace(/^[-*+]\s/, ''));
        return true;
    }

    // 有序列表
    if (/^\d+\.\s/.test(trimmed)) {
        editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
        node.setTextContent(trimmed.replace(/^\d+\.\s/, ''));
        return true;
    }

    // 任务列表
    if (/^-\s\[[ x]\]\s/.test(trimmed)) {
        editor.dispatchCommand(INSERT_CHECK_LIST_COMMAND, undefined);
        node.setTextContent(trimmed.replace(/^-\s\[[ x]\]\s/, ''));
        return true;
    }

    // 代码块开始
    if (/^```(\w*)\s*$/.test(trimmed)) {
        const language = trimmed.replace(/^```/, '').trim();
        const { $createCodeNode } = require('@lexical/code');
        const codeNode = $createCodeNode(language);
        const textNode = $createTextNode('');
        node.replace(codeNode);
        codeNode.append(textNode);
        textNode.select();
        return true;
    }

    // 图片 ![alt](url)
    const imageMatch = text.match(/!\[([^\]]*)\]\(([^)]+)\)/);
    if (imageMatch) {
        const [, altText, src] = imageMatch;
        const imageNode = $createImageNode({ altText, src });
        node.replace(imageNode);
        imageNode.selectNext();
        return true;
    }

    return false;
}

export default function InlineMarkdownPlugin(): null {
    const [editor] = useLexicalComposerContext();

    useEffect(() => {
        const handleSpaceOrEnter = (event: KeyboardEvent | null) => {
            if (!event) return false;

            const selection = $getSelection();
            if (!$isRangeSelection(selection)) return false;

            const anchorNode = selection.anchor.getNode();

            if ($isCodeNode(anchorNode)) return false;

            let targetNode = anchorNode;
            if ($isTextNode(anchorNode) && anchorNode.isSimpleText()) {
                targetNode = anchorNode;
            } else {
                return false;
            }

            editor.update(() => {
                const node = targetNode;
                if (!node || !$isTextNode(node)) return;

                $processBlockAtLineEnd(node, editor);
            });

            return false;
        };

        const removeSpace = editor.registerCommand(
            KEY_SPACE_COMMAND,
            handleSpaceOrEnter,
            COMMAND_PRIORITY_LOW,
        );

        const removeEnter = editor.registerCommand(
            KEY_ENTER_COMMAND,
            (event) => {
                return handleSpaceOrEnter(event);
            },
            COMMAND_PRIORITY_LOW,
        );

        return () => {
            removeSpace();
            removeEnter();
        };
    }, [editor]);

    return null;
}

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useEffect } from 'react';
import {
    $getSelection,
    $isRangeSelection,
    $createTextNode,
    $createParagraphNode,
    $createLineBreakNode,
    PASTE_COMMAND,
    COMMAND_PRIORITY_LOW,
    LexicalNode,
} from 'lexical';
import { $isCodeNode, $createCodeNode } from '@lexical/code';
import { $createHeadingNode, HeadingTagType } from '@lexical/rich-text';
import { $createQuoteNode } from '@lexical/rich-text';
import { $createListNode, $createListItemNode } from '@lexical/list';
import { $createTableNode, $createTableRowNode, $createTableCellNode } from '@lexical/table';
import { $createLinkNode } from '@lexical/link';
import { $generateNodesFromDOM } from '@lexical/html';
import { $createImageNode } from '../nodes/image-node';
import { $createHorizontalRuleNode } from '@lexical/react/LexicalHorizontalRuleNode';

function $isCursorInCodeBlock(): boolean {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) return false;

    const anchorNode = selection.anchor.getNode();
    let currentNode: LexicalNode | null = anchorNode;

    while (currentNode) {
        if ($isCodeNode(currentNode)) {
            return true;
        }
        currentNode = currentNode.getParent();
    }

    return false;
}

function $insertPlainText(text: string) {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) return;

    const textNode = $createTextNode(text);
    selection.insertNodes([textNode]);
}

type InlineFormatDef = { open: string; close: string; format: number };

const INLINE_FORMATS: InlineFormatDef[] = [
    { open: '***', close: '***', format: 3 },
    { open: '___', close: '___', format: 3 },
    { open: '**', close: '**', format: 1 },
    { open: '__', close: '__', format: 1 },
    { open: '~~', close: '~~', format: 4 },
    { open: '==', close: '==', format: 32 },
    { open: '<u>', close: '</u>', format: 16 },
    { open: '*', close: '*', format: 2 },
    { open: '_', close: '_', format: 2 },
];

function $createInlineNodes(text: string, baseFormat: number = 0): LexicalNode[] {
    const nodes: LexicalNode[] = [];

    let earliestIdx = -1;
    let earliestFmt: InlineFormatDef | null = null;

    for (const fmt of INLINE_FORMATS) {
        const idx = text.indexOf(fmt.open);
        if (idx !== -1 && (earliestIdx === -1 || idx < earliestIdx)) {
            earliestIdx = idx;
            earliestFmt = fmt;
        }
    }

    if (earliestFmt && earliestIdx !== -1) {
        if (earliestIdx > 0) {
            nodes.push($createTextNode(text.slice(0, earliestIdx)).setFormat(baseFormat));
        }

        const closeIdx = text.indexOf(earliestFmt.close, earliestIdx + earliestFmt.open.length);
        if (closeIdx !== -1) {
            const inner = text.slice(earliestIdx + earliestFmt.open.length, closeIdx);
            nodes.push(...$createInlineNodes(inner, baseFormat | earliestFmt.format));
            const rest = text.slice(closeIdx + earliestFmt.close.length);
            if (rest) nodes.push(...$createInlineNodes(rest, baseFormat));
        } else {
            nodes.push($createTextNode(text.slice(earliestIdx)).setFormat(baseFormat));
        }

        return nodes.length > 0 ? nodes : [$createTextNode(text)];
    }

    const codeMatch = text.match(/^`([^`]+)`/);
    if (codeMatch) {
        nodes.push($createTextNode(codeMatch[1]).setFormat(8));
        const rest = text.slice(codeMatch[0].length);
        if (rest) nodes.push(...$createInlineNodes(rest, baseFormat));
        return nodes.length > 0 ? nodes : [$createTextNode(text)];
    }

    const linkMatch = text.match(/^\[([^\]]*)\]\(([^)]+)\)/);
    if (linkMatch) {
        const [, linkText, url] = linkMatch;
        const linkNode = $createLinkNode(url);
        const textNode = $createTextNode(linkText || url);
        if (baseFormat) textNode.setFormat(baseFormat);
        linkNode.append(textNode);
        nodes.push(linkNode);
        const rest = text.slice(linkMatch[0].length);
        if (rest) nodes.push(...$createInlineNodes(rest, baseFormat));
        return nodes;
    }

    const urlMatch = text.match(/^https?:\/\/[^\s<>"')\]]+/);
    if (urlMatch) {
        const linkNode = $createLinkNode(urlMatch[0]);
        const textNode = $createTextNode(urlMatch[0]).setFormat(8);
        linkNode.append(textNode);
        nodes.push(linkNode);
        const rest = text.slice(urlMatch[0].length);
        if (rest) nodes.push(...$createInlineNodes(rest, baseFormat));
        return nodes;
    }

    const node = $createTextNode(text);
    if (baseFormat) node.setFormat(baseFormat);
    nodes.push(node);
    return nodes;
}

function $parseMarkdownToNodes(text: string): LexicalNode[] {
    const nodes: LexicalNode[] = [];
    const lines = text.split('\n');
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];
        const trimmed = line.trim();

        // Code block - 检测多种格式
        // 格式1: ```语言\n代码\n```
        const codeStartMatch = trimmed.match(/^```(\w*)$/);
        if (codeStartMatch) {
            const language = codeStartMatch[1] || '';
            const codeLines: string[] = [];
            i++;
            while (i < lines.length) {
                const currentLine = lines[i].trim();
                if (/^`{3,}$/.test(currentLine)) {
                    i++;
                    break;
                }
                codeLines.push(lines[i]);
                i++;
            }
            const codeNode = $createCodeNode(language);
            if (codeLines.length > 0) {
                codeNode.append($createTextNode(codeLines[0]));
                for (let j = 1; j < codeLines.length; j++) {
                    codeNode.append($createLineBreakNode());
                    codeNode.append($createTextNode(codeLines[j]));
                }
            } else {
                codeNode.append($createTextNode(''));
            }
            nodes.push(codeNode);
            continue;
        }

        // 格式2: ```代码``` (单行内联代码块)
        const inlineCodeMatch = trimmed.match(/^```(\w*)\s*([\s\S]*?)```$/);
        if (inlineCodeMatch) {
            const language = inlineCodeMatch[1] || '';
            const codeContent = inlineCodeMatch[2] || '';
            const codeNode = $createCodeNode(language);
            codeNode.append($createTextNode(codeContent));
            nodes.push(codeNode);
            i++;
            continue;
        }

        // Table
        if (trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.length > 2) {
            const tableRows: string[][] = [];
            while (i < lines.length) {
                const rowLine = lines[i].trim();
                if (!rowLine.startsWith('|') || !rowLine.endsWith('|')) break;
                // Skip separator row (|---|---|)
                if (/^\|[\s:-]+\|$/.test(rowLine)) {
                    i++;
                    continue;
                }
                const cells = rowLine.split('|').filter(c => c.trim() !== '').map(c => c.trim());
                tableRows.push(cells);
                i++;
            }
            if (tableRows.length > 0) {
                const tableNode = $createTableNode();
                const cols = Math.max(...tableRows.map(r => r.length));

                tableRows.forEach((row, rowIndex) => {
                    const rowNode = $createTableRowNode();
                    for (let c = 0; c < cols; c++) {
                        const cellNode = $createTableCellNode(rowIndex === 0 ? 1 : 0);
                        const cellText = row[c] || '';
                        const cellNodes = $createInlineNodes(cellText);
                        cellNodes.forEach(n => cellNode.append(n));
                        rowNode.append(cellNode);
                    }
                    tableNode.append(rowNode);
                });
                nodes.push(tableNode);
            }
            continue;
        }

        // Heading
        const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)/);
        if (headingMatch) {
            const level = ('h' + headingMatch[1].length) as HeadingTagType;
            const headingNode = $createHeadingNode(level);
            const textNodes = $createInlineNodes(headingMatch[2]);
            textNodes.forEach(n => headingNode.append(n));
            nodes.push(headingNode);
            i++;
            continue;
        }

        // Quote
        if (trimmed.startsWith('> ')) {
            const quoteNode = $createQuoteNode();
            const textNodes = $createInlineNodes(trimmed.slice(2));
            textNodes.forEach(n => quoteNode.append(n));
            nodes.push(quoteNode);
            i++;
            continue;
        }

        // Check list (task list)
        if (/^-\s\[[ x]\]\s/.test(trimmed)) {
            const listNode = $createListNode('check');
            while (i < lines.length && /^-\s\[[ x]\]\s/.test(lines[i].trim())) {
                const match = lines[i].trim().match(/^-\s\[([ x])\]\s(.*)/);
                if (match) {
                    const listItem = $createListItemNode(match[1] === 'x');
                    const textNodes = $createInlineNodes(match[2]);
                    textNodes.forEach(n => listItem.append(n));
                    listNode.append(listItem);
                }
                i++;
            }
            nodes.push(listNode);
            continue;
        }

        // Unordered list
        if (/^[-*+]\s/.test(trimmed)) {
            const listNode = $createListNode('bullet');
            while (i < lines.length && /^[-*+]\s/.test(lines[i].trim())) {
                const listItem = $createListItemNode();
                const textNodes = $createInlineNodes(lines[i].trim().replace(/^[-*+]\s/, ''));
                textNodes.forEach(n => listItem.append(n));
                listNode.append(listItem);
                i++;
            }
            nodes.push(listNode);
            continue;
        }

        // Ordered list
        if (/^\d+\.\s/.test(trimmed)) {
            const listNode = $createListNode('number');
            while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
                const listItem = $createListItemNode();
                const textNodes = $createInlineNodes(lines[i].trim().replace(/^\d+\.\s/, ''));
                textNodes.forEach(n => listItem.append(n));
                listNode.append(listItem);
                i++;
            }
            nodes.push(listNode);
            continue;
        }

        // Horizontal rule
        if (/^[-*_]{3,}$/.test(trimmed) && trimmed.length >= 3) {
            nodes.push($createHorizontalRuleNode());
            i++;
            continue;
        }

        // Empty line
        if (trimmed === '') {
            nodes.push($createParagraphNode());
            i++;
            continue;
        }

        // Image ![alt](url)
        const imageMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
        if (imageMatch) {
            const [, altText, src] = imageMatch;
            nodes.push($createImageNode({ altText, src }));
            i++;
            continue;
        }

        // Regular paragraph with inline formatting
        const paragraph = $createParagraphNode();
        const textNodes = $createInlineNodes(line);
        textNodes.forEach(n => paragraph.append(n));
        nodes.push(paragraph);
        i++;
    }

    return nodes;
}

function $hasMarkdownSyntax(text: string): boolean {
    const lines = text.split('\n');
    let codeFenceCount = 0;

    for (const line of lines) {
        const trimmed = line.trim();
        // 检测代码块围栏
        if (/^```(\w*)$/.test(trimmed)) codeFenceCount++;
        if (/^```(\w*)\s*[\s\S]*```$/.test(trimmed)) return true; // 单行内联代码块
        if (/^#{1,6}\s/.test(trimmed)) return true;
        if (/^[-*+]\s/.test(trimmed)) return true;
        if (/^\d+\.\s/.test(trimmed)) return true;
        if (trimmed.startsWith('> ')) return true;
        if (trimmed.startsWith('|') && trimmed.endsWith('|')) return true;
        if (/^[-*_]{3,}$/.test(trimmed)) return true;
        if (/\*\*[^*]+\*\*/.test(trimmed)) return true;
        if (/__[^_]+__/.test(trimmed)) return true;
        if (/!\[[^\]]*\]\([^)]+\)/.test(trimmed)) return true;
        if (/\[[^\]]+\]\([^)]+\)/.test(trimmed)) return true;
    }

    // 代码块需要偶数个围栏
    if (codeFenceCount >= 2 && codeFenceCount % 2 === 0) return true;

    return false;
}

export default function MarkdownPastePlugin(): null {
    const [editor] = useLexicalComposerContext();

    useEffect(() => {
        return editor.registerCommand(
            PASTE_COMMAND,
            (event: ClipboardEvent) => {
                const clipboardData = event.clipboardData;
                if (!clipboardData) return false;

                const text = clipboardData.getData('text/plain');
                const html = clipboardData.getData('text/html');

                // If cursor is in code block, only paste plain text
                let inCodeBlock = false;
                editor.getEditorState().read(() => {
                    inCodeBlock = $isCursorInCodeBlock();
                });

                if (inCodeBlock) {
                    if (text) {
                        event.preventDefault();
                        editor.update(() => {
                            $insertPlainText(text);
                        });
                        return true;
                    }
                    return false;
                }

                // Priority 1: Parse HTML if available (preserves formatting from other editors)
                if (html) {
                    try {
                        const doc = new DOMParser().parseFromString(html, 'text/html');
                        const htmlNodes = $generateNodesFromDOM(editor, doc);
                        if (htmlNodes.length > 0) {
                            event.preventDefault();
                            editor.update(() => {
                                const selection = $getSelection();
                                if ($isRangeSelection(selection)) {
                                    selection.insertNodes(htmlNodes);
                                }
                            });
                            return true;
                        }
                    } catch {
                        // Fall through to markdown parsing
                    }
                }

                // Priority 2: Parse markdown syntax
                if (text && $hasMarkdownSyntax(text)) {
                    event.preventDefault();
                    editor.update(() => {
                        const nodes = $parseMarkdownToNodes(text);
                        const selection = $getSelection();
                        if ($isRangeSelection(selection) && nodes.length > 0) {
                            selection.insertNodes(nodes);
                        }
                    });
                    return true;
                }

                // Priority 3: Let browser handle regular text
                return false;
            },
            COMMAND_PRIORITY_LOW,
        );
    }, [editor]);

    return null;
}

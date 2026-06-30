import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useEffect } from 'react';
import { $getRoot } from 'lexical';
import { $isHeadingNode, HeadingTagType } from '@lexical/rich-text';
import type { LexicalEditor } from 'lexical';

export interface OutlineItem {
    tag: HeadingTagType;
    text: string;
    key: string;
}

let outlineListener: ((headings: OutlineItem[]) => void) | null = null;
let editorInstance: LexicalEditor | null = null;

export function setOutlineListener(fn: ((headings: OutlineItem[]) => void) | null) {
    outlineListener = fn;
}

export function getEditorInstance(): LexicalEditor | null {
    return editorInstance;
}

function extractHeadings(editor: LexicalEditor): OutlineItem[] {
    const items: OutlineItem[] = [];
    editor.read(() => {
        const root = $getRoot();
        const walk = (nodes: any[]) => {
            for (const node of nodes) {
                if ($isHeadingNode(node)) {
                    items.push({
                        tag: node.getTag(),
                        text: node.getTextContent(),
                        key: node.getKey(),
                    });
                }
                if (node.getChildren) {
                    walk(node.getChildren());
                }
            }
        };
        walk(root.getChildren());
    });
    return items;
}

export function OutlineExtractor() {
    const [editor] = useLexicalComposerContext();

    useEffect(() => {
        editorInstance = editor;
        outlineListener?.(extractHeadings(editor));
        return () => {
            editorInstance = null;
        };
    }, [editor]);

    useEffect(() => {
        return editor.registerUpdateListener(() => {
            outlineListener?.(extractHeadings(editor));
        });
    }, [editor]);

    return null;
}

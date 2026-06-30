import { useState, useEffect, useCallback } from 'react';
import { OutlineItem, setOutlineListener, getEditorInstance } from './outline-extractor';
import { HeadingTagType } from '@lexical/rich-text';
import { $getRoot } from 'lexical';
import { $isHeadingNode } from '@lexical/rich-text';

export default function OutlinePanel({ onClose }: { onClose: () => void }) {
    const [headings, setHeadings] = useState<OutlineItem[]>([]);

    useEffect(() => {
        setOutlineListener(setHeadings);
        const editor = getEditorInstance();
        if (editor) {
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
            setHeadings(items);
        }
        return () => setOutlineListener(null);
    }, []);

    const scrollToNode = useCallback((key: string) => {
        const editor = getEditorInstance();
        if (editor) {
            const domElement = editor.getElementByKey(key);
            if (domElement) {
                domElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
    }, []);

    const indentClass = (tag: HeadingTagType) => {
        switch (tag) {
            case 'h1': return 'pl-2 font-bold text-sm';
            case 'h2': return 'pl-5 font-semibold text-sm';
            case 'h3': return 'pl-8 text-xs';
            case 'h4': return 'pl-11 text-xs';
            case 'h5': return 'pl-14 text-xs';
            case 'h6': return 'pl-17 text-xs';
            default: return 'pl-2';
        }
    };

    return (
        <div className="flex flex-col h-full">
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-300">
                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                    Outline
                </span>
                <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-700 text-xs"
                >
                    ✕
                </button>
            </div>
            <div className="flex-1 overflow-y-auto py-2">
                {headings.length === 0 ? (
                    <div className="px-3 text-xs text-gray-400">
                        No headings found
                    </div>
                ) : (
                    headings.map((item) => (
                        <div
                            key={item.key}
                            className={`px-3 py-1 cursor-pointer text-gray-600 hover:bg-gray-300 hover:text-gray-900 truncate rounded-sm mx-1 ${indentClass(item.tag)}`}
                            onClick={() => scrollToNode(item.key)}
                            title={item.text}
                        >
                            {item.text}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

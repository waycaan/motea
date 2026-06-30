/**
 * Highlight Node for Lexical
 * Implements text highlighting functionality similar to TipTap's Highlight
 */

import {
    $applyNodeReplacement,
    DOMConversionMap,
    DOMConversionOutput,
    DOMExportOutput,
    EditorConfig,
    LexicalNode,
    NodeKey,
    SerializedTextNode,
    Spread,
    TextNode,
} from 'lexical';

export type SerializedHighlightNode = Spread<
    {
        highlightColor?: string;
    },
    SerializedTextNode
>;

export class HighlightNode extends TextNode {
    __highlightColor: string;

    static getType(): string {
        return 'highlight';
    }

    static clone(node: HighlightNode): HighlightNode {
        return new HighlightNode(
            node.__text,
            node.__highlightColor,
            node.__key,
        );
    }

    constructor(text: string, highlightColor?: string, key?: NodeKey) {
        super(text, key);
        this.__highlightColor = highlightColor || '#ffeb3b';
    }

    createDOM(config: EditorConfig): HTMLElement {
        const element = super.createDOM(config);
        element.className = 'lexical-highlight';
        // 不再直接设置style，让CSS主题样式生效
        return element;
    }

    updateDOM(
        prevNode: HighlightNode,
        dom: HTMLElement,
        config: EditorConfig,
    ): boolean {
        const updated = super.updateDOM(prevNode as this, dom, config);
        if (prevNode.__highlightColor !== this.__highlightColor) {
            dom.style.backgroundColor = this.__highlightColor;
        }
        return updated;
    }

    static importDOM(): DOMConversionMap | null {
        return {
            mark: (_node: Node) => ({
                conversion: convertHighlightElement,
                priority: 1,
            }),
            span: (node: Node) => {
                const element = node as HTMLElement;
                if (element.style.backgroundColor) {
                    return {
                        conversion: convertHighlightElement,
                        priority: 1,
                    };
                }
                return null;
            },
        };
    }

    static importJSON(serializedNode: SerializedHighlightNode): HighlightNode {
        const node = $createHighlightNode(
            serializedNode.text,
            serializedNode.highlightColor,
        );
        node.setFormat(serializedNode.format);
        node.setDetail(serializedNode.detail);
        node.setMode(serializedNode.mode);
        node.setStyle(serializedNode.style);
        return node;
    }

    exportJSON(): SerializedHighlightNode {
        return {
            ...super.exportJSON(),
            highlightColor: this.getHighlightColor(),
            type: 'highlight',
            version: 1,
        };
    }

    exportDOM(): DOMExportOutput {
        const element = this.createDOM({} as EditorConfig);
        return { element };
    }

    getHighlightColor(): string {
        return this.__highlightColor;
    }

    setHighlightColor(highlightColor: string): void {
        const writable = this.getWritable();
        writable.__highlightColor = highlightColor;
    }

    hasFormat(type: string): boolean {
        if (type === 'highlight') {
            return true;
        }
        return super.hasFormat(type as any);
    }
}

function convertHighlightElement(element: HTMLElement): DOMConversionOutput {
    const backgroundColor = element.style.backgroundColor || '#ffeb3b';
    const node = $createHighlightNode(element.textContent || '', backgroundColor);
    return { node };
}

export function $createHighlightNode(
    text: string,
    highlightColor?: string,
): HighlightNode {
    return $applyNodeReplacement(new HighlightNode(text, highlightColor));
}

export function $isHighlightNode(
    node: LexicalNode | null | undefined,
): node is HighlightNode {
    return node instanceof HighlightNode;
}

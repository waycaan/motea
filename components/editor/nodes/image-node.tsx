/**
 * Image Node for Lexical
 * Supports Markdown syntax ![alt](url) and direct image insertion
 */

import {
    $applyNodeReplacement,
    DOMConversionMap,
    DOMConversionOutput,
    DOMExportOutput,
    DecoratorNode,
    EditorConfig,
    LexicalNode,
    NodeKey,
    SerializedLexicalNode,
    Spread,
} from 'lexical';
import { Suspense, useCallback } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getNodeByKey } from 'lexical';

export interface ImagePayload {
    altText: string;
    height?: number;
    key?: NodeKey;
    maxWidth?: number;
    src: string;
    width?: number;
}

export type SerializedImageNode = Spread<
    {
        altText: string;
        height?: number;
        maxWidth?: number;
        src: string;
        width?: number;
    },
    SerializedLexicalNode
>;

function ImageComponent({
    src,
    altText,
    width,
    height,
    maxWidth,
    nodeKey,
}: {
    altText: string;
    height?: number;
    maxWidth?: number;
    nodeKey: string;
    src: string;
    width?: number;
}) {
    const [editor] = useLexicalComposerContext();

    const handleSrcChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const newSrc = e.target.value;
            editor.update(() => {
                const node = $getNodeByKey(nodeKey);
                if (node && 'setSrc' in node) {
                    (node as any).setSrc(newSrc);
                }
            });
        },
        [editor, nodeKey]
    );

    return (
        <div className="my-4">
            <input
                type="text"
                value={src}
                onChange={handleSrcChange}
                className="w-full text-xs text-gray-400 bg-transparent border border-transparent hover:border-gray-300 focus:border-blue-400 focus:outline-none rounded px-1 py-0.5 mb-1 truncate"
                title="点击修改图片链接"
            />
            <img
                src={src}
                alt={altText}
                style={{
                    height,
                    maxWidth: maxWidth || '100%',
                    width,
                }}
                className="max-w-full h-auto rounded-lg"
                draggable="false"
            />
        </div>
    );
}

export class ImageNode extends DecoratorNode<JSX.Element> {
    __src: string;
    __altText: string;
    __width?: number;
    __height?: number;
    __maxWidth?: number;

    static getType(): string {
        return 'image';
    }

    static clone(node: ImageNode): ImageNode {
        return new ImageNode(
            node.__src,
            node.__altText,
            node.__maxWidth,
            node.__width,
            node.__height,
            node.__key,
        );
    }

    static importJSON(serializedNode: SerializedImageNode): ImageNode {
        const { altText, height, width, maxWidth, src } = serializedNode;
        const node = $createImageNode({
            altText,
            height,
            maxWidth,
            src,
            width,
        });
        return node;
    }

    exportJSON(): SerializedImageNode {
        return {
            altText: this.getAltText(),
            height: this.__height,
            maxWidth: this.__maxWidth,
            src: this.getSrc(),
            type: 'image',
            version: 1,
            width: this.__width,
        };
    }

    constructor(
        src: string,
        altText: string,
        maxWidth?: number,
        width?: number,
        height?: number,
        key?: NodeKey,
    ) {
        super(key);
        this.__src = src;
        this.__altText = altText;
        this.__maxWidth = maxWidth;
        this.__width = width;
        this.__height = height;
    }

    exportDOM(): DOMExportOutput {
        const element = document.createElement('img');
        element.setAttribute('src', this.__src);
        element.setAttribute('alt', this.__altText);
        if (this.__width) {
            element.setAttribute('width', this.__width.toString());
        }
        if (this.__height) {
            element.setAttribute('height', this.__height.toString());
        }
        element.className = 'max-w-full h-auto rounded-lg my-4';
        return { element };
    }

    static importDOM(): DOMConversionMap | null {
        return {
            img: (_node: Node) => ({
                conversion: convertImageElement,
                priority: 0,
            }),
        };
    }

    createDOM(config: EditorConfig): HTMLElement {
        const span = document.createElement('span');
        const theme = config.theme;
        const className = theme.image;
        if (className !== undefined) {
            span.className = className;
        }
        return span;
    }

    updateDOM(): false {
        return false;
    }

    getSrc(): string {
        return this.__src;
    }

    getAltText(): string {
        return this.__altText;
    }

    setAltText(altText: string): void {
        const writable = this.getWritable();
        writable.__altText = altText;
    }

    setSrc(src: string): void {
        const writable = this.getWritable();
        writable.__src = src;
    }

    setWidthAndHeight(width: number, height: number): void {
        const writable = this.getWritable();
        writable.__width = width;
        writable.__height = height;
    }

    decorate(): JSX.Element {
        return (
            <Suspense fallback={null}>
                <ImageComponent
                    src={this.__src}
                    altText={this.__altText}
                    width={this.__width}
                    height={this.__height}
                    maxWidth={this.__maxWidth}
                    nodeKey={this.__key}
                />
            </Suspense>
        );
    }
}

function convertImageElement(domNode: Node): null | DOMConversionOutput {
    if (domNode instanceof HTMLImageElement) {
        const { alt: altText, src } = domNode;
        const node = $createImageNode({ altText, src });
        return { node };
    }
    return null;
}

export function $createImageNode({
    altText,
    height,
    maxWidth = 500,
    src,
    width,
    key,
}: ImagePayload): ImageNode {
    return $applyNodeReplacement(
        new ImageNode(src, altText, maxWidth, width, height, key),
    );
}

export function $isImageNode(
    node: LexicalNode | null | undefined,
): node is ImageNode {
    return node instanceof ImageNode;
}

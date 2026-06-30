/**
 * Lexical Markdown 处理器
 * 专门用于Lexical编辑器的markdown处理
 * Lexical编辑器直接处理markdown格式，不需要转换为HTML
 */
class LexicalMarkdownProcessor {

    /**
     * 对于Lexical编辑器，我们不需要将markdown转换为HTML
     * Lexical有自己的markdown解析器($convertFromMarkdownString)
     * 这个方法现在只是简单地返回清理后的markdown
     */
    processMarkdown(markdown: string): string {
        if (!markdown || markdown.trim() === '') {
            return '';
        }

        try {
            // 清理和标准化markdown内容
            let cleanMarkdown = markdown;

            // 1. 标准化换行符
            cleanMarkdown = cleanMarkdown.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

            // 2. 清理开头和结尾的空白，但保留内容中的空行
            cleanMarkdown = cleanMarkdown.trim();

            // 3. 确保checkbox格式正确
            cleanMarkdown = cleanMarkdown.replace(/^(\s*)-\s*\[\s*\]\s*/gm, '$1- [ ] ');
            cleanMarkdown = cleanMarkdown.replace(/^(\s*)-\s*\[x\]\s*/gm, '$1- [x] ');

            return cleanMarkdown;
        } catch (error) {
            console.error('Error processing markdown:', error);
            return markdown; // 如果处理失败，返回原始内容
        }
    }

    /**
     * 检查内容是否看起来像 markdown
     */
    isMarkdownContent(content: string): boolean {
        if (!content || content.trim() === '') {
            return false;
        }

        // 检查常见的 markdown 语法
        const markdownPatterns = [
            /^#{1,6}\s+/m,           // 标题 # ## ###
            /^\*\s+/m,               // 无序列表 *
            /^-\s+/m,                // 无序列表 -
            /^\d+\.\s+/m,            // 有序列表 1.
            /^-\s+\[[ x]\]\s+/m,     // checkbox列表 - [ ] 或 - [x]
            /```[\s\S]*?```/,        // 代码块
            /`[^`]+`/,               // 行内代码
            /\*\*[^*]+\*\*/,         // 粗体
            /\*[^*]+\*/,             // 斜体
            /\[[^\]]+\]\([^)]+\)/,   // 链接
            /!\[[^\]]*\]\([^)]+\)/,  // 图片
            /^>\s+/m,                // 引用
            /^\|.*\|$/m,             // 表格
            /^---+$/m,               // 分隔线
        ];

        return markdownPatterns.some(pattern => pattern.test(content));
    }

    /**
     * 创建与主编辑器相同的转换器配置
     */
    private async createEditorTransformers() {
        // 动态导入所有需要的模块
        const {
            TRANSFORMERS,
            CHECK_LIST,
        } = await import('@lexical/markdown');

        const { $isImageNode, ImageNode } = await import('components/editor/nodes/image-node');
        const { $isHorizontalRuleNode, HorizontalRuleNode } = await import('@lexical/react/LexicalHorizontalRuleNode');
        const { $isTableNode, $isTableRowNode, $isTableCellNode, $createTableNode, $createTableRowNode, $createTableCellNode, TableNode, TableRowNode, TableCellNode } = await import('@lexical/table');

        // 创建自定义转换器（与主编辑器相同）
        const { $createImageNode: createImage } = await import('components/editor/nodes/image-node');

        const IMAGE_TRANSFORMER = {
            dependencies: [ImageNode],
            export: (node: any) => {
                if (!$isImageNode(node)) {
                    return null;
                }
                return `![${node.getAltText()}](${node.getSrc()})`;
            },
            regExp: /!\[([^\]]*)\]\(([^)]+)\)/,
            replace: (parentNode: any, children: any, match: any) => {
                const [, altText, src] = match;
                const imageNode = createImage({
                    altText,
                    src,
                    maxWidth: 800,
                });
                children.forEach((child: any) => child.remove());
                parentNode.append(imageNode);
            },
            type: 'element',
        };

        const UNDERLINE_TRANSFORMER = {
            format: ['underline'],
            tag: '<u>',
            type: 'text-format',
        };

        const { $createHorizontalRuleNode: createHR } = await import('@lexical/react/LexicalHorizontalRuleNode');

        const HR_TRANSFORMER = {
            dependencies: [HorizontalRuleNode],
            export: (node: any) => {
                return $isHorizontalRuleNode(node) ? '---' : null;
            },
            regExp: /^(---|\*\*\*|___)\s?$/,
            replace: (parentNode: any, _children: any, _match: any, isImport: any) => {
                const line = createHR();
                if (isImport || parentNode.getNextSibling() != null) {
                    parentNode.replace(line);
                } else {
                    parentNode.insertBefore(line);
                }
                line.selectNext();
            },
            type: 'element',
        };

        const { $createParagraphNode: createParagraph, $createTextNode: createText } = await import('lexical');

        const TABLE_TRANSFORMER = {
            dependencies: [TableNode, TableRowNode, TableCellNode],
            export: (node: any, traverseChildren: any) => {
                if (!$isTableNode(node)) {
                    return null;
                }

                const rows = node.getChildren();
                let markdown = '\n';

                rows.forEach((row, rowIndex) => {
                    if ($isTableRowNode(row)) {
                        const cells = row.getChildren();
                        const cellTexts = cells.map(cell => {
                            if ($isTableCellNode(cell)) {
                                return traverseChildren(cell).trim() || ' ';
                            }
                            return ' ';
                        });

                        markdown += '| ' + cellTexts.join(' | ') + ' |\n';

                        // 添加表头分隔符（第一行后）
                        if (rowIndex === 0) {
                            markdown += '| ' + cellTexts.map(() => '---').join(' | ') + ' |\n';
                        }
                    }
                });

                return markdown + '\n';
            },
            regExp: /^\|(.+)\|$/,
            replace: (parentNode: any, _children: any, match: any, isImport: any) => {
                if (!isImport) return false;

                try {
                    // 简单的表格行处理 - 创建单行表格
                    const cellsText = match[1].split('|').map((cell: string) => cell.trim());

                    // 创建表格节点
                    const tableNode = $createTableNode();
                    const rowNode = $createTableRowNode();

                    cellsText.forEach((cellText: string) => {
                        const cellNode = $createTableCellNode(1);
                        const paragraphNode = createParagraph();
                        const textNode = createText(cellText);
                        paragraphNode.append(textNode);
                        cellNode.append(paragraphNode);
                        rowNode.append(cellNode);
                    });

                    tableNode.append(rowNode);
                    parentNode.append(tableNode);

                    return true;
                } catch (error) {
                    console.error('Table creation error:', error);
                    return false;
                }
            },
            type: 'element',
        };

        // 重新排序transformers，确保CHECK_LIST优先级高于UNORDERED_LIST
        return [
            // 首先放置CHECK_LIST，确保checkbox优先匹配
            CHECK_LIST,
            // 然后是其他TRANSFORMERS（但要排除重复的CHECK_LIST）
            ...TRANSFORMERS.filter(t => t !== CHECK_LIST),
            // 最后是自定义的转换器
            HR_TRANSFORMER,
            UNDERLINE_TRANSFORMER,
            IMAGE_TRANSFORMER,
            TABLE_TRANSFORMER
        ];
    }

    /**
     * 将 markdown 内容转换为 Lexical 编辑器的 JSON 格式
     * 使用临时的 Lexical 编辑器实例进行转换
     */
    async markdownToJSON(markdown: string): Promise<string> {
        if (!markdown || markdown.trim() === '') {
            return this.createEmptyEditorJSON();
        }

        try {
            // 动态导入 Lexical 相关模块
            const { createEditor } = await import('lexical');
            const {
                $convertFromMarkdownString,
            } = await import('@lexical/markdown');
            const { HeadingNode, QuoteNode } = await import('@lexical/rich-text');
            const { ListNode, ListItemNode } = await import('@lexical/list');
            const { CodeNode, CodeHighlightNode } = await import('@lexical/code');
            const { LinkNode, AutoLinkNode } = await import('@lexical/link');
            const { MarkNode } = await import('@lexical/mark');
            const { TableNode, TableCellNode, TableRowNode } = await import('@lexical/table');
            const { HorizontalRuleNode } = await import('@lexical/react/LexicalHorizontalRuleNode');

            // 创建与主编辑器相同的转换器配置
            const COMPLETE_TRANSFORMERS = await this.createEditorTransformers();

            // 动态导入Table相关功能
            const {
                registerTableCellUnmergeTransform,
            } = await import('@lexical/table');

            // 创建临时编辑器实例，包含所有必要的节点
            const tempEditor = createEditor({
                nodes: [
                    HeadingNode,
                    QuoteNode,
                    ListNode,
                    ListItemNode,
                    CodeNode,
                    CodeHighlightNode,
                    LinkNode,
                    AutoLinkNode,
                    MarkNode,
                    TableNode,
                    TableCellNode,
                    TableRowNode,
                    HorizontalRuleNode,
                    // 注意：自定义节点在前端可能需要特殊处理
                ],
                onError: (error) => console.error('Temp editor error:', error),
            });

            // 注册Table相关功能
            registerTableCellUnmergeTransform(tempEditor);

            let jsonResult = '';

            // 在编辑器中执行转换
            await new Promise<void>((resolve) => {
                tempEditor.update(() => {
                    // 清理和标准化markdown内容
                    const cleanMarkdown = this.processMarkdown(markdown);

                    // 将 markdown 转换为 Lexical AST
                    $convertFromMarkdownString(cleanMarkdown, COMPLETE_TRANSFORMERS as any);
                    resolve();
                });
            });

            // 获取编辑器状态的 JSON
            const editorState = tempEditor.getEditorState();
            jsonResult = JSON.stringify(editorState.toJSON());

            return jsonResult;
        } catch (error) {
            console.error('Error converting markdown to JSON:', error);
            // 如果转换失败，返回包含原始内容的简单JSON
            return this.createSimpleTextJSON(markdown);
        }
    }

    /**
     * 创建空的 Lexical 编辑器 JSON 状态
     */
    private createEmptyEditorJSON(): string {
        return JSON.stringify({
            root: {
                children: [
                    {
                        children: [],
                        direction: null,
                        format: "",
                        indent: 0,
                        type: "paragraph",
                        version: 1
                    }
                ],
                direction: null,
                format: "",
                indent: 0,
                type: "root",
                version: 1
            }
        });
    }

    /**
     * 创建包含简单文本的 JSON 状态
     */
    private createSimpleTextJSON(text: string): string {
        return JSON.stringify({
            root: {
                children: [
                    {
                        children: [
                            {
                                detail: 0,
                                format: 0,
                                mode: "normal",
                                style: "",
                                text: text,
                                type: "text",
                                version: 1
                            }
                        ],
                        direction: null,
                        format: "",
                        indent: 0,
                        type: "paragraph",
                        version: 1
                    }
                ],
                direction: null,
                format: "",
                indent: 0,
                type: "root",
                version: 1
            }
        });
    }

    /**
     * 处理导入的内容
     * 前端处理：将markdown转换为JSON格式
     */
    async processImportedContent(content: string): Promise<string> {
        if (this.isMarkdownContent(content)) {

            return await this.markdownToJSON(content);
        } else {

            // 如果不是markdown，创建包含原始内容的JSON
            return this.createSimpleTextJSON(content);
        }
    }

    /**
     * 验证markdown格式
     * 确保常见的markdown语法正确
     */
    validateMarkdown(markdown: string): { isValid: boolean; errors: string[] } {
        const errors: string[] = [];

        // 检查checkbox格式
        const invalidCheckboxes = markdown.match(/^(\s*)-\s*\[[^\sx ]\]/gm);
        if (invalidCheckboxes) {
            errors.push(`Invalid checkbox format found: ${invalidCheckboxes.join(', ')}`);
        }

        // 检查列表格式
        const lines = markdown.split('\n');
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // 检查有序列表格式
            if (/^\s*\d+\.\s/.test(line)) {
                // 有序列表格式有效
            }
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }
}

// 创建单例实例
const lexicalMarkdownProcessor = new LexicalMarkdownProcessor();

export default lexicalMarkdownProcessor;

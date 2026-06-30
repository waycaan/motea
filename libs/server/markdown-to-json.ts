/**
 * 服务器端 Markdown 到 JSON 转换器
 * 用于在导入API中将markdown内容转换为Lexical JSON格式
 */

import { createEditor } from 'lexical';
import { $convertFromMarkdownString, $convertToMarkdownString, TRANSFORMERS } from '@lexical/markdown';
import { $getRoot } from 'lexical';

/**
 * 将 markdown 内容转换为 Lexical 编辑器的 JSON 格式
 */
export async function convertMarkdownToJSON(markdown: string): Promise<string> {
    if (!markdown || markdown.trim() === '') {
        return createEmptyEditorJSON();
    }

    try {
        // 创建临时编辑器实例
        const tempEditor = createEditor({
            nodes: [], // 使用默认节点
            onError: (error) => console.error('Temp editor error:', error),
        });

        let jsonResult = '';

        // 在编辑器中执行转换
        await new Promise<void>((resolve) => {
            tempEditor.update(() => {
                // 清理和标准化markdown内容
                let cleanMarkdown = markdown;
                cleanMarkdown = cleanMarkdown.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
                cleanMarkdown = cleanMarkdown.trim();
                cleanMarkdown = cleanMarkdown.replace(/^(\s*)-\s*\[\s*\]\s*/gm, '$1- [ ] ');
                cleanMarkdown = cleanMarkdown.replace(/^(\s*)-\s*\[x\]\s*/gm, '$1- [x] ');

                // 将 markdown 转换为 Lexical AST
                $convertFromMarkdownString(cleanMarkdown, TRANSFORMERS);
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
        return createSimpleTextJSON(markdown);
    }
}

/**
 * 创建空的 Lexical 编辑器 JSON 状态
 */
function createEmptyEditorJSON(): string {
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
function createSimpleTextJSON(text: string): string {
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
 * 检查内容是否看起来像 markdown
 */
export function isMarkdownContent(content: string): boolean {
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
 * 将 JSON 格式的编辑器状态转换为 Markdown
 */
export async function convertJSONToMarkdown(jsonContent: string): Promise<string> {
    if (!jsonContent || jsonContent.trim() === '') {
        return '';
    }

    try {
        // 检查是否是JSON格式
        const trimmed = jsonContent.trim();
        if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) {
            // 如果不是JSON格式，可能是旧的markdown格式，直接返回
            return jsonContent;
        }

        // 解析JSON
        const editorStateJSON = JSON.parse(jsonContent);

        // 创建临时编辑器实例
        const tempEditor = createEditor({
            nodes: [], // 使用默认节点
            onError: (error) => console.error('Temp editor error:', error),
        });

        let markdownResult = '';

        // 设置编辑器状态并转换为markdown
        const editorState = tempEditor.parseEditorState(editorStateJSON);
        tempEditor.setEditorState(editorState);

        tempEditor.getEditorState().read(() => {
            const root = $getRoot();
            markdownResult = $convertToMarkdownString(TRANSFORMERS, root);
        });

        return markdownResult;
    } catch (error) {
        console.error('Error converting JSON to markdown:', error);
        // 如果转换失败，尝试提取纯文本
        try {
            const editorStateJSON = JSON.parse(jsonContent);
            return extractTextFromJSON(editorStateJSON);
        } catch {
            // 如果JSON解析也失败，返回原始内容
            return jsonContent;
        }
    }
}

/**
 * 从JSON中提取纯文本内容（作为备用方案）
 */
function extractTextFromJSON(json: any): string {
    if (!json || !json.root || !json.root.children) {
        return '';
    }

    let text = '';

    function extractFromNode(node: any): void {
        if (node.type === 'linebreak') {
            text += '\n';
            return;
        }

        if (node.type === 'text' && node.text) {
            text += node.text;
        } else if (node.children && Array.isArray(node.children)) {
            node.children.forEach(extractFromNode);
        }

        // 在段落、标题等块级元素后添加换行
        if (node.type === 'paragraph' || node.type === 'heading') {
            text += '\n\n';
        }
    }

    json.root.children.forEach(extractFromNode);

    return text.trim();
}

/**
 * 处理导入的内容，将markdown转换为JSON格式
 */
export async function processImportedContent(content: string): Promise<string> {
    if (isMarkdownContent(content)) {

        return await convertMarkdownToJSON(content);
    } else {

        // 如果不是markdown，创建包含原始内容的JSON
        return createSimpleTextJSON(content);
    }
}

/**
 * 统一编辑器事件管理器
 * 
 * 设计理念：
 * 1. 单一职责：只处理编辑器内容变化
 * 2. JSON 优先：完全依赖 Lexical 的原生 JSON 格式
 * 3. IME 友好：利用 Lexical 原生 IME 支持，不干预输入过程
 * 4. 性能优化：减少不必要的转换和 DOM 查询
 */

import { EditorState } from 'lexical';
import { NoteModel } from 'libs/shared/note';
import noteCache from 'libs/web/cache/note';
import { setManagedTimeout, clearManagedTimer } from './timer-manager';

export interface EditorChangeEvent {
    jsonContent: string;
    noteId: string;
    timestamp: number;
}

export interface UnifiedEditorManagerOptions {
    debounceDelay?: number;
    debug?: boolean;
    onSave?: (event: EditorChangeEvent) => Promise<void>;
    onError?: (error: Error) => void;
    onHistoryClear?: () => void; // 新增：历史清理回调
}

export class UnifiedEditorManager {
    private lastSavedContent: string = '';
    private noteId: string = '';
    private options: Required<UnifiedEditorManagerOptions>;
    
    constructor(options: UnifiedEditorManagerOptions = {}) {
        this.options = {
            debounceDelay: 300, // 稍微增加延迟，给 IME 更多时间
            debug: false,
            onSave: async () => {},
            onError: (error) => console.error('UnifiedEditorManager Error:', error),
            onHistoryClear: () => {}, // 默认空实现
            ...options
        };
    }

    /**
     * 设置当前笔记 ID
     */
    setNoteId(noteId: string): void {
        this.noteId = noteId;
        this.lastSavedContent = '';
    }

    initializeContent(editorState: EditorState): void {
        this.lastSavedContent = this.extractJSON(editorState);
    }

    /**
     * 主要的编辑器变化处理入口
     * 
     * 关键设计：
     * 1. 信任 Lexical 的 IME 处理 - 不额外检测 composition 状态
     * 2. 使用 tags 来过滤不需要的事件
     * 3. 直接提取 JSON，避免 Markdown 转换
     */
    handleEditorChange(editorState: EditorState, tags: Set<string>): void {
        try {
            if (this.shouldIgnoreEvent(tags)) {
                return;
            }

            const jsonContent = this.extractJSON(editorState);
            
            if (jsonContent === this.lastSavedContent) {
                return;
            }

            this.debouncedSave(jsonContent);

        } catch (error) {
            this.options.onError(error as Error);
        }
    }

    /**
     * 事件过滤逻辑
     * 
     * 重要：不过滤 composition 相关事件，让 Lexical 自己处理 IME
     */
    private shouldIgnoreEvent(tags: Set<string>): boolean {
        // 只过滤明确不需要的事件类型
        const ignoreTags = [
            'history-merge',    // 历史记录合并
            'content-sync',     // 内容同步（从外部加载）
            'selection-change', // 纯选择变化
        ];

        return ignoreTags.some(tag => tags.has(tag));
    }

    /**
     * 直接提取 Lexical 的 JSON 格式
     * 
     * 优势：
     * 1. 保留完整的编辑器状态
     * 2. 避免 Markdown 转换损失
     * 3. 更好的性能
     */
    private extractJSON(editorState: EditorState): string {
        return JSON.stringify(editorState.toJSON());
    }

    /**
     * 防抖保存逻辑
     * 
     * 设计考虑：
     * 1. 不检测 IME 状态 - 信任 Lexical 的处理
     * 2. 使用适中的延迟时间
     * 3. 确保最后一次变化被保存
     */
    private debouncedSave(jsonContent: string): void {
        // 使用统一定时器管理器
        const timerId = `unified-editor-debounce-${this.noteId}`;

        // 清除之前的定时器
        clearManagedTimer(timerId);

        // 设置新的定时器
        setManagedTimeout(timerId, () => {
            this.executeSave(jsonContent);
        }, this.options.debounceDelay);
    }

    /**
     * 执行实际的保存操作
     */
    private async executeSave(jsonContent: string): Promise<void> {
        try {
            if (!this.noteId) {
                return;
            }

            const event: EditorChangeEvent = {
                jsonContent,
                noteId: this.noteId,
                timestamp: Date.now()
            };

            // 调用保存回调
            await this.options.onSave(event);

            // 更新最后保存的内容
            this.lastSavedContent = jsonContent;

        } catch (error) {
            this.options.onError(error as Error);
        }
    }

    /**
     * 立即保存（用于手动保存等场景）
     */
    async forceSave(editorState: EditorState): Promise<void> {
        // 清除防抖定时器
        const timerId = `unified-editor-debounce-${this.noteId}`;
        clearManagedTimer(timerId);

        const jsonContent = this.extractJSON(editorState);
        await this.executeSave(jsonContent);
    }

    /**
     * 清理资源
     */
    destroy(): void {
        // 清理所有相关定时器
        const timerId = `unified-editor-debounce-${this.noteId}`;
        clearManagedTimer(timerId);
    }
}

/**
 * 默认的保存处理器
 * 保存到 IndexedDB 并处理标题提取
 */
export async function createDefaultSaveHandler(
    getCurrentNote: () => NoteModel | undefined
): Promise<(event: EditorChangeEvent) => Promise<void>> {
    
    return async (event: EditorChangeEvent) => {
        const note = getCurrentNote();
        if (!note) return;

        try {
            // 从 JSON 中提取标题（如果需要）
            const title = extractTitleFromJSON(event.jsonContent) || note.title || 'Untitled';

            // 保存到 IndexedDB
            const existingNote = await noteCache.getItem(event.noteId);
            const baseNote = existingNote || note;

            const updatedNote: Partial<NoteModel> = {
                ...baseNote,
                content: event.jsonContent,
                title,
                updated_at: new Date(event.timestamp).toISOString()
            };

            await noteCache.setItem(event.noteId, updatedNote as any);

        } catch (error) {
            console.error('Failed to save note:', error);
            throw error;
        }
    };
}

/**
 * 从 JSON 内容中提取标题
 * 查找第一个 heading 节点作为标题
 */
function extractTitleFromJSON(jsonContent: string): string | null {
    try {
        const editorState = JSON.parse(jsonContent);
        const root = editorState.root;
        
        if (!root || !root.children) return null;

        // 递归查找第一个 heading 节点
        function findFirstHeading(children: any[]): string | null {
            for (const child of children) {
                if (child.type === 'heading' && child.tag === 'h1' && child.children) {
                    // 提取文本内容
                    return extractTextFromChildren(child.children);
                }
                
                if (child.children) {
                    const result = findFirstHeading(child.children);
                    if (result) return result;
                }
            }
            return null;
        }

        function extractTextFromChildren(children: any[]): string {
            return children
                .filter(child => child.type === 'text')
                .map(child => child.text || '')
                .join('')
                .trim();
        }

        return findFirstHeading(root.children);

    } catch (error) {
        console.error('Failed to extract title from JSON:', error);
        return null;
    }
}

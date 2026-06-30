/**
 * Export API
 *
 * Copyright (c) 2025 waycaan
 * Licensed under the MIT License
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 */

import { useAuth } from 'libs/server/middlewares/auth';
import { useStore } from 'libs/server/middlewares/store';
import AdmZip from 'adm-zip';
import { api } from 'libs/server/connect';
import {
    ROOT_ID,
    HierarchicalTreeItemModel,
    TreeModel,
    TreeItemModel,
} from 'libs/shared/tree';
import { NOTE_DELETED, NOTE_STATUS } from 'libs/shared/meta';
import { toBuffer } from 'libs/shared/str';
import { convertHtmlToMarkdown } from 'libs/shared/html-to-markdown';
import { convertLexicalToMarkdown } from 'libs/shared/lexical-to-markdown';
import { StorePostgreSQL } from 'libs/server/store/providers/postgresql';

const STATUS_FOLDERS: Record<number, string> = {
    [NOTE_STATUS.NORMAL]: 'root',
    [NOTE_STATUS.ARCHIVED]: 'archive',
    [NOTE_STATUS.STARRED]: 'star',
};


export function escapeFileName(name: string): string {
    // list of characters taken from https://www.mtu.edu/umc/services/websites/writing/characters-avoid/
    return name.replace(/[#%&{}\\<>*?/$!'":@+`|=]/g, "_");
}

/**
 * Convert Lexical JSON to Markdown
 */
function convertJSONToMarkdown(jsonContent: string): string {
    try {
        return convertLexicalToMarkdown(jsonContent);
    } catch (error) {
        console.error('Error parsing JSON:', error);
        return jsonContent;
    }
}

// 简单的JSON文本提取函数（备用）
function extractTextFromJSON(json: any): string {
    if (!json || !json.root || !json.root.children) {
        return '';
    }

    function extractFromNode(node: any): string {
        if (node.type === 'linebreak') {
            return '\n';
        }

        let text = '';

        if (node.text) {
            text += node.text;
        }

        if (node.children && Array.isArray(node.children)) {
            for (const child of node.children) {
                text += extractFromNode(child);
            }
        }

        // 为段落和标题添加换行
        if (node.type === 'paragraph' || node.type === 'heading') {
            text += '\n';
        }

        return text;
    }

    return extractFromNode(json.root).trim();
}

/**
 * Build tree from notes table for export (all statuses)
 * Returns a map of status -> TreeModel
 */
async function buildExportTrees(store: StorePostgreSQL): Promise<Map<number, TreeModel>> {
    const treesByStatus = new Map<number, TreeModel>();

    for (const status of [NOTE_STATUS.NORMAL, NOTE_STATUS.ARCHIVED, NOTE_STATUS.STARRED]) {
        const notes = await store.getNotesByStatus(status);

        const items: Record<string, TreeItemModel> = {
            [ROOT_ID]: { id: ROOT_ID, children: [] as string[] },
        };
        for (const note of notes) {
            items[note.id] = {
                id: note.id,
                children: [] as string[],
                data: { id: note.id, title: note.title || '' } as any,
            };
        }
        for (const note of notes) {
            const pid = note.parent_id || ROOT_ID;
            if (items[pid]) {
                items[pid].children.push(note.id);
            } else {
                items[ROOT_ID].children.push(note.id);
            }
        }
        treesByStatus.set(status, { rootId: ROOT_ID, items });
    }

    return treesByStatus;
}

/**
 * Convert flat tree to hierarchical structure for export
 */
function makeHierarchy(tree: TreeModel, pid: string): HierarchicalTreeItemModel | null {
    const item = tree.items[pid];
    if (!item) return null;
    return {
        id: item.id,
        title: (item.data as any)?.title || '',
        children: item.children
            .map((childId) => makeHierarchy(tree, childId))
            .filter((h): h is HierarchicalTreeItemModel => h !== null),
    } as HierarchicalTreeItemModel;
}

export default api()
    .use(useAuth)
    .use(useStore)
    .get(async (req, res) => {
        const zip = new AdmZip();
        const store = req.state.store as StorePostgreSQL;
        const treesByStatus = await buildExportTrees(store);
        const duplicate: Record<string, number> = {};

        // Helper function to add items with a specific prefix
        async function addItemWithPrefix(
            item: HierarchicalTreeItemModel,
            statusPrefix: string
        ): Promise<void> {
            let noteData: any = null;
            const storeAny = req.state.store as any;
            if ('getNoteById' in storeAny && typeof storeAny.getNoteById === 'function') {
                noteData = await storeAny.getNoteById(item.id);
            }

            let deleted = 0;
            let title = 'Untitled';
            let content = '';

            if (noteData) {
                deleted = noteData.deleted ?? 0;
                title = noteData.title || 'Untitled';
                content = noteData.content || '';
            } else {
                return;
            }

            if (deleted === NOTE_DELETED.DELETED) {
                return;
            }
            const escapedTitle = escapeFileName(title);
            const basePath = statusPrefix + escapedTitle;
            let uniquePath = basePath;
            if (duplicate[basePath] !== undefined) {
                duplicate[basePath]++;
                uniquePath = `${basePath} (${duplicate[basePath]})`;
            } else {
                duplicate[basePath] = 0;
            }

            let markdownContent = '';
            if (content) {
                const trimmed = content.trim();
                if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
                    try {
                        markdownContent = convertJSONToMarkdown(content);
                    } catch (error) {
                        try {
                            const jsonData = JSON.parse(content);
                            markdownContent = extractTextFromJSON(jsonData);
                        } catch (parseError) {
                            markdownContent = content;
                        }
                    }
                } else {
                    markdownContent = convertHtmlToMarkdown(content);
                }
            }

            zip.addFile(`${uniquePath}.md`, toBuffer(markdownContent));
            await Promise.all(item.children.map((v) => addItemWithPrefix(v, uniquePath + '/')));
        }

        // Export each status group into its own folder
        for (const [status, tree] of treesByStatus) {
            const folderName = STATUS_FOLDERS[status] || 'root';
            const rootItem = makeHierarchy(tree, ROOT_ID);

            if (rootItem && rootItem.children.length > 0) {
                // Clear duplicate tracking for each status folder
                Object.keys(duplicate).forEach(key => delete duplicate[key]);

                await Promise.all(rootItem.children.map(async (v) => {
                    const tempPrefix = `${folderName}/`;
                    await addItemWithPrefix(v, tempPrefix);
                }));
            }
        }

        const now = new Date();
        const timestamp = now.getFullYear().toString() +
            (now.getMonth() + 1).toString().padStart(2, '0') +
            now.getDate().toString().padStart(2, '0') +
            now.getHours().toString().padStart(2, '0') +
            now.getMinutes().toString().padStart(2, '0') +
            now.getSeconds().toString().padStart(2, '0');
        const filename = `motea_${timestamp}.zip`;

        res.setHeader('content-type', 'application/zip');
        res.setHeader('content-disposition', `attachment; filename=${filename}`);
        res.send(zip.toBuffer());
    });

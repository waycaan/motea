/**
 * Import API
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
import { readFileFromRequest } from 'libs/server/file';
import AdmZip from 'adm-zip';
import { api } from 'libs/server/connect';
import { IMPORT_FILE_LIMIT_SIZE } from 'libs/shared/const';
import { extname } from 'path';
import { genId } from 'libs/shared/id';
import { ROOT_ID } from 'libs/shared/tree';
import { createNote } from 'libs/server/note';
import { NoteModel } from 'libs/shared/note';
// parseMarkdownTitle removed - using filename as title instead
import { convertHtmlToMarkdown } from 'libs/shared/html-to-markdown';
import { NOTE_STATUS } from 'libs/shared/meta';

const MARKDOWN_EXT = [
    '.markdown',
    '.mdown',
    '.mkdn',
    '.md',
    '.mkd',
    '.mdwn',
    '.mdtxt',
    '.mdtext',
    '.text',
    '.Rmd',
];

const HTML_EXT = ['.html', '.htm'];

// Status folder mapping for import
const STATUS_FOLDER_MAP: Record<string, number> = {
    'root': NOTE_STATUS.NORMAL,
    'archive': NOTE_STATUS.ARCHIVED,
    'star': NOTE_STATUS.STARRED,
};

/**
 * Detect if content is HTML
 */
function isHtmlContent(content: string): boolean {
    const trimmed = content.trim();
    // Check for common HTML patterns
    if (/^<!DOCTYPE\s+html>/i.test(trimmed)) return true;
    if (/^<html[\s>]/i.test(trimmed)) return true;
    // Check for HTML tags that indicate structured content
    if (/<(div|p|span|h[1-6]|ul|ol|li|table|tr|td|th|pre|code|blockquote|a|img|strong|em|b|i)\b/i.test(trimmed)) {
        // Make sure it's not just markdown with angle brackets
        const htmlTagCount = (trimmed.match(/<(div|p|span|h[1-6]|ul|ol|li|table|tr|td|th|pre|code|blockquote|a|img|strong|em|b|i)\b/gi) || []).length;
        const closingTagCount = (trimmed.match(/<\/(div|p|span|h[1-6]|ul|ol|li|table|tr|td|th|pre|code|blockquote|a|img|strong|em|b|i)>/gi) || []).length;
        // If there are opening and closing tags, it's likely HTML
        if (htmlTagCount >= 2 && closingTagCount >= 1) return true;
    }
    return false;
}

/**
 * Process raw content: detect HTML or Markdown, return cleaned content
 */
function processRawContent(rawContent: string): string {
    const trimmed = rawContent.trim();

    // Empty content
    if (!trimmed) return '';

    // If it's HTML, convert to markdown
    if (isHtmlContent(trimmed)) {
        return convertHtmlToMarkdown(trimmed);
    }

    // Otherwise treat as markdown
    return trimmed;
}

export const config = {
    api: {
        bodyParser: false,
    },
};

export default api()
    .use(useAuth)
    .use(useStore)
    .post(async (req, res) => {
        const pid = (req.query.pid as string) || ROOT_ID;
        const file = await readFileFromRequest(req) as any;

        if (!file || !file.filepath) {
            console.error('File not received or file path is missing');
            return res.status(400).json({ error: 'File not received or invalid file data' });
        }

        if (file.size > IMPORT_FILE_LIMIT_SIZE) {
            return res.APIError.IMPORT_FILE_LIMIT_SIZE.throw();
        }

        const zip = new AdmZip(file.filepath);
        const zipEntries = zip.getEntries();
        const total = zipEntries.length;

        if (total === 0) {
            return res.status(400).json({ error: 'ZIP file is empty' });
        }

        const hasImportableFiles = zipEntries.some(entry => {
            const ext = extname(entry.name).toLowerCase();
            return MARKDOWN_EXT.includes(ext) || HTML_EXT.includes(ext);
        });

        if (!hasImportableFiles) {
            return res.status(400).json({ error: 'No Markdown or HTML files found in ZIP' });
        }

        // Detect if ZIP has status folders (root, archive, star)
        const hasStatusFolders = zipEntries.some(entry => {
            const firstFolder = entry.entryName.split(/[\\/]/)[0];
            return firstFolder in STATUS_FOLDER_MAP;
        });

        type HierarchyNode = {
            name: string;
            entry?: AdmZip.IZipEntry;
            children: Hierarchy;
        };
        type Hierarchy = Record<string, HierarchyNode>;

        const hierachy: Hierarchy = {};
        zipEntries.forEach((v) => {
            let name: string = v.name;
            if (!v.isDirectory) {
                const entryNameExtension = extname(v.name).toLowerCase();
                const isImportable = MARKDOWN_EXT.includes(entryNameExtension) || HTML_EXT.includes(entryNameExtension);
                
                if (isImportable) {
                    name = v.name.substring(
                        0,
                        v.name.length - entryNameExtension.length
                    );
                } else {
                    return;
                }
            }
            const pathParts = v.entryName.split(/[\\/]/).filter(Boolean);

            let currentHierarchy = hierachy;
            let me: HierarchyNode | undefined;
            for (const part of pathParts) {
                if (!currentHierarchy[part]) {
                    currentHierarchy[part] = {
                        name: part,
                        children: {},
                    };
                }
                me = currentHierarchy[part];
                currentHierarchy = me.children;
            }
            if (!me) {
                throw Error('Current hierarchy node is undefined');
            }
            me.name = name;
            me.entry = v;
        });

        let count: number = 0;
        const errors: string[] = [];

        async function createNotes(
            currentNode: HierarchyNode,
            parent?: string,
            status: number = NOTE_STATUS.NORMAL
        ): Promise<string> {
            let date: string | undefined,
                title: string | undefined,
                content: string | undefined;
            if (currentNode.entry) {
                const entry = currentNode.entry;
                date = entry.header.time.toISOString();
                if (!entry.isDirectory) {
                    try {
                        const rawContent = entry.getData().toString('utf-8');
                        const processedContent = processRawContent(rawContent);
                        content = processedContent;
                        title = currentNode.name;
                    } catch (error) {
                        const msg = `Failed to process ${entry.name}: ${(error as Error).message}`;
                        console.error(msg);
                        errors.push(msg);
                        title = currentNode.name;
                        content = '';
                    }
                }
            }
            const note = {
                title: title ?? currentNode.name,
                pid: parent,
                id: genId(),
                date,
                content,
                status,
            } as NoteModel;

            const createdNote = await createNote(note, req.state);
            count++;
            
            await Promise.all(
                Object.values(currentNode.children).map((child) => createNotes(child, createdNote.id, status))
            );

            return createdNote.id;
        }

        try {
            if (hasStatusFolders) {
                // Import with status folder detection
                for (const [folderName, node] of Object.entries(hierachy)) {
                    const status = STATUS_FOLDER_MAP[folderName] ?? NOTE_STATUS.NORMAL;
                    await Promise.all(
                        Object.values(node.children).map((child) => createNotes(child, pid, status))
                    );
                }
            } else {
                // Legacy flat structure - all notes as NORMAL
                await Promise.all(
                    Object.values(hierachy).map((v) => createNotes(v, pid, NOTE_STATUS.NORMAL))
                );
            }
            res.json({ total, imported: count, errors: errors.length > 0 ? errors : undefined });
        } catch (error) {
            console.error('Error importing notes:', error);
            res.status(500).json({ error: (error as Error).message });
        }
    });

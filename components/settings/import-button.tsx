import { ChangeEvent, FC, useCallback, useState } from 'react';
import useI18n from 'libs/web/hooks/use-i18n';
import { ButtonProps } from './type';
import { useToast } from 'libs/web/hooks/use-toast';
import { ButtonProgress } from 'components/button-progress';
import { ROOT_ID } from 'libs/shared/tree';
import NoteState from 'libs/web/state/note';
import NoteTreeState from 'libs/web/state/tree';
import lexicalMarkdownProcessor from 'libs/web/utils/markdown-processor';
import CsrfTokenState from 'libs/web/state/csrf-token';
import { CSRF_HEADER_KEY } from 'libs/shared/const';

const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => resolve(event.target?.result as string);
        reader.onerror = (error) => reject(error);
        reader.readAsText(file);
    });
};

/**
 * Detect if content is HTML
 */
function isHtmlContent(content: string): boolean {
    const trimmed = content.trim();
    if (/^<!DOCTYPE\s+html>/i.test(trimmed)) return true;
    if (/^<html[\s>]/i.test(trimmed)) return true;
    if (/<(div|p|span|h[1-6]|ul|ol|li|table|tr|td|th|pre|code|blockquote|a|img|strong|em|b|i)\b/i.test(trimmed)) {
        const htmlTagCount = (trimmed.match(/<(div|p|span|h[1-6]|ul|ol|li|table|tr|td|th|pre|code|blockquote|a|img|strong|em|b|i)\b/gi) || []).length;
        const closingTagCount = (trimmed.match(/<\/(div|p|span|h[1-6]|ul|ol|li|table|tr|td|th|pre|code|blockquote|a|img|strong|em|b|i)>/gi) || []).length;
        if (htmlTagCount >= 2 && closingTagCount >= 1) return true;
    }
    return false;
}

/**
 * Convert HTML to Markdown (basic conversion)
 */
function convertHtmlToMarkdown(html: string): string {
    let md = html;
    md = md.replace(/<p>(.*?)<\/p>/gi, '$1\n\n');
    md = md.replace(/<h1>(.*?)<\/h1>/gi, '# $1\n\n');
    md = md.replace(/<h2>(.*?)<\/h2>/gi, '## $1\n\n');
    md = md.replace(/<h3>(.*?)<\/h3>/gi, '### $1\n\n');
    md = md.replace(/<h4>(.*?)<\/h4>/gi, '#### $1\n\n');
    md = md.replace(/<h5>(.*?)<\/h5>/gi, '##### $1\n\n');
    md = md.replace(/<h6>(.*?)<\/h6>/gi, '###### $1\n\n');
    md = md.replace(/<br\s*\/?>/gi, '\n');
    md = md.replace(/<hr\s*\/?>/gi, '\n---\n');
    md = md.replace(/<strong>(.*?)<\/strong>/gi, '**$1**');
    md = md.replace(/<b>(.*?)<\/b>/gi, '**$1**');
    md = md.replace(/<em>(.*?)<\/em>/gi, '*$1*');
    md = md.replace(/<i>(.*?)<\/i>/gi, '*$1*');
    md = md.replace(/<del>(.*?)<\/del>/gi, '~~$1~~');
    md = md.replace(/<code>(.*?)<\/code>/gi, '`$1`');
    md = md.replace(/<a href="(.*?)">(.*?)<\/a>/gi, '[$2]($1)');
    md = md.replace(/<img src="(.*?)" alt="(.*?)"\s*\/?>/gi, '![$2]($1)');
    md = md.replace(/<img src="(.*?)"\s*\/?>/gi, '![]($1)');
    md = md.replace(/<ul>(.*?)<\/ul>/gis, (_m, p1) => p1.replace(/<li>(.*?)<\/li>/gi, '- $1\n'));
    md = md.replace(/<ol>(.*?)<\/ol>/gis, (_m, p1) => {
        let i = 1;
        return p1.replace(/<li>(.*?)<\/li>/gi, () => `${i++}. $1\n`);
    });
    md = md.replace(/<blockquote>(.*?)<\/blockquote>/gis, (_m, p1) => {
        return p1.split('\n').map((l: string) => `> ${l}`).join('\n') + '\n\n';
    });
    md = md.replace(/<pre><code(?: class="language-(.*?)")?>(.*?)<\/code><\/pre>/gis, (_m, lang, code) => {
        return '```' + (lang || '') + '\n' + code.trim() + '\n```\n\n';
    });
    md = md.replace(/<[^>]+>/g, '');
    md = md.replace(/\n{3,}/g, '\n\n');
    return md.trim();
}

interface ImportButtonProps extends ButtonProps {
    onProgress?: (progress: { current: number; total: number } | null) => void;
}

export const ImportButton: FC<ImportButtonProps> = ({ parentId = ROOT_ID, onProgress }) => {
    const { t } = useI18n();
    const toast = useToast();
    const { createNote, mutateNote } = NoteState.useContainer();
    const { initTree } = NoteTreeState.useContainer();
    const csrfToken = CsrfTokenState.useContainer();
    const [loading, setLoading] = useState(false);

    const processFiles = useCallback(
        async (files: File[]) => {
            let successCount = 0;
            let errorCount = 0;
            const total = files.length;

            for (let i = 0; i < files.length; i += 5) {
                const batch = files.slice(i, i + 5);
                const batchPromises = batch.map(async (file) => {
                    const fileName = file.name.replace(/\.(md|html|htm)$/, '');
                    const rawContent = await readFileAsText(file);

                    try {
                        const newNote = await createNote({
                            title: fileName,
                            pid: parentId,
                        });

                        if (!newNote || !newNote.id) {
                            throw new Error(`Failed to create note shell for: ${fileName}`);
                        }

                        let content = rawContent;
                        if (isHtmlContent(rawContent)) {
                            content = convertHtmlToMarkdown(rawContent);
                        }

                        const processedContent = await lexicalMarkdownProcessor.processImportedContent(content);
                        await mutateNote(newNote.id, { content: processedContent });
                        successCount++;
                    } catch (e: any) {
                        console.error(`Error importing ${fileName}:`, e.message);
                        errorCount++;
                    }
                });

                await Promise.allSettled(batchPromises);
                onProgress?.({ current: Math.min(i + 5, total), total });

                if (i + 5 < files.length) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }

            return { successCount, errorCount };
        },
        [parentId, createNote, mutateNote]
    );

    const processZipFile = useCallback(
        async (file: File) => {
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch(`/api/import?pid=${parentId}`, {
                method: 'POST',
                body: formData,
                headers: {
                    ...(csrfToken && { [CSRF_HEADER_KEY]: csrfToken }),
                },
            });

            if (!response.ok) {
                const result = await response.json();
                throw new Error(result.error || 'Import failed');
            }

            return await response.json();
        },
        [parentId, csrfToken]
    );

    const onSelectFile = useCallback(
        async (event: ChangeEvent<HTMLInputElement>) => {
            if (!event.target.files?.length) {
                return toast(t('Please select files'), 'error');
            }

            setLoading(true);
            const fileList = Array.from(event.target.files);
            const mdFiles = fileList.filter(f => f.name.endsWith('.md'));
            const htmlFiles = fileList.filter(f => f.name.endsWith('.html') || f.name.endsWith('.htm'));
            const zipFiles = fileList.filter(f => f.name.endsWith('.zip'));

            let successCount = 0;
            let errorCount = 0;

            try {
                const importableFiles = [...mdFiles, ...htmlFiles];
                if (importableFiles.length > 0) {
                    onProgress?.({ current: 0, total: importableFiles.length });
                    const result = await processFiles(importableFiles);
                    successCount += result.successCount;
                    errorCount += result.errorCount;
                }

                for (const zipFile of zipFiles) {
                    try {
                        onProgress?.({ current: 0, total: 1 });
                        const result = await processZipFile(zipFile);
                        successCount += result.imported || 0;
                        if (result.errors) {
                            errorCount += result.errors.length;
                        }
                        onProgress?.({ current: 1, total: 1 });
                    } catch (e: any) {
                        console.error(`Error importing ZIP ${zipFile.name}:`, e.message);
                        errorCount++;
                    }
                }

                if (successCount > 0) {
                    toast(t('Import finished. Successful: {{success}}, Failed: {{failed}}', { success: successCount, failed: errorCount }), 'success');
                    await initTree();
                } else if (errorCount > 0) {
                    toast(t('Import failed'), 'error');
                } else {
                    toast(t('No importable files selected'), 'warning');
                }
            } catch (e: any) {
                toast(t('Import error: {{message}}', { message: e.message }), 'error');
            } finally {
                setLoading(false);
                onProgress?.(null);
                event.target.value = '';
            }
        },
        [processFiles, processZipFile, initTree, t, toast]
    );

    return (
        <label htmlFor="import-button">
            <input
                hidden
                accept=".md,.html,.htm,.zip,text/markdown,text/html,application/zip"
                id="import-button"
                type="file"
                multiple
                onChange={onSelectFile}
            />
            <ButtonProgress loading={loading}>{t('Import')}</ButtonProgress>
        </label>
    );
};
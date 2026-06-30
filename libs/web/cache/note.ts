import { TreeModel } from 'libs/shared/tree';
import { noteCacheInstance, NoteCacheItem } from 'libs/web/cache';
import { isNoteLink, NoteModel } from 'libs/shared/note';
import { NOTE_DELETED } from 'libs/shared/meta';
import { keys, pull } from 'lodash';
import { removeMarkdown } from '../utils/markdown';

/**
 * 🔗 简单的 Markdown 链接提取器
 * 替换 markdown-link-extractor 以避免依赖冲突
 */
function extractMarkdownLinks(content: string): string[] {
    const links: string[] = [];

    // 匹配 [text](url) 格式的链接
    const linkRegex = /\[([^\]]*)\]\(([^)]+)\)/g;
    let match;

    while ((match = linkRegex.exec(content)) !== null) {
        const url = match[2];
        if (url && !url.startsWith('#')) { // 排除锚点链接
            links.push(url);
        }
    }

    // 匹配 <url> 格式的自动链接
    const autoLinkRegex = /<(https?:\/\/[^>]+)>/g;
    while ((match = autoLinkRegex.exec(content)) !== null) {
        links.push(match[1]);
    }

    return links;
}

/**
 * 清除本地存储中未使用的 note
 * 保留已删除的笔记（deleted: NOTE_DELETED.DELETED）供回收站使用
 */
async function checkItems(items: TreeModel['items']) {
    const noteIds = keys(items);
    const localNoteIds = await noteCache.keys();
    const unusedNoteIds = pull(localNoteIds, ...noteIds);

    await Promise.all(
        unusedNoteIds.map(async (id) => {
            if (!id) return;
            const note = await getItem(id);
            if (note && note.deleted === NOTE_DELETED.DELETED) {
                return;
            }
            return noteCache.removeItem(id);
        })
    );
}

async function getItem(id: string) {
    return noteCacheInstance.getItem<NoteCacheItem>(id);
}

async function setItem(id: string, note: NoteModel) {
    const extractorLinks = extractMarkdownLinks(note.content ?? '');
    const linkIds: string[] = [];
    if (Array.isArray(extractorLinks) && extractorLinks.length) {
        extractorLinks.forEach((link) => {
            if (isNoteLink(link)) {
                linkIds.push(link.slice(1));
            }
        });
    }
    return noteCacheInstance.setItem<NoteCacheItem>(id, {
        ...note,
        rawContent: removeMarkdown(note.content),
        linkIds,
    });
}

async function mutateItem(id: string, body: Partial<NoteModel>) {
    const note = await getItem(id);

    if (!note) {
        return;
    }

    await setItem(id, {
        ...note,
        ...body,
    });
}

const noteCache = {
    ...noteCacheInstance,
    getItem,
    setItem,
    mutateItem,
    checkItems,
};

export default noteCache;

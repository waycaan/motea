/**
 * PostgreSQL Tree Store
 *
 * @deprecated This module is deprecated as of Phase 10 (方案C).
 * Tree structure is now built from the notes table using pid relationships.
 * This file is kept for backward compatibility and can be removed in a future cleanup.
 *
 * Copyright (c) 2025 waycaan
 * Licensed under the MIT License
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { Pool } from 'pg';
import { createLogger } from 'libs/server/debugging';
import { TreeModel, DEFAULT_TREE, ROOT_ID, MovePosition, TreeItemModel } from 'libs/shared/tree';
import TreeActions from 'libs/shared/tree';
import { NOTE_ARCHIVED, NOTE_DELETED, NOTE_SHARED, NOTE_STARRED } from 'libs/shared/meta';
import { filter, forEach, isNil } from 'lodash';
import { genId } from 'libs/shared/id';
import { StoreProvider } from './providers/base';
import { getPathNoteById } from 'libs/server/note-path';

export interface TreeStoreConfig {
    connectionString: string;
    store?: StoreProvider;
}


function fixedTree(tree: TreeModel) {
    forEach(tree.items, (item) => {
        if (
            item.children.find(
                (i) => i === null || i === item.id || !tree.items[i]
            )
        ) {

            tree.items[item.id] = {
                ...item,
                children: filter(
                    item.children,
                    (cid) => !isNil(cid) && cid !== item.id && !!tree.items[cid]
                ),
            };
        }
    });
    return tree;
}

export class TreeStorePostgreSQL {
    private pool: Pool;
    private store?: StoreProvider;
    private logger = createLogger('tree-store.postgresql');

    constructor(config: TreeStoreConfig) {
        this.pool = new Pool({
            connectionString: config.connectionString,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
            max: 1, 
            idleTimeoutMillis: 10000,
            connectionTimeoutMillis: 10000,
        });
        this.store = config.store;
    }

    async get(): Promise<TreeModel> {
        const client = await this.pool.connect();
        try {
            const result = await client.query(
                'SELECT data FROM tree_data WHERE id = $1',
                ['main']
            );

            if (result.rows.length === 0) {
                // 🎉 创建包含欢迎笔记的默认树
                const defaultTreeWithWelcome = await this.createDefaultTreeWithWelcome();
                const defaultTree = fixedTree(defaultTreeWithWelcome);

                await client.query(`
                    INSERT INTO tree_data (id, data, updated_at)
                    VALUES ('main', $1, NOW())
                `, [JSON.stringify(defaultTree)]);

                this.logger.debug('Initialized default tree with welcome note');
                return defaultTree;
            }

            const tree = result.rows[0].data as TreeModel;
            return fixedTree(tree);
        } catch (error) {
            this.logger.error('Error getting tree:', error);
            return fixedTree(DEFAULT_TREE);
        } finally {
            client.release();
        }
    }

    async set(tree: TreeModel): Promise<TreeModel> {
        const newTree = fixedTree(tree);
        const client = await this.pool.connect();
        try {
            await client.query(`
                INSERT INTO tree_data (id, data, updated_at)
                VALUES ('main', $1, NOW())
                ON CONFLICT (id)
                DO UPDATE SET
                    data = EXCLUDED.data,
                    updated_at = NOW()
            `, [JSON.stringify(newTree)]);

            this.logger.debug('Successfully updated tree data');
            return newTree;
        } catch (error) {
            this.logger.error('Error updating tree:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    async addItem(id: string, parentId: string = ROOT_ID): Promise<TreeModel> {
        const tree = await this.get();
        return await this.set(TreeActions.addItem(tree, id, parentId));
    }

    async addItems(ids: string[], parentId: string = ROOT_ID): Promise<TreeModel> {
        let tree = await this.get();
        ids.forEach((id) => {
            tree = TreeActions.addItem(tree, id, parentId);
        });
        return await this.set(tree);
    }

    async removeItem(id: string): Promise<TreeModel> {
        const tree = await this.get();
        return await this.set(TreeActions.removeItem(tree, id));
    }

    async moveItem(source: MovePosition, destination: MovePosition): Promise<TreeModel> {
        const tree = await this.get();
        return await this.set(TreeActions.moveItem(tree, source, destination));
    }

    async mutateItem(id: string, data: TreeItemModel): Promise<TreeModel> {
        const tree = await this.get();
        return await this.set(TreeActions.mutateItem(tree, id, data));
    }

    async restoreItem(id: string, parentId: string): Promise<TreeModel> {
        const tree = await this.get();
        return await this.set(TreeActions.restoreItem(tree, id, parentId));
    }

    async deleteItem(id: string): Promise<TreeModel> {
        const tree = await this.get();
        return await this.set(TreeActions.deleteItem(tree, id));
    }

    /**
     * 🎉 创建包含欢迎笔记的默认树结构
     * 这确保了在数据库初始化时，树结构中包含欢迎笔记
     * 从而保证路由可以被访问，触发 [id].js 编译
     */
    private async createDefaultTreeWithWelcome(): Promise<TreeModel> {
        const welcomeId = genId();
        const currentTime = new Date().toISOString();

        // 创建笔记内容
        const welcomeContent = `# 欢迎使用 Motea

这是一个 Markdown 语法快速参考。

## 标题

\`\`\`markdown
# 一级标题
## 二级标题
### 三级标题
#### 四级标题
\`\`\`

## 文本格式

\`\`\`markdown
**粗体文本**
*斜体文本*
~~删除线~~
\`行内代码\`
\`\`\`

## 列表

\`\`\`markdown
- 无序列表项 1
- 无序列表项 2
  - 嵌套列表项

1. 有序列表项 1
2. 有序列表项 2
\`\`\`

## 任务列表

\`\`\`markdown
- [ ] 待完成任务
- [x] 已完成任务
\`\`\`

## 引用

\`\`\`markdown
> 这是一段引用文本
>> 嵌套引用
\`\`\`

## 代码块

\`\`\`markdown
\`\`\`javascript
function hello() {

}
\`\`\`
\`\`\`

## 链接和图片

\`\`\`markdown
[链接文本](https://example.com)
![图片描述](https://example.com/image.png)
\`\`\`

## 表格

\`\`\`markdown
| 列1 | 列2 | 列3 |
|-----|-----|-----|
| A   | B   | C   |
| D   | E   | F   |
\`\`\`

## 分割线

\`\`\`markdown
---
\`\`\`

---

开始编写你的笔记吧！ 🚀`;

        // 如果有 store，创建笔记内容
        if (this.store) {
            await this.store.putObject(getPathNoteById(welcomeId), welcomeContent, {
                contentType: 'text/markdown',
                parent_id: ROOT_ID,
                title: '欢迎使用 Motea',
                deleted: 0,
                shared: 0,
                starred: 0,
                has_versions: false,
            });
        }

        return {
            rootId: ROOT_ID,
            items: {
                root: {
                    id: ROOT_ID,
                    children: [welcomeId],
                },
                [welcomeId]: {
                    id: welcomeId,
                    children: [],
                    data: {
                        id: welcomeId,
                        title: '欢迎使用 Motea',
                        pid: ROOT_ID,
                        content: welcomeContent,
                        deleted: NOTE_DELETED.NORMAL,
                        shared: NOTE_SHARED.PRIVATE,
                        archived: NOTE_ARCHIVED.UNARCHIVED,
                        starred: NOTE_STARRED.UNSTARRED,
                        editorsize: null,
                        date: currentTime,
                        updated_at: currentTime,
                    } as any
                }
            },
        } as any;
    }

    async close(): Promise<void> {
        await this.pool.end();
    }
}

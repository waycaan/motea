/**
 * PostgreSQL Store Provider
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

import { Pool } from 'pg';
import { StoreProvider, ObjectOptions } from './base';
import { createLogger } from 'libs/server/debugging';
import { ROOT_ID } from 'libs/shared/tree';
import { strDecompress } from 'libs/shared/str';

export interface PostgreSQLConfig {
    connectionString: string;
    prefix?: string;
}

export class StorePostgreSQL extends StoreProvider {
    private pool: Pool;
    private logger = createLogger('store.postgresql');
    private tablesInitialized = false;

    constructor(config: PostgreSQLConfig) {
        super(config);

        const isServerless = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NETLIFY);
        const isDocker = !!(process.env.DOCKER || process.env.HOSTNAME === '0.0.0.0');
        const isProduction = process.env.NODE_ENV === 'production';

        const poolConfig = this.getOptimalPoolConfig(isServerless, isDocker, isProduction);

        this.pool = new Pool({
            connectionString: config.connectionString,
            ssl: isProduction && !isDocker ? { rejectUnauthorized: false } : false,
            ...poolConfig,
        });

        this.logger.info('PostgreSQL pool configured:', {
            environment: isServerless ? 'serverless' : isDocker ? 'docker' : 'traditional',
            max: poolConfig.max,
            min: poolConfig.min || 0,
            idleTimeoutMillis: poolConfig.idleTimeoutMillis,
        });
    }

    /**
     * 根据部署环境获取最优连接池配置
     */
    private getOptimalPoolConfig(isServerless: boolean, isDocker: boolean, isProduction: boolean) {
        if (isServerless) {
            return {
                max: 2,
                min: 0,
                idleTimeoutMillis: 10000,
                connectionTimeoutMillis: 5000,
                statement_timeout: 8000,
            };
        } else if (isDocker) {
            return {
                max: isProduction ? 10 : 6,
                min: 2,
                idleTimeoutMillis: 60000,
                connectionTimeoutMillis: 5000,
                statement_timeout: 15000,
            };
        } else {
            return {
                max: isProduction ? 6 : 4,
                min: 1,
                idleTimeoutMillis: 30000,
                connectionTimeoutMillis: 5000,
                statement_timeout: 10000,
            };
        }
    }

    private async ensureTablesInitialized(): Promise<void> {
        if (this.tablesInitialized) {
            return;
        }

        const client = await this.pool.connect();
        try {
            // Create notes table
            await client.query(`
                CREATE TABLE IF NOT EXISTS notes (
                    id VARCHAR(255) PRIMARY KEY,
                    path VARCHAR(500) UNIQUE NOT NULL,
                    content TEXT,
                    content_type VARCHAR(100) DEFAULT 'text/markdown',
                    metadata JSONB DEFAULT '{}',
                    status INTEGER DEFAULT 0,
                    sort_order INTEGER DEFAULT 0,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );
            `);

            // Migrate existing tables: add status and sort_order columns if missing
            await this.migrateNotesTable(client);

            // Create tree table for storing tree structure
            await client.query(`
                CREATE TABLE IF NOT EXISTS tree_data (
                    id VARCHAR(255) PRIMARY KEY DEFAULT 'main',
                    data JSONB NOT NULL,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );
            `);

            // Create performance indexes
            await this.createPerformanceIndexes(client);

            this.tablesInitialized = true;
            this.logger.info('Database tables initialized successfully');
        } catch (error) {
            this.logger.error('Failed to initialize database tables:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    private async createPerformanceIndexes(client: any): Promise<void> {
        const indexes = [
            'CREATE INDEX IF NOT EXISTS idx_notes_path ON notes(path)',
            'CREATE INDEX IF NOT EXISTS idx_notes_updated_at ON notes(updated_at DESC)',
            'CREATE INDEX IF NOT EXISTS idx_notes_id ON notes(id)',

            'CREATE INDEX IF NOT EXISTS idx_notes_metadata_gin ON notes USING GIN(metadata)',

            'CREATE INDEX IF NOT EXISTS idx_notes_metadata_pid ON notes((metadata->>\'pid\'))',
            'CREATE INDEX IF NOT EXISTS idx_notes_metadata_title ON notes((metadata->>\'title\'))',

            'CREATE INDEX IF NOT EXISTS idx_notes_daily ON notes((metadata->>\'isDailyNote\')) WHERE metadata->>\'isDailyNote\' = \'true\'',

            'CREATE INDEX IF NOT EXISTS idx_notes_content_search ON notes USING GIN(to_tsvector(\'english\', COALESCE(content, \'\')))',

            'CREATE INDEX IF NOT EXISTS idx_tree_data_updated_at ON tree_data(updated_at DESC)',

            // Phase 0: status and sort_order indexes
            'CREATE INDEX IF NOT EXISTS idx_notes_status ON notes(status)',
            'CREATE INDEX IF NOT EXISTS idx_notes_sort ON notes(status, sort_order)',
        ];

        for (const indexQuery of indexes) {
            try {
                await client.query(indexQuery);
                const indexName = indexQuery.match(/idx_\w+/)?.[0] || 'unknown';
                this.logger.debug('Created/verified index:', indexName);
            } catch (error) {
                this.logger.warn('Index creation warning:', error instanceof Error ? error.message : String(error));
            }
        }
    }

    /**
     * Phase 0: Add status, sort_order, parent_id columns to existing notes table
     */
    private async migrateNotesTable(client: any): Promise<void> {
        try {
            // Check if status column exists
            const statusCol = await client.query(`
                SELECT column_name FROM information_schema.columns 
                WHERE table_name = 'notes' AND column_name = 'status'
            `);
            if (statusCol.rows.length === 0) {
                await client.query('ALTER TABLE notes ADD COLUMN status INTEGER DEFAULT 0');
                this.logger.info('Added status column to notes table');
            }

            // Check if sort_order column exists
            const sortCol = await client.query(`
                SELECT column_name FROM information_schema.columns 
                WHERE table_name = 'notes' AND column_name = 'sort_order'
            `);
            if (sortCol.rows.length === 0) {
                await client.query('ALTER TABLE notes ADD COLUMN sort_order INTEGER DEFAULT 0');
                this.logger.info('Added sort_order column to notes table');
            }

            // Check if parent_id column exists
            const parentIdCol = await client.query(`
                SELECT column_name FROM information_schema.columns 
                WHERE table_name = 'notes' AND column_name = 'parent_id'
            `);
            if (parentIdCol.rows.length === 0) {
                await client.query(`ALTER TABLE notes ADD COLUMN parent_id VARCHAR(255) DEFAULT 'root'`);
                this.logger.info('Added parent_id column to notes table');

                // Populate parent_id from metadata
                // pid values can be: raw ID, base64-encoded, or base64+lzutf8-compressed
                const allNotes = await client.query('SELECT id, metadata FROM notes');
                for (const row of allNotes.rows) {
                    const meta = row.metadata || {};
                    let pid = meta.pid || 'root';
                    
                    // Try to decode if it looks like base64
                    if (pid !== 'root' && typeof pid === 'string') {
                        try {
                            const decoded = strDecompress(pid);
                            if (decoded && decoded !== pid) {
                                pid = decoded;
                            }
                        } catch {
                            // If decode fails, use raw value
                        }
                    }
                    
                    await client.query(
                        'UPDATE notes SET parent_id = $1 WHERE id = $2',
                        [pid, row.id]
                    );
                }
                this.logger.info('Populated parent_id from metadata');
            }

            // Create index on parent_id for recursive CTE performance
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_notes_parent_id ON notes(parent_id)
            `);

            // Add denormalized columns for display metadata
            const titleCol = await client.query(`
                SELECT column_name FROM information_schema.columns 
                WHERE table_name = 'notes' AND column_name = 'den_title'
            `);
            if (titleCol.rows.length === 0) {
                await client.query(`ALTER TABLE notes ADD COLUMN den_title TEXT DEFAULT ''`);
                await client.query(`ALTER TABLE notes ADD COLUMN den_deleted INTEGER DEFAULT 0`);
                await client.query(`ALTER TABLE notes ADD COLUMN den_shared INTEGER DEFAULT 0`);
                await client.query(`ALTER TABLE notes ADD COLUMN den_starred INTEGER DEFAULT 0`);
                await client.query(`ALTER TABLE notes ADD COLUMN den_has_versions BOOLEAN DEFAULT FALSE`);
                this.logger.info('Added denormalized display columns to notes table');

                // Populate from metadata (lzutf8-compressed values need JS decoding)
                const allNotes = await client.query('SELECT id, metadata FROM notes');
                for (const row of allNotes.rows) {
                    const meta = row.metadata || {};
                    const decode = (val: any): string => {
                        if (typeof val !== 'string') return String(val ?? '');
                        try { return strDecompress(val) || val; } catch { return val; }
                    };
                    const title = decode(meta.title);
                    const deleted = decode(meta.deleted) === '1' ? 1 : 0;
                    const shared = decode(meta.shared) === '1' ? 1 : 0;
                    const starred = decode(meta.starred) === '1' ? 1 : 0;
                    const hasVersions = decode(meta.hasVersions) === 'true';
                    await client.query(
                        `UPDATE notes SET den_title = $1, den_deleted = $2, den_shared = $3, den_starred = $4, den_has_versions = $5 WHERE id = $6`,
                        [title, deleted, shared, starred, hasVersions, row.id]
                    );
                }
                this.logger.info('Populated denormalized columns from metadata');
            }

            // Migrate archived/starred metadata to status column
            // Metadata values are base64-encoded: base64("1") = "MQ==", base64("0") = "MA=="
            const needsMigration = await client.query(`
                SELECT 1 FROM notes 
                WHERE status = 0 
                AND (
                    (metadata->>'archived') = 'MQ=='
                    OR (metadata->>'starred') = 'MQ=='
                )
                LIMIT 1
            `);
            if (needsMigration.rows.length > 0) {
                await client.query(`
                    UPDATE notes SET status = 1 
                    WHERE (metadata->>'archived') = 'MQ=='
                `);
                await client.query(`
                    UPDATE notes SET status = 2 
                    WHERE (metadata->>'starred') = 'MQ=='
                `);
                this.logger.info('Migrated archived/starred metadata to status column');
            }
        } catch (error) {
            this.logger.warn('Migration warning (non-fatal):', error instanceof Error ? error.message : String(error));
        }
    }

    async getSignUrl(_path: string, _expires = 600): Promise<string | null> {
        return null;
    }

    async hasObject(path: string): Promise<boolean> {
        await this.ensureTablesInitialized();
        const client = await this.pool.connect();
        try {
            const result = await client.query(
                'SELECT 1 FROM notes WHERE path = $1',
                [this.getPath(path)]
            );
            return result.rows.length > 0;
        } catch (error) {
            this.logger.error('Error checking if object exists:', error);
            return false;
        } finally {
            client.release();
        }
    }

    async getObject(path: string, _isCompressed = false): Promise<string | undefined> {
        const client = await this.pool.connect();
        try {
            const result = await client.query(
                'SELECT content FROM notes WHERE path = $1',
                [this.getPath(path)]
            );

            if (result.rows.length === 0) {
                return undefined;
            }

            return result.rows[0].content;
        } catch (error) {
            this.logger.error('Error getting object:', error);
            return undefined;
        } finally {
            client.release();
        }
    }

    async getObjectMeta(path: string): Promise<{ [key: string]: string } | undefined> {
        const client = await this.pool.connect();
        try {
            const result = await client.query(
                'SELECT metadata FROM notes WHERE path = $1',
                [this.getPath(path)]
            );

            if (result.rows.length === 0) {
                return undefined;
            }

            return result.rows[0].metadata || {};
        } catch (error) {
            this.logger.error('Error getting object metadata:', error);
            return undefined;
        } finally {
            client.release();
        }
    }

    async getObjectAndMeta(
        path: string,
        _isCompressed = false
    ): Promise<{
        content?: string;
        meta?: { [key: string]: string };
        contentType?: string;
        buffer?: Buffer;
        updated_at?: string;
    }> {
        const client = await this.pool.connect();
        try {
            const result = await client.query(
                'SELECT content, metadata, content_type, updated_at FROM notes WHERE path = $1',
                [this.getPath(path)]
            );

            if (result.rows.length === 0) {
                return {};
            }

            const row = result.rows[0];
            return {
                content: row.content,
                meta: row.metadata || {},
                contentType: row.content_type,
                updated_at: row.updated_at ? row.updated_at.toISOString() : undefined,
            };
        } catch (error) {
            this.logger.error('Error getting object and metadata:', error);
            return {};
        } finally {
            client.release();
        }
    }

    async putObject(
        path: string,
        raw: string | Buffer,
        options?: ObjectOptions,
        _isCompressed?: boolean
    ): Promise<void> {
        await this.ensureTablesInitialized();
        const client = await this.pool.connect();
        try {
            const content = Buffer.isBuffer(raw) ? raw.toString('utf-8') : raw;
            const fullPath = this.getPath(path);
            const isNotePath = path.startsWith('notes/');

            if (isNotePath) {
                const noteId = fullPath.split('/').pop()?.replace('.md', '') || '';

                if (!noteId) {
                    throw new Error('Note ID could not be extracted from path');
                }

                // Use caller-provided parent_id, or preserve existing
                const hasParentId = options?.parent_id !== undefined;
                const rawPid = options?.parent_id ?? ROOT_ID;
                const denTitle = options?.title ?? '';
                const denDeleted = options?.deleted ?? 0;
                const denShared = options?.shared ?? 0;
                const denStarred = options?.starred ?? 0;
                const denHasVersions = options?.has_versions ?? false;
                const denStatus = options?.status ?? 0;

                const defaultContentType = content && content.trim().startsWith('{') && content.trim().endsWith('}')
                    ? 'application/json'
                    : 'text/markdown';

                // Get next sort_order for this parent
                const maxSortResult = await client.query(
                    `SELECT COALESCE(MAX(sort_order), -1) + 1 as next_sort FROM notes WHERE parent_id = $1`,
                    [rawPid]
                );
                const nextSortOrder = maxSortResult.rows[0]?.next_sort ?? 0;

                if (hasParentId) {
                    // Full update including parent_id
                    await client.query(`
                        INSERT INTO notes (id, path, content, content_type, metadata, status, parent_id, sort_order, den_title, den_deleted, den_shared, den_starred, den_has_versions, updated_at)
                        VALUES ($1, $2, $3, $4, '{}', $5, $6, $7, $8, $9, $10, $11, $12, NOW())
                        ON CONFLICT (path)
                        DO UPDATE SET
                            content = EXCLUDED.content,
                            content_type = EXCLUDED.content_type,
                            metadata = '{}',
                            status = EXCLUDED.status,
                            parent_id = EXCLUDED.parent_id,
                            sort_order = EXCLUDED.sort_order,
                            den_title = EXCLUDED.den_title,
                            den_deleted = EXCLUDED.den_deleted,
                            den_shared = EXCLUDED.den_shared,
                            den_starred = EXCLUDED.den_starred,
                            den_has_versions = EXCLUDED.den_has_versions,
                            updated_at = NOW()
                    `, [
                        noteId, fullPath, content,
                        options?.contentType || defaultContentType,
                        denStatus, rawPid, nextSortOrder,
                        denTitle, denDeleted, denShared, denStarred, denHasVersions,
                    ]);
                } else {
                    // Update without changing parent_id (preserve existing)
                    await client.query(`
                        INSERT INTO notes (id, path, content, content_type, metadata, status, parent_id, sort_order, den_title, den_deleted, den_shared, den_starred, den_has_versions, updated_at)
                        VALUES ($1, $2, $3, $4, '{}', $5, $6, $7, $8, $9, $10, $11, $12, NOW())
                        ON CONFLICT (path)
                        DO UPDATE SET
                            content = EXCLUDED.content,
                            content_type = EXCLUDED.content_type,
                            metadata = '{}',
                            status = EXCLUDED.status,
                            den_title = EXCLUDED.den_title,
                            den_deleted = EXCLUDED.den_deleted,
                            den_shared = EXCLUDED.den_shared,
                            den_starred = EXCLUDED.den_starred,
                            den_has_versions = EXCLUDED.den_has_versions,
                            updated_at = NOW()
                    `, [
                        noteId, fullPath, content,
                        options?.contentType || defaultContentType,
                        denStatus, rawPid, nextSortOrder,
                        denTitle, denDeleted, denShared, denStarred, denHasVersions,
                    ]);
                }

                this.logger.debug('Successfully put note:', fullPath, 'with ID:', noteId);
            } else {
                await client.query(`
                    INSERT INTO notes (id, path, content, content_type, metadata, updated_at)
                    VALUES ($1, $2, $3, $4, $5, NOW())
                    ON CONFLICT (path)
                    DO UPDATE SET
                        content = EXCLUDED.content,
                        content_type = EXCLUDED.content_type,
                        metadata = EXCLUDED.metadata,
                        updated_at = NOW()
                `, [
                    fullPath, 
                    fullPath,
                    content,
                    options?.contentType || 'text/markdown',
                    JSON.stringify(options?.meta || {})
                ]);

                this.logger.debug('Successfully put non-note object:', fullPath);
            }
        } catch (error) {
            this.logger.error('Error putting object:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    async deleteObject(path: string): Promise<void> {
        const client = await this.pool.connect();
        try {
            await client.query(
                'DELETE FROM notes WHERE path = $1',
                [this.getPath(path)]
            );
            this.logger.debug('Successfully deleted object:', this.getPath(path));
        } catch (error) {
            this.logger.error('Error deleting object:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    async copyObject(
        fromPath: string,
        toPath: string,
        options: ObjectOptions
    ): Promise<void> {
        const client = await this.pool.connect();
        try {
            const fullFromPath = this.getPath(fromPath);
            const fullToPath = this.getPath(toPath);

            const metadata = options.meta || {};
            const noteId = metadata.id;

            const metadataWithoutId = { ...metadata };
            delete metadataWithoutId.id;

            if (fullFromPath === fullToPath) {
                await client.query(`
                    UPDATE notes
                    SET metadata = $2, content_type = $3, updated_at = NOW()
                    WHERE path = $1
                `, [
                    fullFromPath,
                    JSON.stringify(metadataWithoutId),
                    options.contentType || 'text/markdown'
                ]);
            } else {
                // Copy to new path
                if (!noteId) {
                    throw new Error('Note ID is required in metadata for copy operation');
                }

                await client.query(`
                    INSERT INTO notes (id, path, content, content_type, metadata, updated_at)
                    SELECT $3, $2, content, $4, $5, NOW()
                    FROM notes WHERE path = $1
                    ON CONFLICT (path)
                    DO UPDATE SET
                        content = EXCLUDED.content,
                        content_type = EXCLUDED.content_type,
                        metadata = EXCLUDED.metadata,
                        updated_at = NOW()
                `, [
                    fullFromPath,
                    fullToPath,
                    noteId,
                    options.contentType || 'text/markdown',
                    JSON.stringify(metadataWithoutId)
                ]);
            }

            this.logger.debug('Successfully copied object from', fullFromPath, 'to', fullToPath);
        } catch (error) {
            this.logger.error('Error copying object:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    async getTree(): Promise<any> {
        const client = await this.pool.connect();
        try {
            const result = await client.query(
                'SELECT data FROM tree_data WHERE id = $1',
                ['main']
            );

            if (result.rows.length === 0) {
                return null;
            }

            return result.rows[0].data;
        } catch (error) {
            this.logger.error('Error getting tree:', error);
            return null;
        } finally {
            client.release();
        }
    }

    async putTree(treeData: any): Promise<void> {
        const client = await this.pool.connect();
        try {
            await client.query(`
                INSERT INTO tree_data (id, data, updated_at)
                VALUES ('main', $1, NOW())
                ON CONFLICT (id)
                DO UPDATE SET
                    data = EXCLUDED.data,
                    updated_at = NOW()
            `, [JSON.stringify(treeData)]);

            this.logger.debug('Successfully updated tree data');
        } catch (error) {
            this.logger.error('Error updating tree:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * 🚀 批量获取对象元数据 - 性能优化
     * 解决 N+1 查询问题，将多次查询合并为一次
     */
    async batchGetObjectMeta(paths: string[]): Promise<Array<{ [key: string]: string } | undefined>> {
        if (paths.length === 0) {
            return [];
        }

        const client = await this.pool.connect();
        try {
            // 🎯 使用 IN 查询批量获取元数据
            const placeholders = paths.map((_, index) => `$${index + 1}`).join(', ');
            const fullPaths = paths.map(path => this.getPath(path));

            const result = await client.query(
                `SELECT path, metadata FROM notes WHERE path IN (${placeholders}) ORDER BY path`,
                fullPaths
            );

            // 📊 创建路径到元数据的映射
            const metaMap = new Map<string, any>();
            result.rows.forEach(row => {
                metaMap.set(row.path, row.metadata || {});
            });

            // 🔄 按原始顺序返回结果，缺失的返回 undefined
            return fullPaths.map(fullPath => metaMap.get(fullPath));
        } catch (error) {
            this.logger.error('Error batch getting object metadata:', error);
            // 🛡️ 降级到单个查询
            return Promise.all(paths.map(path => this.getObjectMeta(path)));
        } finally {
            client.release();
        }
    }

    /**
     * 🚀 批量获取对象内容和元数据 - 性能优化
     */
    async batchGetObjectAndMeta(paths: string[]): Promise<Array<{
        content?: string;
        meta?: { [key: string]: string };
        contentType?: string;
        updated_at?: string;
    }>> {
        if (paths.length === 0) {
            return [];
        }

        const client = await this.pool.connect();
        try {
            const placeholders = paths.map((_, index) => `$${index + 1}`).join(', ');
            const fullPaths = paths.map(path => this.getPath(path));

            const result = await client.query(
                `SELECT path, content, metadata, content_type, updated_at
                 FROM notes
                 WHERE path IN (${placeholders})
                 ORDER BY path`,
                fullPaths
            );

            // 📊 创建路径到数据的映射
            const dataMap = new Map<string, any>();
            result.rows.forEach(row => {
                dataMap.set(row.path, {
                    content: row.content,
                    meta: row.metadata || {},
                    contentType: row.content_type,
                    updated_at: row.updated_at ? row.updated_at.toISOString() : undefined,
                });
            });

            // 🔄 按原始顺序返回结果，缺失的返回空对象
            return fullPaths.map(fullPath => dataMap.get(fullPath) || {});
        } catch (error) {
            this.logger.error('Error batch getting objects and metadata:', error);
            // 🛡️ 降级到单个查询
            return Promise.all(paths.map(path => this.getObjectAndMeta(path)));
        } finally {
            client.release();
        }
    }

    // ========================================================================
    // Phase 1: Tree-building store methods
    // ========================================================================

    /**
     * Get all notes with a given status (0=NORMAL, 1=ARCHIVED, 2=STARRED)
     */
    async getNotesByStatus(status: number): Promise<Array<{
        id: string;
        path: string;
        status: number;
        sort_order: number;
        parent_id: string;
        metadata: Record<string, any>;
        title: string;
        deleted: number;
        shared: number;
        starred: number;
        has_versions: boolean;
    }>> {
        await this.ensureTablesInitialized();
        const client = await this.pool.connect();
        try {
            const result = await client.query(
                `SELECT id, path, status, sort_order, parent_id, metadata,
                        den_title, den_deleted, den_shared, den_starred, den_has_versions
                 FROM notes 
                 WHERE status = $1 AND den_deleted = 0
                 ORDER BY sort_order`,
                [status]
            );
            return result.rows.map((row: any) => ({
                id: row.id,
                path: row.path,
                status: row.status,
                sort_order: row.sort_order,
                parent_id: row.parent_id || 'root',
                metadata: row.metadata || {},
                title: row.den_title || '',
                deleted: row.den_deleted ?? 0,
                shared: row.den_shared ?? 0,
                starred: row.den_starred ?? 0,
                has_versions: row.den_has_versions ?? false,
            }));
        } finally {
            client.release();
        }
    }

    /**
     * Batch update status for multiple notes
     */
    async updateNotesStatus(ids: string[], status: number): Promise<void> {
        if (ids.length === 0) return;
        await this.ensureTablesInitialized();
        const client = await this.pool.connect();
        try {
            await client.query(
                `UPDATE notes SET status = $1, updated_at = NOW() WHERE id = ANY($2)`,
                [status, ids]
            );
        } finally {
            client.release();
        }
    }

    /**
     * Update a single note's status
     */
    async updateNoteStatus(id: string, status: number): Promise<void> {
        await this.ensureTablesInitialized();
        const client = await this.pool.connect();
        try {
            await client.query(
                `UPDATE notes SET status = $1, updated_at = NOW() WHERE id = $2`,
                [status, id]
            );
        } finally {
            client.release();
        }
    }

    /**
     * Update a note's pid (parent id) in metadata and parent_id column
     */
    async updateNotePid(id: string, pid: string): Promise<void> {
        await this.ensureTablesInitialized();
        const client = await this.pool.connect();
        try {
            await client.query(
                `UPDATE notes SET parent_id = $1, updated_at = NOW() WHERE id = $2`,
                [pid, id]
            );
        } finally {
            client.release();
        }
    }

    /**
     * Update a note's sort_order
     */
    async updateNoteSortOrder(id: string, sortOrder: number): Promise<void> {
        await this.ensureTablesInitialized();
        const client = await this.pool.connect();
        try {
            await client.query(
                `UPDATE notes SET sort_order = $1, updated_at = NOW() WHERE id = $2`,
                [sortOrder, id]
            );
        } finally {
            client.release();
        }
    }

    /**
     * Recursively collect all descendant note IDs using PostgreSQL recursive CTE
     * Uses parent_id column (raw, not base64-encoded) for efficient tree queries
     */
    async collectDescendants(ids: string[]): Promise<string[]> {
        if (ids.length === 0) return [];
        await this.ensureTablesInitialized();
        const client = await this.pool.connect();
        try {
            const result = await client.query(
                `WITH RECURSIVE descendants AS (
                    SELECT id FROM notes WHERE id = ANY($1)
                    UNION ALL
                    SELECT n.id FROM notes n
                    INNER JOIN descendants d ON n.parent_id = d.id
                    WHERE n.den_deleted = 0
                )
                SELECT id FROM descendants`,
                [ids]
            );

            return result.rows.map((row: any) => row.id);
        } finally {
            client.release();
        }
    }

    /**
     * Find a note by parent_id and title (efficient SQL query instead of loading all notes)
     */
    async findNoteByParentAndTitle(parentId: string, title: string, status?: number): Promise<string | null> {
        await this.ensureTablesInitialized();
        const client = await this.pool.connect();
        try {
            let query = `SELECT id FROM notes WHERE parent_id = $1 AND den_title = $2`;
            const params: any[] = [parentId, title];
            if (status !== undefined) {
                query += ` AND status = $3`;
                params.push(status);
            }
            query += ` AND den_deleted = 0 LIMIT 1`;
            const result = await client.query(query, params);
            return result.rows[0]?.id || null;
        } finally {
            client.release();
        }
    }

    /**
     * Get version notes under a history folder (efficient SQL query)
     */
    async getVersionNotes(historyFolderId: string): Promise<Array<{ id: string; title: string; created_at: string }>> {
        await this.ensureTablesInitialized();
        const client = await this.pool.connect();
        try {
            const result = await client.query(
                `SELECT id, den_title, updated_at FROM notes 
                 WHERE parent_id = $1 AND id != $1 AND status = 0
                 AND den_deleted = 0
                 ORDER BY updated_at DESC`,
                [historyFolderId]
            );
            return result.rows.map((row: any) => ({
                id: row.id,
                title: row.den_title || '',
                created_at: row.updated_at?.toISOString?.() || '',
            }));
        } finally {
            client.release();
        }
    }

    /**
     * Get a single note with denormalized columns
     */
    async getNoteById(id: string): Promise<{
        id: string;
        content?: string;
        title: string;
        deleted: number;
        shared: number;
        starred: number;
        has_versions: boolean;
        status: number;
        updated_at?: string;
    } | null> {
        await this.ensureTablesInitialized();
        const client = await this.pool.connect();
        try {
            const result = await client.query(
                `SELECT id, content, den_title, den_deleted, den_shared, den_starred, den_has_versions, status, updated_at
                 FROM notes WHERE id = $1`,
                [id]
            );
            if (result.rows.length === 0) return null;
            const row = result.rows[0];
            return {
                id: row.id,
                content: row.content || '',
                title: row.den_title || '',
                deleted: row.den_deleted ?? 0,
                shared: row.den_shared ?? 0,
                starred: row.den_starred ?? 0,
                has_versions: row.den_has_versions ?? false,
                status: row.status ?? 0,
                updated_at: row.updated_at?.toISOString?.() || undefined,
            };
        } finally {
            client.release();
        }
    }

    /**
     * Update denormalized columns for a note
     */
    async updateNoteColumns(id: string, columns: {
        title?: string;
        deleted?: number;
        shared?: number;
        starred?: number;
        has_versions?: boolean;
    }): Promise<void> {
        await this.ensureTablesInitialized();
        const client = await this.pool.connect();
        try {
            const sets: string[] = [];
            const params: any[] = [];
            let idx = 1;
            if (columns.title !== undefined) { sets.push(`den_title = $${idx++}`); params.push(columns.title); }
            if (columns.deleted !== undefined) { sets.push(`den_deleted = $${idx++}`); params.push(columns.deleted); }
            if (columns.shared !== undefined) { sets.push(`den_shared = $${idx++}`); params.push(columns.shared); }
            if (columns.starred !== undefined) { sets.push(`den_starred = $${idx++}`); params.push(columns.starred); }
            if (columns.has_versions !== undefined) { sets.push(`den_has_versions = $${idx++}`); params.push(columns.has_versions); }
            if (sets.length === 0) return;
            sets.push(`updated_at = NOW()`);
            params.push(id);
            await client.query(`UPDATE notes SET ${sets.join(', ')} WHERE id = $${idx}`, params);
        } finally {
            client.release();
        }
    }

    /**
     * Reorder siblings: set sort_order for each child ID in order
     */
    async reorderSiblings(_parentId: string, childIds: string[]): Promise<void> {
        if (childIds.length === 0) return;
        await this.ensureTablesInitialized();
        const client = await this.pool.connect();
        try {
            for (let i = 0; i < childIds.length; i++) {
                await client.query(
                    `UPDATE notes SET sort_order = $1, updated_at = NOW() WHERE id = $2`,
                    [i, childIds[i]]
                );
            }
        } finally {
            client.release();
        }
    }

    /**
     * Initialize sort_order for all notes based on tree_data children order
     * (One-time migration helper)
     */
    async initSortOrderFromTree(treeItems: Record<string, { children?: string[] }>): Promise<void> {
        await this.ensureTablesInitialized();
        const client = await this.pool.connect();
        try {
            let order = 0;
            const processChildren = async (parentId: string) => {
                const item = treeItems[parentId];
                if (!item?.children) return;
                for (const childId of item.children) {
                    if (treeItems[childId]) {
                        await client.query(
                            `UPDATE notes SET sort_order = $1, updated_at = NOW() WHERE id = $2`,
                            [order++, childId]
                        );
                        await processChildren(childId);
                    }
                }
            };
            await processChildren('root');
        } finally {
            client.release();
        }
    }

    /**
     * Find a history folder note by its parent note ID, title, and status
     */
    async findHistoryFolder(noteId: string, title: string, status?: number): Promise<string | null> {
        await this.ensureTablesInitialized();
        const client = await this.pool.connect();
        try {
            let query = `SELECT id FROM notes 
                 WHERE parent_id = $1 
                 AND den_deleted = 0
                 AND den_title = $2
                 AND id != $1`;
            const params: any[] = [noteId, title];
            if (status !== undefined) {
                query += ` AND status = $3`;
                params.push(status);
            }
            query += ` LIMIT 1`;
            const result = await client.query(query, params);
            return result.rows[0]?.id || null;
        } finally {
            client.release();
        }
    }

    /**
     * Trim old version snapshots under a history folder
     * Keeps only the newest MAX_VERSIONS snapshots
     */
    async trimOldVersions(historyFolderId: string, maxVersions: number): Promise<void> {
        const client = await this.pool.connect();
        try {
            const result = await client.query(
                `SELECT id, updated_at FROM notes 
                 WHERE parent_id = $1 
                 AND id != $1
                 AND den_deleted = 0
                 ORDER BY updated_at DESC`,
                [historyFolderId]
            );

            const versions = result.rows.map((row: any) => ({
                id: row.id,
                created_at: row.updated_at?.toISOString?.() || '',
            }));

            // Delete versions beyond limit
            if (versions.length > maxVersions) {
                const toDelete = versions.slice(maxVersions);
                for (const v of toDelete) {
                    await client.query('DELETE FROM notes WHERE id = $1', [v.id]);
                }
            }
        } finally {
            client.release();
        }
    }

    async close(): Promise<void> {
        await this.pool.end();
    }
}

/**
 * Store Factory
 * Based on the open-source project Notea, originally created by qingwei-li<cinwell.li@gmail.com>.
 * Modified and maintained by waycaan, 2025.
 *
 * Key modifications:
 * - Replaced S3 store creation with PostgreSQL store
 * - Simplified store factory to only support PostgreSQL
 * - Added singleton pattern to prevent multiple connection pools
 */

import { StorePostgreSQL } from './providers/postgresql';
import { StoreProvider } from './providers/base';
import { config, PostgreSQLStoreConfiguration } from 'libs/server/config';

// Singleton instance to ensure only one connection pool is created
let storeInstance: StoreProvider | null = null;

export function createStore(): StoreProvider {
    if (!storeInstance) {
        const cfg = config().store as PostgreSQLStoreConfiguration;

        storeInstance = new StorePostgreSQL({
            connectionString: cfg.connectionString,
            prefix: cfg.prefix,
        });
    }

    return storeInstance;
}

export { StoreProvider } from './providers/base';

import { config, PostgreSQLStoreConfiguration } from 'libs/server/config';
import { TreeStorePostgreSQL } from './tree-postgresql';
import { StoreProvider } from './providers/base';

// Singleton instance to ensure only one connection pool is created
let treeStoreInstance: TreeStorePostgreSQL | null = null;

export function createTreeStore(store: StoreProvider): TreeStorePostgreSQL {
    if (!treeStoreInstance) {
        const cfg = config().store as PostgreSQLStoreConfiguration;

        treeStoreInstance = new TreeStorePostgreSQL({
            connectionString: cfg.connectionString,
            store,
        });
    }

    return treeStoreInstance;
}

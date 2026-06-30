import { FC, useState } from 'react';
import { ExportButton } from './export-button';
import { ImportButton } from './import-button';
import { ImportProgress } from 'components/import-progress';
import { ROOT_ID } from 'libs/shared/tree';

export const ImportOrExport: FC = () => {
    const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null);

    return (
        <div>
            <div className="flex mt-2 items-center">
                <div className="space-x-6 flex">
                    <ImportButton parentId={ROOT_ID} onProgress={setImportProgress}></ImportButton>
                    <ExportButton></ExportButton>
                </div>
            </div>
            {importProgress && (
                <div style={{ marginTop: '12px' }}>
                    <ImportProgress current={importProgress.current} total={importProgress.total} />
                </div>
            )}
        </div>
    );
};

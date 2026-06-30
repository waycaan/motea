import { TrashIcon } from '@heroicons/react/outline';
import { ArchiveIcon, StarIcon } from '@heroicons/react/solid';
import { Tooltip } from '@material-ui/core';
import UIState from 'libs/web/state/ui';
import NoteState from 'libs/web/state/note';
import NoteTreeState from 'libs/web/state/tree';
import useI18n from 'libs/web/hooks/use-i18n';
import { NOTE_STATUS } from 'libs/shared/meta';
import { useCallback } from 'react';

type PanelType = 'tree' | 'outline' | 'archive' | 'starred';

const BatchActionsBar = ({ panel }: { panel: PanelType }) => {
    const { t } = useI18n();
    const { selectedNoteIds, clearSelection, exitEditMode } = UIState.useContainer();
    const { updateNotesStatus, removeNote } = NoteState.useContainer();
    const { initTree, loadArchivedTree, loadStarredTree } = NoteTreeState.useContainer();
    const selectedCount = selectedNoteIds.size;

    const handleBatchDelete = useCallback(async () => {
        const ids = Array.from(selectedNoteIds);
        for (const id of ids) {
            await removeNote(id);
        }
        if (panel === 'tree') {
            await initTree();
        } else if (panel === 'archive') {
            await Promise.all([initTree(), loadArchivedTree()]);
        } else if (panel === 'starred') {
            await Promise.all([initTree(), loadStarredTree()]);
        }
        clearSelection();
        exitEditMode();
    }, [selectedNoteIds, removeNote, panel, initTree, loadArchivedTree, loadStarredTree, clearSelection, exitEditMode]);

    const handleBatchArchive = useCallback(async () => {
        const ids = Array.from(selectedNoteIds);
        await updateNotesStatus(ids, NOTE_STATUS.ARCHIVED);
        await Promise.all([initTree(), loadArchivedTree()]);
        clearSelection();
        exitEditMode();
    }, [selectedNoteIds, updateNotesStatus, initTree, loadArchivedTree, clearSelection, exitEditMode]);

    const handleBatchStar = useCallback(async () => {
        const ids = Array.from(selectedNoteIds);
        await updateNotesStatus(ids, NOTE_STATUS.STARRED);
        await Promise.all([initTree(), loadStarredTree()]);
        clearSelection();
        exitEditMode();
    }, [selectedNoteIds, updateNotesStatus, initTree, loadStarredTree, clearSelection, exitEditMode]);

    const handleBatchUnarchive = useCallback(async () => {
        const ids = Array.from(selectedNoteIds);
        await updateNotesStatus(ids, NOTE_STATUS.NORMAL);
        await Promise.all([initTree(), loadArchivedTree()]);
        clearSelection();
        exitEditMode();
    }, [selectedNoteIds, updateNotesStatus, initTree, loadArchivedTree, clearSelection, exitEditMode]);

    const handleBatchUnstar = useCallback(async () => {
        const ids = Array.from(selectedNoteIds);
        await updateNotesStatus(ids, NOTE_STATUS.NORMAL);
        await Promise.all([initTree(), loadStarredTree()]);
        clearSelection();
        exitEditMode();
    }, [selectedNoteIds, updateNotesStatus, initTree, loadStarredTree, clearSelection, exitEditMode]);

    if (selectedCount === 0) return null;

    const renderActions = () => {
        if (panel === 'outline') {
            return null;
        }

        if (panel === 'archive') {
            return (
                <>
                    <Tooltip title={t('Unarchive')}>
                        <button
                            onClick={handleBatchUnarchive}
                            className="p-2 text-gray-500 hover:text-green-500 hover:bg-green-50 rounded transition-colors"
                        >
                            <ArchiveIcon className="w-5 h-5" />
                        </button>
                    </Tooltip>
                    <Tooltip title={t('Delete')}>
                        <button
                            onClick={handleBatchDelete}
                            className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                        >
                            <TrashIcon className="w-5 h-5" />
                        </button>
                    </Tooltip>
                </>
            );
        }

        if (panel === 'starred') {
            return (
                <>
                    <Tooltip title={t('Unstar')}>
                        <button
                            onClick={handleBatchUnstar}
                            className="p-2 text-gray-500 hover:text-yellow-500 hover:bg-yellow-50 rounded transition-colors"
                        >
                            <StarIcon className="w-5 h-5" />
                        </button>
                    </Tooltip>
                    <Tooltip title={t('Delete')}>
                        <button
                            onClick={handleBatchDelete}
                            className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                        >
                            <TrashIcon className="w-5 h-5" />
                        </button>
                    </Tooltip>
                </>
            );
        }

        return (
            <>
                <Tooltip title={t('Delete')}>
                    <button
                        onClick={handleBatchDelete}
                        className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                    >
                        <TrashIcon className="w-5 h-5" />
                    </button>
                </Tooltip>
                <Tooltip title={t('Archive')}>
                    <button
                        onClick={handleBatchArchive}
                        className="p-2 text-gray-500 hover:text-blue-500 hover:bg-blue-50 rounded transition-colors"
                    >
                        <ArchiveIcon className="w-5 h-5" />
                    </button>
                </Tooltip>
                <Tooltip title={t('Star')}>
                    <button
                        onClick={handleBatchStar}
                        className="p-2 text-gray-500 hover:text-yellow-500 hover:bg-yellow-50 rounded transition-colors"
                    >
                        <StarIcon className="w-5 h-5" />
                    </button>
                </Tooltip>
            </>
        );
    };

    return (
        <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-3 shadow-lg z-20">
            <div className="flex items-center justify-center space-x-4 mb-2">
                {renderActions()}
            </div>
            <div className="text-center text-sm text-gray-500">
                {t('Selected')} {selectedCount} {t('items')}
            </div>
        </div>
    );
};

export default BatchActionsBar;

import SidebarTool from 'components/sidebar/sidebar-tool';
import SideBarList from 'components/sidebar/sidebar-list';
import OutlinePanel from 'components/sidebar/outline-panel';
import { Archive } from 'components/sidebar/archive';
import { Starred } from 'components/sidebar/starred';
import BatchActionsBar from 'components/sidebar/batch-actions-bar';
import UIState from 'libs/web/state/ui';
import { FC, useEffect, useState, useCallback, useRef } from 'react';
import NoteTreeState from 'libs/web/state/tree';
import useNoteAPI from 'libs/web/api/note';
import noteCache from 'libs/web/cache/note';
import { NoteCacheItem } from 'libs/web/cache';
import dayjs from 'dayjs';
import { NOTE_STATUS, NOTE_DELETED } from 'libs/shared/meta';
import { ROOT_ID } from 'libs/shared/tree';

const DAILY_TITLE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const Sidebar: FC = () => {
    const { ua, settings } = UIState.useContainer();
    const { initTree, tree, initLoaded } = NoteTreeState.useContainer();
    const { updateStatus } = useNoteAPI();

    const trashExpiryDays = settings?.settings?.trash_expiry_days ?? 1;
    const autoArchiveDays = settings?.settings?.auto_archive_days ?? 0;

    const hasInitTree = useRef(false);
    useEffect(() => {
        if (hasInitTree.current) return;
        hasInitTree.current = true;
        initTree()
            ?.catch((v) => console.error('Error whilst initialising tree: %O', v));
    }, [initTree]);

    // Phase 9: Auto-archive expired daily notes
    const hasCheckedDaily = useRef(false);
    useEffect(() => {
        if (!initLoaded || hasCheckedDaily.current) return;
        hasCheckedDaily.current = true;

        const today = dayjs().format('YYYY-MM-DD');
        const toArchive: string[] = [];

        Object.values(tree.items).forEach((item) => {
            if (item.id === ROOT_ID) return;
            if (!item.data?.title) return;
            if (item.data.deleted === NOTE_DELETED.DELETED) return;
            if (!DAILY_TITLE_REGEX.test(item.data.title)) return;
            if (dayjs(item.data.title).isBefore(today, 'day')) {
                toArchive.push(item.id);
            }
        });

        if (toArchive.length > 0) {

            updateStatus(toArchive, NOTE_STATUS.ARCHIVED).then(() => {
                initTree();
            }).catch((e) => console.error('Failed to auto-archive daily notes:', e));
        }
    }, [initLoaded, tree, initTree, updateStatus]);

    // Auto-archive main notes older than autoArchiveDays (0=disabled)
    const hasCheckedAutoArchive = useRef(false);
    useEffect(() => {
        if (!initLoaded || hasCheckedAutoArchive.current || autoArchiveDays <= 0) return;
        hasCheckedAutoArchive.current = true;

        const cutoffDate = dayjs().subtract(autoArchiveDays, 'day');
        const toArchive: string[] = [];

        Object.values(tree.items).forEach((item) => {
            if (item.id === ROOT_ID) return;
            if (!item.data) return;
            if (item.data.deleted === NOTE_DELETED.DELETED) return;
            if (item.data.status !== NOTE_STATUS.NORMAL) return;
            if (!item.data.updated_at) return;
            if (dayjs(item.data.updated_at).isBefore(cutoffDate)) {
                toArchive.push(item.id);
            }
        });

        if (toArchive.length > 0) {
            updateStatus(toArchive, NOTE_STATUS.ARCHIVED).then(() => {
                initTree();
            }).catch((e) => console.error('Failed to auto-archive notes:', e));
        }
    }, [initLoaded, tree, initTree, updateStatus, autoArchiveDays]);

    // Auto-delete expired trash notes (older than trashExpiryDays)
    const hasCheckedTrash = useRef(false);
    useEffect(() => {
        if (!initLoaded || hasCheckedTrash.current) return;
        hasCheckedTrash.current = true;

        const cutoffDate = dayjs().subtract(trashExpiryDays, 'day');
        const toDelete: string[] = [];

        noteCache.iterate<NoteCacheItem, void>((note) => {
            if (note.deleted !== NOTE_DELETED.DELETED) return;
            if (!note.updated_at) return;
            if (dayjs(note.updated_at).isBefore(cutoffDate)) {
                toDelete.push(note.id);
            }
        }).then(() => {
            if (toDelete.length > 0) {

                Promise.all(
                    toDelete.map(async (id) => {
                        try {
                            await fetch('/api/trash', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ action: 'delete', data: { id } }),
                            });
                            await noteCache.removeItem(id);
                        } catch (e) {
                            console.error(`Failed to auto-delete trash note ${id}:`, e);
                        }
                    })
                );
            }
        });
    }, [initLoaded, trashExpiryDays]);

    return ua?.isMobileOnly ? <MobileSidebar /> : <BrowserSidebar />;
};

type ViewMode = 'tree' | 'outline' | 'archive' | 'starred';

const SidebarContent = ({ viewMode, onToggleOutline, onToggleArchive, onToggleStarred }: {
    viewMode: ViewMode;
    onToggleOutline: () => void;
    onToggleArchive: () => void;
    onToggleStarred: () => void;
}) => {
    return (
        <div className="flex-1 h-full relative overflow-hidden transition-all duration-300 ease-in-out">
            <div
                className="absolute inset-0 transition-all duration-300 ease-in-out"
                style={{
                    opacity: viewMode === 'tree' ? 1 : 0,
                    transform: viewMode === 'tree' ? 'translateX(0)' : 'translateX(-8px)',
                    visibility: viewMode === 'tree' ? 'visible' : 'hidden',
                }}
            >
                <SideBarList />
            </div>
            <div
                className="absolute inset-0 transition-all duration-300 ease-in-out bg-gray-100"
                style={{
                    opacity: viewMode === 'outline' ? 1 : 0,
                    transform: viewMode === 'outline' ? 'translateX(0)' : 'translateX(8px)',
                    visibility: viewMode === 'outline' ? 'visible' : 'hidden',
                }}
            >
                <OutlinePanel onClose={onToggleOutline} />
            </div>
            <div
                className="absolute inset-0 transition-all duration-300 ease-in-out bg-gray-100 overflow-y-auto"
                style={{
                    opacity: viewMode === 'archive' ? 1 : 0,
                    transform: viewMode === 'archive' ? 'translateX(0)' : 'translateX(8px)',
                    visibility: viewMode === 'archive' ? 'visible' : 'hidden',
                }}
            >
                <Archive onClose={onToggleArchive} />
            </div>
            <div
                className="absolute inset-0 transition-all duration-300 ease-in-out bg-gray-100 overflow-y-auto"
                style={{
                    opacity: viewMode === 'starred' ? 1 : 0,
                    transform: viewMode === 'starred' ? 'translateX(0)' : 'translateX(8px)',
                    visibility: viewMode === 'starred' ? 'visible' : 'hidden',
                }}
            >
                <Starred onClose={onToggleStarred} />
            </div>
        </div>
    );
};

const BrowserSidebar: FC = () => {
    const {
        sidebar,
        split: { sizes },
    } = UIState.useContainer();
    const { archivedTree } = NoteTreeState.useContainer();
    const { fetch: fetchNote } = useNoteAPI();
    const [viewMode, setViewMode] = useState<ViewMode>('tree');

    const toggleOutline = useCallback(() => {
        setViewMode((prev) => prev === 'outline' ? 'tree' : 'outline');
    }, []);

    const toggleArchive = useCallback(() => {
        setViewMode((prev) => {
            if (prev === 'archive') return 'tree';
            // Preload archive note content when panel opens
            const archiveIds = Object.keys(archivedTree.items).filter(id => id !== ROOT_ID);
            if (archiveIds.length > 0) {
                Promise.all(
                    archiveIds.map(async (id) => {
                        try {
                            const cached = await noteCache.getItem(id);
                            if (cached && archivedTree.items[id]?.data?.updated_at &&
                                cached.updated_at === archivedTree.items[id]?.data?.updated_at) {
                                return;
                            }
                            await fetchNote(id);
                        } catch {}
                    })
                );
            }
            return 'archive';
        });
    }, [archivedTree, fetchNote]);

    const toggleStarred = useCallback(() => {
        setViewMode((prev) => {
            if (prev === 'starred') return 'tree';
            // Starred tree + content already preloaded in initTree
            return 'starred';
        });
    }, []);

    // Removed: note-saved event listener that forced switching to 'tree' view.
    // This caused starred/archived notes to jump to main directory after saving.

    const isFold = sidebar.isFold;

    return (
        <section
            className="flex h-full fixed left-0 transition-all duration-300 ease-in-out"
            style={{
                width: isFold ? '48px' : `calc(${sizes[0]}% - 5px)`,
            }}
        >
            <SidebarTool
                onToggleOutline={toggleOutline}
                outlineActive={viewMode === 'outline'}
                onToggleArchive={toggleArchive}
                archiveActive={viewMode === 'archive'}
                onToggleStarred={toggleStarred}
                starredActive={viewMode === 'starred'}
            />
            <div
                className="flex-1 h-full relative overflow-hidden transition-all duration-300 ease-in-out"
                style={{
                    opacity: isFold ? 0 : 1,
                    minWidth: isFold ? 0 : undefined,
                }}
            >
                {!isFold && (
                    <SidebarContent
                        viewMode={viewMode}
                        onToggleOutline={toggleOutline}
                        onToggleArchive={toggleArchive}
                        onToggleStarred={toggleStarred}
                    />
                )}
                {!isFold && <BatchActionsBar panel={viewMode} />}
            </div>
        </section>
    );
};

const MobileSidebar: FC = () => {
    const { loadArchivedTree, loadStarredTree } = NoteTreeState.useContainer();
    const [viewMode, setViewMode] = useState<ViewMode>('tree');

    const toggleOutline = useCallback(() => {
        setViewMode((prev) => prev === 'outline' ? 'tree' : 'outline');
    }, []);

    const toggleArchive = useCallback(() => {
        setViewMode((prev) => {
            if (prev === 'archive') return 'tree';
            loadArchivedTree();
            return 'archive';
        });
    }, [loadArchivedTree]);

    const toggleStarred = useCallback(() => {
        setViewMode((prev) => {
            if (prev === 'starred') return 'tree';
            loadStarredTree();
            return 'starred';
        });
    }, [loadStarredTree]);

    return (
        <section className="flex h-full" style={{ width: '80vw' }}>
            <SidebarTool
                onToggleOutline={toggleOutline}
                outlineActive={viewMode === 'outline'}
                onToggleArchive={toggleArchive}
                archiveActive={viewMode === 'archive'}
                onToggleStarred={toggleStarred}
                starredActive={viewMode === 'starred'}
            />
            <SidebarContent
                viewMode={viewMode}
                onToggleOutline={toggleOutline}
                onToggleArchive={toggleArchive}
                onToggleStarred={toggleStarred}
            />
        </section>
    );
};

export default Sidebar;

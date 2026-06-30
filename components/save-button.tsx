/**
 * SaveButton Component
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

import { FC, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Button, makeStyles } from '@material-ui/core';
import {
    EyeIcon,
    DocumentIcon,
    UploadIcon,
    CheckIcon,
    XIcon
} from '@heroicons/react/outline';
import LexicalEditorState from 'libs/web/state/lexical-editor';
import noteCache from 'libs/web/cache/note';
import { setManagedInterval, setManagedTimeout, clearManagedTimer } from 'libs/web/utils/timer-manager';
import { createContentComparator } from 'libs/web/utils/content-hash';

interface SaveButtonProps {
    className?: string;
}

type SyncStatus = 'view' | 'save' | 'syncing' | 'synced' | 'fail';

const useStyles = makeStyles({
    saveButton: {
        minWidth: '80px',
        fontWeight: 'bold',
        textTransform: 'none',
        borderRadius: '20px',
        boxShadow: 'none !important',
        '&:hover': {
            opacity: 0.8,
            boxShadow: 'none !important',
        },
        '&:focus': {
            boxShadow: 'none !important',
        },
        '&:active': {
            boxShadow: 'none !important',
        },
    },
    viewButton: {
        backgroundColor: '#6B7280 !important',
        color: '#FFFFFF !important',
        '&:hover': {
            backgroundColor: '#4B5563 !important',
        },
    },
    saveStateButton: {
        backgroundColor: '#DC2626 !important',
        color: '#FFFFFF !important',
        '&:hover': {
            backgroundColor: '#B91C1C !important',
        },
    },
    syncingButton: {
        backgroundColor: '#3185eb !important',
        color: '#FFFFFF !important',
        '&:hover': {
            backgroundColor: '#2563EB !important',
        },
    },
    syncedButton: {
        backgroundColor: '#FBBF24 !important',
        color: '#000000 !important',
        '&:hover': {
            backgroundColor: '#F59E0B !important',
        },
    },
    failedButton: {
        backgroundColor: '#DC2626 !important',
        color: '#FFFFFF !important',
        '&:hover': {
            backgroundColor: '#B91C1C !important',
        },
    },
});

const SaveButton: FC<SaveButtonProps> = ({ className }) => {
    const classes = useStyles();
    const { syncToServer, note } = LexicalEditorState.useContainer();
    const [syncStatus, setSyncStatus] = useState<SyncStatus>('view');
    const syncedTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // 创建内容观察器 - 用于检测IndexedDB内容变化
    const localContentComparator = useMemo(() => createContentComparator(), []);
    const localTitleComparator = useMemo(() => createContentComparator(), []);

    useEffect(() => {
        if (!note?.id) return;

        let isEditing = false;
        let baselineReady = false;

        const checkIndexedDBChanges = async () => {
            try {
                const localNote = await noteCache.getItem(note.id);
                if (localNote) {
                    if (!baselineReady) {
                        localContentComparator.updateBaseline(localNote.content || '');
                        localTitleComparator.updateBaseline(localNote.title || '');
                        baselineReady = true;
                        return;
                    }
                    const contentChanged = localContentComparator.hasChanged(localNote.content || '');
                    const titleChanged = localTitleComparator.hasChanged(localNote.title || '');
                    if (contentChanged || titleChanged) {
                        if (!isEditing) {
                            isEditing = true;
                            setSyncStatus('save');
                        }
                    }
                } else {
                    if (isEditing) {
                        isEditing = false;
                        setSyncStatus('view');
                    }
                }
            } catch (error) {
                console.error('SaveButton检查错误:', error);
            }
        };

        setSyncStatus('view');
        isEditing = false;
        baselineReady = false;

        const timerId = `save-button-check-${note.id}`;
        setManagedInterval(timerId, checkIndexedDBChanges, 1000);

        return () => {
            clearManagedTimer(timerId);
            clearManagedTimer(`save-button-sync-timeout-${note?.id || 'unknown'}`);
            clearManagedTimer(`save-button-synced-timeout-${note?.id || 'unknown'}`);

            if (syncedTimeoutRef.current) {
                clearTimeout(syncedTimeoutRef.current);
            }
            if (syncTimeoutRef.current) {
                clearTimeout(syncTimeoutRef.current);
            }
        };
    }, [note]);

    const handleSave = useCallback(async () => {
        setSyncStatus('syncing');

        // 清理之前的定时器
        const syncTimeoutId = `save-button-sync-timeout-${note?.id || 'unknown'}`;
        const syncedTimeoutId = `save-button-synced-timeout-${note?.id || 'unknown'}`;

        clearManagedTimer(syncTimeoutId);
        clearManagedTimer(syncedTimeoutId);

        // 兼容性：清理旧的ref定时器
        if (syncedTimeoutRef.current) {
            clearTimeout(syncedTimeoutRef.current);
        }
        if (syncTimeoutRef.current) {
            clearTimeout(syncTimeoutRef.current);
        }

        // 设置30秒超时
        setManagedTimeout(syncTimeoutId, () => {
            setSyncStatus('fail');
            setManagedTimeout(`${syncTimeoutId}-reset`, () => {
                setSyncStatus('view');
            }, 2000);
        }, 30000);

        try {
            await syncToServer();

            // 清理超时定时器
            const syncTimeoutId = `save-button-sync-timeout-${note?.id || 'unknown'}`;
            const syncedTimeoutId = `save-button-synced-timeout-${note?.id || 'unknown'}`;

            clearManagedTimer(syncTimeoutId);

            // 兼容性：清理旧的ref定时器
            if (syncTimeoutRef.current) {
                clearTimeout(syncTimeoutRef.current);
                syncTimeoutRef.current = null;
            }

            setSyncStatus('synced');
            window.dispatchEvent(new Event('note-saved'));

            const savedNote = await noteCache.getItem(note?.id || '');
            if (savedNote) {
                localContentComparator.updateBaseline(savedNote.content || '');
                localTitleComparator.updateBaseline(savedNote.title || '');
            }

            // 2秒后重置为view状态
            setManagedTimeout(syncedTimeoutId, () => {
                setSyncStatus('view');
            }, 2000);

        } catch (error) {
            // 清理超时定时器
            const syncTimeoutId = `save-button-sync-timeout-${note?.id || 'unknown'}`;
            clearManagedTimer(syncTimeoutId);

            // 兼容性：清理旧的ref定时器
            if (syncTimeoutRef.current) {
                clearTimeout(syncTimeoutRef.current);
                syncTimeoutRef.current = null;
            }

            setSyncStatus('fail');

            // 2秒后重置为view状态
            setManagedTimeout(`save-button-fail-reset-${note?.id || 'unknown'}`, () => {
                setSyncStatus('view');
            }, 2000);
        }
    }, [syncToServer]);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            (window as any).saveButtonStatus = syncStatus;
            (window as any).saveButtonAutoSave = handleSave;
        }

        return () => {
            if (typeof window !== 'undefined') {
                delete (window as any).saveButtonStatus;
                delete (window as any).saveButtonAutoSave;
            }
        };
    }, [syncStatus, handleSave]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                const target = e.target as HTMLElement;
                const isInEditor = target.closest('.ProseMirror') ||
                                 target.closest('[contenteditable]') ||
                                 target.closest('textarea') ||
                                 target.closest('input');

                if (isInEditor) {
                    e.preventDefault();
                    e.stopPropagation();
                    handleSave();
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown, true);
        return () => document.removeEventListener('keydown', handleKeyDown, true);
    }, [handleSave]);

    const getButtonIcon = () => {
        switch (syncStatus) {
            case 'view':
                return <EyeIcon className="w-4 h-4" />;
            case 'save':
                return <DocumentIcon className="w-4 h-4" />;
            case 'syncing':
                return <UploadIcon className="w-4 h-4 animate-pulse" />;
            case 'synced':
                return <CheckIcon className="w-4 h-4" />;
            case 'fail':
                return <XIcon className="w-4 h-4" />;
            default:
                return <EyeIcon className="w-4 h-4" />;
        }
    };

    const getButtonText = () => {
        switch (syncStatus) {
            case 'view':
                return 'View';
            case 'save':
                return 'Save';
            case 'syncing':
                return 'Syncing...';
            case 'synced':
                return 'Synced';
            case 'fail':
                return 'Failed';
            default:
                return 'View';
        }
    };

    const getButtonClassName = () => {
        const baseClass = `${classes.saveButton}`;
        switch (syncStatus) {
            case 'view':
                return `${baseClass} ${classes.viewButton}`;
            case 'save':
                return `${baseClass} ${classes.saveStateButton}`;
            case 'syncing':
                return `${baseClass} ${classes.syncingButton}`;
            case 'synced':
                return `${baseClass} ${classes.syncedButton}`;
            case 'fail':
                return `${baseClass} ${classes.failedButton}`;
            default:
                return `${baseClass} ${classes.viewButton}`;
        }
    };

    const isButtonDisabled = () => {
        return syncStatus === 'syncing' || syncStatus === 'view';
    };

    return (
        <Button
            variant="contained"
            startIcon={getButtonIcon()}
            onClick={handleSave}
            disabled={isButtonDisabled()}
            className={`${getButtonClassName()} ${className || ''}`}
            size="small"
            data-save-button="true"
        >
            {getButtonText()}
        </Button>
    );
};

export default SaveButton;

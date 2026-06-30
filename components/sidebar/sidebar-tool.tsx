import {
    SearchIcon,
    TrashIcon,
    ChevronDoubleLeftIcon,
    InboxIcon,
    CogIcon,
    LockOpenIcon,
    LockClosedIcon,
    LogoutIcon,
} from '@heroicons/react/outline';
import { ViewListIcon, ArchiveIcon, StarIcon } from '@heroicons/react/solid';
import { forwardRef, HTMLProps, useCallback } from 'react';
import UIState from 'libs/web/state/ui';
import NoteState from 'libs/web/state/note';
import classNames from 'classnames';
import HotkeyTooltip from 'components/hotkey-tooltip';
import Link from 'next/link';
import dayjs from 'dayjs';
import PortalState from 'libs/web/state/portal';
import useI18n from 'libs/web/hooks/use-i18n';

import { useRouter } from 'next/router';
import NoteTreeState from 'libs/web/state/tree';

const ButtonItem = forwardRef<HTMLDivElement, HTMLProps<HTMLDivElement>>(
    (props, ref) => {
        const { children, className, ...attrs } = props;
        return (
            <div
                {...attrs}
                ref={ref}
                className={classNames(
                    'block m-3 text-gray-500 hover:text-gray-800 cursor-pointer',
                    className
                )}
            >
                {children}
            </div>
        );
    }
);

const ButtonMenu = () => {
    const { t } = useI18n();
    const {
        sidebar: { toggle, isFold },
    } = UIState.useContainer();
    const onFold = useCallback(() => {
        toggle()
            ?.catch((v) => console.error('Error whilst toggling tool: %O', v));
    }, [toggle]);

    return (
        <HotkeyTooltip
            text={t('Fold sidebar')}
            commandKey
            onHotkey={onFold}
            keys={['\\']}
        >
            <ButtonItem onClick={onFold}>
                <ChevronDoubleLeftIcon
                    className={classNames('transform transition-transform', {
                        'rotate-180': isFold,
                    })}
                />
            </ButtonItem>
        </HotkeyTooltip>
    );
};

const ButtonSearch = () => {
    const { t } = useI18n();
    const { search } = PortalState.useContainer();

    return (
        <HotkeyTooltip
            text={t('Search note')}
            commandKey
            onHotkey={search.open}
            keys={['P']}
        >
            <ButtonItem onClick={search.open} aria-label="search">
                <SearchIcon />
            </ButtonItem>
        </HotkeyTooltip>
    );
};

const ButtonTrash = () => {
    const { t } = useI18n();
    const { trash } = PortalState.useContainer();

    return (
        <HotkeyTooltip
            text={t('Trash')}
            commandKey
            optionKey
            onHotkey={trash.open}
            keys={['T']}
        >
            <ButtonItem onClick={trash.open} aria-label="trash">
                <TrashIcon />
            </ButtonItem>
        </HotkeyTooltip>
    );
};

const ButtonDailyNotes = () => {
    const { t } = useI18n();
    const { genNewId } = NoteTreeState.useContainer();
    const { createNote } = NoteState.useContainer();
    const today = dayjs().format('YYYY-MM-DD');
    const router = useRouter();

    const handleDailyNoteClick = useCallback(async () => {
        const newId = genNewId();
        const content = JSON.stringify({
            root: {
                children: [
                    {
                        children: [
                            { children: [{ detail: 0, format: 0, mode: 'normal', style: '', text: '', type: 'text', version: 1 }], direction: null, format: '', indent: 0, type: 'listitem', version: 1, value: 1, listType: 'check', checked: false },
                            { children: [{ detail: 0, format: 0, mode: 'normal', style: '', text: '', type: 'text', version: 1 }], direction: null, format: '', indent: 0, type: 'listitem', version: 1, value: 2, listType: 'check', checked: false },
                            { children: [{ detail: 0, format: 0, mode: 'normal', style: '', text: '', type: 'text', version: 1 }], direction: null, format: '', indent: 0, type: 'listitem', version: 1, value: 3, listType: 'check', checked: false },
                            { children: [{ detail: 0, format: 0, mode: 'normal', style: '', text: '', type: 'text', version: 1 }], direction: null, format: '', indent: 0, type: 'listitem', version: 1, value: 4, listType: 'check', checked: false },
                        ],
                        direction: null, format: '', indent: 0, type: 'list', version: 1, listType: 'check',
                    },
                ],
                direction: null, format: '', indent: 0, type: 'root', version: 1,
            },
        });
        const result = await createNote({ id: newId, title: today, content });
        if (result?.id) {
            router.push(`/${result.id}`, undefined, { shallow: true });
        }
    }, [genNewId, today, createNote, router]);

    return (
        <HotkeyTooltip
            text={t('Daily Notes')}
            commandKey
            onHotkey={handleDailyNoteClick}
            keys={['shift', 'O']}
        >
            <ButtonItem aria-label="daily notes" onClick={handleDailyNoteClick}>
                <InboxIcon />
            </ButtonItem>
        </HotkeyTooltip>
    );
};

const ButtonSettings = () => {
    const { t } = useI18n();

    return (
        <Link href="/settings" shallow>
            <a>
                <HotkeyTooltip text={t('Settings')}>
                    <ButtonItem aria-label="settings">
                        <CogIcon />
                    </ButtonItem>
                </HotkeyTooltip>
            </a>
        </Link>
    );
};

const ButtonLock = () => {
    const { t } = useI18n();
    const { isEditMode, toggleEditMode } = UIState.useContainer();

    return (
        <HotkeyTooltip text={isEditMode ? t('Lock') : t('Unlock')}>
            <ButtonItem onClick={toggleEditMode} aria-label="lock">
                {isEditMode ? (
                    <LockOpenIcon className="text-green-500" />
                ) : (
                    <LockClosedIcon />
                )}
            </ButtonItem>
        </HotkeyTooltip>
    );
};

const ButtonLogout = () => {
    const { t } = useI18n();

    const handleLogout = useCallback(async () => {
        try {
            // 调用服务端登出 API 清理 session
            await fetch('/api/auth/logout', { method: 'POST' });
        } catch {
            // 即使 API 失败也继续清理
        }

        // 清理 IndexedDB
        if (typeof window !== 'undefined' && window.indexedDB) {
            try {
                const databases = await window.indexedDB.databases();
                for (const db of databases) {
                    if (db.name) {
                        window.indexedDB.deleteDatabase(db.name);
                    }
                }
            } catch {
                // 忽略错误
            }
        }
        // 清理 localStorage
        localStorage.clear();
        // 清理 sessionStorage
        sessionStorage.clear();
        // 跳转到登录页
        window.location.href = '/login';
    }, []);

    return (
        <HotkeyTooltip text={t('Logout')}>
            <ButtonItem onClick={handleLogout} aria-label="logout">
                <LogoutIcon className="text-red-500" />
            </ButtonItem>
        </HotkeyTooltip>
    );
};

const ButtonOutline = ({ onClick, active }: { onClick: () => void; active: boolean }) => {
    const { t } = useI18n();

    return (
        <HotkeyTooltip text={t('Outline')}>
            <ButtonItem
                onClick={onClick}
                aria-label="outline"
                className={active ? 'text-blue-600' : ''}
            >
                <ViewListIcon className="w-5 h-5" />
            </ButtonItem>
        </HotkeyTooltip>
    );
};

const ButtonArchive = ({ onClick, active }: { onClick: () => void; active: boolean }) => {
    const { t } = useI18n();

    return (
        <HotkeyTooltip text={t('Archive')}>
            <ButtonItem
                onClick={onClick}
                aria-label="archive"
                className={active ? 'text-blue-500' : ''}
            >
                <ArchiveIcon className="w-5 h-5" />
            </ButtonItem>
        </HotkeyTooltip>
    );
};

const ButtonStar = ({ onClick, active }: { onClick: () => void; active: boolean }) => {
    const { t } = useI18n();

    return (
        <HotkeyTooltip text={t('Starred')}>
            <ButtonItem
                onClick={onClick}
                aria-label="starred"
                className={active ? 'text-yellow-500' : ''}
            >
                <StarIcon className="w-5 h-5" />
            </ButtonItem>
        </HotkeyTooltip>
    );
};

const SidebarTool = ({ onToggleOutline, outlineActive, onToggleArchive, archiveActive, onToggleStarred, starredActive }: {
    onToggleOutline: () => void;
    outlineActive: boolean;
    onToggleArchive: () => void;
    archiveActive: boolean;
    onToggleStarred: () => void;
    starredActive: boolean;
}) => {
    return (
        <aside className="h-full flex flex-col w-12  md:w-11 flex-none bg-gray-200">
            <ButtonSearch />
            <ButtonOutline onClick={onToggleOutline} active={outlineActive} />
            <ButtonArchive onClick={onToggleArchive} active={archiveActive} />
            <ButtonStar onClick={onToggleStarred} active={starredActive} />
            <ButtonDailyNotes />
            <ButtonTrash />

            <div className="tool mt-auto">
                <ButtonMenu></ButtonMenu>
                <ButtonLock />
                <ButtonSettings></ButtonSettings>
                <ButtonLogout />
            </div>
        </aside>
    );
};

export default SidebarTool;

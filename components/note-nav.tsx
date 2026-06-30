import classNames from 'classnames';
import NoteState from 'libs/web/state/note';
import UIState from 'libs/web/state/ui';
import { useCallback, MouseEvent } from 'react';
import { CircularProgress, Tooltip } from '@material-ui/core';
import NoteTreeState from 'libs/web/state/tree';
import { Breadcrumbs } from '@material-ui/core';
import Link from 'next/link';
import IconButton from './icon-button';
import HotkeyTooltip from './hotkey-tooltip';
import PortalState from 'libs/web/state/portal';
import { NOTE_SHARED } from 'libs/shared/meta';
import useI18n from 'libs/web/hooks/use-i18n';
import NavButtonGroup from './nav-button-group';
import SaveButton from './save-button';
import VersionToggle from './version-toggle';
import UpdatedAtDisplay from './updated-at-display';
import { EyeIcon } from '@heroicons/react/outline';

const MenuButton = () => {
    const { sidebar } = UIState.useContainer();

    const onToggle = useCallback(
        (e: MouseEvent) => {
            e.stopPropagation();
            sidebar.toggle()
                ?.catch((v) => console.error('Error whilst toggling sidebar: %O', v));
        },
        [sidebar]
    );

    return (
        <IconButton
            icon="Menu"
            className="mr-2 active:bg-gray-400"
            onClick={onToggle}
        ></IconButton>
    );
};

const NoteNav = () => {
    const { t } = useI18n();
    const { note, loading } = NoteState.useContainer();
    const { ua } = UIState.useContainer();
    const { getPaths, showItem, checkItemIsShown } =
        NoteTreeState.useContainer();
    const { share, menu, editorWidthSelect } = PortalState.useContainer();

    const handleClickShare = useCallback(
        (event: MouseEvent) => {
            share.setData(note);
            share.setAnchor(event.target as Element);
            share.open();
        },
        [note, share]
    );

    const handleClickMenu = useCallback(
        (event: MouseEvent) => {
            menu.setData(note);
            menu.setAnchor(event.target as Element);
            menu.open();
        },
        [note, menu]
    );
    const handleClickEditorWidth = useCallback(
        (event: MouseEvent) => {
            editorWidthSelect.setData(note);
            editorWidthSelect.setAnchor(event.target as Element);
            editorWidthSelect.open();
        },
        [note, editorWidthSelect]
    );

    const handleClickOpenInTree = useCallback(() => {
        if (!note) return;
        showItem(note);
    }, [note, showItem]);

    return (
        <nav
            className={classNames(
                'fixed bg-gray-50 z-10 right-0 flex',
                'lg:items-center lg:h-auto lg:p-2',
                'max-lg:flex-col max-lg:items-start max-lg:py-6 max-lg:px-2',
                {
                    shadow: ua.isMobileOnly,
                }
            )}
            style={{
                width: ua.isMobileOnly ? '100%' : 'inherit',
            }}
        >
            {ua.isMobileOnly ? <MenuButton /> : null}

            {/* 导航箭头 - 在窄屏时隐藏 */}
            <div className="hidden lg:block">
                <NavButtonGroup />
            </div>

            <div className="flex-auto lg:ml-4 max-lg:mb-2">
                {note && (
                    <Breadcrumbs
                        maxItems={2}
                        className="text-gray-800 leading-none"
                        aria-label="breadcrumb"
                    >
                        {getPaths(note)
                            .reverse()
                            .map((path) => (
                                <Tooltip key={path.id} title={path.title}>
                                    <div>
                                        <Link href={`/${path.id}`} shallow>
                                            <a className="title block hover:bg-gray-200 px-1 py-0.5 rounded text-sm truncate">
                                                {path.title}
                                            </a>
                                        </Link>
                                    </div>
                                </Tooltip>
                            ))}
                        <span>
                            <Tooltip title={note.title}>
                                <span
                                    className="title inline-block text-gray-600 text-sm truncate select-none align-middle"
                                    aria-current="page"
                                >
                                    {note.title}
                                </span>
                            </Tooltip>
                            <UpdatedAtDisplay className="inline-block ml-2 hidden lg:inline-block" />
                            {!checkItemIsShown(note) && (
                                <Tooltip title={t('Show note in tree')}>
                                    <span>
                                        <EyeIcon
                                            width="20"
                                            className="inline-block cursor-pointer ml-1"
                                            onClick={handleClickOpenInTree}
                                        />
                                    </span>
                                </Tooltip>
                            )}
                        </span>
                    </Breadcrumbs>
                )}
                <style jsx>
                    {`
                        .title {
                            max-width: 120px;
                        }

                        @media (max-width: 959px) {
                            .title {
                                max-width: 10ch; /* 10个字符宽度 */
                            }
                        }
                    `}
                </style>
            </div>

            {/* 按钮区域 */}
            <div className="flex items-center max-lg:mt-2">
                <div
                    className={classNames(
                        'flex mr-2 transition-opacity delay-100',
                        {
                            'opacity-0': !loading,
                        }
                    )}
                >
                    <CircularProgress size="14px" color="inherit" />
                </div>
                <VersionToggle className="mr-2" />
                <SaveButton className="mr-2" />

                {/* Share按钮 - 在窄屏时隐藏 */}
                <div className="hidden lg:block">
                    <HotkeyTooltip text={t('Share page')}>
                        <IconButton
                            onClick={handleClickShare}
                            className="mr-2"
                            disabled={!note}
                            iconClassName={classNames({
                                'text-blue-500': note?.shared === NOTE_SHARED.PUBLIC,
                            })}
                            style={{
                                color: note?.shared === NOTE_SHARED.PUBLIC ? '#3185eb' : undefined
                            }}
                            icon="Share"
                        />
                    </HotkeyTooltip>
                </div>

                {/* 宽度调节按钮 - 在窄屏时隐藏 */}
                <div className="hidden lg:block">
                    <HotkeyTooltip text={t('Editor width')}>
                        <IconButton
                            icon="WidthSize"
                            className="mr-2"
                            onClick={handleClickEditorWidth}
                        >
                        </IconButton>
                    </HotkeyTooltip>
                </div>

                <HotkeyTooltip text={t('Settings')}>
                    <IconButton
                        disabled={!note}
                        onClick={handleClickMenu}
                        icon="DotsHorizontal"
                    />
                </HotkeyTooltip>
            </div>
        </nav>
    );
};

export default NoteNav;

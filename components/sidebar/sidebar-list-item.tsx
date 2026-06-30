import { NoteModel } from 'libs/shared/note';
import Link from 'next/link';
import { FC, ReactText, MouseEvent, useCallback, useMemo, useState } from 'react';
import classNames from 'classnames';
import { useRouter } from 'next/router';
import HotkeyTooltip from 'components/hotkey-tooltip';
import IconButton from 'components/icon-button';
import NoteTreeState from 'libs/web/state/tree';
import UIState from 'libs/web/state/ui';
import { Skeleton } from '@material-ui/lab';
import PortalState from 'libs/web/state/portal';
import useI18n from 'libs/web/hooks/use-i18n';
import emojiRegex from 'emoji-regex';

const TextSkeleton = () => (
    <Skeleton
        width={80}
        variant="text"
        animation="wave"
        classes={{
            root: 'bg-gray-300',
        }}
    />
);

const SidebarListItem: FC<{
    item: NoteModel;
    innerRef: (el: HTMLElement | null) => void;
    onExpand: (itemId?: ReactText) => void;
    onCollapse: (itemId?: ReactText) => void;
    isExpanded: boolean;
    hasChildren: boolean;
    snapshot: {
        isDragging: boolean;
    };
    style?: {
        paddingLeft: number;
    };
}> = ({
    item,
    innerRef,
    onExpand,
    onCollapse,
    isExpanded,
    snapshot,
    hasChildren,
    ...attrs
}) => {
    const { t } = useI18n();
    const router = useRouter();
    const { query } = router;
    const { mutateItem, initLoaded, genNewId } = NoteTreeState.useContainer();
    const { isEditMode, selectedNoteIds, toggleNoteSelection } = UIState.useContainer();
    const {
        menu: { open, setData, setAnchor },
    } = PortalState.useContainer();
    const isSelected = selectedNoteIds.has(item.id);

    // 添加hover状态来控制按钮显示
    const [isHovered, setIsHovered] = useState(false);

    // 提取图标选择逻辑
    const getIconType = useCallback(() => {
        if (hasChildren || isExpanded) return 'ChevronRight';
        if (item.title) return 'DocumentText';
        return 'Document';
    }, [hasChildren, isExpanded, item.title]);

    const onAddNote = useCallback(
        (e: MouseEvent) => {
            e.preventDefault();
            const newId = genNewId();
            router.push(`/${newId}?new&pid=` + item.id, undefined, { shallow: true })
                ?.catch((v) => console.error('Error whilst pushing to router: %O', v));
            mutateItem(item.id, {
                isExpanded: true,
            })
                ?.catch((v) => console.error('Error whilst mutating item: %O', v));
        },
        [item.id, mutateItem, genNewId]
    );

    const handleClickMenu = useCallback(
        (event: MouseEvent) => {
            event.preventDefault();
            setAnchor(event.target as Element);
            open();
            setData(item);
        },
        [item, open, setAnchor, setData]
    );

    const handleClickIcon = useCallback(
        (e: MouseEvent) => {
            e.preventDefault();
            isExpanded ? onCollapse(item.id) : onExpand(item.id);
        },
        [item.id, isExpanded, onCollapse, onExpand]
    );

    const emoji = useMemo(() => {
        const emoji = item.title?.match(emojiRegex());
        if (emoji?.length === 1) return emoji[0];
        return undefined;
    }, [item.title]);

    const noteUrl = useMemo(() => {
        if (typeof window !== 'undefined') {
            return `${window.location.origin}/${item.id}`;
        }
        return `/${item.id}`;
    }, [item.id]);

    const onDragStart = useCallback(
        (e: React.DragEvent) => {
            e.dataTransfer.setData('text/uri-list', noteUrl);
            e.dataTransfer.setData('text/plain', noteUrl);
            e.dataTransfer.effectAllowed = 'copyLink';
        },
        [noteUrl]
    );

    // 提取标题显示逻辑（必须在emoji声明之后）
    const getDisplayTitle = useCallback(() => {
        if (!initLoaded) return <TextSkeleton />;

        const baseTitle = emoji
            ? item.title.replace(emoji, '').trimLeft()
            : item.title;

        return baseTitle || t('Untitled');
    }, [emoji, item.title, initLoaded, t]);

    return (
        <>
            <div
                {...attrs}
                ref={innerRef}
                className={classNames(
                    'flex items-center group pr-2 overflow-hidden hover:bg-gray-300 text-gray-700',
                    {
                        'shadow bg-gray-300': snapshot.isDragging,
                        'bg-gray-200': query.id === item.id && !isEditMode,
                        'bg-blue-100': isSelected,
                    }
                )}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            >
                {isEditMode && (
                    <span className="ml-2 mr-1 flex-shrink-0 cursor-pointer" onClick={(e) => { e.preventDefault(); toggleNoteSelection(item.id); }}>
                        {isSelected ? (
                            <span className="block w-4 h-4 border-2 border-blue-500 bg-blue-500 rounded flex items-center justify-center">
                                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </span>
                        ) : (
                            <span className="block w-4 h-4 border-2 border-gray-400 rounded" />
                        )}
                    </span>
                )}
                <Link href={`/${item.id}`} shallow>
                    <a
                        className="flex flex-1 items-center truncate px-2 py-1.5"
                        draggable={!isEditMode}
                        onDragStart={isEditMode ? undefined : onDragStart}
                        onClick={(e) => {
                            if (isEditMode) {
                                e.preventDefault();
                                toggleNoteSelection(item.id);
                            }
                        }}
                    >
                        {emoji ? (
                            <span
                                onClick={isEditMode ? (e) => { e.preventDefault(); toggleNoteSelection(item.id); } : handleClickIcon}
                                className={classNames(
                                    'block p-0.5 cursor-pointer w-7 h-7 md:w-6 md:h-6 rounded hover:bg-gray-400 mr-1 text-center'
                                )}
                            >
                                {emoji}
                            </span>
                        ) : (
                            <IconButton
                                className="mr-1"
                                icon={getIconType()}
                                iconClassName={classNames(
                                    'transition-transform transform',
                                    {
                                        'rotate-90': isExpanded,
                                    }
                                )}
                                onClick={isEditMode ? (e) => { e.preventDefault(); toggleNoteSelection(item.id); } : handleClickIcon}
                            ></IconButton>
                        )}

                        <span className="flex-1 truncate" dir="auto">
                            {getDisplayTitle()}
                        </span>
                    </a>
                </Link>

                {isHovered && !isEditMode && (
                    <>
                        <HotkeyTooltip text={t('Remove, Copy Link, etc')}>
                            <IconButton
                                icon="DotsHorizontal"
                                onClick={handleClickMenu}
                            ></IconButton>
                        </HotkeyTooltip>

                        <HotkeyTooltip text={t('Add a page inside')}>
                            <IconButton
                                icon="Plus"
                                onClick={onAddNote}
                                className="ml-1"
                            ></IconButton>
                        </HotkeyTooltip>
                    </>
                )}
            </div>

            {!hasChildren && isExpanded && (
                <div
                    className="ml-9 py-1.5 text-gray-400 select-none"
                    style={{
                        paddingLeft: attrs.style?.paddingLeft,
                    }}
                >
                    {initLoaded ? t('No notes inside') : <TextSkeleton />}
                </div>
            )}
        </>
    );
};

export default SidebarListItem;

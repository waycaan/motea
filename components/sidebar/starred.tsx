import Tree from '@atlaskit/tree';
import HotkeyTooltip from 'components/hotkey-tooltip';
import IconButton from 'components/icon-button';
import { ROOT_ID } from 'libs/shared/tree';
import useI18n from 'libs/web/hooks/use-i18n';
import NoteTreeState from 'libs/web/state/tree';
import { FC, useCallback, useMemo, useState } from 'react';
import SidebarListItem from './sidebar-list-item';

export const Starred: FC<{ onClose: () => void }> = ({ onClose }) => {
    const { t } = useI18n();
    const { starredTree } = NoteTreeState.useContainer();
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
    const starredCount = useMemo(
        () => starredTree.items[ROOT_ID]?.children?.length ?? 0,
        [starredTree]
    );

    const onExpand = useCallback((id: string | number) => {
        setExpandedIds((prev) => new Set(prev).add(String(id)));
    }, []);

    const onCollapse = useCallback((id: string | number) => {
        setExpandedIds((prev) => {
            const next = new Set(prev);
            next.delete(String(id));
            return next;
        });
    }, []);

    const treeWithExpand = useMemo(() => {
        const items = { ...starredTree.items };
        for (const id of Object.keys(items)) {
            items[id] = {
                ...items[id],
                isExpanded: expandedIds.has(id),
            };
        }
        return { ...starredTree, items };
    }, [starredTree, expandedIds]);

    return (
        <>
            <div className="group p-2 text-gray-500 flex items-center sticky top-0 bg-gray-100 z-10">
                <div className="flex-auto flex items-center">
                    <span>{t('Starred')}</span>
                    {starredCount > 0 && (
                        <span className="ml-2 text-xs text-gray-400">({starredCount})</span>
                    )}
                </div>
                <HotkeyTooltip text={t('Back to pages')}>
                    <IconButton
                        icon="XIcon"
                        onClick={onClose}
                        className="text-gray-700"
                    ></IconButton>
                </HotkeyTooltip>
            </div>
            <div className="overflow-y-auto">
                {starredCount === 0 ? (
                    <div className="px-3 py-4 text-xs text-gray-400">
                        {t('No starred notes')}
                    </div>
                ) : (
                    <div className="transition-all duration-300 ease-in-out">
                        <Tree
                            tree={treeWithExpand}
                            offsetPerLevel={10}
                            onExpand={onExpand}
                            onCollapse={onCollapse}
                            renderItem={({
                                provided,
                                item,
                                snapshot,
                            }) => {
                                const hasChildren = item.children && item.children.length > 0;
                                return (
                                    <SidebarListItem
                                        {...provided.draggableProps}
                                        {...provided.dragHandleProps}
                                        innerRef={provided.innerRef}
                                        hasChildren={hasChildren}
                                        isExpanded={expandedIds.has(String(item.id))}
                                        onExpand={onExpand}
                                        onCollapse={onCollapse}
                                        item={{
                                            ...item.data,
                                            id: item.id,
                                        }}
                                        snapshot={snapshot}
                                    ></SidebarListItem>
                                );
                            }}
                        ></Tree>
                    </div>
                )}
            </div>
        </>
    );
};

/**
 * Slash Commands Plugin for Lexical
 * Provides quick insertion of various content types using "/" trigger
 */

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
    LexicalTypeaheadMenuPlugin,
    MenuOption,
    useBasicTypeaheadTriggerMatch,
} from '@lexical/react/LexicalTypeaheadMenuPlugin';
import { $createQuoteNode } from '@lexical/rich-text';
import { $getSelection, $isRangeSelection } from 'lexical';
import { $setBlocksType } from '@lexical/selection';
import {
    INSERT_ORDERED_LIST_COMMAND,
    INSERT_UNORDERED_LIST_COMMAND,
    INSERT_CHECK_LIST_COMMAND
} from '@lexical/list';
import { INSERT_HORIZONTAL_RULE_COMMAND } from '@lexical/react/LexicalHorizontalRuleNode';
import { INSERT_CODE_BLOCK_COMMAND } from './code-block-plugin';
import { FORMAT_TEXT_ALIGN_COMMAND } from './text-align-plugin';
import { INSERT_CUSTOM_TABLE_COMMAND } from './table-plugin';
import { useCallback, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from 'next-themes';
import TableConfigDialog from '../components/table-config-dialog';

// Heroicons
import {
    ViewListIcon,
    CollectionIcon,
    ClipboardListIcon,
    AnnotationIcon,
    MinusIcon,
    CodeIcon,
} from '@heroicons/react/outline';

// 对齐图标组件
const AlignLeftIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6h18M3 12h12M3 18h18" />
    </svg>
);

const AlignCenterIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6h18M7 12h10M3 18h18" />
    </svg>
);

const TableIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h18v18H3V3z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v18" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 3v18" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9h18" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15h18" />
    </svg>
);



class SlashCommandOption extends MenuOption {
    title: string;
    icon?: JSX.Element;
    keywords: Array<string>;
    keyboardShortcut?: string;
    onSelect: (queryString: string) => void;

    constructor(
        title: string,
        options: {
            icon?: JSX.Element;
            keywords?: Array<string>;
            keyboardShortcut?: string;
            onSelect: (queryString: string) => void;
        },
    ) {
        super(title);
        this.title = title;
        this.keywords = options.keywords || [];
        this.icon = options.icon;
        this.keyboardShortcut = options.keyboardShortcut;
        this.onSelect = options.onSelect.bind(this);
    }
}

function SlashCommandMenuItem({
    index,
    isSelected,
    onClick,
    onMouseEnter,
    option,
}: {
    index: number;
    isSelected: boolean;
    onClick: () => void;
    onMouseEnter: () => void;
    option: SlashCommandOption;
}) {
    return (
        <li
            key={option.key}
            tabIndex={-1}
            className={`slash-command-item ${isSelected ? 'selected' : ''}`}
            ref={option.setRefElement}
            role="option"
            aria-selected={isSelected}
            id={'typeahead-item-' + index}
            onMouseEnter={onMouseEnter}
            onClick={onClick}
        >
            {option.icon && <div className="slash-command-icon">{option.icon}</div>}
            <div className="slash-command-text">
                <span className="slash-command-title">{option.title}</span>
                {option.keyboardShortcut && (
                    <span className="slash-command-shortcut">{option.keyboardShortcut}</span>
                )}
            </div>
        </li>
    );
}

export default function SlashCommandsPlugin(): JSX.Element {
    const [editor] = useLexicalComposerContext();
    const [queryString, setQueryString] = useState<string | null>(null);
    const [isTableDialogOpen, setIsTableDialogOpen] = useState(false);
    const { theme } = useTheme();

    const checkForTriggerMatch = useBasicTypeaheadTriggerMatch('/', {
        minLength: 0,
    });

    const options = useMemo(() => {
        const baseOptions = [
            new SlashCommandOption('Checklist', {
                icon: <ClipboardListIcon className="w-4 h-4" />,
                keywords: ['checklist', 'todo', 'task', 'checkbox'],
                onSelect: () => {
                    editor.dispatchCommand(INSERT_CHECK_LIST_COMMAND, undefined);
                },
            }),
            new SlashCommandOption('Bullet List', {
                icon: <ViewListIcon className="w-4 h-4" />,
                keywords: ['bullet', 'list', 'unordered', 'ul'],
                onSelect: () => {
                    editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
                },
            }),
            new SlashCommandOption('Numbered List', {
                icon: <CollectionIcon className="w-4 h-4" />,
                keywords: ['numbered', 'list', 'ordered', 'ol'],
                onSelect: () => {
                    editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
                },
            }),
            new SlashCommandOption('Quote', {
                icon: <AnnotationIcon className="w-4 h-4" />,
                keywords: ['quote', 'blockquote', 'citation'],
                onSelect: () => {
                    editor.update(() => {
                        const selection = $getSelection();
                        if ($isRangeSelection(selection)) {
                            $setBlocksType(selection, () => $createQuoteNode());
                        }
                    });
                },
            }),
            new SlashCommandOption('Divider', {
                icon: <MinusIcon className="w-4 h-4" />,
                keywords: ['divider', 'separator', 'hr', 'horizontal', 'rule'],
                onSelect: () => {
                    editor.dispatchCommand(INSERT_HORIZONTAL_RULE_COMMAND, undefined);
                },
            }),
            new SlashCommandOption('Code Block', {
                icon: <CodeIcon className="w-4 h-4" />,
                keywords: ['code', 'block', 'codeblock', 'pre'],
                onSelect: () => {
                    editor.dispatchCommand(INSERT_CODE_BLOCK_COMMAND, undefined);
                },
            }),
            new SlashCommandOption('Left Align', {
                icon: <AlignLeftIcon />,
                keywords: ['left', 'align', 'alignment'],
                onSelect: () => {
                    editor.dispatchCommand(FORMAT_TEXT_ALIGN_COMMAND, 'left');
                },
            }),
            new SlashCommandOption('Center Align', {
                icon: <AlignCenterIcon />,
                keywords: ['center', 'align', 'alignment'],
                onSelect: () => {
                    editor.dispatchCommand(FORMAT_TEXT_ALIGN_COMMAND, 'center');
                },
            }),
            new SlashCommandOption('Table', {
                icon: <TableIcon />,
                keywords: ['table', 'grid', 'rows', 'columns'],
                onSelect: () => {
                    setIsTableDialogOpen(true);
                },
            }),
        ];

        if (!queryString) {
            return baseOptions;
        }

        return baseOptions.filter((option) => {
            return new RegExp(queryString, 'gi').exec(option.title) ||
                option.keywords != null
                    ? option.keywords.some((keyword) =>
                        new RegExp(queryString, 'gi').exec(keyword),
                    )
                    : false;
        });
    }, [editor, queryString]);

    const onSelectOption = useCallback(
        (
            selectedOption: SlashCommandOption,
            nodeToRemove: any,
            closeMenu: () => void,
            matchingString: string,
        ) => {
            editor.update(() => {
                if (nodeToRemove) {
                    nodeToRemove.remove();
                }
                selectedOption.onSelect(matchingString);
                closeMenu();
            });
        },
        [editor],
    );

    const handleTableConfirm = useCallback((rows: number, columns: number) => {
        editor.dispatchCommand(INSERT_CUSTOM_TABLE_COMMAND, { rows, columns });
    }, [editor]);

    return (
        <>
            <LexicalTypeaheadMenuPlugin<SlashCommandOption>
                onQueryChange={setQueryString}
                onSelectOption={onSelectOption}
                triggerFn={checkForTriggerMatch}
                options={options}
                menuRenderFn={(
                    anchorElementRef,
                    { selectedIndex, selectOptionAndCleanUp, setHighlightedIndex },
                ) =>
                    anchorElementRef.current && options.length
                        ? createPortal(
                            <div className={`slash-commands-menu ${theme === 'dark' ? 'dark' : ''}`}>
                                <ul className="slash-commands-list">
                                    {options.map((option, i: number) => (
                                        <SlashCommandMenuItem
                                            index={i}
                                            isSelected={selectedIndex === i}
                                            onClick={() => {
                                                setHighlightedIndex(i);
                                                selectOptionAndCleanUp(option);
                                            }}
                                            onMouseEnter={() => {
                                                setHighlightedIndex(i);
                                            }}
                                            key={option.key}
                                            option={option}
                                        />
                                    ))}
                                </ul>
                            </div>,
                            anchorElementRef.current,
                        )
                        : null
                }
            />
            <style jsx global>{`
                .slash-commands-menu {
                    background: #f4f4f5;
                    border: 1px solid #e5e7eb;
                    border-radius: 0.5rem;
                    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
                    max-height: 300px;
                    min-width: 240px;
                    overflow-y: auto;
                    padding: 0.5rem 0;
                    z-index: 1000;
                    position: absolute;
                }

                .slash-commands-menu.dark {
                    background: #27272a;
                    border-color: #374151;
                }

                .slash-commands-list {
                    list-style: none;
                    margin: 0;
                    padding: 0;
                }

                .slash-command-item {
                    display: flex;
                    align-items: center;
                    padding: 0.75rem 1rem;
                    cursor: pointer;
                    transition: all 0.15s ease;
                    border-radius: 0.25rem;
                    margin: 0 0.25rem;
                }

                .slash-command-item:hover,
                .slash-command-item.selected {
                    background-color: #eab834;
                    color: black;
                }

                .slash-commands-menu.dark .slash-command-item:hover,
                .slash-commands-menu.dark .slash-command-item.selected {
                    background-color: #3185eb;
                    color: white;
                }

                .slash-command-item:hover .slash-command-icon,
                .slash-command-item.selected .slash-command-icon,
                .slash-command-item:hover .slash-command-title,
                .slash-command-item.selected .slash-command-title {
                    color: black;
                }

                .slash-commands-menu.dark .slash-command-item:hover .slash-command-icon,
                .slash-commands-menu.dark .slash-command-item.selected .slash-command-icon,
                .slash-commands-menu.dark .slash-command-item:hover .slash-command-title,
                .slash-commands-menu.dark .slash-command-item.selected .slash-command-title {
                    color: white;
                }

                .slash-command-icon {
                    margin-right: 0.75rem;
                    width: 2rem;
                    height: 2rem;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1rem;
                    color: #6b7280;
                    background-color: #e4e4e7;
                    border-radius: 0.375rem;
                    font-weight: 600;
                }

                .slash-commands-menu.dark .slash-command-icon {
                    background-color: #3f3f46;
                    color: #9ca3af;
                }

                .slash-command-text {
                    display: flex;
                    flex-direction: column;
                    flex: 1;
                }

                .slash-command-title {
                    font-size: 0.875rem;
                    font-weight: 600;
                    color: #111827;
                    line-height: 1.25;
                }

                .slash-commands-menu.dark .slash-command-title {
                    color: #f9fafb;
                }

                .slash-command-shortcut {
                    font-size: 0.75rem;
                    color: #6b7280;
                    margin-top: 0.125rem;
                }

                .slash-commands-menu.dark .slash-command-shortcut {
                    color: #9ca3af;
                }


            `}</style>
            <TableConfigDialog
                isOpen={isTableDialogOpen}
                onClose={() => setIsTableDialogOpen(false)}
                onConfirm={handleTableConfirm}
            />
        </>
    );
}

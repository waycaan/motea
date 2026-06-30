/**
 * Floating Toolbar Plugin for Lexical
 * Shows formatting options when text is selected with state awareness
 */

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
    $getSelection,
    $isRangeSelection,
    FORMAT_TEXT_COMMAND,
    TextFormatType,
    INDENT_CONTENT_COMMAND,
    OUTDENT_CONTENT_COMMAND,
    SELECTION_CHANGE_COMMAND,
    COMMAND_PRIORITY_LOW,
    $createParagraphNode,
} from 'lexical';
import { $isLinkNode, TOGGLE_LINK_COMMAND } from '@lexical/link';
import { $setBlocksType } from '@lexical/selection';
import { $createQuoteNode } from '@lexical/rich-text';
import { INSERT_ORDERED_LIST_COMMAND, INSERT_UNORDERED_LIST_COMMAND } from '@lexical/list';
import { INSERT_CHECK_LIST_COMMAND } from '@lexical/list';
import { $isListItemNode, $isListNode } from '@lexical/list';
import { TOGGLE_HIGHLIGHT_COMMAND } from './highlight-plugin';

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from 'next-themes';

import {
    LinkIcon,
    CodeIcon,
    ArrowRightIcon,
    ArrowLeftIcon,
    ViewListIcon,
    CollectionIcon,
    ClipboardListIcon,
} from '@heroicons/react/outline';

const BoldIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" />
        <path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" />
    </svg>
);

const ItalicIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="19" y1="4" x2="10" y2="4" />
        <line x1="14" y1="20" x2="5" y2="20" />
        <line x1="15" y1="4" x2="9" y2="20" />
    </svg>
);

const StrikethroughIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 4H9a3 3 0 0 0-2.83 4" />
        <path d="M14 12a4 4 0 0 1 0 8H6" />
        <line x1="4" y1="12" x2="20" y2="12" />
    </svg>
);

const HighlightIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
);

const QuoteIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M4.583 17.321C3.553 16.227 3 15 3 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311C9.591 11.69 11 13.166 11 15c0 1.933-1.567 3.5-3.5 3.5-1.193 0-2.31-.566-2.917-1.179zM14.583 17.321C13.553 16.227 13 15 13 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311C19.591 11.69 21 13.166 21 15c0 1.933-1.567 3.5-3.5 3.5-1.193 0-2.31-.566-2.917-1.179z" />
    </svg>
);

export default function FloatingToolbarPlugin(): JSX.Element | null {
    const [editor] = useLexicalComposerContext();
    const [isVisible, setIsVisible] = useState(false);
    const [position, setPosition] = useState({ top: 0, left: 0 });
    const [isBold, setIsBold] = useState(false);
    const [isStrikethrough, setIsStrikethrough] = useState(false);
    const [isLink, setIsLink] = useState(false);
    const [isHighlight, setIsHighlight] = useState(false);
    const [isCode, setIsCode] = useState(false);
    const [isUnorderedList, setIsUnorderedList] = useState(false);
    const [isOrderedList, setIsOrderedList] = useState(false);
    const [isCheckList, setIsCheckList] = useState(false);
    const [isQuote, setIsQuote] = useState(false);
    const { theme } = useTheme();

    const updateToolbar = useCallback(() => {
        try {
            const selection = $getSelection();

            if (!$isRangeSelection(selection)) {
                setIsVisible(false);
                return;
            }

            const textContent = selection.getTextContent();

            if (textContent === '') {
                setIsVisible(false);
                return;
            }

            const nativeSelection = window.getSelection();
            const rootElement = editor.getRootElement();

            if (
                nativeSelection === null ||
                nativeSelection.rangeCount === 0 ||
                rootElement === null ||
                !rootElement.contains(nativeSelection.anchorNode)
            ) {
                setIsVisible(false);
                return;
            }

            const rangeRect = nativeSelection.getRangeAt(0).getBoundingClientRect();
            const editorRect = rootElement.getBoundingClientRect();

            const toolbarWidth = 290;
            const toolbarHeight = 76;
            const margin = 8;

            let left = rangeRect.right - toolbarWidth;
            let top = rangeRect.top - toolbarHeight - margin;

            if (left < editorRect.left) {
                left = editorRect.left + margin;
            } else if (left + toolbarWidth > editorRect.right) {
                left = editorRect.right - toolbarWidth - margin;
            }

            if (top < editorRect.top) {
                top = rangeRect.bottom + margin;
            }

            setPosition({ top, left });
            setIsVisible(true);

            setIsBold(selection.hasFormat('bold'));
            setIsStrikethrough(selection.hasFormat('strikethrough'));
            setIsCode(selection.hasFormat('code'));
            setIsHighlight(selection.hasFormat('highlight'));

            const node = selection.anchor.getNode();
            const parent = node.getParent();
            setIsLink($isLinkNode(parent) || $isLinkNode(node));

            let isQuoteNode = false;
            const nodes = selection.getNodes();
            for (const selectedNode of nodes) {
                let currentNode = selectedNode;
                while (currentNode) {
                    if (currentNode.getType() === 'quote') {
                        isQuoteNode = true;
                        break;
                    }
                    currentNode = currentNode.getParent() as any;
                }
                if (isQuoteNode) break;
            }
            setIsQuote(isQuoteNode);

            let isInList = false;
            let listType = '';

            for (const selectedNode of nodes) {
                let currentNode = selectedNode;
                while (currentNode) {
                    if ($isListItemNode(currentNode)) {
                        const listNode = currentNode.getParent();
                        if ($isListNode(listNode)) {
                            isInList = true;
                            listType = listNode.getListType();
                            break;
                        }
                    }
                    currentNode = currentNode.getParent() as any;
                }
                if (isInList) break;
            }

            setIsUnorderedList(isInList && listType === 'bullet');
            setIsOrderedList(isInList && listType === 'number');
            setIsCheckList(isInList && listType === 'check');
        } catch (error) {
            setIsVisible(false);
        }
    }, [editor]);

    useEffect(() => {
        const unregisterListener = editor.registerUpdateListener(({ editorState }) => {
            editorState.read(() => {
                updateToolbar();
            });
        });

        const unregisterSelectionListener = editor.registerCommand(
            SELECTION_CHANGE_COMMAND,
            () => {
                updateToolbar();
                return false;
            },
            COMMAND_PRIORITY_LOW
        );

        const rootElement = editor.getRootElement();
        if (rootElement) {
            const handleSelectionChange = () => {
                setTimeout(() => {
                    editor.getEditorState().read(() => {
                        updateToolbar();
                    });
                }, 0);
            };

            rootElement.addEventListener('mouseup', handleSelectionChange);
            rootElement.addEventListener('keyup', handleSelectionChange);
            rootElement.addEventListener('touchend', handleSelectionChange);

            return () => {
                unregisterListener();
                unregisterSelectionListener();
                rootElement.removeEventListener('mouseup', handleSelectionChange);
                rootElement.removeEventListener('keyup', handleSelectionChange);
                rootElement.removeEventListener('touchend', handleSelectionChange);
            };
        }

        return () => {
            unregisterListener();
            unregisterSelectionListener();
        };
    }, [editor, updateToolbar]);

    const handleFormat = (format: TextFormatType) => {
        editor.dispatchCommand(FORMAT_TEXT_COMMAND, format);
    };

    const handleListToggle = (listType: 'bullet' | 'number' | 'check') => {
        const isCurrentlyActive =
            (listType === 'bullet' && isUnorderedList) ||
            (listType === 'number' && isOrderedList) ||
            (listType === 'check' && isCheckList);

        if (isCurrentlyActive) {
            editor.update(() => {
                const selection = $getSelection();
                if ($isRangeSelection(selection)) {
                    $setBlocksType(selection, () => $createParagraphNode());
                }
            });
        } else {
            if (listType === 'bullet') {
                editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
            } else if (listType === 'number') {
                editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
            } else if (listType === 'check') {
                editor.dispatchCommand(INSERT_CHECK_LIST_COMMAND, undefined);
            }
        }
    };

    const handleQuote = () => {
        editor.update(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
                if (isQuote) {
                    $setBlocksType(selection, () => $createParagraphNode());
                } else {
                    $setBlocksType(selection, () => $createQuoteNode());
                }
            }
        });
    };

    const handleLink = () => {
        if (isLink) {
            editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
        } else {
            const url = prompt('Enter URL:');
            if (url) {
                editor.dispatchCommand(TOGGLE_LINK_COMMAND, url);
            }
        }
    };

    if (!isVisible) {
        return null;
    }

    const isDark = theme === 'dark';
    const bg = isDark ? '#3f3f46' : '#e4e4e7';
    const btnText = isDark ? 'text-white' : 'text-gray-700';
    const btnHover = isDark ? 'hover:text-white' : 'hover:text-gray-900';
    const btnActive = isDark ? 'text-white' : 'text-gray-900';
    const sepColor = isDark ? 'bg-gray-600' : 'bg-gray-300';
    const activeBg = isDark ? '#3185eb' : '#eab834';

    const topRow = [
        {
            title: 'Bold',
            icon: <BoldIcon className="w-4 h-4" />,
            isActive: isBold,
            action: () => handleFormat('bold'),
        },
        {
            title: 'Italic',
            icon: <ItalicIcon className="w-4 h-4" />,
            isActive: false,
            action: () => handleFormat('italic'),
        },
        {
            title: 'Strikethrough',
            icon: <StrikethroughIcon className="w-4 h-4" />,
            isActive: isStrikethrough,
            action: () => handleFormat('strikethrough'),
        },
        {
            title: 'Highlight',
            icon: <HighlightIcon className="w-4 h-4" />,
            isActive: isHighlight,
            action: () => editor.dispatchCommand(TOGGLE_HIGHLIGHT_COMMAND, undefined),
        },
        {
            title: 'Inline Code',
            icon: <CodeIcon className="w-4 h-4" />,
            isActive: isCode,
            action: () => handleFormat('code'),
        },
        {
            title: isLink ? 'Remove Link' : 'Add Link',
            icon: <LinkIcon className="w-4 h-4" />,
            isActive: isLink,
            action: handleLink,
        },
    ];

    const bottomRow = [
        {
            title: 'Quote',
            icon: <QuoteIcon className="w-4 h-4" />,
            isActive: isQuote,
            action: handleQuote,
        },
        {
            title: isCheckList ? 'Remove Checklist' : 'Checklist',
            icon: <CollectionIcon className="w-4 h-4" />,
            isActive: isCheckList,
            action: () => handleListToggle('check'),
        },
        {
            title: isUnorderedList ? 'Remove Bullet List' : 'Bullet List',
            icon: <ViewListIcon className="w-4 h-4" />,
            isActive: isUnorderedList,
            action: () => handleListToggle('bullet'),
        },
        {
            title: isOrderedList ? 'Remove Numbered List' : 'Numbered List',
            icon: <ClipboardListIcon className="w-4 h-4" />,
            isActive: isOrderedList,
            action: () => handleListToggle('number'),
        },
        {
            title: 'Indent',
            icon: <ArrowRightIcon className="w-4 h-4" />,
            isActive: false,
            action: () => editor.dispatchCommand(INDENT_CONTENT_COMMAND, undefined),
        },
        {
            title: 'Outdent',
            icon: <ArrowLeftIcon className="w-4 h-4" />,
            isActive: false,
            action: () => editor.dispatchCommand(OUTDENT_CONTENT_COMMAND, undefined),
        },
    ];

    const renderButton = (button: { title: string; icon: JSX.Element; isActive: boolean; action: () => void }, index: number) => (
        <button
            key={index}
            onClick={button.action}
            title={button.title}
            className={`
                px-2.5 py-1.5 rounded transition-colors duration-150 min-w-[30px] h-7 flex items-center justify-center text-sm font-medium
                ${button.isActive ? btnActive : `${btnText} ${btnHover}`}
            `}
            style={{ backgroundColor: button.isActive ? activeBg : 'transparent' }}
            onMouseEnter={(e) => {
                if (!button.isActive) {
                    e.currentTarget.style.backgroundColor = activeBg;
                    if (isDark) e.currentTarget.style.color = 'white';
                }
            }}
            onMouseLeave={(e) => {
                if (!button.isActive) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = '';
                }
            }}
        >
            {button.icon}
        </button>
    );

    return createPortal(
        <div
            className="fixed z-50 border rounded-lg shadow-lg overflow-hidden"
            style={{
                top: position.top,
                left: position.left,
                backgroundColor: bg,
                borderColor: isDark ? '#52525b' : '#d4d4d8',
            }}
        >
            <div className="flex items-center px-1 py-1 space-x-0.5">
                {topRow.map((btn, i) => renderButton(btn, i))}
            </div>
            <div className={`h-px ${sepColor}`} />
            <div className="flex items-center px-1 py-1 space-x-0.5">
                {bottomRow.map((btn, i) => renderButton(btn, i + topRow.length))}
            </div>
        </div>,
        document.body
    );
}

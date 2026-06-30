import { Tooltip, TooltipProps } from '@material-ui/core';
import UIState from 'libs/web/state/ui';
import { noop } from 'lodash';
import { FC, useEffect, ReactNode } from 'react';

const Title: FC<{
    text: string;
    keys: string[];
}> = ({ text, keys }) => {
    return (
        <span>
            {text} {keys.join('+')}
        </span>
    );
};

const HotkeyTooltip: FC<{
    text: string;
    keys?: string[];
    children: ReactNode;
    /**
     * first key
     */
    commandKey?: boolean;
    optionKey?: boolean;
    onClose?: TooltipProps['onClose'];
    onHotkey?: () => void;
    disableOnContentEditable?: boolean;
}> = ({
    text,
    keys = [],
    children,
    onClose,
    commandKey,
    optionKey,
    onHotkey = noop,
    disableOnContentEditable = false,
}) => {
    const {
        ua: { isMac },
    } = UIState.useContainer();
    const keyMap = [...keys];

    if (commandKey) {
        keyMap.unshift(isMac ? '⌘' : 'ctrl');
    }

    if (optionKey) {
        keyMap.unshift(isMac ? '⌥' : 'alt');
    }

    useEffect(() => {
        if (!keys.length) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement;

            const isInEditor = target.closest('.ProseMirror') ||
                             target.closest('[contenteditable]') ||
                             target.tagName === 'INPUT' ||
                             target.tagName === 'TEXTAREA';

            if (isInEditor && !disableOnContentEditable) {
                return;
            }

            let matches = true;

            if (commandKey && !(event.ctrlKey || event.metaKey)) {
                matches = false;
            }
            if (!commandKey && (event.ctrlKey || event.metaKey)) {
                matches = false;
            }

            if (optionKey && !event.altKey) {
                matches = false;
            }
            if (!optionKey && event.altKey) {
                matches = false;
            }

            if (keys.length === 1) {
                if (event.key.toLowerCase() !== keys[0].toLowerCase()) {
                    matches = false;
                }
            } else if (keys.length > 1) {
                const hasShift = keys.includes('shift') || keys.includes('Shift');
                if (hasShift && !event.shiftKey) {
                    matches = false;
                }
                if (!hasShift && event.shiftKey) {
                    matches = false;
                }

                const mainKey = keys.find(k => k.toLowerCase() !== 'shift');
                if (mainKey && event.key.toLowerCase() !== mainKey.toLowerCase()) {
                    matches = false;
                }
            }

            if (matches) {
                event.preventDefault();
                event.stopPropagation();
                onHotkey();
            }
        };

        document.addEventListener('keydown', handleKeyDown, true); 
        return () => document.removeEventListener('keydown', handleKeyDown, true);
    }, [keys, commandKey, optionKey, onHotkey, disableOnContentEditable]);

    return (
        <Tooltip
            enterDelay={200}
            TransitionProps={{ timeout: 0 }}
            title={<Title text={text} keys={keyMap} />}
            onClose={onClose}
            placement="bottom-start"
        >
            {children as any}
        </Tooltip>
    );
};

export default HotkeyTooltip;

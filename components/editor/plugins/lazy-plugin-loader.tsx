/**
 * Lazy Plugin Loader
 * Dynamically loads plugins only when needed to improve initial performance
 */

import { lazy, Suspense, useState, useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';

// Lazy load heavy plugins
const TablePlugin = lazy(() => import('./table-plugin'));
const TextAlignPlugin = lazy(() => import('./text-align-plugin'));

interface LazyPluginLoaderProps {
    enableTable?: boolean;
    enableTextAlign?: boolean;
    forceLoad?: boolean; // 强制立即加载，用于导入等场景
}

export default function LazyPluginLoader({
    enableTable = false,
    enableTextAlign = false,
    forceLoad = false
}: LazyPluginLoaderProps) {
    const [editor] = useLexicalComposerContext();
    const [shouldLoadTable, setShouldLoadTable] = useState(false);
    const [shouldLoadTextAlign, setShouldLoadTextAlign] = useState(false);

    useEffect(() => {
        if (!enableTable && !enableTextAlign) return;

        // Load plugins when user starts interacting with the editor
        const handleUserInteraction = () => {
            if (enableTable && !shouldLoadTable) {
                setShouldLoadTable(true);
            }
            if (enableTextAlign && !shouldLoadTextAlign) {
                setShouldLoadTextAlign(true);
            }
        };

        // 如果forceLoad为true，立即加载
        if (forceLoad) {
            handleUserInteraction();
            return;
        }

        // Load on first focus or after a short delay
        const timeoutId = setTimeout(() => {
            handleUserInteraction();
        }, 2000); // Load after 2 seconds

        const editorElement = editor.getRootElement();
        if (editorElement) {
            editorElement.addEventListener('focus', handleUserInteraction, { once: true });
            editorElement.addEventListener('click', handleUserInteraction, { once: true });
        }

        return () => {
            clearTimeout(timeoutId);
            if (editorElement) {
                editorElement.removeEventListener('focus', handleUserInteraction);
                editorElement.removeEventListener('click', handleUserInteraction);
            }
        };
    }, [editor, enableTable, enableTextAlign, shouldLoadTable, shouldLoadTextAlign]);

    return (
        <>
            {shouldLoadTable && (
                <Suspense fallback={null}>
                    <TablePlugin />
                </Suspense>
            )}
            {shouldLoadTextAlign && (
                <Suspense fallback={null}>
                    <TextAlignPlugin />
                </Suspense>
            )}
        </>
    );
}

// Hook to enable lazy loading for specific features
export function useLazyPlugins() {
    const [enabledPlugins, setEnabledPlugins] = useState({
        table: false,
        textAlign: false,
    });

    const enablePlugin = (plugin: keyof typeof enabledPlugins) => {
        setEnabledPlugins(prev => ({
            ...prev,
            [plugin]: true
        }));
    };

    return {
        enabledPlugins,
        enablePlugin
    };
}

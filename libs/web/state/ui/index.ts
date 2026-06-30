import { Settings } from 'libs/shared/settings';
import { UserAgentType } from 'libs/shared/ua';
import { createContainer } from 'unstated-next';
import { useCallback, useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import useSettings from './settings';
import useSidebar from './sidebar';
import useSplit from './split';
import useTitle from './title';

const DEFAULT_UA: UserAgentType = {
    isMobile: false,
    isMobileOnly: false,
    isTablet: false,
    isBrowser: true,
    isWechat: false,
    isMac: false,
};

interface Props {
    ua?: UserAgentType;
    settings?: Settings;
    disablePassword?: boolean;
    IS_DEMO?: boolean;
}

function useUI({
    ua = DEFAULT_UA,
    settings,
    disablePassword,
    IS_DEMO,
}: Props = {}) {
    const router = useRouter();
    const [isEditMode, setIsEditMode] = useState(false);
    const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(new Set());

    const toggleEditMode = useCallback(() => {
        setIsEditMode(prev => {
            // When turning off edit mode, clear selection
            if (prev) {
                setSelectedNoteIds(new Set());
            }
            return !prev;
        });
    }, []);

    const exitEditMode = useCallback(() => {
        setIsEditMode(false);
    }, []);

    const toggleNoteSelection = useCallback((noteId: string) => {
        setSelectedNoteIds(prev => {
            const next = new Set(prev);
            if (next.has(noteId)) {
                next.delete(noteId);
            } else {
                next.add(noteId);
            }
            return next;
        });
    }, []);

    const clearSelection = useCallback(() => {
        setSelectedNoteIds(new Set());
    }, []);

    const selectAll = useCallback((noteIds: string[]) => {
        setSelectedNoteIds(new Set(noteIds));
    }, []);

    useEffect(() => {
        clearSelection();
    }, [router?.query?.id, clearSelection]);

    return {
        ua,
        sidebar: useSidebar(
            ua?.isMobileOnly ? false : settings?.sidebar_is_fold,
            ua.isMobileOnly
        ),
        split: useSplit(settings?.split_sizes),
        title: useTitle(),
        settings: useSettings(settings),
        disablePassword,
        IS_DEMO,
        isEditMode,
        toggleEditMode,
        exitEditMode,
        selectedNoteIds,
        toggleNoteSelection,
        clearSelection,
        selectAll,
    };
}

const UIState = createContainer(useUI);

export default UIState;

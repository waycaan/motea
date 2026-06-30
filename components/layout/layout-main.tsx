import NoteTreeState from 'libs/web/state/tree';
import { FC, useEffect } from 'react';
import NoteState from 'libs/web/state/note';
import { useResizeDetector } from 'react-resize-detector';
import Sidebar from 'components/sidebar/sidebar';
import UIState from 'libs/web/state/ui';
import Resizable from 'components/resizable';
import { TreeModel } from 'libs/shared/tree';
import TrashState from 'libs/web/state/trash';
import TrashModal from 'components/portal/trash-modal/trash-modal';
import SearchState from 'libs/web/state/search';
import SearchModal from 'components/portal/search-modal/search-modal';
import ShareModal from 'components/portal/share-modal';
import { SwipeableDrawer } from '@material-ui/core';
import SidebarMenu from 'components/portal/sidebar-menu/sidebar-menu';
import { NoteModel } from 'libs/shared/note';
import PreviewModal from 'components/portal/preview-modal';
import LinkToolbar from 'components/portal/link-toolbar/link-toolbar';
import EditorWidthSelect from 'components/portal/editor-width-select';

const MainWrapper: FC<{ children: React.ReactNode }> = ({ children }) => {
    const {
        sidebar: { isFold },
    } = UIState.useContainer();
    const { ref, width = 0 } = useResizeDetector<HTMLDivElement>({
        handleHeight: false,
    });

    return (
        <div className="h-full" ref={ref}>
            <Resizable width={width}>
                <Sidebar />
                <main className="relative">{children}</main>
            </Resizable>
            <style jsx global>
                {`
                    .gutter {
                        pointer-events: ${isFold ? 'none' : 'auto'};
                    }
                `}
            </style>
        </div>
    );
};

const MobileMainWrapper: FC<{ children: React.ReactNode }> = ({ children }) => {
    const {
        sidebar: { isFold, open, close },
    } = UIState.useContainer();

    return (
        <div className="flex h-full">
            <SwipeableDrawer
                anchor="left"
                open={isFold}
                onClose={close}
                onOpen={open}
                hysteresis={0.4}
                disableDiscovery
            >
                <Sidebar />
            </SwipeableDrawer>

            <main className="flex-grow" onClick={close}>
                {children}
            </main>
            <style jsx global>
                {`
                    .gutter {
                        pointer-events: none;
                    }
                `}
            </style>
        </div>
    );
};

// 提取状态提供者组合
const StateProviders: FC<{ tree?: TreeModel; note?: NoteModel; children: React.ReactNode }> = ({
    tree,
    note,
    children
}) => (
    <NoteTreeState.Provider initialState={tree}>
        <NoteState.Provider initialState={note}>
            {children}
        </NoteState.Provider>
    </NoteTreeState.Provider>
);

// 提取模态框组合
const ModalGroup: FC = () => (
    <>
        <TrashState.Provider>
            <TrashModal />
        </TrashState.Provider>
        <SearchState.Provider>
            <SearchModal />
        </SearchState.Provider>
        <ShareModal />
        <PreviewModal />
        <LinkToolbar />
        <SidebarMenu />
        <EditorWidthSelect/>
    </>
);

// 提取主布局选择逻辑
const MainLayoutSelector: FC<{ children: React.ReactNode }> = ({ children }) => {
    const { ua } = UIState.useContainer();

    if (ua?.isMobileOnly) {
        return <MobileMainWrapper>{children}</MobileMainWrapper>;
    }

    return <MainWrapper>{children}</MainWrapper>;
};

const LayoutMain: FC<{
    tree?: TreeModel;
    note?: NoteModel;
    children: React.ReactNode;
}> = ({ children, tree, note }) => {
    useEffect(() => {
        document.body.classList.add('overscroll-none');
    }, []);

    return (
        <StateProviders tree={tree} note={note}>
            <>
                <MainLayoutSelector>{children}</MainLayoutSelector>
                <ModalGroup />
            </>
        </StateProviders>
    );
};

export default LayoutMain;

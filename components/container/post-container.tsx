import { FC, useMemo } from 'react';
import 'highlight.js/styles/zenburn.css';
import UIState from 'libs/web/state/ui';
import InnerHTML from 'dangerously-set-html-content';
import { NoteModel } from 'libs/shared/note';
import pupa from 'pupa';
import LexicalMainEditor from 'components/editor/lexical-main-editor';
import LexicalEditorState from 'libs/web/state/lexical-editor';

const MAX_WIDTH = 900;

export const PostContainer: FC<{
    isPreview?: boolean;
    note?: NoteModel;
}> = ({ isPreview = false, note }) => {
    const {
        settings: {
            settings: { injection },
        },
    } = UIState.useContainer();

    const injectionHTML = useMemo(() => {
        return pupa(injection ?? '', {
            ...note,
            url: typeof window !== 'undefined' ? location.href : null,
        });
    }, [injection, note]);

    const className = 'pt-10 px-6 m-auto max-w-full w-[900px]';

    return (
        <>
            <LexicalEditorState.Provider>
                <LexicalMainEditor
                    isPreview={isPreview}
                    note={note}
                    className={className}
                    readOnly
                />
            </LexicalEditorState.Provider>
            {isPreview ? null : (
                <>
                    {injection ? (
                        <InnerHTML
                            id="snippet-injection"
                            className={className}
                            style={{ width: MAX_WIDTH }}
                            html={injectionHTML}
                        />
                    ) : null}
                    <footer className="pb-10 text-gray-300 text-center my-20 text-sm">
                        Written with{' '}
                        <a
                            href="https://github.com/notea-org/notea"
                            target="_blank"
                            rel="noreferrer"
                        >
                            Notea
                        </a>
                    </footer>
                </>
            )}
        </>
    );
};

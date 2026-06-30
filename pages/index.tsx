import LayoutMain from 'components/layout/layout-main';
import { NextPage } from 'next';
import { applyUA } from 'libs/server/middlewares/ua';
import { TreeModel } from 'libs/shared/tree';
import { useSession } from 'libs/server/middlewares/session';
import { applySettings } from 'libs/server/middlewares/settings';
import { applyAuth, applyRedirectLogin } from 'libs/server/middlewares/auth';
import { applyTree } from 'libs/server/middlewares/tree';
import { useEffect, useState, useCallback, FC } from 'react';
import { applyCsrf } from 'libs/server/middlewares/csrf';
import { SSRContext, ssr } from 'libs/server/connect';
import { applyReset } from 'libs/server/middlewares/reset';

interface HitokotoData {
    hitokoto: string;
    from: string;
    from_who?: string;
}

const TypewriterText: FC = () => {
    const [displayText, setDisplayText] = useState('');
    const [fullText, setFullText] = useState('');
    const [source, setSource] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);

    const fetchHitokoto = useCallback(async () => {
        try {
            const res = await fetch('https://v1.hitokoto.cn/');
            const data: HitokotoData = await res.json();
            setFullText(data.hitokoto);
            setSource(data.from_who ? `—— ${data.from_who}「${data.from}」` : `—— 「${data.from}」`);
            setDisplayText('');
            setIsDeleting(false);
        } catch (error) {
            console.error('Failed to fetch hitokoto:', error);
            setFullText('念念不忘，必有回响');
            setSource('—— motea');
            setDisplayText('');
            setIsDeleting(false);
        }
    }, []);

    useEffect(() => {
        fetchHitokoto();
    }, [fetchHitokoto]);

    useEffect(() => {
        if (!fullText) return;

        let timeout: NodeJS.Timeout;

        if (!isDeleting) {
            if (displayText.length < fullText.length) {
                timeout = setTimeout(() => {
                    setDisplayText(fullText.slice(0, displayText.length + 1));
                }, 150);
            } else {
                timeout = setTimeout(() => {
                    setIsDeleting(true);
                }, 5000);
            }
        } else {
            if (displayText.length > 0) {
                timeout = setTimeout(() => {
                    setDisplayText(displayText.slice(0, -1));
                }, 80);
            } else {
                fetchHitokoto();
            }
        }

        return () => clearTimeout(timeout);
    }, [displayText, isDeleting, fullText, fetchHitokoto]);

    return (
        <div className="text-center flex flex-col items-center">
            <img src="/logo.svg" alt="Motea" className="w-80 h-80 opacity-80" style={{ marginBottom: '60px' }} />
            <div
                className="text-2xl font-bold text-gray-700 mb-4 min-h-[3rem]"
                style={{
                    textShadow: '0 2px 4px rgba(0,0,0,0.1)',
                }}
            >
                {displayText}
                <span className="animate-pulse">|</span>
            </div>
            <div
                className="text-sm text-gray-500 min-h-[1.5rem]"
                style={{
                    textShadow: '0 1px 2px rgba(0,0,0,0.05)',
                }}
            >
                {source}
            </div>
        </div>
    );
};

const EditNotePage: NextPage<{ tree: TreeModel }> = ({ tree }) => {
    return (
        <LayoutMain tree={tree}>
            <div className="flex flex-col h-screen items-center justify-center">
                <TypewriterText />
            </div>
        </LayoutMain>
    );
};

export default EditNotePage;

export const getServerSideProps = async (ctx: SSRContext) => {
    await ssr()
        .use(useSession)
        .use(applyAuth)
        .use(applyTree)
        .use(applyRedirectLogin(ctx.resolvedUrl))
        .use(applyReset)
        .use(applySettings)
        .use(applyCsrf)
        .use(applyUA)
        .run(ctx.req, ctx.res);

    return {
        props: ctx.req.props,
        redirect: ctx.req.redirect,
    };
};

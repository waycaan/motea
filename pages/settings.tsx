import LayoutMain from 'components/layout/layout-main';
import { NextPage } from 'next';
import { applyUA } from 'libs/server/middlewares/ua';
import { TreeModel } from 'libs/shared/tree';
import { useSession } from 'libs/server/middlewares/session';
import { applySettings } from 'libs/server/middlewares/settings';
import { applyAuth } from 'libs/server/middlewares/auth';
import { SettingsContainer } from 'components/settings/settings-container';
import useI18n from 'libs/web/hooks/use-i18n';
import { applyCsrf } from 'libs/server/middlewares/csrf';
import { SettingFooter } from 'components/settings/setting-footer';
import { SSRContext, ssr } from 'libs/server/connect';
import { applyReset } from 'libs/server/middlewares/reset';
import { applyTree } from 'libs/server/middlewares/tree';
import UIState from 'libs/web/state/ui';
import IconButton from 'components/icon-button';
import { useCallback, MouseEvent } from 'react';

const SettingsMenuButton = () => {
    const { sidebar, ua } = UIState.useContainer();

    const onToggle = useCallback(
        (e: MouseEvent) => {
            e.stopPropagation();
            sidebar.toggle()
                ?.catch((v) => console.error('Error whilst toggling sidebar: %O', v));
        },
        [sidebar]
    );

    // 只在移动端显示菜单按钮
    if (!ua.isMobileOnly) {
        return null;
    }

    return (
        <IconButton
            icon="Menu"
            className="mr-4 active:bg-gray-400"
            onClick={onToggle}
        />
    );
};

const SettingsPage: NextPage<{ tree: TreeModel }> = ({ tree }) => {
    const { t } = useI18n();

    return (
        <LayoutMain tree={tree}>
            <section className="py-40 h-full overflow-y-auto">
                <div className="px-6 max-w-prose m-auto">
                    <div className="flex items-center mb-10">
                        <SettingsMenuButton />
                        <h1 className="font-normal text-4xl">
                            <span>{t('Settings')}</span>
                        </h1>
                    </div>

                    <SettingsContainer />
                    <SettingFooter />
                </div>
            </section>
        </LayoutMain>
    );
};

export default SettingsPage;

export const getServerSideProps = async (ctx: SSRContext) => {
    await ssr()
        .use(useSession)
        .use(applyAuth)
        .use(applyTree)
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

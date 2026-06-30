/**
 * Debug Page
 * Based on the open-source project Notea, originally created by qingwei-li<cinwell.li@gmail.com>.
 * Modified and maintained by waycaan, 2025.
 */

import { ServerProps, ssr, SSRContext } from 'libs/server/connect';
import { applyMisconfiguration } from 'libs/server/middlewares/misconfiguration';
import pkg from 'package.json';
import { IssueList } from 'components/debug/issue-list';
import { DebugInfoCopyButton } from 'components/debug/debug-info-copy-button';
import { DebugInformation, IssueSeverity } from 'libs/shared/debugging';
import { Logs } from 'components/debug/logs';
import * as env from 'libs/shared/env';

export function DebugPage({ debugInformation }: ServerProps) {
    if (!debugInformation) throw new Error('Missing debug information');

    const issues = debugInformation.issues;
    const logs = debugInformation.logs ?? [];

    return (
        <div className="h-screen flex flex-col">
            <main className="flex flex-col space-y-4 mx-auto my-auto">
                <h1 className="text-4xl font-bold my-auto mx-auto">Backup debugging page</h1>
                <div className="flex flex-row my-auto mx-auto">
                    <DebugInfoCopyButton debugInfo={debugInformation} />
                </div>
                <div className="flex flex-row space-x-5 my-auto">
                    {issues.length > 0 && (
                        <div className={"flex flex-col"}>
                            <h2 className={"text-2xl"}>Issues</h2>
                            <IssueList
                                issues={debugInformation.issues}
                            />
                        </div>
                    )}
                    {logs.length > 0  && (
                        <div>
                            <h2 className={"text-2xl"}>Logs</h2>
                            <Logs logs={logs}/>
                        </div>
                    )}
                    {issues.length < 1 && logs.length < 1 && (
                        <div className={"mx-auto text-lg"}>
                            No debug information available.
                        </div>
                    )}
                </div>

            </main>
            <footer className="flex flex-col my-auto mx-auto">
                <div className="mx-auto">
                    <a
                        href="https://github.com/waycaan/motea"
                        target="_blank"
                        rel="noreferrer"
                    >
                        Motea v3.0.0
                    </a>
                </div>
                <div className="space-x-1">
                    <span>Apache 2.0 &copy; waycaan 2025 | Based on </span>
                    <a
                        href="https://github.com/notea-org/notea"
                        target="_blank"
                        rel="noreferrer"
                    >
                        Notea Contributors
                    </a>
                    <span>2022</span>
                </div>
            </footer>
        </div>
    );
}

export default DebugPage;

export const getServerSideProps = async (ctx: SSRContext) => {
    await ssr().use(applyMisconfiguration).run(ctx.req, ctx.res);


    const debugInformation = ctx.req.props.debugInformation as DebugInformation;


    const envAllowDebug = env.parseBool(env.getEnvRaw('ALLOW_DEBUG'), false);

    let redirect;
    if (!envAllowDebug && !debugInformation.issues.some((v) => v.severity === IssueSeverity.FATAL_ERROR)) {
        redirect = {
            destination: '/',
            permanent: false,
        };
    }

    return {
        redirect,
        props: ctx.req.props,
    };
};

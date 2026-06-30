/**
 * Server Configuration
 * Based on the open-source project Notea, originally created by qingwei-li<cinwell.li@gmail.com>.
 * Modified and maintained by waycaan, 2025.
 *
 * Key modifications:
 * - Replaced S3 storage configuration with PostgreSQL
 * - Added support for multiple PostgreSQL providers (Neon, Supabase, self-hosted)
 * - Enhanced error handling and validation for database connections
 */

import yaml from 'js-yaml';
import * as env from 'libs/shared/env';
import { existsSync, readFileSync } from 'fs';
import {
    coerceToValidCause,
    createLogger,
    Issue,
    IssueCategory,
    IssueFixRecommendation,
    IssueSeverity,
} from 'libs/server/debugging';

const logger = createLogger('config');

export type BasicUser = { username: string; password: string };
type BasicMultiUserConfiguration = {
    username?: never;
    password?: never;
    users: BasicUser[];
};
type BasicSingleUserConfiguration = { username?: string; password: string } & {
    users?: never;
};
export type BasicAuthConfiguration = { type: 'basic' } & (
    | BasicSingleUserConfiguration
    | BasicMultiUserConfiguration
);
export type AuthConfiguration = { type: 'none' } | BasicAuthConfiguration;

export interface S3StoreConfiguration {
    type: 's3';
    detectCredentials: boolean;
    accessKey?: string;
    secretKey?: string;
    bucket: string;
    endpoint: string;
    region: string;
    forcePathStyle: boolean;
    prefix: string;
    proxyAttachments: boolean;
}

export interface PostgreSQLStoreConfiguration {
    type: 'postgresql';
    connectionString: string;
    prefix: string;
    provider?: 'self-hosted' | 'supabase' | 'neon';
    ssl?: boolean;
}

export type StoreConfiguration = S3StoreConfiguration | PostgreSQLStoreConfiguration;

export interface ServerConfiguration {
    useSecureCookies: boolean;
    baseUrl?: string;
}

export interface Configuration {
    auth: AuthConfiguration;
    store: StoreConfiguration;
    server: ServerConfiguration;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
let loaded: Configuration | undefined = undefined;

enum ErrTitle {
    CONFIG_FILE_READ_FAIL = 'Failed to load configuration file',
    INVALID_AUTH_CONFIG = 'Invalid authorisation configuration',
    CONFIG_FILE_PARSE_FAIL = 'Could not parse configuration file',
    INVALID_STORE_CONFIG = 'Invalid store configuration',
}

enum ErrInstruction {
    ENV_EDIT = 'If using Vercel or Netlify, go to the environment settings. If using an environment file, edit that file.',
    CONFIG_FILE_OPEN = 'Edit the configuration file. Note that this does not work for Vercel nor Netlify.',
}

export function loadConfigAndListErrors(): {
    config?: Configuration;
    errors: Array<Issue>;
} {
    logger.debug(
        'Loading configuration from scratch (loadConfigAndListErrors)'
    );
    // TODO: More config errors
    const configFile = env.getEnvRaw('CONFIG_FILE', false) ?? './notea.yml';
    const errors: Array<Issue> = [];

    function tryElseAddError(f: () => void, issue: (e: any) => Issue): void {
        try {
            f();
        } catch (e) {
            errors.push(issue(e));
        }
    }
    void tryElseAddError;

    let baseConfig: Configuration = {} as Configuration;
    if (existsSync(configFile)) {
        let data;
        try {
            data = readFileSync(configFile, 'utf-8');
        } catch (e) {
            errors.push({
                name: ErrTitle.CONFIG_FILE_READ_FAIL,
                description: "The configuration file couldn't be read.",
                cause: coerceToValidCause(e),
                severity: IssueSeverity.WARNING,
                category: IssueCategory.CONFIG,
                fixes: [
                    {
                        description:
                            'Make sure Notea has read access to the configuration file',
                        recommendation: IssueFixRecommendation.NEUTRAL,
                    },
                    {
                        description:
                            'Make sure no other programme is using the configuration file',
                        recommendation: IssueFixRecommendation.NEUTRAL,
                    },
                ],
            });
        }
        if (data) {
            try {
                baseConfig = yaml.load(data) as Configuration;
            } catch (e) {
                errors.push({
                    name: ErrTitle.CONFIG_FILE_PARSE_FAIL,
                    description:
                        'The configuration file could not be parsed, probably due to a syntax error.',
                    severity: IssueSeverity.WARNING,
                    category: IssueCategory.CONFIG,
                    cause: coerceToValidCause(e),
                    fixes: [
                        {
                            description:
                                'Check your configuration file for syntax errors.',
                            recommendation: IssueFixRecommendation.RECOMMENDED,
                        },
                    ],
                });
            }
        }
    }

    const disablePassword = env.parseBool(
        env.getEnvRaw('DISABLE_PASSWORD', false),
        false
    );

    let auth: AuthConfiguration = { type: 'none' };
    if (!disablePassword) {
        const envPassword = env.getEnvRaw('PASSWORD', false);
        if (baseConfig.auth === undefined) {
            if (envPassword === undefined) {
                errors.push({
                    name: ErrTitle.INVALID_AUTH_CONFIG,
                    description:
                        'Neither the configuration file, the PASSWORD environment variable, nor the DISABLE_PASSWORD environment variable was set.',
                    severity: IssueSeverity.FATAL_ERROR,
                    category: IssueCategory.CONFIG,
                    fixes: [
                        {
                            description:
                                'Set the PASSWORD environment variable',
                            recommendation: IssueFixRecommendation.RECOMMENDED,
                            steps: [
                                ErrInstruction.ENV_EDIT,
                                'Set a variable with PASSWORD as key and your desired password as the variable.',
                            ],
                        },
                        {
                            description:
                                'Include an auth section in the configuration file',
                            recommendation: IssueFixRecommendation.RECOMMENDED,
                            steps: [
                                ErrInstruction.CONFIG_FILE_OPEN,
                                'Configure the auth section as you desire the authentication to work. Note that as of now it only supports basic authentication.',
                            ],
                        },
                        {
                            description: 'Disable authentication',
                            recommendation: IssueFixRecommendation.NOT_ADVISED,
                            steps: [
                                'Set either the DISABLE_PASSWORD environment variable or set auth.type to none in the configuration file.',
                            ],
                        },
                    ],
                });
            } else {
                auth = {
                    type: 'basic',
                    password: envPassword.toString(),
                };
            }
        } else {
            auth = baseConfig.auth;
            if (envPassword !== undefined) {
                errors.push({
                    name: ErrTitle.INVALID_AUTH_CONFIG,
                    description:
                        'The PASSWORD environment variable cannot be set when the file configuration contains an auth section.',
                    category: IssueCategory.CONFIG,
                    severity: IssueSeverity.FATAL_ERROR,
                    fixes: [
                        {
                            description:
                                "Don't set the PASSWORD environment variable prior to running Notea.",
                            recommendation: IssueFixRecommendation.RECOMMENDED,
                        },
                        {
                            description:
                                'Remove the auth section from your file configuration.',
                            recommendation: IssueFixRecommendation.NEUTRAL,
                        },
                    ],
                });
            }
            if (auth.type === 'basic') {
                if (auth.users) {
                    errors.push({
                        name: ErrTitle.INVALID_AUTH_CONFIG,
                        description: 'Multiple users are not yet supported',
                        severity: IssueSeverity.FATAL_ERROR,
                        category: IssueCategory.CONFIG,
                        fixes: [
                            {
                                description:
                                    'Change to a single-user configuration.',
                                recommendation:
                                    IssueFixRecommendation.RECOMMENDED,
                            },
                        ],
                    });

                } else {
                    auth.username = auth.username?.toString();
                    auth.password = auth.password.toString();
                }
            }
        }
    } else {
        auth = { type: 'none' };
    }

    let store: StoreConfiguration;

    // This version only supports PostgreSQL
    const postgresUrl = env.getEnvRaw('DATABASE_URL', false);
    const supabaseUrl = env.getEnvRaw('SUPABASE_URL', false);
    const supabaseKey = env.getEnvRaw('SUPABASE_ANON_KEY', false);
    const dbProvider = env.getEnvRaw('DB_PROVIDER' as any, false);

    let provider: 'self-hosted' | 'supabase' | 'neon' = 'self-hosted';
    let connectionString = postgresUrl || '';
    let ssl = false;

    // Auto-detect provider based on connection string or explicit provider setting
    if (dbProvider) {
        provider = dbProvider as 'self-hosted' | 'supabase' | 'neon';
    } else if (postgresUrl) {
        if (postgresUrl.includes('neon.tech') || postgresUrl.includes('neon.')) {
            provider = 'neon';
        } else if (postgresUrl.includes('supabase.co') || postgresUrl.includes('supabase.')) {
            provider = 'supabase';
        } else {
            provider = 'self-hosted';
        }
    }

    // Configure based on provider
    if (supabaseUrl && supabaseKey && provider === 'supabase') {
        connectionString = postgresUrl || `postgresql://postgres:[YOUR-PASSWORD]@${supabaseUrl.replace('https://', '').replace('http://', '')}:5432/postgres`;
        ssl = true;
    } else if (postgresUrl) {
        connectionString = postgresUrl;
        // Auto-detect SSL requirements
        ssl = postgresUrl.includes('sslmode=require') ||
              postgresUrl.includes('ssl=true') ||
              provider === 'neon' ||
              provider === 'supabase';
    }

    store = {
        type: 'postgresql',
        connectionString,
        prefix: env.getEnvRaw('STORE_PREFIX', false) || '',
        provider,
        ssl,
    } as PostgreSQLStoreConfiguration;

    if (!connectionString) {
        errors.push({
            name: 'PostgreSQL connection string missing',
            description: 'DATABASE_URL environment variable is required, or SUPABASE_URL + SUPABASE_ANON_KEY for Supabase',
            severity: IssueSeverity.FATAL_ERROR,
            category: IssueCategory.CONFIG,
            fixes: [
                {
                    description: 'Set the DATABASE_URL environment variable for self-hosted PostgreSQL',
                    recommendation: IssueFixRecommendation.RECOMMENDED,
                    steps: [
                        ErrInstruction.ENV_EDIT,
                        'Set DATABASE_URL to your PostgreSQL connection string (e.g., postgresql://user:password@host:port/database)',
                    ],
                },
                {
                    description: 'Set Supabase environment variables',
                    recommendation: IssueFixRecommendation.RECOMMENDED,
                    steps: [
                        ErrInstruction.ENV_EDIT,
                        'Set SUPABASE_URL to your Supabase project URL',
                        'Set SUPABASE_ANON_KEY to your Supabase anon key',
                        'Set DATABASE_URL to your Supabase PostgreSQL connection string',
                    ],
                },
            ],
        });
    }

    let server: ServerConfiguration;
    if (!baseConfig.server) {
        server = {} as ServerConfiguration;
    } else {
        server = baseConfig.server;
    }
    {
        server.useSecureCookies = env.parseBool(
            env.getEnvRaw('COOKIE_SECURE', false),
            server.useSecureCookies ?? process.env.NODE_ENV === 'production'
        );
        server.baseUrl = env.getEnvRaw('BASE_URL', false) ?? server.baseUrl;
    }

    return {
        config: {
            auth,
            store,
            server,
        },
        errors,
    };
}

const MAX_ERRORS = 2;
export function loadConfig() {
    const result = loadConfigAndListErrors();

    if (!result.config) {
        const { errors } = result;
        let name = errors
            .slice(0, MAX_ERRORS)
            .map((v) => v.name)
            .join(', ');
        if (errors.length > MAX_ERRORS) {
            const rest = errors.length - MAX_ERRORS;
            name += ' and ' + rest + ' other error' + (rest > 1 ? 's' : '');
        }
        throw new Error(name);
    }

    loaded = result.config;

    return loaded;
}

export function config(): Configuration {
    if (!loaded) {
        logger.debug('Loading configuration');
        loadConfig();
        logger.debug('Successfully loaded configuration');
    }

    return loaded as Configuration;
}

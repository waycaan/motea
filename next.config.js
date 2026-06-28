const path = require('path');
const isDocker = !!process.env.DOCKER;

module.exports = {
    // Docker 环境使用 standalone，本地部署不需要
    ...(isDocker ? { output: 'standalone' } : {}),
    swcMinify: true,
    eslint: {
        ignoreDuringBuilds: true,
    },
    typescript: {
        ignoreBuildErrors: true,
    },
    experimental: {
        esmExternals: false,
    },
    webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
        config.resolve.alias = {
            ...config.resolve.alias,
            'libs': path.resolve(__dirname, 'libs'),
            'components': path.resolve(__dirname, 'components'),
            'pages': path.resolve(__dirname, 'pages'),
            'public': path.resolve(__dirname, 'public'),
        };

        config.resolve.modules = [
            path.resolve(__dirname),
            path.resolve(__dirname, 'node_modules'),
            'node_modules'
        ];

        config.resolve.extensions = [
            '.ts', '.tsx', '.js', '.jsx', '.json',
            ...config.resolve.extensions
        ];

        if (!isServer) {
            config.resolve.fallback = {
                ...config.resolve.fallback,
                fs: false,
                path: false,
                os: false,
            };
        }

        return config;
    },
};

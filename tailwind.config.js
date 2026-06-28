const colors = require('tailwindcss/colors');
const defaultConfig = require('tailwindcss/defaultConfig');

module.exports = {
    mode: 'jit',
    purge: ['./pages/**/*.tsx', './components/**/*.tsx'],
    darkMode: 'class',
    theme: {
        colors: {
            gray: colors.gray,
            blue: colors.blue,
            red: colors.red,
            yellow: colors.yellow,
            green: colors.green,
            transparent: 'transparent',
            current: 'currentColor',
        },
        screens: {
            xs: '480px',
            md: '768px',
            lg: '960px', // 半屏断点
        },
        extend: {
            cursor: {
                'col-resize': 'col-resize',
            },
            nightwind: {
                typography: true,
                colorClasses: ['divide', 'placeholder'],
            },
            maxWidth: {
                '400': '400px',
            },
        },
        fontFamily: {
            sans: ['Noto Sans'].concat(defaultConfig.theme.fontFamily['sans']),
            mono: defaultConfig.theme.fontFamily['mono']
        },
    },
    variants: {
        extend: {
            display: ['group-hover'],
            visibility: ['group-hover'],
            backgroundColor: ['active'],
            borderWidth: ['last'],
        },
    },
    plugins: [require('@tailwindcss/typography'), require('nightwind')],
};

import React from 'react';

export const SettingFooter = () => {
    return (
        <footer className="mt-20 text-center opacity-50 text-xs">
            <div>
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
            </div>
        </footer>
    );
};

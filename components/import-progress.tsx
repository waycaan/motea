import { FC, useEffect, useState } from 'react';

interface ImportProgressProps {
    current: number;
    total: number;
}

export const ImportProgress: FC<ImportProgressProps> = ({ current, total }) => {
    const [visible, setVisible] = useState(false);
    const percent = Math.round((current / total) * 100);

    useEffect(() => {
        const timer = setTimeout(() => setVisible(true), 50);
        return () => clearTimeout(timer);
    }, []);

    return (
        <div
            style={{
                opacity: visible ? 1 : 0,
                transform: visible ? 'translateY(0)' : 'translateY(-8px)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                marginTop: '8px',
            }}
        >
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '4px',
                }}
            >
                <span
                    style={{
                        fontSize: '12px',
                        color: '#999',
                        fontWeight: 500,
                    }}
                >
                    Importing...
                </span>
                <span
                    style={{
                        fontSize: '12px',
                        color: '#666',
                        fontVariantNumeric: 'tabular-nums',
                    }}
                >
                    {current} / {total}
                </span>
            </div>
            <div
                style={{
                    height: '6px',
                    background: 'rgba(0, 0, 0, 0.06)',
                    borderRadius: '3px',
                    overflow: 'hidden',
                }}
            >
                <div
                    style={{
                        height: '100%',
                        width: `${percent}%`,
                        background: 'linear-gradient(90deg, #6366f1, #a855f7, #ec4899)',
                        borderRadius: '3px',
                        transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                        boxShadow: '0 0 8px rgba(139, 92, 246, 0.4)',
                    }}
                />
            </div>
        </div>
    );
};

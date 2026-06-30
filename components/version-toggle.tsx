import { FC, useCallback, useState, useEffect } from 'react';
import { ClockIcon } from '@heroicons/react/outline';
import NoteState from 'libs/web/state/note';

interface VersionToggleProps {
    className?: string;
}

const VersionToggle: FC<VersionToggleProps> = ({ className }) => {
    const { note, mutateNote } = NoteState.useContainer();
    const [isDark, setIsDark] = useState(false);

    useEffect(() => {
        const checkDark = () => {
            setIsDark(document.documentElement.classList.contains('dark'));
        };
        checkDark();
        const observer = new MutationObserver(checkDark);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        return () => observer.disconnect();
    }, []);

    const hasVersions = note?.hasVersions === true;

    const handleToggle = useCallback(() => {
        if (!note?.id) return;
        mutateNote(note.id, { hasVersions: !hasVersions });
    }, [note, hasVersions, mutateNote]);

    return (
        <button
            onClick={handleToggle}
            className={`
                relative inline-flex items-center h-8 w-[80px] rounded-full transition-all duration-200 ease-in-out
                focus:outline-none
                ${className || ''}
            `}
            style={{
                backgroundColor: hasVersions ? '#22c55e' : (isDark ? '#374151' : '#ffffff'),
                borderWidth: '2px',
                borderStyle: 'solid',
                borderColor: hasVersions ? '#22c55e' : (isDark ? '#4b5563' : '#d1d5db'),
            }}
        >
            <span
                className="absolute text-[13px] font-bold tracking-wide transition-all duration-200 ease-in-out"
                style={{
                    left: hasVersions ? '10px' : 'auto',
                    right: hasVersions ? 'auto' : '10px',
                    color: hasVersions ? '#ffffff' : '#9ca3af',
                }}
            >
                VerS
            </span>
            <span
                className="absolute w-6 h-6 rounded-full flex items-center justify-center transition-all duration-200 ease-in-out"
                style={{
                    left: hasVersions ? 'auto' : '2px',
                    right: hasVersions ? '2px' : 'auto',
                    backgroundColor: isDark ? '#1f2937' : '#ffffff',
                }}
            >
                <ClockIcon
                    className="w-3.5 h-3.5"
                    style={{
                        color: isDark ? '#d1d5db' : '#374151',
                    }}
                />
            </span>
        </button>
    );
};

export default VersionToggle;

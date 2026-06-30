/**
 * Table Configuration Dialog
 * Allows users to configure table dimensions before insertion
 */

import { useState } from 'react';
import { useTheme } from 'next-themes';

interface TableConfigDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (rows: number, columns: number) => void;
}

export default function TableConfigDialog({ isOpen, onClose, onConfirm }: TableConfigDialogProps) {
    const [rows, setRows] = useState(3);
    const [columns, setColumns] = useState(3);
    const { theme } = useTheme();

    if (!isOpen) return null;

    const handleConfirm = () => {
        onConfirm(rows, columns);
        onClose();
    };

    const handleCancel = () => {
        onClose();
    };

    const handleOverlayClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    return (
        <div 
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
            onClick={handleOverlayClick}
        >
            <div 
                className="rounded-lg p-6 shadow-lg border max-w-sm w-full mx-4"
                style={{
                    backgroundColor: theme === 'dark' ? '#3f3f46' : '#e4e4e7',
                    borderColor: theme === 'dark' ? '#52525b' : '#d4d4d8',
                    color: theme === 'dark' ? 'white' : 'black',
                }}
            >
                <h3 className="text-lg font-semibold mb-4">Insert Table</h3>
                
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            Rows:
                        </label>
                        <input
                            type="number"
                            min="1"
                            max="20"
                            value={rows}
                            onChange={(e) => setRows(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
                            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2"
                            style={{
                                backgroundColor: theme === 'dark' ? '#27272a' : '#f4f4f5',
                                borderColor: theme === 'dark' ? '#52525b' : '#d4d4d8',
                                color: theme === 'dark' ? 'white' : 'black',
                            }}
                        />
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            Columns:
                        </label>
                        <input
                            type="number"
                            min="1"
                            max="10"
                            value={columns}
                            onChange={(e) => setColumns(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2"
                            style={{
                                backgroundColor: theme === 'dark' ? '#27272a' : '#f4f4f5',
                                borderColor: theme === 'dark' ? '#52525b' : '#d4d4d8',
                                color: theme === 'dark' ? 'white' : 'black',
                            }}
                        />
                    </div>
                </div>

                <div className="flex justify-end space-x-3 mt-6">
                    <button
                        onClick={handleCancel}
                        className="px-4 py-2 rounded-md border transition-colors"
                        style={{
                            backgroundColor: 'transparent',
                            borderColor: theme === 'dark' ? '#52525b' : '#d4d4d8',
                            color: theme === 'dark' ? 'white' : 'black',
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = theme === 'dark' ? '#27272a' : '#f4f4f5';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        className="px-4 py-2 rounded-md transition-colors"
                        style={{
                            backgroundColor: theme === 'dark' ? '#3185eb' : '#eab834',
                            color: theme === 'dark' ? 'white' : 'black',
                            border: 'none',
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.opacity = '0.8';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.opacity = '1';
                        }}
                    >
                        Insert Table
                    </button>
                </div>
            </div>
        </div>
    );
}

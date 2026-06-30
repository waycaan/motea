/**
 * Auto Save on Leave Hook
 *
 * Copyright (c) 2025 waycaan
 * Licensed under the MIT License
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 */

import { useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';

interface WindowWithSaveButton extends Window {
    saveButtonStatus?: 'save' | 'saved' | 'pending';
    saveButtonAutoSave?: () => Promise<boolean>;
}

interface UseAutoSaveOnLeaveOptions {
    enabled?: boolean;
}

const useAutoSaveOnLeave = (options: UseAutoSaveOnLeaveOptions = {}) => {
    const { enabled = true } = options;
    const router = useRouter();
    const isAutoSavingRef = useRef(false);


    const shouldAutoSave = useCallback(() => {
        if (typeof window !== 'undefined') {
            const win = window as WindowWithSaveButton;
            return win.saveButtonStatus === 'save';
        }
        return false;
    }, []);

    const performAutoSave = useCallback(async () => {
        if (typeof window !== 'undefined') {
            const win = window as WindowWithSaveButton;
            if (win.saveButtonAutoSave) {
                try {
                    await win.saveButtonAutoSave();
                    return true;
                } catch (error) {
                    return false;
                }
            }
        }
        return false;
    }, []);

    const handleBeforeUnload = useCallback((event: BeforeUnloadEvent) => {
        if (!enabled) return;

        if (shouldAutoSave()) {
            // 显示确认对话框
            event.preventDefault();
            event.returnValue = '您有未保存的更改。确定要离开吗？';

            // 重要：不执行任何保存操作！
            // 用户选择"离开" = 放弃保存
            // 用户选择"取消" = 留在页面，可以手动保存

            return '您有未保存的更改。确定要离开吗？';
        }
    }, [enabled, shouldAutoSave]);

    const handleRouteChangeStart = useCallback(async (url: string) => {
        if (!enabled || isAutoSavingRef.current) return;

        if (shouldAutoSave()) {
            isAutoSavingRef.current = true;

            // 阻止路由跳转
            router.events.emit('routeChangeError', new Error('Auto-saving before route change'), url);

            try {
                const success = await performAutoSave();
                isAutoSavingRef.current = false;

                if (success) {
                    // 自动保存成功，继续跳转
                    router.push(url);
                } else {
                    // 自动保存失败，询问用户
                    const confirmed = window.confirm('自动保存失败。是否强制离开？');
                    if (confirmed) {
                        router.push(url);
                    }
                }
            } catch (error) {
                isAutoSavingRef.current = false;
                // 自动保存出错，询问用户
                const confirmed = window.confirm('自动保存出错。是否强制离开？');
                if (confirmed) {
                    router.push(url);
                }
            }
        }
    }, [enabled, shouldAutoSave, performAutoSave, router]);



    useEffect(() => {
        if (!enabled) return;

        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, [enabled, handleBeforeUnload]);

    useEffect(() => {
        if (!enabled) return;

        router.events.on('routeChangeStart', handleRouteChangeStart);
        return () => {
            router.events.off('routeChangeStart', handleRouteChangeStart);
        };
    }, [enabled, handleRouteChangeStart, router.events]);

    return {
        shouldAutoSave,
        performAutoSave,
    };
};

export default useAutoSaveOnLeave;

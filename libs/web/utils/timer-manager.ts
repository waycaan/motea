/**
 * 统一定时器管理器
 * 
 * 作用：
 * 1. 集中管理所有定时器，防止内存泄漏
 * 2. 避免定时器冲突
 * 3. 提供统一的定时器生命周期管理
 * 4. 便于调试和维护
 */

interface ActiveTimer {
    id: string;
    type: 'interval' | 'timeout';
    timerId: NodeJS.Timeout;
    callback: () => void;
    startTime: number;
}

export class TimerManager {
    private activeTimers = new Map<string, ActiveTimer>();
    private debug: boolean;

    constructor(debug = false) {
        this.debug = debug && process.env.NODE_ENV === 'development';
        
        // 页面卸载时自动清理所有定时器
        if (typeof window !== 'undefined') {
            window.addEventListener('beforeunload', () => {
                this.clearAll();
            });
            
            // 页面隐藏时也清理（移动端友好）
            document.addEventListener('visibilitychange', () => {
                if (document.hidden) {
                    this.clearAll();
                }
            });
        }
    }

    /**
     * 设置间隔定时器
     */
    setInterval(id: string, callback: () => void, interval: number, immediate = false): void {
        // 如果已存在同ID定时器，先清除
        this.clear(id);

        if (immediate) {
            callback();
        }

        const timerId = setInterval(callback, interval);
        
        this.activeTimers.set(id, {
            id,
            type: 'interval',
            timerId,
            callback,
            startTime: Date.now()
        });

        if (this.debug) {

        }
    }

    /**
     * 设置延时定时器
     */
    setTimeout(id: string, callback: () => void, timeout: number): void {
        // 如果已存在同ID定时器，先清除
        this.clear(id);

        const timerId = setTimeout(() => {
            callback();
            // 延时定时器执行后自动清理
            this.activeTimers.delete(id);
            
            if (this.debug) {

            }
        }, timeout);

        this.activeTimers.set(id, {
            id,
            type: 'timeout',
            timerId,
            callback,
            startTime: Date.now()
        });

        if (this.debug) {

        }
    }

    /**
     * 清除指定定时器
     */
    clear(id: string): boolean {
        const timer = this.activeTimers.get(id);
        if (!timer) {
            return false;
        }

        if (timer.type === 'interval') {
            clearInterval(timer.timerId);
        } else {
            clearTimeout(timer.timerId);
        }

        this.activeTimers.delete(id);

        if (this.debug) {

        }

        return true;
    }

    /**
     * 清除所有定时器
     */
    clearAll(): void {
        const count = this.activeTimers.size;
        
        this.activeTimers.forEach((timer) => {
            if (timer.type === 'interval') {
                clearInterval(timer.timerId);
            } else {
                clearTimeout(timer.timerId);
            }
        });

        this.activeTimers.clear();

        if (this.debug && count > 0) {

        }
    }

    /**
     * 获取活跃定时器信息
     */
    getActiveTimers(): Array<{id: string, type: string, runningTime: number}> {
        const now = Date.now();
        return Array.from(this.activeTimers.values()).map(timer => ({
            id: timer.id,
            type: timer.type,
            runningTime: now - timer.startTime
        }));
    }

    /**
     * 检查定时器是否存在
     */
    exists(id: string): boolean {
        return this.activeTimers.has(id);
    }

    /**
     * 重启定时器（保持原有配置）
     */
    restart(id: string): boolean {
        const timer = this.activeTimers.get(id);
        if (!timer) {
            return false;
        }

        // 清除当前定时器
        this.clear(id);

        // 重新启动（需要外部提供间隔/延时时间）
        // 这里只是框架，具体实现需要保存原始配置
        if (this.debug) {

        }

        return true;
    }

    /**
     * 获取统计信息
     */
    getStats(): {
        totalTimers: number;
        intervalTimers: number;
        timeoutTimers: number;
        oldestTimer: string | null;
    } {
        const timers = Array.from(this.activeTimers.values());
        const intervalCount = timers.filter(t => t.type === 'interval').length;
        const timeoutCount = timers.filter(t => t.type === 'timeout').length;
        
        let oldestTimer: string | null = null;
        let oldestTime = Date.now();
        
        timers.forEach(timer => {
            if (timer.startTime < oldestTime) {
                oldestTime = timer.startTime;
                oldestTimer = timer.id;
            }
        });

        return {
            totalTimers: timers.length,
            intervalTimers: intervalCount,
            timeoutTimers: timeoutCount,
            oldestTimer
        };
    }
}

// 全局定时器管理器实例
let globalTimerManager: TimerManager | null = null;

/**
 * 获取全局定时器管理器
 */
export function getGlobalTimerManager(): TimerManager {
    if (!globalTimerManager) {
        globalTimerManager = new TimerManager(false); // 默认关闭调试日志
    }
    return globalTimerManager;
}

/**
 * 便捷方法：设置间隔定时器
 */
export function setManagedInterval(id: string, callback: () => void, interval: number, immediate = false): void {
    getGlobalTimerManager().setInterval(id, callback, interval, immediate);
}

/**
 * 便捷方法：设置延时定时器
 */
export function setManagedTimeout(id: string, callback: () => void, timeout: number): void {
    getGlobalTimerManager().setTimeout(id, callback, timeout);
}

/**
 * 便捷方法：清除定时器
 */
export function clearManagedTimer(id: string): boolean {
    return getGlobalTimerManager().clear(id);
}

/**
 * 便捷方法：清除所有定时器
 */
export function clearAllManagedTimers(): void {
    getGlobalTimerManager().clearAll();
}

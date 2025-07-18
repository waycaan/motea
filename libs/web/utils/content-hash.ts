/**
 * Content Hash Utility
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

export function fastHash(str: string): number {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash) + str.charCodeAt(i);
    }
    return hash >>> 0;
}

export function jsonHash(obj: any): number {
    if (obj === null || obj === undefined) {
        return 0;
    }

    if (typeof obj !== 'object') {
        return fastHash(String(obj));
    }
    try {
        const jsonStr = JSON.stringify(obj);
        return fastHash(jsonStr);
    } catch (error) {
        console.warn('Failed to hash object:', error);
        return 0;
    }
}


export class ContentComparator {
    private lastHash: number = 0;
    private lastContent: string = '';
    private hashCache = new Map<string, number>();
    

    hasChanged(content: string): boolean {
        // 快速检查：如果内容完全相同，直接返回false
        if (content === this.lastContent) {
            return false;
        }
        
        // 计算新内容的哈希
        let newHash: number;
        
        // 检查缓存
        if (this.hashCache.has(content)) {
            newHash = this.hashCache.get(content)!;
        } else {
            newHash = fastHash(content);
            
            // 限制缓存大小，避免内存泄漏
            if (this.hashCache.size > 100) {
                // 清理最旧的一半缓存
                const entries = Array.from(this.hashCache.entries());
                const toDelete = entries.slice(0, 50);
                toDelete.forEach(([key]) => this.hashCache.delete(key));
            }
            
            this.hashCache.set(content, newHash);
        }
        
        // 比较哈希
        const changed = newHash !== this.lastHash;
        
        if (changed) {
            this.lastHash = newHash;
            this.lastContent = content;
        }
        
        return changed;
    }
    
    /**
     * 强制更新比较基准
     * @param content 新的基准内容
     */
    updateBaseline(content: string): void {
        this.lastContent = content;
        this.lastHash = fastHash(content);
    }
    
    /**
     * 重置比较器
     */
    reset(): void {
        this.lastHash = 0;
        this.lastContent = '';
        this.hashCache.clear();
    }
    
    /**
     * 获取缓存统计
     */
    getCacheStats(): { size: number; hitRate: number } {
        return {
            size: this.hashCache.size,
            hitRate: 0 // 简化实现，不统计命中率
        };
    }
}

/**
 * JSON内容比较器
 * 专门用于比较JSON对象
 */
export class JsonComparator {
    private lastHash: number = 0;
    private lastJson: any = null;
    
    /**
     * 检查JSON对象是否发生变化
     * @param jsonObj 要检查的JSON对象
     * @returns 是否发生变化
     */
    hasChanged(jsonObj: any): boolean {
        // 快速检查：引用相同
        if (jsonObj === this.lastJson) {
            return false;
        }
        
        // 计算新的哈希
        const newHash = jsonHash(jsonObj);
        const changed = newHash !== this.lastHash;
        
        if (changed) {
            this.lastHash = newHash;
            this.lastJson = jsonObj;
        }
        
        return changed;
    }
    
    /**
     * 强制更新比较基准
     * @param jsonObj 新的基准对象
     */
    updateBaseline(jsonObj: any): void {
        this.lastJson = jsonObj;
        this.lastHash = jsonHash(jsonObj);
    }
    
    /**
     * 重置比较器
     */
    reset(): void {
        this.lastHash = 0;
        this.lastJson = null;
    }
}

/**
 * 创建内容比较器实例
 */
export function createContentComparator(): ContentComparator {
    return new ContentComparator();
}

/**
 * 创建JSON比较器实例
 */
export function createJsonComparator(): JsonComparator {
    return new JsonComparator();
}

/**
 * 便捷函数：比较两个字符串是否相同（使用哈希）
 */
export function quickCompare(str1: string, str2: string): boolean {
    // 长度不同，肯定不同
    if (str1.length !== str2.length) {
        return false;
    }
    
    // 长度相同但内容可能不同，使用哈希比较
    return fastHash(str1) === fastHash(str2);
}

/**
 * 便捷函数：比较两个JSON对象是否相同（使用哈希）
 */
export function quickJsonCompare(obj1: any, obj2: any): boolean {
    // 引用相同
    if (obj1 === obj2) {
        return true;
    }
    
    // 使用哈希比较
    return jsonHash(obj1) === jsonHash(obj2);
}

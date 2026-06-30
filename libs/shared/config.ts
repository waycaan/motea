export interface AppConfig {
    preloadNotesCount: number;
    platform: 'vercel' | 'docker' | 'unknown';
    isDevelopment: boolean;
}

export function getPreloadNotesCount(): number {

    const envValue = process.env.PRELOAD_NOTES_COUNT;
    if (envValue) {
        const parsed = parseInt(envValue, 10);
        if (!isNaN(parsed) && parsed > 0) {

            return Math.min(parsed, 100); 
        }
    }

  
    const platform = detectPlatform();
    const defaults = {
        vercel: 5,
        docker: 15,
        unknown: 10
    };

    const defaultCount = defaults[platform];

    return defaultCount;
}


export function detectPlatform(): AppConfig['platform'] {
    if (typeof process !== 'undefined' && process.env) {
        if (process.env.VERCEL) {
            return 'vercel';
        }
        if (process.env.DOCKER_ENV || process.env.KUBERNETES_SERVICE_HOST) {
            return 'docker';
        }
    }

    if (typeof window !== 'undefined') {
        const hostname = window.location.hostname;
        if (hostname.includes('vercel.app') || hostname.includes('vercel.com')) {
            return 'vercel';
        }
        if (hostname === 'localhost' || hostname.startsWith('192.168.') || hostname.startsWith('10.')) {
            return 'docker';
        }
    }

    return 'unknown';
}


export function getAppConfig(): AppConfig {
    return {
        preloadNotesCount: getPreloadNotesCount(),
        platform: detectPlatform(),
        isDevelopment: process.env.NODE_ENV === 'development',
    };
}

export function getPerformanceRecommendations(platform: AppConfig['platform']) {
    const recommendations = {
        vercel: {
            preloadCount: '3-10',
            reason: '保守加载',
            strategy: 'conservative'
        },
        docker: {
            preloadCount: '10-30',
            reason: '性能调整',
            strategy: 'balanced'
        },
        unknown: {
            preloadCount: '5-15',
            reason: '保守配置',
            strategy: 'conservative'
        }
    };

    return recommendations[platform];
}


export function validateConfig(config: AppConfig): { valid: boolean; warnings: string[] } {
    const warnings: string[] = [];
    
    const recommendations = getPerformanceRecommendations(config.platform);
    const [min, max] = recommendations.preloadCount.split('-').map(n => parseInt(n));
    
    if (config.preloadNotesCount < min) {
        warnings.push(`预加载数量 ${config.preloadNotesCount} 可能过少，建议 ${recommendations.preloadCount}`);
    }
    
    if (config.preloadNotesCount > max) {
        warnings.push(`预加载数量 ${config.preloadNotesCount} 可能过多，建议 ${recommendations.preloadCount}`);
    }

    return {
        valid: warnings.length === 0,
        warnings
    };
}

/**
 * Configuration for SMART Health Check-in demo
 * Supports both multi-origin (localhost subdomains) and single-origin (GitHub Pages) deployments
 */
export interface AppConfig {
    id: string;
    name: string;
    description: string;
    category?: string;
    color: string;
    accentColor?: string;
    logo: string;
    logoStyle?: string;
    launchBase: string;
}
export interface Config {
    mode: 'multi-origin' | 'single-origin';
    requester: {
        url: string;
        checkin: string;
    };
    checkin: {
        url: string;
        apps: AppConfig[];
    };
}
export declare const config: Config;
//# sourceMappingURL=config.d.ts.map
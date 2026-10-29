/**
 * Demo builds (EXPO_PUBLIC_DEMO=1) preload sample data and answer scans and recipe
 * requests with sample results, so the app can be shown without an API key.
 * The value is inlined at build time; regular builds never contain demo behavior.
 */
export const DEMO_MODE = process.env.EXPO_PUBLIC_DEMO === '1';

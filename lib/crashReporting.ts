/**
 * Crash Reporting for Manuver
 * Wraps Sentry to capture exceptions and breadcrumbs in production.
 */
// @ts-ignore
import * as Sentry from '@sentry/react-native';

// Configured in .env (EXPO_PUBLIC_SENTRY_DSN). Without it, crash reporting stays off.
const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

export const initCrashReporting = () => {
  if (!SENTRY_DSN) return;
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: __DEV__ ? 'development' : 'production',
    // 20% of transactions is plenty for performance data without burning quota.
    tracesSampleRate: 0.2,
    attachStacktrace: true,
    maxBreadcrumbs: 50,
    // Development crashes stay in the console instead of the production dashboard.
    enabled: !__DEV__,
  });

  if (__DEV__) {
    console.log('[CrashReporting] Sentry initialized.');
  }
};

export const captureException = (error: any, context?: Record<string, any>) => {
  if (__DEV__) {
    console.error('[CrashReporting] Captured Exception:', error, context || '');
  }
  Sentry.captureException(error, { extra: context });
};

export const addBreadcrumb = (message: string, category: string = 'ui') => {
  if (__DEV__) {
    console.log(`[Breadcrumb] [${category}] ${message}`);
  }
  Sentry.addBreadcrumb({ message, category, level: 'info' });
};

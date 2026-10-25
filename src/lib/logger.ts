import * as Sentry from '@sentry/react';

const isDev = !import.meta.env.PROD;
const environment = import.meta.env.VITE_ENVIRONMENT || 'development';

if (import.meta.env.PROD) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN || '',
    environment,
    tracesSampleRate: 0.1,
    beforeSend(event) {
      if (isDev) return null;
      return event;
    },
  });
}

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export const logger = {
  debug: (message: string, context?: Record<string, unknown>) => {
    console.debug(`[KAPL] ${message}`, context);
  },

  info: (message: string, context?: Record<string, unknown>) => {
    console.log(`[KAPL] ${message}`, context);
  },

  warn: (message: string, context?: Record<string, unknown>) => {
    console.warn(`[KAPL] ${message}`, context);
    if (!isDev) {
      Sentry.captureMessage(message, 'warning');
    }
  },

  error: (message: string, error?: Error | unknown, context?: Record<string, unknown>) => {
    console.error(`[KAPL] ${message}`, error, context);
    if (!isDev) {
      if (error instanceof Error) {
        Sentry.captureException(error, {
          tags: { message },
          contexts: { custom: context },
        });
      } else {
        Sentry.captureMessage(message, 'error');
      }
    }
  },

  captureException: (error: Error, context?: Record<string, unknown>) => {
    console.error('[KAPL Exception]', error);
    if (!isDev) {
      Sentry.captureException(error, {
        contexts: { custom: context },
      });
    }
  },

  addBreadcrumb: (message: string, data?: Record<string, unknown>) => {
    Sentry.addBreadcrumb({
      message,
      data,
      level: 'info',
    });
  },
};

export const apiLogger = {
  request: (method: string, endpoint: string) => {
    logger.debug(`API ${method} ${endpoint}`);
    logger.addBreadcrumb(`API Request`, { method, endpoint });
  },

  response: (method: string, endpoint: string, status: number) => {
    logger.debug(`API ${method} ${endpoint} → ${status}`);
  },

  error: (method: string, endpoint: string, status: number, error: unknown) => {
    logger.error(`API ${method} ${endpoint} failed (${status})`, error instanceof Error ? error : new Error(String(error)));
  },
};

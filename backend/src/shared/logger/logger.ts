import { env } from '../config/env.js';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_WEIGHT: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const sanitize = (data: Record<string, unknown>): Record<string, unknown> => {
  const SENSITIVE = ['password', 'token', 'authorization', 'secret', 'idempotencykey', 'card'];
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (SENSITIVE.some((k) => key.toLowerCase().includes(k))) {
      sanitized[key] = '[REDACTED]';
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      sanitized[key] = sanitize(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
};

export class Logger {
  private emit(level: LogLevel, message: string, context: Record<string, unknown> = {}) {
    const payload = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...sanitize(context),
    };
    const str = JSON.stringify(payload);
    if (level === 'error') console.error(str);
    else if (level === 'warn') console.warn(str);
    else console.log(str);
  }

  private log(level: LogLevel, message: string, context: Record<string, unknown> = {}) {
    if (LEVEL_WEIGHT[level] < LEVEL_WEIGHT[env.LOG_LEVEL]) return;
    this.emit(level, message, context);
  }

  public debug(msg: string, ctx?: Record<string, unknown>) { this.log('debug', msg, ctx); }
  public info(msg: string, ctx?: Record<string, unknown>) { this.log('info', msg, ctx); }
  public warn(msg: string, ctx?: Record<string, unknown>) { this.log('warn', msg, ctx); }
  public error(msg: string, ctx?: Record<string, unknown>) { this.log('error', msg, ctx); }

  /**
   * Línea de acceso por invocación (CA-NF07.1). Es obligatoria, por lo que no depende de LOG_LEVEL;
   * el nivel refleja el resultado: info (< 400), warn (4xx) o error (5xx).
   */
  public access(statusCode: number, ctx: Record<string, unknown>) {
    const level: LogLevel = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
    this.emit(level, 'access', { ...ctx, statusCode });
  }
}

export const logger = new Logger();

import { env } from '../config/env.js';

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
  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string, context: Record<string, unknown> = {}) {
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

  public debug(msg: string, ctx?: Record<string, unknown>) { this.log('debug', msg, ctx); }
  public info(msg: string, ctx?: Record<string, unknown>) { this.log('info', msg, ctx); }
  public warn(msg: string, ctx?: Record<string, unknown>) { this.log('warn', msg, ctx); }
  public error(msg: string, ctx?: Record<string, unknown>) { this.log('error', msg, ctx); }
}

export const logger = new Logger();
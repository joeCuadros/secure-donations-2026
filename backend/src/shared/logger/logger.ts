import { env } from '../config/env.js';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_WEIGHTS: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const sanitize = (data: Record<string, unknown>): Record<string, unknown> => {
  const SENSITIVE_KEYS = ['password', 'token', 'authorization', 'secret', 'idempotencykey', 'card'];
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (SENSITIVE_KEYS.some((k) => key.toLowerCase().includes(k))) {
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
  private levelWeight: number;

  constructor() {
    this.levelWeight = LEVEL_WEIGHTS[env.LOG_LEVEL];
  }

  private log(level: LogLevel, message: string, context: Record<string, unknown> = {}) {
    if (LEVEL_WEIGHTS[level] < this.levelWeight) {
      return;
    }

    const payload = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...sanitize(context),
    };

    const output = JSON.stringify(payload);
    if (level === 'error') {
      console.error(output);
    } else if (level === 'warn') {
      console.warn(output);
    } else {
      console.log(output);
    }
  }

  public debug(message: string, context?: Record<string, unknown>) {
    this.log('debug', message, context);
  }

  public info(message: string, context?: Record<string, unknown>) {
    this.log('info', message, context);
  }

  public warn(message: string, context?: Record<string, unknown>) {
    this.log('warn', message, context);
  }

  public error(message: string, context?: Record<string, unknown>) {
    this.log('error', message, context);
  }
}

export const logger = new Logger();
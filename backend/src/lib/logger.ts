import pino from 'pino';
import { config } from '../config.js';

export const logger = pino({
  level: config.NODE_ENV === 'production' ? 'info' : 'debug',
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      '*.password',
      '*.token',
      '*.access_token',
      '*.refresh_token',
      '*.secret',
      '*.stripe_secret_key',
      '*.supabase_server_key',
    ],
    censor: '[REDACTED]',
  },
  base: { service: 'brandedalign-api' },
});

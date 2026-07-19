import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  port: Number(process.env.PORT ?? 3000),
  environment: process.env.NODE_ENV ?? 'development',
  frontendUrls: (process.env.FRONTEND_URLS ?? 'http://127.0.0.1:5500')
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean),
}));

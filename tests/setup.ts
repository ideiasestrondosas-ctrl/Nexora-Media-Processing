import { beforeAll, afterAll } from 'vitest';
beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'error';
});
afterAll(async () => {});

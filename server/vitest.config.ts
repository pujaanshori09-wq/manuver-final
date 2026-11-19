import os from 'node:os';
import path from 'node:path';
import { defineConfig } from 'vitest/config';

try {
  process.loadEnvFile('.env');
} catch {
  // CI provides the environment directly
}

const testDb = process.env.TEST_DATABASE_URL;
if (!testDb) throw new Error('TEST_DATABASE_URL is required to run tests');

export default defineConfig({
  // Always this folder's tsconfig, also for the app files some tests import: without it Vite would find the
  // app's tsconfig (which extends expo/tsconfig.base) and fail wherever only server/ is installed, like CI.
  tsconfig: './tsconfig.json',
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Tests share one database: run files one at a time.
    fileParallelism: false,
    globalSetup: ['./tests/global-setup.ts'],
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: testDb,
      // Test uploads go to a throwaway folder, never the real uploads/.
      UPLOAD_DIR: path.join(os.tmpdir(), 'manuver-test-uploads'),
    },
    testTimeout: 20_000,
  },
});

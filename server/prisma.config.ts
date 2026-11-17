import { defineConfig, env } from 'prisma/config';

// Prisma 7 no longer loads .env on its own. Use Node's built-in loader; in CI/production
// the variables come from the environment and there is no file.
try {
  process.loadEnvFile('.env');
} catch {
  // no .env file — rely on the real environment
}

// Prisma 7: connection settings live here, not in schema.prisma.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx --env-file=.env prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});

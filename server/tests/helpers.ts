import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';

export const app = createApp();
export const api = () => request(app);

/** Empties every table (keeps the migrations table). */
export async function resetDb() {
  const rows = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (rows.length === 0) return;
  const list = rows.map((r) => `"public"."${r.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

let counter = 0;
export const uniqueEmail = () => `player${Date.now()}${counter++}@test.manuver`;

export async function registerUser(email = uniqueEmail(), password = 'correct-horse-9') {
  const res = await api().post('/v1/auth/register').send({ email, password, name: 'Test' });
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { email, password, ...res.body } as {
    email: string;
    password: string;
    user: { id: string };
    accessToken: string;
    refreshToken: string;
  };
}

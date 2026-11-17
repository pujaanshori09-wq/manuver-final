import { PrismaPg } from '@prisma/adapter-pg';
import { env } from '../config/env.js';
import { PrismaClient } from '../generated/prisma/client.js';

const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

/** Single shared client for the whole process. */
export const prisma = new PrismaClient({ adapter });

export type Db = typeof prisma;

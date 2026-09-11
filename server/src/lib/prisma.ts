import { PrismaClient } from '@prisma/client';
import '../config/env.js'; // side effect: loads the correct .env/.env.test before Prisma reads DATABASE_URL

export const prisma = new PrismaClient();

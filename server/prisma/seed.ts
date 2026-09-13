import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { seedCatalog } from './catalogSeed.js';

const prisma = new PrismaClient();
const DEV_ONLY_DEFAULT_PASSWORD = 'ChangeMe!Dev123';

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to run the demo seed against a production environment.');
  }

  // `||`, not `??` — an empty string (e.g. `SEED_ADMIN_PASSWORD=` left blank in .env, exactly
  // as .env.example ships it) must also fall back to the documented default.
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || DEV_ONLY_DEFAULT_PASSWORD;
  const customerPassword = process.env.SEED_CUSTOMER_PASSWORD || DEV_ONLY_DEFAULT_PASSWORD;

  if (!process.env.SEED_ADMIN_PASSWORD || !process.env.SEED_CUSTOMER_PASSWORD) {
    console.warn(
      '[seed] SEED_ADMIN_PASSWORD / SEED_CUSTOMER_PASSWORD not set in server/.env — using a shared, ' +
        'publicly-documented development-only password. Never reuse these demo accounts outside local development.',
    );
  }

  await prisma.user.upsert({
    where: { email: 'admin@audiocommerce.demo' },
    update: {},
    create: {
      email: 'admin@audiocommerce.demo',
      passwordHash: await bcrypt.hash(adminPassword, 12),
      name: 'Demo Admin',
      role: 'ADMIN',
    },
  });

  await prisma.user.upsert({
    where: { email: 'customer@audiocommerce.demo' },
    update: {},
    create: {
      email: 'customer@audiocommerce.demo',
      passwordHash: await bcrypt.hash(customerPassword, 12),
      name: 'Demo Customer',
      role: 'CUSTOMER',
    },
  });

  await seedCatalog(prisma);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });

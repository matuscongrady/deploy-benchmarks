import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from './generated/prisma/client';
import { FixturePool } from './fixture-database';

// A production deployment passes its DATABASE_URL to a pg Pool. The fixture's pool answers from sample data instead.
const pool = new FixturePool({ connectionString: process.env.DATABASE_URL ?? 'postgresql://shop@localhost:5432/shop', max: 2 });
export const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
export const Decimal = Prisma.Decimal;

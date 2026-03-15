const { PrismaClient } = require('@prisma/client');

// By default, Prisma logs only warnings and errors to keep the console clean.
// Set PRISMA_LOG=info,query,warn,error (comma-separated) to enable additional logging.
const prismaLogConfig = process.env.PRISMA_LOG ? process.env.PRISMA_LOG.split(',') : ['warn', 'error'];

// Use direct DB URL when available (helps avoid prepared-statement errors on pgbouncer / Supabase pooler)
// Fallback to DATABASE_URL if DIRECT_URL is not provided.
const prismaDbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!prismaDbUrl) {
  throw new Error(
    'Environment variable not set: please set DIRECT_URL or DATABASE_URL (prefer DIRECT_URL for Supabase).' +
    ' Example: DIRECT_URL="postgresql://user:password@host:5432/postgres"'
  );
}

const prisma = new PrismaClient({
  log: prismaLogConfig,
  datasources: {
    db: {
      url: prismaDbUrl,
    },
  },
});

module.exports = prisma;

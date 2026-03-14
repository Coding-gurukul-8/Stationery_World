const { PrismaClient } = require('@prisma/client');

// By default, Prisma logs only warnings and errors to keep the console clean.
// Set PRISMA_LOG=info,query,warn,error (comma-separated) to enable additional logging.
const prismaLogConfig = process.env.PRISMA_LOG ? process.env.PRISMA_LOG.split(',') : ['warn', 'error'];

const prisma = new PrismaClient({
  log: prismaLogConfig,
});

module.exports = prisma;

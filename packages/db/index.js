const { PrismaClient } = require('@prisma/client');
const { createMongoAdapter, connectMongo } = require('./mongo');

let clientInstance;

function getPrismaClient() {
  // If explicitly requested to use Prisma/SQLite:
  if (process.env.USE_PRISMA === 'true') {
    if (!clientInstance || clientInstance.isMongo) {
      clientInstance = new PrismaClient();
      clientInstance.isMongo = false;
    }
    return clientInstance;
  }

  // Default to native MongoDB on localhost (Compass compatible)
  if (!clientInstance || !clientInstance.isMongo) {
    clientInstance = createMongoAdapter();
    clientInstance.isMongo = true;
  }
  return clientInstance;
}

module.exports = {
  getPrismaClient,
  PrismaClient,
  createMongoAdapter,
  connectMongo,
};

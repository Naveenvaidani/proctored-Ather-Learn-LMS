import { MongoMemoryServer } from "mongodb-memory-server";

const mongod = await MongoMemoryServer.create({
  instance: {
    port: 27017,
    ip: "127.0.0.1",
    dbName: "vibe",
  },
});

console.log("MongoMemoryServer started at:", mongod.getUri());

const shutdown = async () => {
  await mongod.stop();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

setInterval(() => {}, 1000);

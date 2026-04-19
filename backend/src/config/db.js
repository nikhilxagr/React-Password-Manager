const { MongoClient } = require("mongodb");
const config = require("./env");

const client = new MongoClient(config.MONGO_URI, {
  maxPoolSize: 10,
});

let db;

const connectDb = async () => {
  if (!db) {
    await client.connect();
    db = client.db(config.DB_NAME);
    console.log("✅ MongoDB connected Successfullyy");
  }

  return db;
};

const getDb = () => {
  if (!db) {
    throw new Error("Database is not connected. Call connectDb() first.");
  } 

  return db;
};

const closeDb = async () => {
  await client.close();
};

module.exports = {
  connectDb,
  getDb,
  closeDb,
};

const config = require("./src/config/env");
const { app } = require("./src/app");
const { connectDb, closeDb } = require("./src/config/db");
const { ensureUserIndexes } = require("./src/services/accountService");
const { ensureVaultIndexes } = require("./src/services/vaultService");
const { ensureCredentialIndexes } = require("./src/services/credentialService");

let server;

const shutdown = async () => {
  if (server) {
    server.close();
  }

  await closeDb();
  process.exit(0);
};

const bootstrap = async () => {
  await connectDb();
  await Promise.all([
    ensureUserIndexes(),
    ensureVaultIndexes(),
    ensureCredentialIndexes(),
  ]);

  server = app.listen(config.PORT, () => {
    console.log(`Backend running on http://localhost:${config.PORT}`);
  });

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
};

bootstrap().catch((error) => {
  console.error("Failed to start server", error);
  console.error(
    "Check backend/.env MONGO_URI and Atlas network access if MongoDB connection fails.",
  );
  process.exit(1);
});

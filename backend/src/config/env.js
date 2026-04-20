const dotenv = require("dotenv");

dotenv.config();

const getRequired = (key) => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

const toInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const toPositiveInt = (value, fallback) => {
  const parsed = toInt(value, fallback);
  return parsed > 0 ? parsed : fallback;
};

const config = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: toInt(process.env.PORT, 3000),
  MONGO_URI: getRequired("MONGO_URI"),
  DB_NAME: getRequired("DB_NAME"),
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN || "http://localhost:5173",
  EXTENSION_ORIGINS: (process.env.EXTENSION_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  ALLOW_CHROME_EXTENSION_ORIGINS:
    process.env.ALLOW_CHROME_EXTENSION_ORIGINS !== "false",
  BLIND_INDEX_KEY:
    process.env.BLIND_INDEX_KEY || "dev-blind-index-key-change-me",
  ARGON2_TIME_COST: toPositiveInt(process.env.ARGON2_TIME_COST, 3),
  ARGON2_MEMORY_COST_KIB: toPositiveInt(
    process.env.ARGON2_MEMORY_COST_KIB,
    65536,
  ),
  ARGON2_PARALLELISM: toPositiveInt(process.env.ARGON2_PARALLELISM, 1),
  SESSION_TTL_MINUTES: toInt(process.env.SESSION_TTL_MINUTES, 30),
  RATE_LIMIT_WINDOW_MS: toInt(process.env.RATE_LIMIT_WINDOW_MS, 10 * 60 * 1000),
  RATE_LIMIT_MAX_REQUESTS: toInt(process.env.RATE_LIMIT_MAX_REQUESTS, 200),
};

if (
  config.NODE_ENV === "production" &&
  config.BLIND_INDEX_KEY === "dev-blind-index-key-change-me"
) {
  throw new Error(
    "BLIND_INDEX_KEY must be set in production.",
  );
}

module.exports = config;

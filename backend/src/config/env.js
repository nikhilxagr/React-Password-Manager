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

const toBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  if (value === true || value === "true") {
    return true;
  }

  if (value === false || value === "false") {
    return false;
  }

  return fallback;
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
  JWT_SECRET: getRequired("JWT_SECRET"),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "7d",
  JWT_ISSUER: process.env.JWT_ISSUER || "vaultguard",
  PASSWORD_RESET_TOKEN_TTL_MINUTES: toPositiveInt(
    process.env.PASSWORD_RESET_TOKEN_TTL_MINUTES,
    30,
  ),
  APP_BASE_URL: process.env.APP_BASE_URL || "http://localhost:5173",
  SMTP_HOST: process.env.SMTP_HOST || "",
  SMTP_PORT: toPositiveInt(process.env.SMTP_PORT, 587),
  SMTP_SECURE: toBoolean(process.env.SMTP_SECURE, false),
  SMTP_USER: process.env.SMTP_USER || "",
  SMTP_PASS: process.env.SMTP_PASS || "",
  SMTP_FROM: process.env.SMTP_FROM || "",
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

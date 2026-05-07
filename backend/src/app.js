const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const config = require("./config/env");
const accountRoutes = require("./routes/accountRoutes");
const authRoutes = require("./routes/authRoutes");
const credentialRoutes = require("./routes/credentialRoutes");
const { notFoundHandler } = require("./middlewares/notFound");
const { errorHandler } = require("./middlewares/errorHandler");

const app = express();

const isAllowedOrigin = (origin) => {
  if (!origin) {
    return true;
  }

  if (origin === config.CLIENT_ORIGIN) {
    return true;
  }

  if (config.EXTENSION_ORIGINS.includes(origin)) {
    return true;
  }

  return (
    config.ALLOW_CHROME_EXTENSION_ORIGINS &&
    origin.startsWith("chrome-extension://")
  );
};

app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Origin not allowed by CORS policy."));
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(morgan(config.NODE_ENV === "production" ? "combined" : "dev"));

const limiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api", limiter);

app.get("/api/health", (req, res) => {
  res.status(200).json({
    ok: true,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/account", accountRoutes);
app.use("/api/v1/credentials", credentialRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = { app };

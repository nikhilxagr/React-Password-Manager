const { HttpError } = require("../utils/httpError");

const errorHandler = (err, req, res, next) => {
  const statusCode = err instanceof HttpError ? err.statusCode : 500;
  const message = err.message || "Internal Server Error";

  if (statusCode >= 500) {
    console.error("[SERVER_ERROR]", err);
  }

  res.status(statusCode).json({
    ok: false,
    error: message,
    details: err instanceof HttpError ? err.details : null,
  });
};

module.exports = { errorHandler };

const { getSession } = require("../services/vaultService");
const { HttpError } = require("../utils/httpError");

const getBearerToken = (req) => {
  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) {
    return null;
  }

  return authHeader.slice(7).trim();
};

const requireVaultSession = (req, res, next) => {
  const token = getBearerToken(req);

  if (!token) {
    return next(new HttpError(401, "Missing bearer token."));
  }

  const session = getSession(token);

  if (!session) {
    return next(
      new HttpError(
        401,
        "Vault session expired or invalid. Unlock the vault again.",
      ),
    );
  }

  req.sessionToken = token;
  req.vaultKey = session.vaultKey;
  req.sessionExpiresAt = session.expiresAt;

  return next();
};

module.exports = {
  getBearerToken,
  requireVaultSession,
};

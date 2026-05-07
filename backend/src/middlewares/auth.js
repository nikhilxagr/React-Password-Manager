const { getSession } = require("../services/vaultService");
const { getUserById } = require("../services/accountService");
const { verifyAccessToken } = require("../utils/jwt");
const { HttpError } = require("../utils/httpError");

const getBearerToken = (req) => {
  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) {
    return null;
  }

  return authHeader.slice(7).trim();
};

const getVaultToken = (req) => {
  const header = req.headers["x-vault-token"];
  if (Array.isArray(header)) {
    return header[0];
  }

  return typeof header === "string" ? header.trim() : null;
};

const requireUserAuth = async (req, res, next) => {
  const token = getBearerToken(req);

  if (!token) {
    return next(new HttpError(401, "Missing bearer token."));
  }

  try {
    const payload = verifyAccessToken(token);
    const user = await getUserById(payload.sub);

    if (!user) {
      return next(new HttpError(401, "Account not found."));
    }

    req.user = {
      id: user._id.toString(),
      email: user.email,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt || null,
    };

    return next();
  } catch (error) {
    return next(new HttpError(401, "Invalid or expired access token."));
  }
};

const requireVaultSession = (req, res, next) => {
  if (!req.user) {
    return next(new HttpError(401, "Account authentication required."));
  }

  const token = getVaultToken(req);

  if (!token) {
    return next(new HttpError(401, "Missing vault session token."));
  }

  const session = getSession(token, req.user.id);

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
  getVaultToken,
  requireUserAuth,
  requireVaultSession,
};

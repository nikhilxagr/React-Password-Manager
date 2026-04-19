const config = require("../config/env");
const { getDb } = require("../config/db");
const { HttpError } = require("../utils/httpError");
const {
  randomBytes,
  deriveKey,
  hashPassword,
  encryptBuffer,
  decryptToBuffer,
  safeCompareBase64,
} = require("../utils/crypto");

const VAULT_META_COLLECTION = "vault_meta";
const VAULT_META_ID = "singleton";

const sessions = new Map();

const getMetaCollection = () => getDb().collection(VAULT_META_COLLECTION);

const sessionTtlMs = () => config.SESSION_TTL_MINUTES * 60 * 1000;

const cleanupExpiredSessions = () => {
  const now = Date.now();

  for (const [token, session] of sessions.entries()) {
    if (session.expiresAt <= now) {
      sessions.delete(token);
    }
  }
};

const getVaultMetadata = async () => {
  return getMetaCollection().findOne({ _id: VAULT_META_ID });
};

const ensureVaultMetadata = async () => {
  const metadata = await getVaultMetadata();
  if (!metadata) {
    throw new HttpError(404, "Vault is not initialized. Set up a master password first.");
  }

  return metadata;
};

const ensureVaultIndexes = async () => {
  await getMetaCollection().createIndex({ updatedAt: -1 });
};

const isVaultInitialized = async () => {
  const metadata = await getVaultMetadata();
  return Boolean(metadata);
};

const setupMasterPassword = async (masterPassword) => {
  const metadata = await getVaultMetadata();
  if (metadata) {
    throw new HttpError(409, "Vault is already initialized.");
  }

  const salt = randomBytes(16).toString("base64");
  const passwordHash = await hashPassword(masterPassword, salt);
  const keyEncryptionKey = await deriveKey(masterPassword, salt);
  const vaultKey = randomBytes(32);
  const wrappedVaultKey = encryptBuffer(vaultKey, keyEncryptionKey);
  const now = new Date();

  await getMetaCollection().insertOne({
    _id: VAULT_META_ID,
    salt,
    passwordHash,
    wrappedVaultKey,
    createdAt: now,
    updatedAt: now,
  });

  return {
    initialized: true,
    createdAt: now,
  };
};

const unlockVault = async (masterPassword) => {
  const metadata = await ensureVaultMetadata();
  const computedHash = await hashPassword(masterPassword, metadata.salt);

  if (!safeCompareBase64(computedHash, metadata.passwordHash)) {
    throw new HttpError(401, "Invalid master password.");
  }

  const keyEncryptionKey = await deriveKey(masterPassword, metadata.salt);
  const vaultKey = decryptToBuffer(metadata.wrappedVaultKey, keyEncryptionKey);

  const token = randomBytes(32).toString("hex");
  const expiresAt = Date.now() + sessionTtlMs();

  sessions.set(token, {
    vaultKey,
    expiresAt,
    createdAt: Date.now(),
  });

  return {
    token,
    expiresAt: new Date(expiresAt).toISOString(),
  };
};

const getSession = (token) => {
  if (!token) {
    return null;
  }

  cleanupExpiredSessions();
  const session = sessions.get(token);

  if (!session) {
    return null;
  }

  const renewedExpiresAt = Date.now() + sessionTtlMs();
  session.expiresAt = renewedExpiresAt;
  sessions.set(token, session);

  return {
    ...session,
    expiresAt: renewedExpiresAt,
  };
};

const lockSession = (token) => {
  if (!token) {
    return false;
  }

  return sessions.delete(token);
};

const getVaultStatus = async (token) => {
  cleanupExpiredSessions();
  const initialized = await isVaultInitialized();
  const unlocked = token ? Boolean(getSession(token)) : sessions.size > 0;

  return {
    initialized,
    unlocked,
  };
};

module.exports = {
  ensureVaultIndexes,
  isVaultInitialized,
  setupMasterPassword,
  unlockVault,
  getSession,
  lockSession,
  getVaultStatus,
};

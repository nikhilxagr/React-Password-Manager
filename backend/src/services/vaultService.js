const config = require("../config/env");
const { getDb } = require("../config/db");
const { HttpError } = require("../utils/httpError");
const {
  randomBytes,
  KDF_ALGORITHM_ARGON2ID,
  KDF_ALGORITHM_SCRYPT,
  createArgon2KdfConfig,
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

const getArgon2KdfParams = () => {
  return {
    algorithm: KDF_ALGORITHM_ARGON2ID,
    keyLength: 32,
    timeCost: config.ARGON2_TIME_COST,
    memoryCost: config.ARGON2_MEMORY_COST_KIB,
    parallelism: config.ARGON2_PARALLELISM,
  };
};

const buildVaultKdfConfig = () => {
  return createArgon2KdfConfig({
    timeCost: config.ARGON2_TIME_COST,
    memoryCost: config.ARGON2_MEMORY_COST_KIB,
    parallelism: config.ARGON2_PARALLELISM,
  });
};

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
    throw new HttpError(
      404,
      "Vault is not initialized. Set up a master password first.",
    );
  }

  return metadata;
};

const getMetadataKdfConfig = (metadata) => {
  if (metadata?.kdf?.salt) {
    return {
      ...metadata.kdf,
      algorithm: metadata.kdf.algorithm || KDF_ALGORITHM_ARGON2ID,
      keyLength: metadata.kdf.keyLength || 32,
    };
  }

  if (typeof metadata?.salt === "string") {
    return {
      algorithm: KDF_ALGORITHM_SCRYPT,
      keyLength: 32,
      salt: metadata.salt,
    };
  }

  throw new HttpError(500, "Vault metadata is missing KDF configuration.");
};

const migrateLegacyKdf = async (masterPassword, vaultKey) => {
  const nextKdf = buildVaultKdfConfig();
  const nextPasswordHash = await hashPassword(masterPassword, nextKdf);
  const nextKeyEncryptionKey = await deriveKey(masterPassword, nextKdf);
  const nextWrappedVaultKey = encryptBuffer(vaultKey, nextKeyEncryptionKey);

  await getMetaCollection().updateOne(
    { _id: VAULT_META_ID },
    {
      $set: {
        kdf: nextKdf,
        passwordHash: nextPasswordHash,
        wrappedVaultKey: nextWrappedVaultKey,
        updatedAt: new Date(),
      },
      $unset: {
        salt: "",
      },
    },
  );
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

  const kdf = buildVaultKdfConfig();
  const passwordHash = await hashPassword(masterPassword, kdf);
  const keyEncryptionKey = await deriveKey(masterPassword, kdf);
  const vaultKey = randomBytes(32);
  const wrappedVaultKey = encryptBuffer(vaultKey, keyEncryptionKey);
  const now = new Date();

  await getMetaCollection().insertOne({
    _id: VAULT_META_ID,
    kdf,
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
  const kdf = getMetadataKdfConfig(metadata);
  const computedHash = await hashPassword(masterPassword, kdf);

  if (!safeCompareBase64(computedHash, metadata.passwordHash)) {
    throw new HttpError(401, "Invalid master password.");
  }

  const keyEncryptionKey = await deriveKey(masterPassword, kdf);
  const vaultKey = decryptToBuffer(metadata.wrappedVaultKey, keyEncryptionKey);

  if (kdf.algorithm === KDF_ALGORITHM_SCRYPT) {
    // Opportunistic migration keeps legacy users working while upgrading KDF posture.
    migrateLegacyKdf(masterPassword, vaultKey).catch((error) => {
      console.warn("Legacy vault KDF migration failed:", error.message);
    });
  }

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

const getVaultKdfParams = async () => {
  const metadata = await getVaultMetadata();

  if (metadata?.kdf?.algorithm === KDF_ALGORITHM_ARGON2ID) {
    return {
      algorithm: metadata.kdf.algorithm,
      keyLength: metadata.kdf.keyLength || 32,
      timeCost: metadata.kdf.timeCost || config.ARGON2_TIME_COST,
      memoryCost: metadata.kdf.memoryCost || config.ARGON2_MEMORY_COST_KIB,
      parallelism: metadata.kdf.parallelism || config.ARGON2_PARALLELISM,
    };
  }

  return getArgon2KdfParams();
};

module.exports = {
  ensureVaultIndexes,
  isVaultInitialized,
  setupMasterPassword,
  unlockVault,
  getSession,
  lockSession,
  getVaultStatus,
  getVaultKdfParams,
};

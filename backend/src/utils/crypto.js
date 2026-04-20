const {
  randomBytes,
  scrypt: scryptCallback,
  createCipheriv,
  createDecipheriv,
  timingSafeEqual,
} = require("crypto");
const argon2 = require("argon2");
const { promisify } = require("util");

const scrypt = promisify(scryptCallback);

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32;
const IV_LENGTH = 12;

const KDF_ALGORITHM_ARGON2ID = "argon2id";
const KDF_ALGORITHM_SCRYPT = "scrypt";

const DEFAULT_ARGON2_TIME_COST = 3;
const DEFAULT_ARGON2_MEMORY_COST_KIB = 65536;
const DEFAULT_ARGON2_PARALLELISM = 1;

const createArgon2KdfConfig = ({
  timeCost = DEFAULT_ARGON2_TIME_COST,
  memoryCost = DEFAULT_ARGON2_MEMORY_COST_KIB,
  parallelism = DEFAULT_ARGON2_PARALLELISM,
} = {}) => {
  return {
    algorithm: KDF_ALGORITHM_ARGON2ID,
    keyLength: KEY_LENGTH,
    salt: randomBytes(16).toString("base64"),
    timeCost,
    memoryCost,
    parallelism,
  };
};

const normalizeKdfConfig = (kdfConfigOrSalt) => {
  if (typeof kdfConfigOrSalt === "string") {
    return {
      algorithm: KDF_ALGORITHM_SCRYPT,
      keyLength: KEY_LENGTH,
      salt: kdfConfigOrSalt,
    };
  }

  if (!kdfConfigOrSalt || typeof kdfConfigOrSalt !== "object") {
    throw new Error("A valid KDF configuration is required.");
  }

  const algorithm =
    typeof kdfConfigOrSalt.algorithm === "string" &&
    kdfConfigOrSalt.algorithm.trim().length > 0
      ? kdfConfigOrSalt.algorithm.trim()
      : KDF_ALGORITHM_ARGON2ID;

  if (!kdfConfigOrSalt.salt || typeof kdfConfigOrSalt.salt !== "string") {
    throw new Error("KDF salt is required.");
  }

  return {
    algorithm,
    keyLength: Number.isInteger(kdfConfigOrSalt.keyLength)
      ? kdfConfigOrSalt.keyLength
      : KEY_LENGTH,
    salt: kdfConfigOrSalt.salt,
    timeCost: Number.isInteger(kdfConfigOrSalt.timeCost)
      ? kdfConfigOrSalt.timeCost
      : DEFAULT_ARGON2_TIME_COST,
    memoryCost: Number.isInteger(kdfConfigOrSalt.memoryCost)
      ? kdfConfigOrSalt.memoryCost
      : DEFAULT_ARGON2_MEMORY_COST_KIB,
    parallelism: Number.isInteger(kdfConfigOrSalt.parallelism)
      ? kdfConfigOrSalt.parallelism
      : DEFAULT_ARGON2_PARALLELISM,
  };
};

const deriveKey = async (password, kdfConfigOrSalt) => {
  const kdf = normalizeKdfConfig(kdfConfigOrSalt);
  const salt = Buffer.from(kdf.salt, "base64");

  if (kdf.algorithm === KDF_ALGORITHM_SCRYPT) {
    return scrypt(password, salt, kdf.keyLength);
  }

  if (kdf.algorithm === KDF_ALGORITHM_ARGON2ID) {
    return argon2.hash(password, {
      type: argon2.argon2id,
      salt,
      raw: true,
      hashLength: kdf.keyLength,
      timeCost: kdf.timeCost,
      memoryCost: kdf.memoryCost,
      parallelism: kdf.parallelism,
    });
  }

  throw new Error(`Unsupported KDF algorithm: ${kdf.algorithm}`);
};

const hashPassword = async (password, kdfConfigOrSalt) => {
  const derived = await deriveKey(password, kdfConfigOrSalt);
  return Buffer.from(derived).toString("base64");
};

const encryptText = (plainText, keyBuffer) => {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, keyBuffer, iv);

  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    iv: iv.toString("base64"),
    ciphertext: encrypted.toString("base64"),
    tag: tag.toString("base64"),
  };
};

const decryptText = (payload, keyBuffer) => {
  const iv = Buffer.from(payload.iv, "base64");
  const ciphertext = Buffer.from(payload.ciphertext, "base64");
  const tag = Buffer.from(payload.tag, "base64");

  const decipher = createDecipheriv(ALGORITHM, keyBuffer, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString("utf8");
};

const encryptBuffer = (buffer, keyBuffer) => {
  return encryptText(buffer.toString("base64"), keyBuffer);
};

const decryptToBuffer = (payload, keyBuffer) => {
  const plaintextBase64 = decryptText(payload, keyBuffer);
  return Buffer.from(plaintextBase64, "base64");
};

const safeCompareBase64 = (left, right) => {
  try {
    const a = Buffer.from(left || "", "base64");
    const b = Buffer.from(right || "", "base64");

    if (a.length !== b.length) {
      return false;
    }

    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
};

module.exports = {
  randomBytes,
  KDF_ALGORITHM_ARGON2ID,
  KDF_ALGORITHM_SCRYPT,
  createArgon2KdfConfig,
  deriveKey,
  hashPassword,
  encryptText,
  decryptText,
  encryptBuffer,
  decryptToBuffer,
  safeCompareBase64,
};

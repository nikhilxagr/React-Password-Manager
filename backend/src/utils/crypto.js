const {
  randomBytes,
  scrypt: scryptCallback,
  createCipheriv,
  createDecipheriv,
  timingSafeEqual,
} = require("crypto");
const { promisify } = require("util");

const scrypt = promisify(scryptCallback);

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32;
const IV_LENGTH = 12;

const deriveKey = async (password, saltBase64) => {
  const salt = Buffer.from(saltBase64, "base64");
  return scrypt(password, salt, KEY_LENGTH);
};

const hashPassword = async (password, saltBase64) => {
  const derived = await deriveKey(password, saltBase64);
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
  deriveKey,
  hashPassword,
  encryptText,
  decryptText,
  encryptBuffer,
  decryptToBuffer,
  safeCompareBase64,
};

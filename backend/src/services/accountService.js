const { ObjectId } = require("mongodb");
const { createHash, randomBytes } = require("crypto");
const argon2 = require("argon2");
const config = require("../config/env");
const { getDb } = require("../config/db");
const { HttpError } = require("../utils/httpError");

const USERS_COLLECTION = "users";

const getUsersCollection = () => getDb().collection(USERS_COLLECTION);

const normalizeEmail = (email) => email.trim().toLowerCase();

const toObjectId = (value, message) => {
  if (!ObjectId.isValid(value)) {
    throw new HttpError(400, message || "Invalid user id.");
  }

  return new ObjectId(value);
};

const hashAccountPassword = async (password) => {
  return argon2.hash(password, {
    type: argon2.argon2id,
    timeCost: config.ARGON2_TIME_COST,
    memoryCost: config.ARGON2_MEMORY_COST_KIB,
    parallelism: config.ARGON2_PARALLELISM,
  });
};

const verifyAccountPassword = async (hash, password) => {
  return argon2.verify(hash, password);
};

const toPublicUser = (doc) => {
  return {
    id: doc._id.toString(),
    email: doc.email,
    createdAt: doc.createdAt,
    lastLoginAt: doc.lastLoginAt || null,
  };
};

const ensureUserIndexes = async () => {
  const collection = getUsersCollection();
  await collection.createIndex({ email: 1 }, { unique: true });
  await collection.createIndex({ resetTokenHash: 1 }, { sparse: true });
};

const getUserByEmail = async (email) => {
  return getUsersCollection().findOne({ email: normalizeEmail(email) });
};

const getUserById = async (id) => {
  const objectId = toObjectId(id);
  return getUsersCollection().findOne({ _id: objectId });
};

const createUser = async ({ email, password }) => {
  const normalizedEmail = normalizeEmail(email);
  const existing = await getUsersCollection().findOne({
    email: normalizedEmail,
  });

  if (existing) {
    throw new HttpError(409, "An account with this email already exists.");
  }

  const passwordHash = await hashAccountPassword(password);
  const now = new Date();
  const doc = {
    email: normalizedEmail,
    passwordHash,
    createdAt: now,
    updatedAt: now,
    lastLoginAt: null,
  };

  const result = await getUsersCollection().insertOne(doc);
  return toPublicUser({ ...doc, _id: result.insertedId });
};

const authenticateUser = async ({ email, password }) => {
  const normalizedEmail = normalizeEmail(email);
  const user = await getUsersCollection().findOne({ email: normalizedEmail });

  if (!user) {
    throw new HttpError(401, "Invalid email or password.");
  }

  const valid = await verifyAccountPassword(user.passwordHash, password);
  if (!valid) {
    throw new HttpError(401, "Invalid email or password.");
  }

  await getUsersCollection().updateOne(
    { _id: user._id },
    {
      $set: {
        lastLoginAt: new Date(),
        updatedAt: new Date(),
      },
    },
  );

  return toPublicUser(user);
};

const createPasswordResetToken = async (userId) => {
  const objectId = toObjectId(userId);
  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(
    Date.now() + config.PASSWORD_RESET_TOKEN_TTL_MINUTES * 60 * 1000,
  );

  await getUsersCollection().updateOne(
    { _id: objectId },
    {
      $set: {
        resetTokenHash: tokenHash,
        resetTokenExpiresAt: expiresAt,
        updatedAt: new Date(),
      },
    },
  );

  return { token: rawToken, expiresAt };
};

const consumePasswordResetToken = async (token) => {
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const user = await getUsersCollection().findOne({
    resetTokenHash: tokenHash,
    resetTokenExpiresAt: { $gt: new Date() },
  });

  if (!user) {
    throw new HttpError(400, "Invalid or expired reset token.");
  }

  return user;
};

const resetPassword = async (userId, newPassword) => {
  const objectId = toObjectId(userId);
  const passwordHash = await hashAccountPassword(newPassword);

  await getUsersCollection().updateOne(
    { _id: objectId },
    {
      $set: {
        passwordHash,
        updatedAt: new Date(),
      },
      $unset: {
        resetTokenHash: "",
        resetTokenExpiresAt: "",
      },
    },
  );
};

module.exports = {
  ensureUserIndexes,
  getUserByEmail,
  getUserById,
  createUser,
  authenticateUser,
  createPasswordResetToken,
  consumePasswordResetToken,
  resetPassword,
};

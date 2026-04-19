const { ObjectId } = require("mongodb");
const { getDb } = require("../config/db");
const { HttpError } = require("../utils/httpError");
const { encryptText, decryptText } = require("../utils/crypto");
const {
  normalizeDomain,
  hashBlindIndex,
  escapeRegExp,
} = require("../utils/domain");

const CREDENTIAL_COLLECTION = "credentials";

const getCollection = () => getDb().collection(CREDENTIAL_COLLECTION);

const ensureCredentialIndexes = async () => {
  const collection = getCollection();
  await collection.createIndex({ site: 1 });
  await collection.createIndex({ host: 1 });
  await collection.createIndex({ registrableDomain: 1 });
  await collection.createIndex({ hostIndex: 1 });
  await collection.createIndex({ registrableDomainIndex: 1 });
  await collection.createIndex({ username: 1 });
  await collection.createIndex({ tags: 1 });
  await collection.createIndex({ favorite: 1, updatedAt: -1 });
  await collection.createIndex({ updatedAt: -1 });
};

const toPublicCredential = (doc) => {
  return {
    id: doc._id.toString(),
    site: doc.site,
    username: doc.username,
    notes: doc.notes || "",
    tags: Array.isArray(doc.tags) ? doc.tags : [],
    category: doc.category || "General",
    favorite: Boolean(doc.favorite),
    host: doc.host || "",
    registrableDomain: doc.registrableDomain || "",
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    lastUsedAt: doc.lastUsedAt || null,
  };
};

const toExtensionCredential = (doc) => {
  return {
    id: doc._id.toString(),
    site: doc.site,
    username: doc.username,
    encryptedPassword: doc.encryptedPassword,
    category: doc.category || "General",
    favorite: Boolean(doc.favorite),
    host: doc.host || "",
    registrableDomain: doc.registrableDomain || "",
    updatedAt: doc.updatedAt,
    lastUsedAt: doc.lastUsedAt || null,
  };
};

const buildDomainMetadata = (site) => {
  const normalized = normalizeDomain(site);
  if (!normalized) {
    throw new HttpError(400, "Unable to determine domain from site URL.");
  }

  return {
    host: normalized.host,
    registrableDomain: normalized.registrableDomain,
    hostIndex: hashBlindIndex(normalized.host),
    registrableDomainIndex: hashBlindIndex(normalized.registrableDomain),
  };
};

const asObjectId = (id) => {
  if (!ObjectId.isValid(id)) {
    throw new HttpError(400, "Invalid credential id.");
  }

  return new ObjectId(id);
};

const parseFavorite = (favorite) => {
  if (favorite === undefined) {
    return undefined;
  }

  if (favorite === true || favorite === "true") {
    return true;
  }

  if (favorite === false || favorite === "false") {
    return false;
  }

  return undefined;
};

const buildQuery = ({ search, favorite, tag, category }) => {
  const query = {};

  const favoriteFilter = parseFavorite(favorite);
  if (favoriteFilter !== undefined) {
    query.favorite = favoriteFilter;
  }

  if (typeof tag === "string" && tag.trim().length > 0) {
    query.tags = { $in: [tag.trim()] };
  }

  if (typeof category === "string" && category.trim().length > 0) {
    query.category = category.trim();
  }

  if (typeof search === "string" && search.trim().length > 0) {
    const searchRegex = new RegExp(search.trim(), "i");
    query.$or = [
      { site: searchRegex },
      { username: searchRegex },
      { notes: searchRegex },
      { category: searchRegex },
      { tags: searchRegex },
    ];
  }

  return query;
};

const listCredentials = async ({ search, favorite, tag, category, sortBy, order }) => {
  const collection = getCollection();
  const query = buildQuery({ search, favorite, tag, category });

  const allowedSortFields = new Set(["site", "username", "createdAt", "updatedAt", "favorite"]);
  const safeSortBy = allowedSortFields.has(sortBy) ? sortBy : "updatedAt";
  const safeOrder = order === "asc" ? 1 : -1;

  const credentials = await collection.find(query).sort({ [safeSortBy]: safeOrder }).toArray();
  return credentials.map(toPublicCredential);
};

const createCredential = async (payload, vaultKey) => {
  const now = new Date();
  const encryptedPassword = encryptText(payload.password, vaultKey);
  const domainMeta = buildDomainMetadata(payload.site);

  const doc = {
    site: payload.site,
    ...domainMeta,
    username: payload.username,
    encryptedPassword,
    notes: payload.notes || "",
    tags: payload.tags || [],
    category: payload.category || "General",
    favorite: Boolean(payload.favorite),
    lastUsedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  const result = await getCollection().insertOne(doc);
  return toPublicCredential({ ...doc, _id: result.insertedId });
};

const updateCredential = async (id, payload, vaultKey) => {
  const objectId = asObjectId(id);
  const updates = { updatedAt: new Date() };

  if (payload.site !== undefined) updates.site = payload.site;
  if (payload.username !== undefined) updates.username = payload.username;
  if (payload.notes !== undefined) updates.notes = payload.notes;
  if (payload.tags !== undefined) updates.tags = payload.tags;
  if (payload.category !== undefined) updates.category = payload.category;
  if (payload.favorite !== undefined) updates.favorite = Boolean(payload.favorite);

  if (payload.password !== undefined) {
    updates.encryptedPassword = encryptText(payload.password, vaultKey);
  }

  if (payload.site !== undefined) {
    const domainMeta = buildDomainMetadata(payload.site);
    updates.host = domainMeta.host;
    updates.registrableDomain = domainMeta.registrableDomain;
    updates.hostIndex = domainMeta.hostIndex;
    updates.registrableDomainIndex = domainMeta.registrableDomainIndex;
  }

  if (Object.keys(updates).length === 1) {
    throw new HttpError(400, "No updatable fields provided.");
  }

  const result = await getCollection().findOneAndUpdate(
    { _id: objectId },
    { $set: updates },
    { returnDocument: "after" },
  );

  if (!result.value) {
    throw new HttpError(404, "Credential not found.");
  }

  return toPublicCredential(result.value);
};

const deleteCredential = async (id) => {
  const objectId = asObjectId(id);
  const result = await getCollection().deleteOne({ _id: objectId });

  if (result.deletedCount === 0) {
    throw new HttpError(404, "Credential not found.");
  }

  return true;
};

const getCredentialSecret = async (id, vaultKey) => {
  const objectId = asObjectId(id);
  const doc = await getCollection().findOne({ _id: objectId });

  if (!doc) {
    throw new HttpError(404, "Credential not found.");
  }

  const password = decryptText(doc.encryptedPassword, vaultKey);
  return {
    id: doc._id.toString(),
    password,
  };
};

const touchCredential = async (id) => {
  const objectId = asObjectId(id);

  const result = await getCollection().findOneAndUpdate(
    { _id: objectId },
    {
      $set: {
        lastUsedAt: new Date(),
        updatedAt: new Date(),
      },
    },
    { returnDocument: "after" },
  );

  if (!result.value) {
    throw new HttpError(404, "Credential not found.");
  }

  return toPublicCredential(result.value);
};

const listCredentialsByDomain = async (domain) => {
  const normalized = normalizeDomain(domain);
  if (!normalized) {
    throw new HttpError(400, "A valid domain is required.");
  }

  const collection = getCollection();
  const hostIndex = hashBlindIndex(normalized.host);
  const registrableDomainIndex = hashBlindIndex(normalized.registrableDomain);

  const query = {
    $or: [
      { host: normalized.host },
      { registrableDomain: normalized.registrableDomain },
      { hostIndex },
      { registrableDomainIndex },
    ],
  };

  let docs = await collection.find(query).sort({ favorite: -1, updatedAt: -1 }).toArray();

  if (docs.length === 0) {
    const escapedHost = escapeRegExp(normalized.host);
    const escapedDomain = escapeRegExp(normalized.registrableDomain);
    const fallbackRegex = new RegExp(`(https?:\\/\\/)?([^.]+\\.)*(${escapedHost}|${escapedDomain})(:\\d+)?(\\/|$)`, "i");

    docs = await collection
      .find({ site: fallbackRegex })
      .sort({ favorite: -1, updatedAt: -1 })
      .limit(20)
      .toArray();
  }

  return docs.map(toExtensionCredential);
};

const importLegacyCredentials = async (entries, vaultKey) => {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new HttpError(400, "entries must be a non-empty array.");
  }

  if (entries.length > 500) {
    throw new HttpError(400, "Import limit exceeded. Max 500 entries per request.");
  }

  const now = new Date();
  const docs = entries.map((entry) => {
    const domainMeta = buildDomainMetadata(entry.site);

    return {
      site: entry.site,
      ...domainMeta,
      username: entry.username,
      encryptedPassword: encryptText(entry.password, vaultKey),
      notes: entry.notes || "",
      tags: entry.tags || [],
      category: entry.category || "General",
      favorite: Boolean(entry.favorite),
      lastUsedAt: null,
      createdAt: now,
      updatedAt: now,
    };
  });

  const result = await getCollection().insertMany(docs, { ordered: false });
  return result.insertedCount;
};

module.exports = {
  ensureCredentialIndexes,
  listCredentials,
  createCredential,
  updateCredential,
  deleteCredential,
  getCredentialSecret,
  touchCredential,
  listCredentialsByDomain,
  importLegacyCredentials,
};

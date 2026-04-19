const { HttpError } = require("./httpError");

const isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;

const normalizeString = (value) => (typeof value === "string" ? value.trim() : "");

const normalizeTags = (tags) => {
  if (!Array.isArray(tags)) {
    return [];
  }

  return tags
    .map((tag) => (typeof tag === "string" ? tag.trim() : ""))
    .filter((tag) => tag.length > 0)
    .slice(0, 12);
};

const normalizeUrl = (url) => {
  const candidate = normalizeString(url);
  if (!candidate) {
    return "";
  }

  if (candidate.startsWith("http://") || candidate.startsWith("https://")) {
    return candidate;
  }

  return `https://${candidate}`;
};

const validateMasterPassword = (password) => {
  if (!isNonEmptyString(password) || password.trim().length < 8) {
    throw new HttpError(400, "Master password must be at least 8 characters long.");
  }
};

const validateCredentialPayload = (payload, { partial = false } = {}) => {
  const errors = [];
  const normalized = {};

  const hasSite = Object.prototype.hasOwnProperty.call(payload, "site");
  const hasUsername = Object.prototype.hasOwnProperty.call(payload, "username");
  const hasPassword = Object.prototype.hasOwnProperty.call(payload, "password");
  const hasNotes = Object.prototype.hasOwnProperty.call(payload, "notes");
  const hasTags = Object.prototype.hasOwnProperty.call(payload, "tags");
  const hasCategory = Object.prototype.hasOwnProperty.call(payload, "category");
  const hasFavorite = Object.prototype.hasOwnProperty.call(payload, "favorite");

  if (partial && !hasSite && !hasUsername && !hasPassword && !hasNotes && !hasTags && !hasCategory && !hasFavorite) {
    throw new HttpError(400, "No fields provided for update.");
  }

  if (!partial || hasSite) {
    const site = normalizeUrl(payload.site);
    if (!site || site.length < 4) {
      errors.push("Site is required and must be valid.");
    } else {
      normalized.site = site;
    }
  }

  if (!partial || hasUsername) {
    const username = normalizeString(payload.username);
    if (!username || username.length < 3) {
      errors.push("Username must be at least 3 characters.");
    } else {
      normalized.username = username;
    }
  }

  if (!partial || hasPassword) {
    const password = normalizeString(payload.password);
    if (!password || password.length < 6) {
      errors.push("Password must be at least 6 characters.");
    } else {
      normalized.password = password;
    }
  }

  if (!partial || hasNotes) {
    const notes = normalizeString(payload.notes || "");
    if (notes.length > 1000) {
      errors.push("Notes must be 1000 characters or less.");
    } else {
      normalized.notes = notes;
    }
  }

  if (!partial || hasCategory) {
    const category = normalizeString(payload.category || "General");
    if (category.length > 40) {
      errors.push("Category must be 40 characters or less.");
    } else {
      normalized.category = category;
    }
  }

  if (!partial || hasTags) {
    normalized.tags = normalizeTags(payload.tags || []);
  }

  if (!partial || hasFavorite) {
    normalized.favorite = Boolean(payload.favorite);
  }

  if (errors.length > 0) {
    throw new HttpError(400, "Invalid credential payload.", errors);
  }

  return normalized;
};

module.exports = {
  validateMasterPassword,
  validateCredentialPayload,
  normalizeTags,
  normalizeString,
};

const { createHmac } = require("crypto");
const { parse: parseDomain } = require("tldts");
const config = require("../config/env");

const toHostCandidate = (value) => {
  if (typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  try {
    const url = trimmed.startsWith("http://") || trimmed.startsWith("https://")
      ? new URL(trimmed)
      : new URL(`https://${trimmed}`);
    return url.hostname.toLowerCase();
  } catch {
    return trimmed
      .replace(/^https?:\/\//i, "")
      .split("/")[0]
      .split(":")[0]
      .toLowerCase();
  }
};

const normalizeDomain = (value) => {
  const host = toHostCandidate(value);
  if (!host) {
    return null;
  }

  const parsed = parseDomain(host, { allowPrivateDomains: true });

  return {
    host,
    registrableDomain: parsed.domain || host,
  };
};

const escapeRegExp = (value) => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

const hashBlindIndex = (value) => {
  return createHmac("sha256", config.BLIND_INDEX_KEY)
    .update(value)
    .digest("hex");
};

module.exports = {
  normalizeDomain,
  hashBlindIndex,
  escapeRegExp,
};
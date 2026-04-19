const MULTI_LABEL_TLDS = new Set([
  "co.uk",
  "com.au",
  "co.in",
  "co.jp",
  "com.br",
  "com.mx",
  "com.tr",
  "com.sg",
  "com.cn",
]);

export const toHost = (value) => {
  if (!value || typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  try {
    const url =
      trimmed.startsWith("http://") || trimmed.startsWith("https://")
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

export const toRegistrableDomain = (host) => {
  if (!host) {
    return "";
  }

  const parts = host.split(".").filter(Boolean);
  if (parts.length <= 2) {
    return host;
  }

  const lastTwo = parts.slice(-2).join(".");
  if (MULTI_LABEL_TLDS.has(lastTwo)) {
    return parts.slice(-3).join(".");
  }

  return lastTwo;
};

export const normalizeDomain = (value) => {
  const host = toHost(value);

  if (!host) {
    return null;
  }

  return {
    host,
    registrableDomain: toRegistrableDomain(host),
  };
};

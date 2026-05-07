const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api/v1";

const buildUrl = (path, query) => {
  const url = new URL(`${API_BASE}${path}`);

  if (query && typeof query === "object") {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    });
  }

  return url.toString();
};

const request = async (
  path,
  { method = "GET", accessToken, vaultToken, body, query } = {},
) => {
  const headers = {
    "Content-Type": "application/json",
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  if (vaultToken) {
    headers["X-Vault-Token"] = vaultToken;
  }

  const response = await fetch(buildUrl(path, query), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMessage = payload.error || payload.message || "Request failed.";
    const error = new Error(errorMessage);
    error.status = response.status;
    error.details = payload.details || null;
    throw error;
  }

  return payload;
};

export const api = {
  health: () => request("/health"),
  account: {
    signup: ({ email, password, confirmPassword }) =>
      request("/account/signup", {
        method: "POST",
        body: { email, password, confirmPassword },
      }),
    login: ({ email, password }) =>
      request("/account/login", {
        method: "POST",
        body: { email, password },
      }),
    me: (accessToken) => request("/account/me", { accessToken }),
    logout: (accessToken) =>
      request("/account/logout", { method: "POST", accessToken }),
    requestPasswordReset: ({ email }) =>
      request("/account/password-reset/request", {
        method: "POST",
        body: { email },
      }),
    confirmPasswordReset: ({ token, password, confirmPassword }) =>
      request("/account/password-reset/confirm", {
        method: "POST",
        body: { token, password, confirmPassword },
      }),
  },
  auth: {
    status: (accessToken, vaultToken) =>
      request("/auth/status", { accessToken, vaultToken }),
    unlock: (accessToken, { masterPassword }) =>
      request("/auth/unlock", {
        method: "POST",
        accessToken,
        body: { masterPassword },
      }),
    setup: (accessToken, { masterPassword, confirmMasterPassword }) =>
      request("/auth/setup", {
        method: "POST",
        accessToken,
        body: { masterPassword, confirmMasterPassword },
      }),
    lock: (accessToken, vaultToken) =>
      request("/auth/lock", {
        method: "POST",
        accessToken,
        vaultToken,
      }),
  },
  credentials: {
    list: (accessToken, vaultToken, query = {}) =>
      request("/credentials", { accessToken, vaultToken, query }),
    create: (accessToken, vaultToken, body) =>
      request("/credentials", {
        method: "POST",
        accessToken,
        vaultToken,
        body,
      }),
    update: (accessToken, vaultToken, id, body) =>
      request(`/credentials/${id}`, {
        method: "PUT",
        accessToken,
        vaultToken,
        body,
      }),
    delete: (accessToken, vaultToken, id) =>
      request(`/credentials/${id}`, {
        method: "DELETE",
        accessToken,
        vaultToken,
      }),
    secret: (accessToken, vaultToken, id) =>
      request(`/credentials/${id}/secret`, { accessToken, vaultToken }),
    touch: (accessToken, vaultToken, id) =>
      request(`/credentials/${id}/touch`, {
        method: "POST",
        accessToken,
        vaultToken,
      }),
    importLegacy: (accessToken, vaultToken, entries) =>
      request("/credentials/import-legacy", {
        method: "POST",
        accessToken,
        vaultToken,
        body: { entries },
      }),
  },
};

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

const request = async (path, { method = "GET", token, body, query } = {}) => {
  const headers = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
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
  auth: {
    status: (token) => request("/auth/status", { token }),
    setup: ({ masterPassword, confirmMasterPassword }) =>
      request("/auth/setup", {
        method: "POST",
        body: { masterPassword, confirmMasterPassword },
      }),
    unlock: ({ masterPassword }) =>
      request("/auth/unlock", {
        method: "POST",
        body: { masterPassword },
      }),
    lock: (token) =>
      request("/auth/lock", {
        method: "POST",
        token,
      }),
  },
  credentials: {
    list: (token, query = {}) => request("/credentials", { token, query }),
    create: (token, body) => request("/credentials", { method: "POST", token, body }),
    update: (token, id, body) =>
      request(`/credentials/${id}`, { method: "PUT", token, body }),
    delete: (token, id) =>
      request(`/credentials/${id}`, { method: "DELETE", token }),
    secret: (token, id) => request(`/credentials/${id}/secret`, { token }),
    touch: (token, id) => request(`/credentials/${id}/touch`, { method: "POST", token }),
    importLegacy: (token, entries) =>
      request("/credentials/import-legacy", {
        method: "POST",
        token,
        body: { entries },
      }),
  },
};

import { normalizeDomain } from "../shared/domain.js";

const STORAGE_KEYS = {
  token: "vault_token",
  expiresAt: "vault_expires_at",
  apiBase: "api_base"
};

const AUTO_LOCK_ALARM = "vault-auto-lock";
const DEFAULT_API_BASE = "http://localhost:3000/api/v1";
const AUTO_LOCK_MINUTES = 30;

const getStorageArea = () => chrome.storage.session || chrome.storage.local;

const getApiBase = async () => {
  const value = await chrome.storage.local.get(STORAGE_KEYS.apiBase);
  return value[STORAGE_KEYS.apiBase] || DEFAULT_API_BASE;
};

const setApiBase = async (baseUrl) => {
  await chrome.storage.local.set({
    [STORAGE_KEYS.apiBase]: baseUrl || DEFAULT_API_BASE
  });

  return baseUrl || DEFAULT_API_BASE;
};

const getSession = async () => {
  const storage = getStorageArea();
  const data = await storage.get([STORAGE_KEYS.token, STORAGE_KEYS.expiresAt]);

  return {
    token: data[STORAGE_KEYS.token] || "",
    expiresAt: data[STORAGE_KEYS.expiresAt] || null
  };
};

const setSession = async ({ token, expiresAt }) => {
  const storage = getStorageArea();

  await storage.set({
    [STORAGE_KEYS.token]: token,
    [STORAGE_KEYS.expiresAt]: expiresAt || null
  });

  await chrome.alarms.create(AUTO_LOCK_ALARM, {
    delayInMinutes: AUTO_LOCK_MINUTES
  });
};

const clearSession = async () => {
  const storage = getStorageArea();

  await storage.remove([STORAGE_KEYS.token, STORAGE_KEYS.expiresAt]);
  await chrome.alarms.clear(AUTO_LOCK_ALARM);
};

const apiRequest = async (path, { method = "GET", token, body } = {}) => {
  const apiBase = await getApiBase();
  const url = `${apiBase}${path}`;

  const headers = {
    "Content-Type": "application/json"
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = payload.error || payload.message || "Request failed.";
    throw new Error(message);
  }

  return payload;
};

const withActiveSession = async () => {
  const session = await getSession();

  if (!session.token) {
    throw new Error("Vault is locked in extension. Unlock it from the popup.");
  }

  return session;
};

const getCredentialsForDomain = async (domainInput) => {
  const normalized = normalizeDomain(domainInput);

  if (!normalized) {
    return [];
  }

  const { token } = await withActiveSession();
  const response = await apiRequest(
    `/credentials/domain/${encodeURIComponent(normalized.host)}`,
    { token }
  );

  return response.data || [];
};

const unlockVault = async (masterPassword) => {
  const response = await apiRequest("/auth/unlock", {
    method: "POST",
    body: { masterPassword }
  });

  await setSession(response.data);
  return response.data;
};

const lockVault = async () => {
  const { token } = await getSession();

  if (token) {
    try {
      await apiRequest("/auth/lock", { method: "POST", token });
    } catch {
      // Local lock should always proceed even if API call fails.
    }
  }

  await clearSession();
  return true;
};

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === AUTO_LOCK_ALARM) {
    await clearSession();
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handle = async () => {
    switch (message?.type) {
      case "vault.getStatus": {
        const session = await getSession();
        const response = await apiRequest("/auth/status", {
          token: session.token || undefined
        });

        return {
          ...response.data,
          tokenPresent: Boolean(session.token),
          apiBase: await getApiBase()
        };
      }
      case "vault.setApiBase": {
        const apiBase = await setApiBase(String(message.apiBase || "").trim());
        return { apiBase };
      }
      case "vault.unlock": {
        if (!message.masterPassword) {
          throw new Error("Master password is required.");
        }

        const data = await unlockVault(message.masterPassword);
        return data;
      }
      case "vault.lock": {
        await lockVault();
        return { locked: true };
      }
      case "credentials.byDomain": {
        const data = await getCredentialsForDomain(message.domain || sender?.url || "");
        return { items: data };
      }
      case "credentials.secret": {
        const session = await withActiveSession();
        const response = await apiRequest(`/credentials/${message.id}/secret`, {
          token: session.token
        });

        return response.data;
      }
      case "credentials.touch": {
        const session = await withActiveSession();
        await apiRequest(`/credentials/${message.id}/touch`, {
          method: "POST",
          token: session.token
        });
        return { ok: true };
      }
      case "credentials.create": {
        const session = await withActiveSession();
        const response = await apiRequest("/credentials", {
          method: "POST",
          token: session.token,
          body: message.payload
        });

        return response.data;
      }
      default:
        throw new Error("Unsupported message type.");
    }
  };

  handle()
    .then((data) => sendResponse({ ok: true, data }))
    .catch((error) => sendResponse({ ok: false, error: error.message }));

  return true;
});

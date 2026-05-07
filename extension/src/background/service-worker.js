import { normalizeDomain } from "../shared/domain.js";

const STORAGE_KEYS = {
  accountToken: "account_token",
  accountEmail: "account_email",
  vaultToken: "vault_token",
  vaultExpiresAt: "vault_expires_at",
  apiBase: "api_base",
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
    [STORAGE_KEYS.apiBase]: baseUrl || DEFAULT_API_BASE,
  });

  return baseUrl || DEFAULT_API_BASE;
};

const getVaultSession = async () => {
  const storage = getStorageArea();
  const data = await storage.get([
    STORAGE_KEYS.vaultToken,
    STORAGE_KEYS.vaultExpiresAt,
  ]);

  return {
    token: data[STORAGE_KEYS.vaultToken] || "",
    expiresAt: data[STORAGE_KEYS.vaultExpiresAt] || null,
  };
};

const setVaultSession = async ({ token, expiresAt }) => {
  const storage = getStorageArea();

  await storage.set({
    [STORAGE_KEYS.vaultToken]: token,
    [STORAGE_KEYS.vaultExpiresAt]: expiresAt || null,
  });

  await chrome.alarms.create(AUTO_LOCK_ALARM, {
    delayInMinutes: AUTO_LOCK_MINUTES,
  });
};

const clearVaultSession = async () => {
  const storage = getStorageArea();

  await storage.remove([STORAGE_KEYS.vaultToken, STORAGE_KEYS.vaultExpiresAt]);
  await chrome.alarms.clear(AUTO_LOCK_ALARM);
};

const getAccountSession = async () => {
  const data = await chrome.storage.local.get([
    STORAGE_KEYS.accountToken,
    STORAGE_KEYS.accountEmail,
  ]);

  return {
    token: data[STORAGE_KEYS.accountToken] || "",
    email: data[STORAGE_KEYS.accountEmail] || "",
  };
};

const setAccountSession = async ({ token, email }) => {
  await chrome.storage.local.set({
    [STORAGE_KEYS.accountToken]: token,
    [STORAGE_KEYS.accountEmail]: email || "",
  });
};

const clearAccountSession = async () => {
  await chrome.storage.local.remove([
    STORAGE_KEYS.accountToken,
    STORAGE_KEYS.accountEmail,
  ]);
  await clearVaultSession();
};

const apiRequest = async (
  path,
  { method = "GET", accessToken, vaultToken, body } = {},
) => {
  const apiBase = await getApiBase();
  const url = `${apiBase}${path}`;

  const headers = {
    "Content-Type": "application/json",
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  if (vaultToken) {
    headers["X-Vault-Token"] = vaultToken;
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = payload.error || payload.message || "Request failed.";
    throw new Error(message);
  }

  return payload;
};

const withActiveAccount = async () => {
  const account = await getAccountSession();

  if (!account.token) {
    throw new Error("Login required in extension.");
  }

  return account;
};

const withActiveVaultSession = async () => {
  const account = await withActiveAccount();
  const session = await getVaultSession();

  if (!session.token) {
    throw new Error("Vault is locked in extension. Unlock it from the popup.");
  }

  return { account, session };
};

const getCredentialsForDomain = async (domainInput) => {
  const normalized = normalizeDomain(domainInput);

  if (!normalized) {
    return [];
  }

  const { account, session } = await withActiveVaultSession();
  const response = await apiRequest(
    `/credentials/domain/${encodeURIComponent(normalized.host)}`,
    { accessToken: account.token, vaultToken: session.token },
  );

  return response.data || [];
};

const unlockVault = async (masterPassword) => {
  const account = await withActiveAccount();
  const response = await apiRequest("/auth/unlock", {
    method: "POST",
    accessToken: account.token,
    body: { masterPassword },
  });

  await setVaultSession(response.data);
  return response.data;
};

const lockVault = async () => {
  const account = await getAccountSession();
  const { token } = await getVaultSession();

  if (token && account.token) {
    try {
      await apiRequest("/auth/lock", {
        method: "POST",
        accessToken: account.token,
        vaultToken: token,
      });
    } catch {
      // Local lock should always proceed even if API call fails.
    }
  }

  await clearVaultSession();
  return true;
};

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === AUTO_LOCK_ALARM) {
    await clearVaultSession();
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handle = async () => {
    switch (message?.type) {
      case "vault.getStatus": {
        const account = await getAccountSession();
        const session = await getVaultSession();

        if (!account.token) {
          return {
            authenticated: false,
            initialized: false,
            unlocked: false,
            tokenPresent: false,
            apiBase: await getApiBase(),
            accountEmail: "",
          };
        }

        const response = await apiRequest("/auth/status", {
          accessToken: account.token,
          vaultToken: session.token || undefined,
        });

        return {
          ...response.data,
          authenticated: true,
          tokenPresent: Boolean(session.token),
          apiBase: await getApiBase(),
          accountEmail: account.email || "",
        };
      }
      case "account.login": {
        const response = await apiRequest("/account/login", {
          method: "POST",
          body: {
            email: message.email,
            password: message.password,
          },
        });

        const { token, user } = response.data;
        await setAccountSession({ token, email: user.email });
        return { user };
      }
      case "account.logout": {
        const account = await getAccountSession();

        if (account.token) {
          try {
            await apiRequest("/account/logout", {
              method: "POST",
              accessToken: account.token,
            });
          } catch {
            // Ignore logout API errors.
          }
        }

        await clearAccountSession();
        return { ok: true };
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
        const data = await getCredentialsForDomain(
          message.domain || sender?.url || "",
        );
        return { items: data };
      }
      case "credentials.secret": {
        const { account, session } = await withActiveVaultSession();
        const response = await apiRequest(`/credentials/${message.id}/secret`, {
          accessToken: account.token,
          vaultToken: session.token,
        });

        return response.data;
      }
      case "credentials.touch": {
        const { account, session } = await withActiveVaultSession();
        await apiRequest(`/credentials/${message.id}/touch`, {
          method: "POST",
          accessToken: account.token,
          vaultToken: session.token,
        });
        return { ok: true };
      }
      case "credentials.create": {
        const { account, session } = await withActiveVaultSession();
        const response = await apiRequest("/credentials", {
          method: "POST",
          accessToken: account.token,
          vaultToken: session.token,
          body: message.payload,
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

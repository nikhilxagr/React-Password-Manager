import { normalizeDomain } from "../shared/domain.js";

const els = {
  statusText: document.getElementById("statusText"),
  unlockPanel: document.getElementById("unlockPanel"),
  actionsPanel: document.getElementById("actionsPanel"),
  matchesPanel: document.getElementById("matchesPanel"),
  unlockForm: document.getElementById("unlockForm"),
  masterPassword: document.getElementById("masterPassword"),
  lockVault: document.getElementById("lockVault"),
  refreshMatches: document.getElementById("refreshMatches"),
  matchesList: document.getElementById("matchesList"),
  activeDomain: document.getElementById("activeDomain"),
  apiBase: document.getElementById("apiBase"),
  saveApiBase: document.getElementById("saveApiBase")
};

let currentDomain = "";

const sendMessage = (payload) => {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(payload, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      if (!response || !response.ok) {
        reject(new Error(response?.error || "Request failed."));
        return;
      }

      resolve(response.data);
    });
  });
};

const setLockedUi = (message) => {
  els.statusText.textContent = message || "Vault is locked in extension.";
  els.unlockPanel.classList.remove("hidden");
  els.actionsPanel.classList.add("hidden");
  els.matchesPanel.classList.add("hidden");
};

const setUnlockedUi = (message) => {
  els.statusText.textContent = message || "Vault unlocked in extension.";
  els.unlockPanel.classList.add("hidden");
  els.actionsPanel.classList.remove("hidden");
  els.matchesPanel.classList.remove("hidden");
};

const loadCurrentTabDomain = async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.url) {
    currentDomain = "";
    els.activeDomain.textContent = "Current site: unavailable";
    return;
  }

  const normalized = normalizeDomain(tab.url);
  currentDomain = normalized?.host || "";
  els.activeDomain.textContent = currentDomain
    ? `Current site: ${currentDomain}`
    : "Current site: unavailable";
};

const renderMatches = (items) => {
  els.matchesList.innerHTML = "";

  if (!Array.isArray(items) || items.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No matching credentials for this domain.";
    els.matchesList.appendChild(li);
    return;
  }

  items.slice(0, 6).forEach((item) => {
    const li = document.createElement("li");

    const title = document.createElement("strong");
    title.textContent = item.username;

    const meta = document.createElement("span");
    meta.textContent = `${item.site} • ${item.category || "General"}`;

    li.appendChild(title);
    li.appendChild(meta);

    els.matchesList.appendChild(li);
  });
};

const refreshMatches = async () => {
  if (!currentDomain) {
    renderMatches([]);
    return;
  }

  const result = await sendMessage({
    type: "credentials.byDomain",
    domain: currentDomain
  });

  renderMatches(result.items || []);
};

const initialize = async () => {
  try {
    const status = await sendMessage({ type: "vault.getStatus" });

    if (status.apiBase) {
      els.apiBase.value = status.apiBase;
    }

    await loadCurrentTabDomain();

    if (!status.initialized) {
      setLockedUi("Vault not initialized in backend app yet.");
      return;
    }

    if (status.unlocked && status.tokenPresent) {
      setUnlockedUi();
      await refreshMatches();
      return;
    }

    setLockedUi();
  } catch (error) {
    setLockedUi(error.message || "Unable to reach backend API.");
  }
};

els.unlockForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const masterPassword = els.masterPassword.value.trim();
  if (!masterPassword) {
    return;
  }

  try {
    await sendMessage({ type: "vault.unlock", masterPassword });
    els.masterPassword.value = "";
    setUnlockedUi();
    await refreshMatches();
  } catch (error) {
    setLockedUi(error.message || "Unlock failed.");
  }
});

els.lockVault.addEventListener("click", async () => {
  try {
    await sendMessage({ type: "vault.lock" });
  } finally {
    setLockedUi("Vault locked in extension.");
  }
});

els.refreshMatches.addEventListener("click", async () => {
  try {
    await loadCurrentTabDomain();
    await refreshMatches();
  } catch (error) {
    setUnlockedUi(error.message || "Failed to load domain matches.");
  }
});

els.saveApiBase.addEventListener("click", async () => {
  const apiBase = els.apiBase.value.trim();

  try {
    const result = await sendMessage({ type: "vault.setApiBase", apiBase });
    els.apiBase.value = result.apiBase;
    els.statusText.textContent = "API base updated.";
  } catch (error) {
    els.statusText.textContent = error.message || "Could not update API base.";
  }
});

initialize();

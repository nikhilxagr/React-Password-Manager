(() => {
  if (window.top !== window.self) {
    return;
  }

  const STYLE_ID = "passmongo-style";
  const PORTAL_ID = "passmongo-suggestion-root";

  const MULTI_LABEL_TLDS = new Set([
    "co.uk",
    "com.au",
    "co.in",
    "co.jp",
    "com.br",
    "com.mx",
    "com.tr",
    "com.sg",
    "com.cn"
  ]);

  const state = {
    activeForm: null,
    usernameInput: null,
    passwordInput: null,
    suggestions: [],
    popupNode: null
  };

  const injectStyles = () => {
    if (document.getElementById(STYLE_ID)) {
      return;
    }

    const link = document.createElement("link");
    link.id = STYLE_ID;
    link.rel = "stylesheet";
    link.href = chrome.runtime.getURL("src/content/content-style.css");
    document.head.appendChild(link);
  };

  const normalizeDomain = (value) => {
    if (!value || typeof value !== "string") {
      return null;
    }

    let host = "";

    try {
      const url = value.startsWith("http://") || value.startsWith("https://")
        ? new URL(value)
        : new URL(`https://${value}`);
      host = url.hostname.toLowerCase();
    } catch {
      host = value
        .replace(/^https?:\/\//i, "")
        .split("/")[0]
        .split(":")[0]
        .toLowerCase();
    }

    if (!host) {
      return null;
    }

    const parts = host.split(".").filter(Boolean);
    let registrableDomain = host;

    if (parts.length > 2) {
      const lastTwo = parts.slice(-2).join(".");
      registrableDomain = MULTI_LABEL_TLDS.has(lastTwo)
        ? parts.slice(-3).join(".")
        : lastTwo;
    }

    return { host, registrableDomain };
  };

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

  const getPasswordInput = (form) => {
    if (!form) {
      return null;
    }

    return form.querySelector('input[type="password"]');
  };

  const getUsernameInput = (form) => {
    if (!form) {
      return null;
    }

    const candidates = form.querySelectorAll('input[type="email"], input[type="text"], input:not([type])');

    return Array.from(candidates).find((input) => {
      const fieldName = `${input.name || ""} ${input.id || ""}`.toLowerCase();
      if (!fieldName) {
        return false;
      }

      return (
        fieldName.includes("user") ||
        fieldName.includes("email") ||
        fieldName.includes("login")
      );
    }) || candidates[0] || null;
  };

  const removeSuggestionPopup = () => {
    if (state.popupNode) {
      state.popupNode.remove();
      state.popupNode = null;
    }
  };

  const ensurePortal = () => {
    let portal = document.getElementById(PORTAL_ID);

    if (!portal) {
      portal = document.createElement("div");
      portal.id = PORTAL_ID;
      document.body.appendChild(portal);
    }

    return portal;
  };

  const placePopupNear = (target, popup) => {
    const rect = target.getBoundingClientRect();

    popup.style.top = `${window.scrollY + rect.bottom + 6}px`;
    popup.style.left = `${window.scrollX + rect.left}px`;
  };

  const fillCredential = async (credential) => {
    if (!state.passwordInput || !state.usernameInput) {
      return;
    }

    const secret = await sendMessage({
      type: "credentials.secret",
      id: credential.id
    });

    state.usernameInput.value = credential.username;
    state.passwordInput.value = secret.password;

    state.usernameInput.dispatchEvent(new Event("input", { bubbles: true }));
    state.passwordInput.dispatchEvent(new Event("input", { bubbles: true }));

    sendMessage({ type: "credentials.touch", id: credential.id }).catch(() => {
      // Not critical for autofill success.
    });

    removeSuggestionPopup();
  };

  const renderSuggestions = (target) => {
    removeSuggestionPopup();

    const portal = ensurePortal();
    const popup = document.createElement("div");
    popup.className = "passmongo-suggestions";

    const title = document.createElement("h4");
    title.textContent = "PassMongo Suggestions";
    popup.appendChild(title);

    if (!state.suggestions.length) {
      const empty = document.createElement("p");
      empty.className = "passmongo-empty";
      empty.textContent = "No matching credentials for this site.";
      popup.appendChild(empty);
    } else {
      state.suggestions.forEach((item) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "passmongo-item";

        const strong = document.createElement("strong");
        strong.textContent = item.username;

        const info = document.createElement("span");
        info.textContent = `${item.site} • ${item.category || "General"}`;

        button.appendChild(strong);
        button.appendChild(info);

        button.addEventListener("click", () => {
          fillCredential(item).catch(() => {
            removeSuggestionPopup();
          });
        });

        popup.appendChild(button);
      });
    }

    placePopupNear(target, popup);
    portal.appendChild(popup);
    state.popupNode = popup;
  };

  const loadSuggestions = async (target) => {
    const normalized = normalizeDomain(window.location.hostname);
    if (!normalized) {
      return;
    }

    const data = await sendMessage({
      type: "credentials.byDomain",
      domain: normalized.host
    });

    state.suggestions = Array.isArray(data.items) ? data.items : [];
    renderSuggestions(target);
  };

  const setFormContext = (input) => {
    const form = input.closest("form");
    const passwordInput = getPasswordInput(form);

    if (!form || !passwordInput) {
      return false;
    }

    const usernameInput = getUsernameInput(form);

    state.activeForm = form;
    state.usernameInput = usernameInput;
    state.passwordInput = passwordInput;

    return true;
  };

  const attachSavePrompt = (form) => {
    if (form.dataset.passmongoBound === "true") {
      return;
    }

    form.dataset.passmongoBound = "true";

    form.addEventListener("submit", () => {
      const username = state.usernameInput?.value?.trim() || "";
      const password = state.passwordInput?.value?.trim() || "";

      if (!username || !password) {
        return;
      }

      window.setTimeout(async () => {
        const shouldSave = window.confirm("Save this login to PassMongo vault?");
        if (!shouldSave) {
          return;
        }

        try {
          await sendMessage({
            type: "credentials.create",
            payload: {
              site: window.location.origin,
              username,
              password,
              notes: "Saved from browser extension",
              category: "Web",
              tags: ["autofill"],
              favorite: false
            }
          });
        } catch {
          // The background script handles lock/auth errors.
        }
      }, 300);
    });
  };

  document.addEventListener("focusin", (event) => {
    const target = event.target;

    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    const supportedType = ["password", "email", "text", ""].includes(target.type);
    if (!supportedType) {
      return;
    }

    const hasContext = setFormContext(target);
    if (!hasContext) {
      return;
    }

    attachSavePrompt(state.activeForm);

    if (target === state.usernameInput || target === state.passwordInput) {
      loadSuggestions(target).catch(() => {
        removeSuggestionPopup();
      });
    }
  }, true);

  document.addEventListener("click", (event) => {
    if (!state.popupNode) {
      return;
    }

    if (!state.popupNode.contains(event.target)) {
      removeSuggestionPopup();
    }
  });

  window.addEventListener("scroll", () => {
    if (state.popupNode && state.passwordInput) {
      placePopupNear(state.passwordInput, state.popupNode);
    }
  }, { passive: true });

  injectStyles();
})();

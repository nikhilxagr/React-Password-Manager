import { useCallback, useEffect, useMemo, useState } from "react";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { api } from "../lib/api";
import { estimateStrength, generateStrongPassword } from "../utils/password";

const TOKEN_KEY = "vault_session_token";
const ACCOUNT_TOKEN_KEY = "account_access_token";
const ACCOUNT_EMAIL_KEY = "account_email";
const LEGACY_IMPORT_KEY = "legacy_import_done_v1";

const initialFormState = {
  site: "",
  username: "",
  password: "",
  notes: "",
  tags: "",
  category: "General",
  favorite: false,
};

const normalizeLegacyEntry = (entry) => {
  const site = typeof entry.site === "string" ? entry.site.trim() : "";
  const username =
    typeof entry.username === "string" ? entry.username.trim() : "";
  const password =
    typeof entry.password === "string" ? entry.password.trim() : "";

  if (!site || !username || !password) {
    return null;
  }

  return {
    site,
    username,
    password,
    notes: "",
    tags: [],
    category: "General",
    favorite: false,
  };
};

const Manager = () => {
  const [isBooting, setIsBooting] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [token, setToken] = useState("");
  const [accountToken, setAccountToken] = useState("");
  const [accountEmail, setAccountEmail] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [resetForm, setResetForm] = useState({
    email: "",
    token: "",
    password: "",
    confirmPassword: "",
  });

  const [setupForm, setSetupForm] = useState({
    masterPassword: "",
    confirmMasterPassword: "",
  });
  const [unlockPassword, setUnlockPassword] = useState("");

  const [credentials, setCredentials] = useState([]);
  const [isLoadingCredentials, setIsLoadingCredentials] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(initialFormState);
  const [showFormPassword, setShowFormPassword] = useState(false);
  const [revealedSecrets, setRevealedSecrets] = useState({});

  const [search, setSearch] = useState("");
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("All");

  const strength = useMemo(
    () => estimateStrength(form.password),
    [form.password],
  );

  const categoryOptions = useMemo(() => {
    const categories = new Set(
      credentials.map((item) => item.category || "General"),
    );
    return [
      "All",
      ...Array.from(categories).sort((a, b) => a.localeCompare(b)),
    ];
  }, [credentials]);

  const stats = useMemo(() => {
    const total = credentials.length;
    const favorites = credentials.filter((item) => item.favorite).length;
    const categories = new Set(
      credentials.map((item) => item.category || "General"),
    ).size;

    return { total, favorites, categories };
  }, [credentials]);

  const legacyImportNeeded = useMemo(() => {
    if (!isUnlocked) {
      return false;
    }

    const alreadyImported = localStorage.getItem(LEGACY_IMPORT_KEY) === "true";
    if (alreadyImported) {
      return false;
    }

    const raw = localStorage.getItem("passwords");
    if (!raw) {
      return false;
    }

    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) && parsed.length > 0;
    } catch {
      return false;
    }
  }, [isUnlocked]);

  const clearSession = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken("");
    setIsUnlocked(false);
    setCredentials([]);
    setRevealedSecrets({});
  }, []);

  const clearAccount = useCallback(() => {
    localStorage.removeItem(ACCOUNT_TOKEN_KEY);
    localStorage.removeItem(ACCOUNT_EMAIL_KEY);
    setAccountToken("");
    setAccountEmail("");
    setIsAuthenticated(false);
    setIsInitialized(false);
    setAuthMode("login");
    setAuthForm({ email: "", password: "", confirmPassword: "" });
    setResetForm({
      email: "",
      token: "",
      password: "",
      confirmPassword: "",
    });
    clearSession();
  }, [clearSession]);

  const fetchCredentials = useCallback(
    async (accessToken, vaultToken) => {
      if (!accessToken || !vaultToken) {
        return;
      }

      setIsLoadingCredentials(true);
      try {
        const query = {
          search,
          favorite: favoriteOnly ? true : undefined,
          category: categoryFilter === "All" ? undefined : categoryFilter,
        };
        const response = await api.credentials.list(
          accessToken,
          vaultToken,
          query,
        );
        setCredentials(response.data || []);
      } catch (error) {
        if (error.status === 401) {
          clearSession();
        }
        toast.error(error.message || "Failed to load credentials.");
      } finally {
        setIsLoadingCredentials(false);
      }
    },
    [categoryFilter, favoriteOnly, search, clearSession],
  );

  useEffect(() => {
    const initialize = async () => {
      const storedAccountToken = localStorage.getItem(ACCOUNT_TOKEN_KEY) || "";
      const storedVaultToken = localStorage.getItem(TOKEN_KEY) || "";

      try {
        if (!storedAccountToken) {
          setIsBooting(false);
          return;
        }

        const meResponse = await api.account.me(storedAccountToken);
        const user = meResponse.data?.user;

        setAccountToken(storedAccountToken);
        setAccountEmail(
          user?.email || localStorage.getItem(ACCOUNT_EMAIL_KEY) || "",
        );
        setIsAuthenticated(true);

        const statusResponse = await api.auth.status(
          storedAccountToken,
          storedVaultToken || undefined,
        );
        const status = statusResponse.data;
        setIsInitialized(Boolean(status.initialized));

        if (status.initialized && storedVaultToken && status.unlocked) {
          setToken(storedVaultToken);
          setIsUnlocked(true);
          await fetchCredentials(storedAccountToken, storedVaultToken);
        } else {
          clearSession();
        }
      } catch (error) {
        clearAccount();
        toast.error(error.message || "Failed to bootstrap account.");
      } finally {
        setIsBooting(false);
      }
    };

    initialize();
  }, [fetchCredentials, clearSession, clearAccount]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenParam = params.get("token");
    if (tokenParam) {
      setResetForm((current) => ({
        ...current,
        token: tokenParam,
      }));
      setAuthMode("reset-confirm");
    }
  }, []);

  useEffect(() => {
    if (!isUnlocked || !token || !accountToken) {
      return;
    }

    const timeoutId = setTimeout(() => {
      fetchCredentials(accountToken, token);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [isUnlocked, token, accountToken, fetchCredentials]);

  const handleSetupSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      await api.auth.setup(accountToken, setupForm);
      const unlockResponse = await api.auth.unlock(accountToken, {
        masterPassword: setupForm.masterPassword,
      });
      const newToken = unlockResponse.data.token;

      localStorage.setItem(TOKEN_KEY, newToken);
      setToken(newToken);
      setIsInitialized(true);
      setIsUnlocked(true);
      setSetupForm({ masterPassword: "", confirmMasterPassword: "" });
      toast.success("Vault created and unlocked.");
      await fetchCredentials(accountToken, newToken);
    } catch (error) {
      toast.error(error.message || "Failed to create vault.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignupSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await api.account.signup(authForm);
      const { token: newToken, user } = response.data;

      localStorage.setItem(ACCOUNT_TOKEN_KEY, newToken);
      localStorage.setItem(ACCOUNT_EMAIL_KEY, user.email);
      setAccountToken(newToken);
      setAccountEmail(user.email);
      setIsAuthenticated(true);
      setAuthForm({ email: "", password: "", confirmPassword: "" });
      clearSession();

      const statusResponse = await api.auth.status(newToken, undefined);
      setIsInitialized(Boolean(statusResponse.data?.initialized));
      toast.success("Account created.");
    } catch (error) {
      toast.error(error.message || "Failed to create account.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLoginSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await api.account.login({
        email: authForm.email,
        password: authForm.password,
      });
      const { token: newToken, user } = response.data;

      localStorage.setItem(ACCOUNT_TOKEN_KEY, newToken);
      localStorage.setItem(ACCOUNT_EMAIL_KEY, user.email);
      setAccountToken(newToken);
      setAccountEmail(user.email);
      setIsAuthenticated(true);
      setAuthForm({ email: "", password: "", confirmPassword: "" });
      clearSession();

      const statusResponse = await api.auth.status(newToken, undefined);
      setIsInitialized(Boolean(statusResponse.data?.initialized));
      toast.success("Welcome back.");
    } catch (error) {
      toast.error(error.message || "Failed to login.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    try {
      if (accountToken) {
        await api.account.logout(accountToken);
      }
    } catch {
      // Ignore logout API errors.
    } finally {
      clearAccount();
      toast.info("Logged out.");
    }
  };

  const handlePasswordResetRequest = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      await api.account.requestPasswordReset({ email: resetForm.email });
      toast.success("If that email exists, a reset link was sent.");
      setAuthMode("login");
    } catch (error) {
      toast.error(error.message || "Failed to request reset link.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasswordResetConfirm = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      await api.account.confirmPasswordReset({
        token: resetForm.token,
        password: resetForm.password,
        confirmPassword: resetForm.confirmPassword,
      });
      setResetForm({
        email: "",
        token: "",
        password: "",
        confirmPassword: "",
      });
      setAuthMode("login");
      toast.success("Password updated. Please login.");
    } catch (error) {
      toast.error(error.message || "Failed to reset password.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnlockSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await api.auth.unlock(accountToken, {
        masterPassword: unlockPassword,
      });
      const newToken = response.data.token;

      localStorage.setItem(TOKEN_KEY, newToken);
      setToken(newToken);
      setIsUnlocked(true);
      setUnlockPassword("");
      toast.success("Vault unlocked.");
      await fetchCredentials(accountToken, newToken);
    } catch (error) {
      toast.error(error.message || "Failed to unlock vault.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLock = async () => {
    try {
      if (token && accountToken) {
        await api.auth.lock(accountToken, token);
      }
    } catch {
      // Ignore lock API failure and clear local session anyway.
    } finally {
      clearSession();
      toast.info("Vault locked.");
    }
  };

  const resetCredentialForm = () => {
    setEditingId(null);
    setForm(initialFormState);
    setShowFormPassword(false);
  };

  const handleSubmitCredential = async (event) => {
    event.preventDefault();

    const payload = {
      site: form.site.trim(),
      username: form.username.trim(),
      notes: form.notes.trim(),
      category: form.category.trim() || "General",
      tags: form.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      favorite: form.favorite,
    };

    if (form.password.trim()) {
      payload.password = form.password.trim();
    }

    if (!editingId && !payload.password) {
      toast.error("Password is required when creating a credential.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingId) {
        await api.credentials.update(accountToken, token, editingId, payload);
        toast.success("Credential updated.");
      } else {
        await api.credentials.create(accountToken, token, payload);
        toast.success("Credential saved.");
      }

      resetCredentialForm();
      await fetchCredentials(accountToken, token);
    } catch (error) {
      toast.error(error.message || "Failed to save credential.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (item) => {
    setEditingId(item.id);
    setForm({
      site: item.site,
      username: item.username,
      password: "",
      notes: item.notes || "",
      tags: Array.isArray(item.tags) ? item.tags.join(", ") : "",
      category: item.category || "General",
      favorite: Boolean(item.favorite),
    });
  };

  const handleDelete = async (id) => {
    const shouldDelete = window.confirm("Delete this credential permanently?");
    if (!shouldDelete) {
      return;
    }

    try {
      await api.credentials.delete(accountToken, token, id);
      setRevealedSecrets((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
      toast.success("Credential deleted.");
      await fetchCredentials(accountToken, token);
    } catch (error) {
      toast.error(error.message || "Failed to delete credential.");
    }
  };

  const toggleSecret = async (id) => {
    if (revealedSecrets[id]) {
      setRevealedSecrets((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
      return;
    }

    try {
      const response = await api.credentials.secret(accountToken, token, id);
      setRevealedSecrets((current) => ({
        ...current,
        [id]: response.data.password,
      }));
      api.credentials.touch(accountToken, token, id).catch(() => {
        // No-op: this metadata update should not block UX.
      });
    } catch (error) {
      toast.error(error.message || "Failed to reveal password.");
    }
  };

  const copyText = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied.`);
    } catch {
      toast.error("Copy failed.");
    }
  };

  const importLegacy = async () => {
    const raw = localStorage.getItem("passwords");
    if (!raw) {
      toast.info("No local legacy passwords found.");
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      const normalized = Array.isArray(parsed)
        ? parsed.map(normalizeLegacyEntry).filter(Boolean)
        : [];

      if (normalized.length === 0) {
        toast.info("No valid legacy entries were found.");
        return;
      }

      const response = await api.credentials.importLegacy(
        accountToken,
        token,
        normalized,
      );
      localStorage.setItem(LEGACY_IMPORT_KEY, "true");
      toast.success(`Imported ${response.data.importedCount} legacy entries.`);
      await fetchCredentials(accountToken, token);
    } catch (error) {
      toast.error(error.message || "Failed to import legacy credentials.");
    }
  };

  const renderAccountLogin = () => (
    <section className="vault-panel">
      <h2 className="vault-title">Login to VaultGuard</h2>
      <p className="vault-subtitle">
        Sign in to your account to access your personal vault.
      </p>
      <form onSubmit={handleLoginSubmit} className="vault-form">
        <label>
          Email address
          <input
            type="email"
            value={authForm.email}
            onChange={(event) =>
              setAuthForm((current) => ({
                ...current,
                email: event.target.value,
              }))
            }
            required
            placeholder="you@example.com"
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={authForm.password}
            onChange={(event) =>
              setAuthForm((current) => ({
                ...current,
                password: event.target.value,
              }))
            }
            required
            minLength={8}
            placeholder="Enter your password"
          />
        </label>
        <button type="submit" className="btn-primary" disabled={isSubmitting}>
          {isSubmitting ? "Signing in..." : "Sign in"}
        </button>
        <div className="form-actions">
          <button
            type="button"
            className="btn-link"
            onClick={() => setAuthMode("signup")}
          >
            Create an account
          </button>
          <button
            type="button"
            className="btn-link"
            onClick={() => setAuthMode("reset-request")}
          >
            Forgot password?
          </button>
        </div>
      </form>
    </section>
  );

  const renderAccountSignup = () => (
    <section className="vault-panel">
      <h2 className="vault-title">Create your account</h2>
      <p className="vault-subtitle">
        Your vault stays personal to your account. Create login credentials to
        get started.
      </p>
      <form onSubmit={handleSignupSubmit} className="vault-form">
        <label>
          Email address
          <input
            type="email"
            value={authForm.email}
            onChange={(event) =>
              setAuthForm((current) => ({
                ...current,
                email: event.target.value,
              }))
            }
            required
            placeholder="you@example.com"
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={authForm.password}
            onChange={(event) =>
              setAuthForm((current) => ({
                ...current,
                password: event.target.value,
              }))
            }
            required
            minLength={8}
            placeholder="At least 8 characters"
          />
        </label>
        <label>
          Confirm password
          <input
            type="password"
            value={authForm.confirmPassword}
            onChange={(event) =>
              setAuthForm((current) => ({
                ...current,
                confirmPassword: event.target.value,
              }))
            }
            required
            minLength={8}
            placeholder="Repeat your password"
          />
        </label>
        <button type="submit" className="btn-primary" disabled={isSubmitting}>
          {isSubmitting ? "Creating account..." : "Create account"}
        </button>
        <div className="form-actions">
          <button
            type="button"
            className="btn-link"
            onClick={() => setAuthMode("login")}
          >
            I already have an account
          </button>
        </div>
      </form>
    </section>
  );

  const renderPasswordResetRequest = () => (
    <section className="vault-panel">
      <h2 className="vault-title">Reset account password</h2>
      <p className="vault-subtitle">
        Enter your account email to receive a reset link.
      </p>
      <form onSubmit={handlePasswordResetRequest} className="vault-form">
        <label>
          Email address
          <input
            type="email"
            value={resetForm.email}
            onChange={(event) =>
              setResetForm((current) => ({
                ...current,
                email: event.target.value,
              }))
            }
            required
            placeholder="you@example.com"
          />
        </label>
        <button type="submit" className="btn-primary" disabled={isSubmitting}>
          {isSubmitting ? "Sending..." : "Send reset link"}
        </button>
        <div className="form-actions">
          <button
            type="button"
            className="btn-link"
            onClick={() => setAuthMode("login")}
          >
            Back to login
          </button>
        </div>
      </form>
    </section>
  );

  const renderPasswordResetConfirm = () => (
    <section className="vault-panel">
      <h2 className="vault-title">Choose a new password</h2>
      <p className="vault-subtitle">
        Enter the reset token and a new account password.
      </p>
      <form onSubmit={handlePasswordResetConfirm} className="vault-form">
        <label>
          Reset token
          <input
            type="text"
            value={resetForm.token}
            onChange={(event) =>
              setResetForm((current) => ({
                ...current,
                token: event.target.value,
              }))
            }
            required
            placeholder="Paste the token from email"
          />
        </label>
        <label>
          New password
          <input
            type="password"
            value={resetForm.password}
            onChange={(event) =>
              setResetForm((current) => ({
                ...current,
                password: event.target.value,
              }))
            }
            required
            minLength={8}
            placeholder="At least 8 characters"
          />
        </label>
        <label>
          Confirm new password
          <input
            type="password"
            value={resetForm.confirmPassword}
            onChange={(event) =>
              setResetForm((current) => ({
                ...current,
                confirmPassword: event.target.value,
              }))
            }
            required
            minLength={8}
            placeholder="Repeat your password"
          />
        </label>
        <button type="submit" className="btn-primary" disabled={isSubmitting}>
          {isSubmitting ? "Updating..." : "Update password"}
        </button>
        <div className="form-actions">
          <button
            type="button"
            className="btn-link"
            onClick={() => setAuthMode("login")}
          >
            Back to login
          </button>
        </div>
      </form>
    </section>
  );

  const renderAccountGate = () => {
    if (authMode === "signup") {
      return renderAccountSignup();
    }

    if (authMode === "reset-request") {
      return renderPasswordResetRequest();
    }

    if (authMode === "reset-confirm") {
      return renderPasswordResetConfirm();
    }

    return renderAccountLogin();
  };

  const renderVaultSetup = () => {
    return (
      <section className="vault-panel">
        <h2 className="vault-title">Create your vault</h2>
        <p className="vault-subtitle">
          Set one strong master password. It unlocks your encrypted credential
          store.
        </p>
        <form onSubmit={handleSetupSubmit} className="vault-form">
          <label>
            Master password
            <input
              type="password"
              value={setupForm.masterPassword}
              onChange={(event) =>
                setSetupForm((current) => ({
                  ...current,
                  masterPassword: event.target.value,
                }))
              }
              required
              minLength={8}
              placeholder="At least 8 characters"
            />
          </label>

          <label>
            Confirm master password
            <input
              type="password"
              value={setupForm.confirmMasterPassword}
              onChange={(event) =>
                setSetupForm((current) => ({
                  ...current,
                  confirmMasterPassword: event.target.value,
                }))
              }
              required
              minLength={8}
              placeholder="Repeat your master password"
            />
          </label>

          <button type="submit" className="btn-primary" disabled={isSubmitting}>
            {isSubmitting ? "Creating vault..." : "Create vault"}
          </button>
        </form>
      </section>
    );
  };

  const renderVaultUnlock = () => {
    return (
      <section className="vault-panel">
        <h2 className="vault-title">Unlock vault</h2>
        <p className="vault-subtitle">
          Enter your master password to access credentials.
        </p>
        <form onSubmit={handleUnlockSubmit} className="vault-form">
          <label>
            Master password
            <input
              type="password"
              value={unlockPassword}
              onChange={(event) => setUnlockPassword(event.target.value)}
              required
              minLength={8}
              placeholder="Enter master password"
            />
          </label>

          <button type="submit" className="btn-primary" disabled={isSubmitting}>
            {isSubmitting ? "Unlocking..." : "Unlock vault"}
          </button>
        </form>
      </section>
    );
  };

  if (isBooting) {
    return (
      <div className="vault-panel">
        <h2 className="vault-title">Loading vault...</h2>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        <ToastContainer position="top-right" autoClose={2800} theme="colored" />
        {renderAccountGate()}
      </>
    );
  }

  if (!isInitialized) {
    return (
      <>
        <ToastContainer position="top-right" autoClose={2800} theme="colored" />
        {renderVaultSetup()}
      </>
    );
  }

  if (!isUnlocked) {
    return (
      <>
        <ToastContainer position="top-right" autoClose={2800} theme="colored" />
        {renderVaultUnlock()}
      </>
    );
  }

  return (
    <>
      <ToastContainer position="top-right" autoClose={2800} theme="colored" />

      <section className="manager-shell">
        <header className="manager-header">
          <div>
            <p className="eyebrow">Secure Workspace</p>
            <h2>Password Vault Dashboard</h2>
            {accountEmail && (
              <p className="manager-subtitle">Signed in as {accountEmail}</p>
            )}
            <p>
              Manage, search, and rotate credentials with encrypted storage.
              Keep every account in one place and access it in seconds.
            </p>
          </div>

          <div className="manager-actions">
            <button
              type="button"
              className="btn-ghost"
              onClick={() =>
                document.getElementById("vault-editor")?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                })
              }
            >
              Add new credential
            </button>
            <button onClick={handleLock} className="btn-ghost" type="button">
              Lock vault
            </button>
            <button onClick={handleLogout} className="btn-ghost" type="button">
              Log out
            </button>
          </div>
        </header>

        <div className="stats-grid">
          <article className="stat-card">
            <h3>Total credentials</h3>
            <p>{stats.total}</p>
          </article>
          <article className="stat-card">
            <h3>Favorites</h3>
            <p>{stats.favorites}</p>
          </article>
          <article className="stat-card">
            <h3>Categories</h3>
            <p>{stats.categories}</p>
          </article>
        </div>

        {legacyImportNeeded && (
          <div className="legacy-callout">
            <div>
              <strong>Legacy local data found.</strong>
              <p>
                Import passwords from your previous localStorage-based manager.
              </p>
            </div>
            <button
              type="button"
              className="btn-primary"
              onClick={importLegacy}
            >
              Import legacy data
            </button>
          </div>
        )}

        <div className="workspace-grid">
          <section id="vault-editor" className="editor-card">
            <div className="card-head">
              <h3>{editingId ? "Edit credential" : "Add credential"}</h3>
              {editingId && (
                <button
                  type="button"
                  className="btn-link"
                  onClick={resetCredentialForm}
                >
                  Cancel edit
                </button>
              )}
            </div>

            <form onSubmit={handleSubmitCredential} className="credential-form">
              <label>
                Website URL
                <input
                  type="text"
                  value={form.site}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      site: event.target.value,
                    }))
                  }
                  placeholder="example.com"
                  required
                />
              </label>

              <label>
                Username / Email
                <input
                  type="text"
                  value={form.username}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      username: event.target.value,
                    }))
                  }
                  placeholder="user@company.com"
                  required
                />
              </label>

              <label>
                Password {editingId ? "(leave blank to keep current)" : ""}
                <div className="password-row">
                  <input
                    type={showFormPassword ? "text" : "password"}
                    value={form.password}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        password: event.target.value,
                      }))
                    }
                    placeholder={
                      editingId
                        ? "Set a new password only if needed"
                        : "Enter strong password"
                    }
                    required={!editingId}
                  />
                  <button
                    type="button"
                    className="btn-inline"
                    onClick={() => setShowFormPassword((current) => !current)}
                  >
                    {showFormPassword ? "Hide" : "Show"}
                  </button>
                  <button
                    type="button"
                    className="btn-inline"
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        password: generateStrongPassword(16),
                      }))
                    }
                  >
                    Generate
                  </button>
                </div>
              </label>

              <div className="strength-wrap">
                <span>{strength.label}</span>
                <div className="strength-bar">
                  <div style={{ width: `${strength.percent}%` }} />
                </div>
              </div>

              <div className="two-col">
                <label>
                  Category
                  <input
                    type="text"
                    value={form.category}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        category: event.target.value,
                      }))
                    }
                    placeholder="Work"
                  />
                </label>

                <label>
                  Tags
                  <input
                    type="text"
                    value={form.tags}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        tags: event.target.value,
                      }))
                    }
                    placeholder="finance, infra"
                  />
                </label>
              </div>

              <label>
                Notes
                <textarea
                  value={form.notes}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                  placeholder="Optional notes"
                  rows={3}
                />
              </label>

              <label className="toggle-row">
                <input
                  type="checkbox"
                  checked={form.favorite}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      favorite: event.target.checked,
                    }))
                  }
                />
                Mark as favorite
              </label>

              <div className="form-actions">
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={isSubmitting}
                >
                  {isSubmitting
                    ? "Saving..."
                    : editingId
                      ? "Update credential"
                      : "Save credential"}
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={resetCredentialForm}
                  disabled={isSubmitting}
                >
                  {editingId ? "Discard changes" : "Clear form"}
                </button>
              </div>
            </form>
          </section>

          <section className="list-card">
            <div className="card-head card-head-list">
              <div>
                <h3>Credentials</h3>
                <p className="card-subtitle">
                  {credentials.length} visible entries
                </p>
              </div>
              <button
                type="button"
                className="btn-ghost btn-compact"
                onClick={() => {
                  setSearch("");
                  setCategoryFilter("All");
                  setFavoriteOnly(false);
                }}
              >
                Reset filters
              </button>
            </div>

            <div className="filters">
              <input
                type="text"
                placeholder="Search site, username, notes"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />

              <select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
              >
                {categoryOptions.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>

              <label className="toggle-row compact">
                <input
                  type="checkbox"
                  checked={favoriteOnly}
                  onChange={(event) => setFavoriteOnly(event.target.checked)}
                />
                Favorites only
              </label>
            </div>

            {isLoadingCredentials ? (
              <p className="empty-hint">Loading credentials...</p>
            ) : credentials.length === 0 ? (
              <p className="empty-hint">
                No credentials found for current filters.
              </p>
            ) : (
              <>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Site</th>
                        <th>Username</th>
                        <th>Password</th>
                        <th>Meta</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {credentials.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <a
                              href={item.site}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {item.site}
                            </a>
                            <button
                              type="button"
                              className="btn-link"
                              onClick={() => copyText(item.site, "Site")}
                            >
                              Copy
                            </button>
                          </td>
                          <td>
                            {item.username}
                            <button
                              type="button"
                              className="btn-link"
                              onClick={() =>
                                copyText(item.username, "Username")
                              }
                            >
                              Copy
                            </button>
                          </td>
                          <td>
                            <span className="secret-pill">
                              {revealedSecrets[item.id] || "********"}
                            </span>
                            <button
                              type="button"
                              className="btn-link"
                              onClick={() => toggleSecret(item.id)}
                            >
                              {revealedSecrets[item.id] ? "Hide" : "Reveal"}
                            </button>
                            {revealedSecrets[item.id] && (
                              <button
                                type="button"
                                className="btn-link"
                                onClick={() =>
                                  copyText(revealedSecrets[item.id], "Password")
                                }
                              >
                                Copy
                              </button>
                            )}
                          </td>
                          <td>
                            <div className="meta-stack">
                              <span>{item.category || "General"}</span>
                              <span>
                                {item.favorite ? "Favorite" : "Standard"}
                              </span>
                            </div>
                          </td>
                          <td>
                            <div className="action-row">
                              <button
                                type="button"
                                className="btn-link"
                                onClick={() => handleEdit(item)}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="btn-link danger"
                                onClick={() => handleDelete(item.id)}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mobile-cards">
                  {credentials.map((item) => (
                    <article key={item.id}>
                      <header>
                        <a href={item.site} target="_blank" rel="noreferrer">
                          {item.site}
                        </a>
                        <span>{item.favorite ? "Favorite" : "Standard"}</span>
                      </header>

                      <p>{item.username}</p>
                      <p>{item.category || "General"}</p>
                      <p>{revealedSecrets[item.id] || "********"}</p>

                      <div className="action-row">
                        <button
                          type="button"
                          className="btn-link"
                          onClick={() => toggleSecret(item.id)}
                        >
                          {revealedSecrets[item.id] ? "Hide" : "Reveal"}
                        </button>
                        {revealedSecrets[item.id] && (
                          <button
                            type="button"
                            className="btn-link"
                            onClick={() =>
                              copyText(revealedSecrets[item.id], "Password")
                            }
                          >
                            Copy
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn-link"
                          onClick={() => handleEdit(item)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn-link danger"
                          onClick={() => handleDelete(item.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </>
            )}
          </section>
        </div>
      </section>
    </>
  );
};

export default Manager;

import { useCallback, useEffect, useMemo, useState } from "react";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { api } from "../lib/api";
import { estimateStrength, generateStrongPassword } from "../utils/password";

const TOKEN_KEY = "vault_session_token";
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

  const fetchCredentials = useCallback(
    async (authToken) => {
      if (!authToken) {
        return;
      }

      setIsLoadingCredentials(true);
      try {
        const query = {
          search,
          favorite: favoriteOnly ? true : undefined,
          category: categoryFilter === "All" ? undefined : categoryFilter,
        };
        const response = await api.credentials.list(authToken, query);
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
      const storedToken = localStorage.getItem(TOKEN_KEY) || "";

      try {
        const response = await api.auth.status(storedToken || undefined);
        const status = response.data;

        setIsInitialized(Boolean(status.initialized));

        if (status.initialized && storedToken && status.unlocked) {
          setToken(storedToken);
          setIsUnlocked(true);
          await fetchCredentials(storedToken);
        } else {
          clearSession();
        }
      } catch (error) {
        toast.error(error.message || "Failed to bootstrap vault status.");
      } finally {
        setIsBooting(false);
      }
    };

    initialize();
  }, [fetchCredentials, clearSession]);

  useEffect(() => {
    if (!isUnlocked || !token) {
      return;
    }

    const timeoutId = setTimeout(() => {
      fetchCredentials(token);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [isUnlocked, token, fetchCredentials]);

  const handleSetupSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      await api.auth.setup(setupForm);
      const unlockResponse = await api.auth.unlock({
        masterPassword: setupForm.masterPassword,
      });
      const newToken = unlockResponse.data.token;

      localStorage.setItem(TOKEN_KEY, newToken);
      setToken(newToken);
      setIsInitialized(true);
      setIsUnlocked(true);
      setSetupForm({ masterPassword: "", confirmMasterPassword: "" });
      toast.success("Vault created and unlocked.");
      await fetchCredentials(newToken);
    } catch (error) {
      toast.error(error.message || "Failed to create vault.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnlockSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await api.auth.unlock({
        masterPassword: unlockPassword,
      });
      const newToken = response.data.token;

      localStorage.setItem(TOKEN_KEY, newToken);
      setToken(newToken);
      setIsUnlocked(true);
      setUnlockPassword("");
      toast.success("Vault unlocked.");
      await fetchCredentials(newToken);
    } catch (error) {
      toast.error(error.message || "Failed to unlock vault.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLock = async () => {
    try {
      if (token) {
        await api.auth.lock(token);
      }
    } catch {
      // Ignore lock API failure and clear local session anyway.
    } finally {
      clearSession();
      toast.info("Vault locked.");
    }
  };

  const resetForm = () => {
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
        await api.credentials.update(token, editingId, payload);
        toast.success("Credential updated.");
      } else {
        await api.credentials.create(token, payload);
        toast.success("Credential saved.");
      }

      resetForm();
      await fetchCredentials(token);
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
      await api.credentials.delete(token, id);
      setRevealedSecrets((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
      toast.success("Credential deleted.");
      await fetchCredentials(token);
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
      const response = await api.credentials.secret(token, id);
      setRevealedSecrets((current) => ({
        ...current,
        [id]: response.data.password,
      }));
      api.credentials.touch(token, id).catch(() => {
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

      const response = await api.credentials.importLegacy(token, normalized);
      localStorage.setItem(LEGACY_IMPORT_KEY, "true");
      toast.success(`Imported ${response.data.importedCount} legacy entries.`);
      await fetchCredentials(token);
    } catch (error) {
      toast.error(error.message || "Failed to import legacy credentials.");
    }
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
                <button type="button" className="btn-link" onClick={resetForm}>
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
                  onClick={resetForm}
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

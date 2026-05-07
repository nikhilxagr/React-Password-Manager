const {
  listCredentials,
  createCredential,
  updateCredential,
  deleteCredential,
  getCredentialSecret,
  touchCredential,
  listCredentialsByDomain,
  importLegacyCredentials,
} = require("../services/credentialService");
const { validateCredentialPayload } = require("../utils/validators");

const listCredentialsController = async (req, res) => {
  const data = await listCredentials(req.user.id, req.query);

  return res.status(200).json({
    ok: true,
    data,
  });
};

const createCredentialController = async (req, res) => {
  const payload = validateCredentialPayload(req.body, { partial: false });
  const data = await createCredential(req.user.id, payload, req.vaultKey);

  return res.status(201).json({
    ok: true,
    message: "Credential created.",
    data,
  });
};

const updateCredentialController = async (req, res) => {
  const payload = validateCredentialPayload(req.body, { partial: true });
  const data = await updateCredential(
    req.user.id,
    req.params.id,
    payload,
    req.vaultKey,
  );

  return res.status(200).json({
    ok: true,
    message: "Credential updated.",
    data,
  });
};

const deleteCredentialController = async (req, res) => {
  await deleteCredential(req.user.id, req.params.id);

  return res.status(200).json({
    ok: true,
    message: "Credential deleted.",
  });
};

const credentialSecretController = async (req, res) => {
  const data = await getCredentialSecret(
    req.user.id,
    req.params.id,
    req.vaultKey,
  );

  return res.status(200).json({
    ok: true,
    data,
  });
};

const touchCredentialController = async (req, res) => {
  const data = await touchCredential(req.user.id, req.params.id);

  return res.status(200).json({
    ok: true,
    data,
  });
};

const domainCredentialsController = async (req, res) => {
  const data = await listCredentialsByDomain(req.user.id, req.params.domain);

  return res.status(200).json({
    ok: true,
    data,
  });
};

const importLegacyController = async (req, res) => {
  const entries = Array.isArray(req.body.entries)
    ? req.body.entries.map((entry) =>
        validateCredentialPayload(entry, { partial: false }),
      )
    : [];

  const importedCount = await importLegacyCredentials(
    req.user.id,
    entries,
    req.vaultKey,
  );

  return res.status(201).json({
    ok: true,
    message: "Legacy credentials imported.",
    data: {
      importedCount,
    },
  });
};

module.exports = {
  listCredentialsController,
  createCredentialController,
  updateCredentialController,
  deleteCredentialController,
  credentialSecretController,
  touchCredentialController,
  domainCredentialsController,
  importLegacyController,
};

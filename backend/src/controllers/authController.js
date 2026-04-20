const {
  setupMasterPassword,
  unlockVault,
  lockSession,
  getVaultStatus,
  getVaultKdfParams,
} = require("../services/vaultService");
const {
  validateMasterPassword,
  normalizeString,
} = require("../utils/validators");
const { HttpError } = require("../utils/httpError");
const { getBearerToken } = require("../middlewares/auth");

const setupVaultController = async (req, res) => {
  const masterPassword = normalizeString(req.body.masterPassword);
  const confirmMasterPassword = normalizeString(
    req.body.confirmMasterPassword || "",
  );

  validateMasterPassword(masterPassword);

  if (confirmMasterPassword && masterPassword !== confirmMasterPassword) {
    throw new HttpError(400, "Master password and confirmation do not match.");
  }

  const result = await setupMasterPassword(masterPassword);

  return res.status(201).json({
    ok: true,
    message: "Vault initialized successfully.",
    data: result,
  });
};

const unlockVaultController = async (req, res) => {
  const masterPassword = normalizeString(req.body.masterPassword);
  validateMasterPassword(masterPassword);

  const data = await unlockVault(masterPassword);

  return res.status(200).json({
    ok: true,
    message: "Vault unlocked.",
    data,
  });
};

const lockVaultController = async (req, res) => {
  const locked = lockSession(req.sessionToken);

  return res.status(200).json({
    ok: true,
    message: locked ? "Vault locked." : "Session already expired.",
  });
};

const vaultStatusController = async (req, res) => {
  const token = getBearerToken(req);
  const data = await getVaultStatus(token);

  return res.status(200).json({
    ok: true,
    data,
  });
};

const vaultKdfParamsController = async (_req, res) => {
  const data = await getVaultKdfParams();

  return res.status(200).json({
    ok: true,
    data,
  });
};

module.exports = {
  setupVaultController,
  unlockVaultController,
  lockVaultController,
  vaultStatusController,
  vaultKdfParamsController,
};

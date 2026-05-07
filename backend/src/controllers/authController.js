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
const { getVaultToken } = require("../middlewares/auth");

const setupVaultController = async (req, res) => {
  const masterPassword = normalizeString(req.body.masterPassword);
  const confirmMasterPassword = normalizeString(
    req.body.confirmMasterPassword || "",
  );

  validateMasterPassword(masterPassword);

  if (confirmMasterPassword && masterPassword !== confirmMasterPassword) {
    throw new HttpError(400, "Master password and confirmation do not match.");
  }

  const result = await setupMasterPassword(req.user.id, masterPassword);

  return res.status(201).json({
    ok: true,
    message: "Vault initialized successfully.",
    data: result,
  });
};

const unlockVaultController = async (req, res) => {
  const masterPassword = normalizeString(req.body.masterPassword);
  validateMasterPassword(masterPassword);

  const data = await unlockVault(req.user.id, masterPassword);

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
  const token = getVaultToken(req);
  const data = await getVaultStatus(req.user.id, token);

  return res.status(200).json({
    ok: true,
    data,
  });
};

const vaultKdfParamsController = async (_req, res) => {
  const data = await getVaultKdfParams(req.user.id);

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

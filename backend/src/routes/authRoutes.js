const express = require("express");
const { asyncHandler } = require("../middlewares/asyncHandler");
const { requireVaultSession, requireUserAuth } = require("../middlewares/auth");
const {
  setupVaultController,
  unlockVaultController,
  lockVaultController,
  vaultStatusController,
  vaultKdfParamsController,
} = require("../controllers/authController");

const router = express.Router();

router.use(requireUserAuth);

router.get("/status", asyncHandler(vaultStatusController));
router.get("/kdf-params", asyncHandler(vaultKdfParamsController));
router.post("/setup", asyncHandler(setupVaultController));
router.post("/unlock", asyncHandler(unlockVaultController));
router.post("/lock", requireVaultSession, asyncHandler(lockVaultController));

module.exports = router;

const express = require("express");
const { asyncHandler } = require("../middlewares/asyncHandler");
const { requireVaultSession } = require("../middlewares/auth");
const {
  setupVaultController,
  unlockVaultController,
  lockVaultController,
  vaultStatusController,
} = require("../controllers/authController");

const router = express.Router();

router.get("/status", asyncHandler(vaultStatusController));
router.post("/setup", asyncHandler(setupVaultController));
router.post("/unlock", asyncHandler(unlockVaultController));
router.post("/lock", requireVaultSession, asyncHandler(lockVaultController));

module.exports = router;

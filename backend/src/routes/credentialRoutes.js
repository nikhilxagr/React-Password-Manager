const express = require("express");
const { asyncHandler } = require("../middlewares/asyncHandler");
const { requireVaultSession, requireUserAuth } = require("../middlewares/auth");
const {
  listCredentialsController,
  createCredentialController,
  updateCredentialController,
  deleteCredentialController,
  credentialSecretController,
  touchCredentialController,
  domainCredentialsController,
  importLegacyController,
} = require("../controllers/credentialController");

const router = express.Router();

router.use(requireUserAuth);
router.use(requireVaultSession);

router.get("/", asyncHandler(listCredentialsController));
router.post("/", asyncHandler(createCredentialController));
router.post("/import-legacy", asyncHandler(importLegacyController));
router.get("/domain/:domain", asyncHandler(domainCredentialsController));
router.get("/:id/secret", asyncHandler(credentialSecretController));
router.post("/:id/touch", asyncHandler(touchCredentialController));
router.put("/:id", asyncHandler(updateCredentialController));
router.delete("/:id", asyncHandler(deleteCredentialController));

module.exports = router;

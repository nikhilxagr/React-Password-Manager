const express = require("express");
const { asyncHandler } = require("../middlewares/asyncHandler");
const { requireUserAuth } = require("../middlewares/auth");
const {
  signupController,
  loginController,
  meController,
  logoutController,
  requestPasswordResetController,
  confirmPasswordResetController,
} = require("../controllers/accountController");

const router = express.Router();

router.post("/signup", asyncHandler(signupController));
router.post("/login", asyncHandler(loginController));
router.get("/me", requireUserAuth, asyncHandler(meController));
router.post("/logout", requireUserAuth, asyncHandler(logoutController));
router.post("/password-reset/request", asyncHandler(requestPasswordResetController));
router.post("/password-reset/confirm", asyncHandler(confirmPasswordResetController));

module.exports = router;

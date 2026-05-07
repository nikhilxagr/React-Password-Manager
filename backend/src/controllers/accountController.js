const config = require("../config/env");
const {
  createUser,
  authenticateUser,
  getUserByEmail,
  createPasswordResetToken,
  consumePasswordResetToken,
  resetPassword,
} = require("../services/accountService");
const {
  validateEmail,
  validateAccountPassword,
  normalizeString,
} = require("../utils/validators");
const { HttpError } = require("../utils/httpError");
const { signAccessToken } = require("../utils/jwt");
const { sendPasswordResetEmail } = require("../utils/mailer");

const signupController = async (req, res) => {
  const email = normalizeString(req.body.email).toLowerCase();
  const password = normalizeString(req.body.password);
  const confirmPassword = normalizeString(req.body.confirmPassword || "");

  validateEmail(email);
  validateAccountPassword(password);

  if (confirmPassword && confirmPassword !== password) {
    throw new HttpError(400, "Password confirmation does not match.");
  }

  const user = await createUser({ email, password });
  const token = signAccessToken(user);

  return res.status(201).json({
    ok: true,
    message: "Account created.",
    data: {
      user,
      token,
    },
  });
};

const loginController = async (req, res) => {
  const email = normalizeString(req.body.email).toLowerCase();
  const password = normalizeString(req.body.password);

  validateEmail(email);
  validateAccountPassword(password);

  const user = await authenticateUser({ email, password });
  const token = signAccessToken(user);

  return res.status(200).json({
    ok: true,
    message: "Logged in.",
    data: {
      user,
      token,
    },
  });
};

const meController = async (req, res) => {
  return res.status(200).json({
    ok: true,
    data: {
      user: req.user,
    },
  });
};

const logoutController = async (_req, res) => {
  return res.status(200).json({
    ok: true,
    message: "Logged out.",
  });
};

const requestPasswordResetController = async (req, res) => {
  const email = normalizeString(req.body.email).toLowerCase();
  validateEmail(email);

  const user = await getUserByEmail(email);
  if (user) {
    const reset = await createPasswordResetToken(user._id.toString());
    const resetUrl = `${config.APP_BASE_URL}/reset-password?token=${reset.token}`;

    await sendPasswordResetEmail({
      to: user.email,
      resetUrl,
    });
  }

  return res.status(200).json({
    ok: true,
    message: "If that email exists, a reset link has been sent.",
  });
};

const confirmPasswordResetController = async (req, res) => {
  const token = normalizeString(req.body.token);
  const password = normalizeString(req.body.password);
  const confirmPassword = normalizeString(req.body.confirmPassword || "");

  if (!token) {
    throw new HttpError(400, "Reset token is required.");
  }

  validateAccountPassword(password);

  if (confirmPassword && confirmPassword !== password) {
    throw new HttpError(400, "Password confirmation does not match.");
  }

  const user = await consumePasswordResetToken(token);
  await resetPassword(user._id.toString(), password);

  return res.status(200).json({
    ok: true,
    message: "Password reset successfully.",
  });
};

module.exports = {
  signupController,
  loginController,
  meController,
  logoutController,
  requestPasswordResetController,
  confirmPasswordResetController,
};

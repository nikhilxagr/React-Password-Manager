const nodemailer = require("nodemailer");
const config = require("../config/env");
const { HttpError } = require("./httpError");

const getTransporter = () => {
  if (!config.SMTP_HOST || !config.SMTP_USER || !config.SMTP_PASS || !config.SMTP_FROM) {
    throw new HttpError(500, "SMTP is not configured.");
  }

  return nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_SECURE,
    auth: {
      user: config.SMTP_USER,
      pass: config.SMTP_PASS,
    },
  });
};

const sendPasswordResetEmail = async ({ to, resetUrl }) => {
  const transporter = getTransporter();

  await transporter.sendMail({
    from: config.SMTP_FROM,
    to,
    subject: "Reset your VaultGuard password",
    text: `We received a request to reset your VaultGuard account password.\n\nReset your password: ${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
  });
};

module.exports = {
  sendPasswordResetEmail,
};

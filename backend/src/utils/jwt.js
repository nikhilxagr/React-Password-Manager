const jwt = require("jsonwebtoken");
const config = require("../config/env");

const signAccessToken = (user) => {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
    },
    config.JWT_SECRET,
    {
      expiresIn: config.JWT_EXPIRES_IN,
      issuer: config.JWT_ISSUER,
    },
  );
};

const verifyAccessToken = (token) => {
  return jwt.verify(token, config.JWT_SECRET, {
    issuer: config.JWT_ISSUER,
  });
};

module.exports = {
  signAccessToken,
  verifyAccessToken,
};

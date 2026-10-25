const jwt = require('jsonwebtoken');

function getJWTSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }
  return secret;
}

function generateToken(userId, username, role) {
  const payload = {
    user_id: userId,
    username,
    role
  };
  return jwt.sign(payload, getJWTSecret(), {
    algorithm: 'HS256',
    expiresIn: '24h'
  });
}

function parseJWT(tokenStr) {
  try {
    return jwt.verify(tokenStr, getJWTSecret(), { algorithms: ['HS256'] });
  } catch (err) {
    return null;
  }
}

module.exports = {
  generateToken,
  parseJWT
};

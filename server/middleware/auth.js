const { parseJWT } = require('../utils/token');

function extractToken(req) {
  if (req.cookies && req.cookies.TRANSPORT_AUTH) {
    return req.cookies.TRANSPORT_AUTH;
  }
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }
  return null;
}

function authMiddleware(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const claims = parseJWT(token);
  if (!claims) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }

  const userId = claims.user_id;
  if (!userId) {
    return res.status(401).json({ error: 'Malformed token' });
  }

  req.userId = parseInt(userId, 10);
  req.user_id = req.userId;
  req.username = claims.username;
  req.role = claims.role;
  req.user = { id: req.userId, user_id: req.userId, username: req.username, role: req.role };
  next();
}

function roleMiddleware(...allowedRoles) {
  return (req, res, next) => {
    const userRole = (req.role || '').toUpperCase();
    const matched = allowedRoles.some(r => r.toUpperCase() === userRole);
    if (!matched) {
      return res.status(403).json({ error: 'Access denied' });
    }
    next();
  };
}

module.exports = {
  extractToken,
  authMiddleware,
  roleMiddleware
};

const roleMiddleware = (...allowedRoles) => {
  const normalizedAllowed = allowedRoles.flat().map((r) => r.toLowerCase());

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const userRole = (req.user.role || 'reader').toLowerCase();

    if (!normalizedAllowed.includes(userRole)) {
      return res.status(403).json({
        message: 'Access denied: insufficient permissions for this operation',
        requiredRoles: allowedRoles.flat(),
        userRole: req.user.role,
      });
    }

    next();
  };
};

module.exports = roleMiddleware;

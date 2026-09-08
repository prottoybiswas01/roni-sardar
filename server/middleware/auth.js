import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const jwtSecret = process.env.JWT_SECRET || 'secure_jwt_secret_duty_master_key_2026';
      const decoded = jwt.verify(token, jwtSecret);

      req.user = await User.findById(decoded.id).select('-password');

      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'User belonging to this token no longer exists',
        });
      }

      if (req.user.status === 'pending') {
        return res.status(403).json({
          success: false,
          message: 'Your account is pending Super Admin approval. Please wait for activation.',
        });
      }

      if (req.user.status === 'inactive') {
        return res.status(403).json({
          success: false,
          message: 'Your account has been deactivated. Please contact an administrator.',
        });
      }

      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized, token validation failed',
      });
    }
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized, no token provided',
    });
  }
};

export const authorize = (...roles) => {
  return (req, res, next) => {
    // superadmin always has unrestricted access
    if (req.user && req.user.role === 'superadmin') {
      return next();
    }
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `User role '${req.user ? req.user.role : 'unauthenticated'}' is not authorized to access this route`,
      });
    }
    next();
  };
};

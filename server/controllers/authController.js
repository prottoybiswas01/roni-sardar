import jwt from 'jsonwebtoken';
import User from '../models/User.js';

// Generate JWT token
const generateToken = (id) => {
  return jwt.sign(
    { id },
    process.env.JWT_SECRET || 'fallback_secret_hospital_overduty_2026',
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    }
  );
};

// @desc    Register a new user (New users default to pending status awaiting Super Admin approval)
// @route   POST /api/auth/register
// @access  Public
export const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, email, and password',
      });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const userExists = await User.findOne({ email: trimmedEmail });
    if (userExists) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists',
      });
    }

    // New user registration starts with 'pending' status
    const user = await User.create({
      name: name.trim(),
      email: trimmedEmail,
      username: trimmedEmail.split('@')[0],
      password,
      role: 'staff',
      status: 'pending',
    });

    res.status(201).json({
      success: true,
      message: 'Account registered successfully! Your account is pending Super Admin approval. Please contact the administrator to activate your account.',
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
// @access  Public
export const login = async (req, res, next) => {
  try {
    const { email, username, password } = req.body;
    const identifier = (email || username || '').trim().toLowerCase();

    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both username/email and password',
      });
    }

    // Support username 'admin', email addresses, and legacy admin logins
    const user = await User.findOne({
      $or: [
        { email: identifier },
        { username: identifier },
        ...(identifier === 'admin'
          ? [{ email: 'admin@hospital.com' }, { email: 'admin@hospital.local' }]
          : []),
      ],
    }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username/email or password credentials',
      });
    }

    // Check if account is still pending Super Admin approval
    if (user.status === 'pending') {
      return res.status(403).json({
        success: false,
        message: 'Your account is pending Super Admin approval. Please contact the administrator to activate your account.',
      });
    }

    // Check if account is deactivated
    if (user.status === 'inactive') {
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated. Please contact the Super Administrator.',
      });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username/email or password credentials',
      });
    }

    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: 'Logged in successfully',
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
export const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all users (Super Admin & Admin only)
// @route   GET /api/auth/users
// @access  Private/Admin/SuperAdmin
export const getUsers = async (req, res, next) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      data: users,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user status or role (Super Admin & Admin only)
// @route   PUT /api/auth/users/:id
// @access  Private/Admin/SuperAdmin
export const updateUser = async (req, res, next) => {
  try {
    const { role, status, name } = req.body;
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Protect primary super admin from losing superadmin role or being deactivated
    if (user.username === 'admin' || user.email === 'admin@hospital.com') {
      if (status === 'inactive' || status === 'pending') {
        return res.status(400).json({
          success: false,
          message: 'The main Super Administrator account cannot be deactivated',
        });
      }
    }

    if (role) user.role = role;
    if (status) user.status = status;
    if (name) user.name = name;

    await user.save();

    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete user account (Super Admin only)
// @route   DELETE /api/auth/users/:id
// @access  Private/SuperAdmin
export const deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (user.username === 'admin' || user.email === 'admin@hospital.com' || user.role === 'superadmin') {
      return res.status(400).json({
        success: false,
        message: 'Super Administrator accounts cannot be deleted',
      });
    }

    await User.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Seed or update default Super Administrator: admin / admin123
// @route   POST /api/auth/seed-admin
// @access  Public
export const seedInitialAdmin = async () => {
  try {
    let admin = await User.findOne({
      $or: [
        { username: 'admin' },
        { email: 'admin@hospital.com' },
        { email: 'admin@hospital.local' },
      ],
    }).select('+password');

    if (!admin) {
      await User.create({
        name: 'Super Administrator',
        username: 'admin',
        email: 'admin@hospital.com',
        password: 'admin123',
        role: 'superadmin',
        status: 'active',
      });
      console.log('[Auth] Default Super Administrator initialized: admin / admin123 (superadmin)');
    } else {
      // Ensure superadmin role, active status, and admin123 password
      admin.role = 'superadmin';
      admin.status = 'active';
      admin.username = 'admin';
      const isMatch = await admin.matchPassword('admin123');
      if (!isMatch) {
        admin.password = 'admin123';
      }
      await admin.save();
      console.log('[Auth] Super Administrator synchronized: admin / admin123 (role: superadmin, status: active)');
    }
  } catch (err) {
    console.error('[Auth] Error checking initial admin seed:', err.message);
  }
};

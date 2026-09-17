import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../services/authApi';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem('user');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(() => {
    try {
      return localStorage.getItem('token') || null;
    } catch {
      return null;
    }
  });

  // Fast Instant-Load: If user session is already cached locally, or if user has no token at all,
  // do NOT block initial render with a loading screen. Load the app in 0ms!
  const [isLoading, setIsLoading] = useState(() => {
    try {
      const savedToken = localStorage.getItem('token');
      const savedUser = localStorage.getItem('user');
      if (savedToken && savedUser) return false; // Already logged in, instant entry!
      if (!savedToken) return false; // Not logged in, instant login screen!
    } catch {
      // Fallback
    }
    return true;
  });

  useEffect(() => {
    const handleSessionExpired = () => {
      setUser(null);
      setToken(null);
    };

    window.addEventListener('auth:session_expired', handleSessionExpired);
    return () => window.removeEventListener('auth:session_expired', handleSessionExpired);
  }, []);

  useEffect(() => {
    let isMounted = true;

    // Safety timeout: Never keep user waiting on loading screen for more than 2.5 seconds
    const safetyTimer = setTimeout(() => {
      if (isMounted) setIsLoading(false);
    }, 2500);

    const checkAuthStatus = async () => {
      if (token) {
        try {
          const res = await authApi.getMe();
          if (isMounted && res.success && res.data) {
            setUser(res.data);
            localStorage.setItem('user', JSON.stringify(res.data));
          }
        } catch (err) {
          // Only logout if token was explicitly rejected / unauthorized (401)
          // Do NOT logout on server wake-up (502/503), timeout, or temporary network blips
          if (
            isMounted &&
            (err?.status === 401 ||
              err?.message?.includes('401') ||
              err?.message?.includes('token') ||
              err?.message?.includes('authorized'))
          ) {
            logout();
          }
        }
      }
      if (isMounted) {
        setIsLoading(false);
      }
    };

    checkAuthStatus();

    return () => {
      isMounted = false;
      clearTimeout(safetyTimer);
    };
  }, [token]);

  const login = async (email, password) => {
    const res = await authApi.login({ email, password });
    if (res.requiresAdmin2FA) {
      return res;
    }
    if (res.success && res.data) {
      const { token: newToken, ...userData } = res.data;
      setToken(newToken);
      setUser(userData);
      localStorage.setItem('token', newToken);
      localStorage.setItem('user', JSON.stringify(userData));
      return res.data;
    }
    throw new Error(res.message || 'Login failed');
  };

  const loginWithSession = (sessionData) => {
    if (sessionData) {
      const { token: newToken, ...userData } = sessionData;
      setToken(newToken);
      setUser(userData);
      localStorage.setItem('token', newToken);
      localStorage.setItem('user', JSON.stringify(userData));
      return sessionData;
    }
  };

  const register = async (userData) => {
    const res = await authApi.register(userData);
    return res;
  };

  const verifyEmailOtp = async (email, otp) => {
    const res = await authApi.verifyEmailOtp({ email, otp });
    if (res.success && res.data) {
      const { token: newToken, ...userData } = res.data;
      setToken(newToken);
      setUser(userData);
      localStorage.setItem('token', newToken);
      localStorage.setItem('user', JSON.stringify(userData));
      return res.data;
    }
    throw new Error(res.message || 'Verification failed');
  };

  const resendEmailOtp = async (email) => {
    return await authApi.resendEmailOtp(email);
  };

  const verifyAdminOtp = async (otp, email) => {
    const res = await authApi.verifyAdminOtp({ otp, email });
    if (res.success && res.data) {
      const { token: newToken, ...userData } = res.data;
      setToken(newToken);
      setUser(userData);
      localStorage.setItem('token', newToken);
      localStorage.setItem('user', JSON.stringify(userData));
      return res.data;
    }
    throw new Error(res.message || 'Super Admin OTP verification failed');
  };

  const resendAdminOtp = async (email) => {
    return await authApi.resendAdminOtp(email);
  };

  const forgotPassword = async (email) => {
    return await authApi.forgotPassword(email);
  };

  const verifyResetPassword = async (email, otp, newPassword) => {
    return await authApi.verifyResetPassword({ email, otp, newPassword });
  };

  const resendForgotPasswordOtp = async (email) => {
    return await authApi.resendForgotPasswordOtp(email);
  };

  const refreshUser = async () => {
    if (token) {
      try {
        const res = await authApi.getMe();
        if (res.success && res.data) {
          setUser(res.data);
          localStorage.setItem('user', JSON.stringify(res.data));
          return res.data;
        }
      } catch (err) {
        console.error('Failed to refresh user:', err);
      }
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  const value = {
    user,
    token,
    role: user?.role || 'staff',
    isSuperAdmin: user?.role === 'superadmin',
    isAdmin: user?.role === 'admin' || user?.role === 'superadmin',
    isManager: user?.role === 'manager' || user?.role === 'admin' || user?.role === 'superadmin',
    isPaused: user?.status === 'paused' || user?.status === 'suspended',
    userStatus: user?.status || 'active',
    isAuthenticated: Boolean(token && user),
    isLoading,
    login,
    loginWithSession,
    register,
    verifyEmailOtp,
    resendEmailOtp,
    verifyAdminOtp,
    resendAdminOtp,
    forgotPassword,
    verifyResetPassword,
    resendForgotPasswordOtp,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

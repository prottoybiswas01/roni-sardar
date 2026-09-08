import { apiClient } from './api';

export const authApi = {
  login: async (credentials) => {
    return await apiClient('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  },

  register: async (userData) => {
    return await apiClient('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  },

  verifyEmailOtp: async ({ email, otp }) => {
    return await apiClient('/auth/verify-email-otp', {
      method: 'POST',
      body: JSON.stringify({ email, otp }),
    });
  },

  resendEmailOtp: async (email) => {
    return await apiClient('/auth/resend-email-otp', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  getMe: async () => {
    return await apiClient('/auth/me');
  },

  updateBackupEmail: async (payload) => {
    const bodyData = typeof payload === 'string' ? { backupEmail: payload } : payload;
    return await apiClient('/auth/backup-email', {
      method: 'PUT',
      body: JSON.stringify(bodyData),
    });
  },

  getUsers: async () => {
    return await apiClient('/auth/users');
  },

  updateUser: async (id, data) => {
    return await apiClient(`/auth/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  sendDeleteUserOtp: async (id) => {
    return await apiClient(`/auth/users/${id}/send-delete-otp`, {
      method: 'POST',
    });
  },

  verifyAndDeleteUser: async (id, otp) => {
    return await apiClient(`/auth/users/${id}/verify-delete`, {
      method: 'POST',
      body: JSON.stringify({ otp }),
    });
  },

  deleteUser: async (id) => {
    return await apiClient(`/auth/users/${id}`, {
      method: 'DELETE',
    });
  },
};


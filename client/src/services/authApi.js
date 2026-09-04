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

  getMe: async () => {
    return await apiClient('/auth/me');
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
};

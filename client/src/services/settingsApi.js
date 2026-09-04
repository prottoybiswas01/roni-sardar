import { apiClient } from './api';

export const settingsApi = {
  getSettings: async () => {
    return await apiClient('/settings');
  },

  updateSettings: async (settingsData) => {
    return await apiClient('/settings', {
      method: 'PUT',
      body: JSON.stringify(settingsData),
    });
  },
};

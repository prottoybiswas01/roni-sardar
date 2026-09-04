import { apiClient } from './api';

export const recordsApi = {
  getRecords: async (params = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        query.append(key, val);
      }
    });
    const queryString = query.toString() ? `?${query.toString()}` : '';
    return await apiClient(`/records${queryString}`);
  },

  getRecordById: async (id) => {
    return await apiClient(`/records/${id}`);
  },

  createRecord: async (recordData) => {
    return await apiClient('/records', {
      method: 'POST',
      body: JSON.stringify(recordData),
    });
  },

  updateRecord: async (id, recordData) => {
    return await apiClient(`/records/${id}`, {
      method: 'PUT',
      body: JSON.stringify(recordData),
    });
  },

  deleteRecord: async (id) => {
    return await apiClient(`/records/${id}`, {
      method: 'DELETE',
    });
  },

  checkDuplicate: async (patientId, date, excludeId = null) => {
    const query = new URLSearchParams({
      patientId: String(patientId).trim(),
      date,
    });
    if (excludeId) query.append('excludeId', excludeId);
    return await apiClient(`/records/check-duplicate?${query.toString()}`);
  },

  getDashboardStats: async (month, year) => {
    const query = new URLSearchParams();
    if (month) query.append('month', month);
    if (year) query.append('year', year);
    const queryString = query.toString() ? `?${query.toString()}` : '';
    return await apiClient(`/records/dashboard-stats${queryString}`);
  },
};

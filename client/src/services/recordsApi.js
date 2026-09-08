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

  getDashboardStats: async (month, year, userId = null) => {
    const query = new URLSearchParams();
    if (month) query.append('month', month);
    if (year) query.append('year', year);
    if (userId) query.append('userId', userId);
    const queryString = query.toString() ? `?${query.toString()}` : '';
    return await apiClient(`/records/dashboard-stats${queryString}`);
  },

  getNextSl: async (params = {}) => {
    const query = new URLSearchParams();
    if (params.date) query.append('date', params.date);
    if (params.month) query.append('month', params.month);
    if (params.year) query.append('year', params.year);
    const queryString = query.toString() ? `?${query.toString()}` : '';
    return await apiClient(`/records/next-sl${queryString}`);
  },

  // Recycle Bin / Trash API
  getBinRecords: async (params = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        query.append(key, val);
      }
    });
    const queryString = query.toString() ? `?${query.toString()}` : '';
    return await apiClient(`/records/bin${queryString}`);
  },

  restoreRecord: async (id) => {
    return await apiClient(`/records/bin/${id}/restore`, {
      method: 'PUT',
    });
  },

  permanentDeleteRecord: async (id) => {
    return await apiClient(`/records/bin/${id}/permanent`, {
      method: 'DELETE',
    });
  },

  emptyBin: async () => {
    return await apiClient('/records/bin/empty', {
      method: 'DELETE',
    });
  },
};


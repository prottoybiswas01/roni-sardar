import { apiClient } from './api';

export const backupApi = {
  getBackupStatus: async () => {
    return await apiClient('/backup/status');
  },

  triggerEmailBackup: async ({ customRecipient = null, forSelfOnly = false, month = null, year = null } = {}) => {
    return await apiClient('/backup/email-now', {
      method: 'POST',
      body: JSON.stringify({ customRecipient, forSelfOnly, month, year }),
    });
  },

  shareReport: async ({ recipientEmail, recipientName, month, year, format, customNote, targetUserId }) => {
    return await apiClient('/backup/share-report', {
      method: 'POST',
      body: JSON.stringify({ recipientEmail, recipientName, month, year, format, customNote, targetUserId }),
    });
  },

  testEmailSettings: async (smtpData) => {
    return await apiClient('/backup/test-email', {
      method: 'POST',
      body: JSON.stringify(smtpData),
    });
  },

  restoreBackup: async (backupJson) => {
    return await apiClient('/backup/restore', {
      method: 'POST',
      body: JSON.stringify(backupJson),
    });
  },

  downloadFullBackup: async () => {
    const token = localStorage.getItem('token');
    const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api';
    const response = await fetch(`${baseUrl}/backup/export`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to download database backup');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const dateStr = new Date().toISOString().split('T')[0];
    a.download = `hospital-overduty-database-backup-${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },
};

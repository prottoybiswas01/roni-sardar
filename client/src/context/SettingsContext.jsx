import React, { createContext, useContext, useState, useEffect } from 'react';
import { settingsApi } from '../services/settingsApi';
import { useAuth } from './AuthContext';

const SettingsContext = createContext(null);

export const SettingsProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const currentDate = new Date();

  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());

  const [settings, setSettings] = useState({
    hospitalName: 'Ad-din Akij Medical College Hospital',
    location: 'Boyra, Khulna',
    reportTitle: 'OVER DUTY / PATIENT REPORT',
    checkDuplicates: true,
  });

  const [isLoadingSettings, setIsLoadingSettings] = useState(false);

  const fetchSettings = async () => {
    if (!isAuthenticated) return;
    try {
      setIsLoadingSettings(true);
      const res = await settingsApi.getSettings();
      if (res.success && res.data) {
        setSettings(res.data);
      }
    } catch (err) {
      console.warn('Failed to load settings from server, using default clinical settings:', err.message);
    } finally {
      setIsLoadingSettings(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, [isAuthenticated]);

  const updateSettings = async (newSettings) => {
    const res = await settingsApi.updateSettings(newSettings);
    if (res.success && res.data) {
      setSettings(res.data);
      return res.data;
    }
    throw new Error(res.message || 'Failed to update settings');
  };

  const value = {
    settings,
    selectedMonth,
    selectedYear,
    setSelectedMonth,
    setSelectedYear,
    updateSettings,
    refreshSettings: fetchSettings,
    isLoadingSettings,
  };

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};

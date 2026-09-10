const getBaseUrl = () => {
  let envUrl = import.meta.env.VITE_API_BASE_URL;
  if (envUrl && envUrl.trim()) {
    let clean = envUrl.trim().replace(/\/+$/, '');
    return clean.endsWith('/api') ? clean : `${clean}/api`;
  }
  if (typeof window !== 'undefined' && window.location.hostname.includes('vercel.app')) {
    return 'https://roni-sardar.onrender.com/api';
  }
  return '/api';
};

const API_BASE_URL = getBaseUrl();

/**
 * Core API client with token injection, auto-retry on 502/503/504 & uniform error handling
 */
export const apiClient = async (endpoint, options = {}, retries = 2) => {
  const token = localStorage.getItem('token');

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const config = {
    ...options,
    headers,
  };

  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;

  try {
    const response = await fetch(url, config);

    // Handle 502 / 503 / 504 server spin-up / waking state with auto-retry
    if ((response.status === 502 || response.status === 503 || response.status === 504) && retries > 0) {
      console.warn(`[API] Server returned ${response.status}. Retrying in 1.8s... (Remaining retries: ${retries})`);
      await new Promise((r) => setTimeout(r, 1800));
      return apiClient(endpoint, options, retries - 1);
    }

    // Handle 401 Unauthorized globally
    if (response.status === 401) {
      if (!endpoint.includes('/auth/login') && !endpoint.includes('/auth/register')) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.dispatchEvent(new CustomEvent('auth:session_expired'));
      }
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      let errorMsg = data.message;
      if (!errorMsg) {
        if (response.status === 503 || response.status === 502) {
          errorMsg = 'সার্ভার সংযোগ সক্রিয় হচ্ছে... অনুগ্রহ করে কয়েক সেকেন্ড পর আবার চেষ্টা করুন।';
        } else if (response.status === 404) {
          errorMsg = 'সার্ভিসটি পাওয়া যায়নি (404 Not Found)';
        } else {
          errorMsg = `Request failed with status ${response.status}`;
        }
      }
      const error = new Error(errorMsg);
      Object.assign(error, data);
      throw error;
    }

    return data;
  } catch (error) {
    if (error.name === 'TypeError' && error.message.includes('fetch') && retries > 0) {
      await new Promise((r) => setTimeout(r, 1800));
      return apiClient(endpoint, options, retries - 1);
    }
    throw error;
  }
};

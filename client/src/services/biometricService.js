import { apiClient } from './api';

// Helper: Convert ArrayBuffer to Base64URL string
const bufferToBase64Url = (buffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

// Helper: Convert Base64URL / string to Uint8Array buffer
const stringToBuffer = (str) => {
  return Uint8Array.from(str, (c) => c.charCodeAt(0));
};

export const biometricService = {
  /**
   * Check if running on a mobile phone (Android / iPhone)
   */
  isMobileDevice: () => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent || navigator.vendor || window.opera || '';
    const isMobileUA = /Android|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
    const hasTouchScreen = Boolean(navigator.maxTouchPoints > 0 || ('ontouchstart' in window));
    const isSmallScreen = typeof window !== 'undefined' && window.innerWidth <= 850;
    return isMobileUA || (hasTouchScreen && isSmallScreen);
  },

  /**
   * Check if current browser and hardware device support Biometrics
   */
  isSupported: async () => {
    try {
      if (!biometricService.isMobileDevice()) return false;
      if (!window.PublicKeyCredential) return false;
      if (typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
        const available = await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        return Boolean(available);
      }
      return true;
    } catch (e) {
      return false;
    }
  },

  /**
   * Register and link current phone/PC fingerprint to the logged-in account
   */
  registerDevice: async (customDeviceName = '') => {
    const isAvail = await biometricService.isSupported();
    if (!isAvail) {
      throw new Error('আপনার ব্রাউজার বা ডিভাইসে বায়োমেট্রিক / ফিঙ্গারপ্রিন্ট সেন্সর সক্রিয় নেই।');
    }

    // 1. Get Challenge from server
    const optionsRes = await apiClient('/auth/biometrics/register-options', {
      method: 'POST',
    });

    if (!optionsRes.success || !optionsRes.data) {
      throw new Error(optionsRes.message || 'Failed to initialize biometric challenge');
    }

    const { challenge, user } = optionsRes.data;

    // Detect device label
    let detectedName = customDeviceName;
    if (!detectedName) {
      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      if (/Android/i.test(navigator.userAgent)) detectedName = '📱 Android Fingerprint';
      else if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) detectedName = '📱 Apple Touch ID / Face ID';
      else if (/Windows/i.test(navigator.userAgent)) detectedName = '💻 Windows Hello Biometrics';
      else if (/Mac/i.test(navigator.userAgent)) detectedName = '💻 Mac Touch ID';
      else detectedName = isMobile ? '📱 Mobile Biometrics' : '💻 Browser Biometrics';
    }

    // 2. Call Native WebAuthn API on Device
    const challengeBuffer = stringToBuffer(challenge);
    const userIdBuffer = stringToBuffer(user.id);

    const credential = await navigator.credentials.create({
      publicKey: {
        challenge: challengeBuffer,
        rp: {
          name: 'OverDuty Hospital Pro',
          id: window.location.hostname === 'localhost' ? 'localhost' : window.location.hostname,
        },
        user: {
          id: userIdBuffer,
          name: user.name,
          displayName: user.displayName,
        },
        pubKeyCredParams: [
          { alg: -7, type: 'public-key' }, // ES256
          { alg: -257, type: 'public-key' }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'preferred',
        },
        timeout: 60000,
        attestation: 'none',
      },
    });

    if (!credential) {
      throw new Error('বায়োমেট্রিক স্ক্যান সম্পন্ন করা যায়নি।');
    }

    const rawIdBase64 = bufferToBase64Url(credential.rawId);

    // 3. Verify and Save on Server
    return await apiClient('/auth/biometrics/verify-registration', {
      method: 'POST',
      body: JSON.stringify({
        credentialId: rawIdBase64,
        publicKey: credential.id || rawIdBase64,
        deviceName: detectedName,
      }),
    });
  },

  /**
   * 1-Touch Fingerprint / Face ID Login on Login Screen
   */
  loginWithBiometrics: async () => {
    const isAvail = await biometricService.isSupported();
    if (!isAvail) {
      throw new Error('আপনার ডিভাইসে বায়োমেট্রিক সেন্সর পাওয়া যায়নি।');
    }

    // 1. Get Challenge & Allowed credentials
    const optionsRes = await apiClient('/auth/biometrics/login-options', {
      method: 'POST',
    });

    if (!optionsRes.success || !optionsRes.data) {
      throw new Error(optionsRes.message || 'Failed to initialize biometric login options');
    }

    const { challenge, allowCredentials } = optionsRes.data;
    const challengeBuffer = stringToBuffer(challenge);

    // 2. Trigger native device fingerprint / Face ID prompt
    const publicKeyOpts = {
      challenge: challengeBuffer,
      rpId: window.location.hostname === 'localhost' ? 'localhost' : window.location.hostname,
      userVerification: 'preferred',
      timeout: 60000,
    };

    if (Array.isArray(allowCredentials) && allowCredentials.length > 0) {
      publicKeyOpts.allowCredentials = allowCredentials.map((credId) => ({
        id: stringToBuffer(atob(credId.replace(/-/g, '+').replace(/_/g, '/'))),
        type: 'public-key',
      }));
    }

    const assertion = await navigator.credentials.get({
      publicKey: publicKeyOpts,
    });

    if (!assertion) {
      throw new Error('বায়োমেট্রিক ভেরিফিকেশন বাতিল করা হয়েছে।');
    }

    const rawIdBase64 = bufferToBase64Url(assertion.rawId);

    // 3. Verify Assertion and Log In
    return await apiClient('/auth/biometrics/verify-login', {
      method: 'POST',
      body: JSON.stringify({
        credentialId: rawIdBase64,
      }),
    });
  },

  /**
   * Get registered biometric devices and 2FA setting
   */
  getDevices: async () => {
    return await apiClient('/auth/biometrics/devices');
  },

  /**
   * Delete a registered biometric device
   */
  deleteDevice: async (credentialId) => {
    return await apiClient(`/auth/biometrics/${encodeURIComponent(credentialId)}`, {
      method: 'DELETE',
    });
  },

  /**
   * Toggle Admin Email OTP requirement [ON/OFF]
   */
  toggleAdmin2FA: async (enabled) => {
    return await apiClient('/auth/toggle-admin-2fa', {
      method: 'PUT',
      body: JSON.stringify({ enabled }),
    });
  },
};

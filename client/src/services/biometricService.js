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

// Helper: Convert Base64URL string back to ArrayBuffer
const base64UrlToBuffer = (base64url) => {
  if (!base64url) return new Uint8Array(0).buffer;
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
};

// Helper: Convert regular string to Uint8Array buffer
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
    
    // Reject Desktop OS & Tablets
    const isDesktop = /Windows NT|Macintosh|Mac OS X|Linux x86_64|CrOS|X11/i.test(ua);
    const isTablet = /iPad|Tablet|Nexus 7|Nexus 10|KFAPWI|PlayBook|Silk/i.test(ua);
    if (isDesktop || isTablet) return false;

    // Check mobile phone UA
    const isMobilePhoneUA = (/Android/i.test(ua) && /Mobile/i.test(ua)) || /iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
    const isSmallScreen = typeof window !== 'undefined' && window.innerWidth <= 640;
    return Boolean(isMobilePhoneUA && isSmallScreen);
  },

  /**
   * Check if current browser and hardware device support Biometrics
   */
  isSupported: async () => {
    try {
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
   * Register and link current phone fingerprint to the logged-in account
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
      if (/Android/i.test(navigator.userAgent)) detectedName = '📱 Android Phone Fingerprint';
      else if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) detectedName = '📱 iPhone Touch ID / Face ID';
      else detectedName = '📱 Mobile Phone Fingerprint';
    }

    // 2. Call Native WebAuthn API on Device
    const challengeBuffer = stringToBuffer(challenge);
    const userIdBuffer = stringToBuffer(user.id);

    try {
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
            residentKey: 'preferred',
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
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        throw new Error('ফিঙ্গারপ্রিন্ট স্ক্যান বাতিল করা হয়েছে। পুনরায় চেষ্টা করুন।');
      }
      throw err;
    }
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

    // Check if any biometric credential exists in database
    if (!Array.isArray(allowCredentials) || allowCredentials.length === 0) {
      throw new Error('⚠️ এই ফোনে এখনও কোনো ফিঙ্গারপ্রিন্ট যুক্ত করা হয়নি। প্রথমে পাসওয়ার্ড দিয়ে লগইন করে Settings ➔ Biometric & 2FA Login-এ গিয়ে "ফিঙ্গারপ্রিন্ট যুক্ত করুন" বাটনে চাপ দিন।');
    }

    const challengeBuffer = stringToBuffer(challenge);

    // 2. Trigger native device fingerprint / Face ID prompt
    const publicKeyOpts = {
      challenge: challengeBuffer,
      rpId: window.location.hostname === 'localhost' ? 'localhost' : window.location.hostname,
      userVerification: 'preferred',
      timeout: 60000,
      allowCredentials: allowCredentials.map((credId) => ({
        id: base64UrlToBuffer(credId),
        type: 'public-key',
      })),
    };

    try {
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
    } catch (err) {
      if (err.name === 'NotAllowedError' || err.message?.includes('timed out') || err.message?.includes('not allowed')) {
        throw new Error('⚠️ এই ফোনে এখনও আপনার ফিঙ্গারপ্রিন্ট যুক্ত করা হয়নি। অনুগ্রহ করে প্রথমে পাসওয়ার্ড দিয়ে লগইন করে Settings থেকে "ফিঙ্গারপ্রিন্ট যুক্ত করুন" বাটনে ক্লিক করুন।');
      }
      throw err;
    }
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

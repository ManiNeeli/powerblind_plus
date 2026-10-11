/**
 * UTM Tracking Utility
 * Captures campaign parameters (utm_source, utm_medium, utm_campaign, utm_term, utm_content)
 * from the URL on landing and persists them in sessionStorage for analytics and audit attribution.
 */

const UTM_STORAGE_KEY = 'powerblind_utm_params';

export function captureUtmParams() {
  if (typeof window === 'undefined') return {};

  const params = new URLSearchParams(window.location.search);
  const utm = {};
  const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];

  let found = false;
  for (const key of utmKeys) {
    const val = params.get(key);
    if (val) {
      utm[key] = val;
      found = true;
    }
  }

  if (found) {
    try {
      const existing = getStoredUtmParams();
      const merged = { ...existing, ...utm, capturedAt: new Date().toISOString() };
      sessionStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(merged));
      return merged;
    } catch {
      // Storage unavailable / private mode
    }
  }

  return getStoredUtmParams();
}

export function getStoredUtmParams() {
  if (typeof window === 'undefined') return {};
  try {
    const raw = sessionStorage.getItem(UTM_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

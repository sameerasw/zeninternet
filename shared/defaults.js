/**
 * Default settings for Zen Internet extension.
 */
const isFirefox = typeof browser !== "undefined" && typeof browser.runtime !== "undefined" && (
  (typeof browser.runtime.getBrowserInfo === "function") ||
  (typeof navigator !== "undefined" && navigator.userAgent.toLowerCase().includes("firefox"))
);

export const DEFAULT_SETTINGS = {
  enableStyling: true,
  autoUpdate: true,
  forceStyling: false,
  whitelistMode: false,
  whitelistStyleMode: false,
  disableTransparency: !isFirefox,
  disableHover: false,
  disableFooter: false,
  fallbackBackgroundList: [],
  welcomeShown: false,
};

/**
 * Ensures all required settings are present with default values.
 */
export function ensureDefaultSettings(settings = {}) {
  const result = { ...settings };

  for (const [key, defaultValue] of Object.entries(DEFAULT_SETTINGS)) {
    if (result[key] === undefined) {
      result[key] = defaultValue;
    }
  }

  return result;
}

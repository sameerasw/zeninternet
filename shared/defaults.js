/**
 * Default settings for Zen Internet extension.
 */
export const DEFAULT_SETTINGS = {
  enableStyling: true,
  autoUpdate: true,
  forceStyling: false,
  whitelistMode: false,
  whitelistStyleMode: false,
  disableTransparency: false,
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

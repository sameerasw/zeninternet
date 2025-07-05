/**
 * Default settings for Zen Internet extension
 * These defaults are used when settings are missing or undefined
 */

export const DEFAULT_SETTINGS = {
  enableStyling: true, // Enable styling globally
  autoUpdate: true, // Auto-update styles
  forceStyling: false, // Force styling on sites without themes
  whitelistMode: false, // Use blacklist mode by default for force styling
  whitelistStyleMode: false, // Use blacklist mode by default for regular styling
  disableTransparency: false, // Don't disable transparency by default
  disableHover: false, // Don't disable hover effects by default
  disableFooter: false, // Don't disable footers by default
  fallbackBackgroundList: [], // Empty array for fallback background sites
  welcomeShown: false, // Track if welcome screen has been shown
};

/**
 * Ensures all required settings are present with default values
 * @param {Object} settings - Current settings object
 * @returns {Object} - Settings object with defaults applied where needed
 */
export function ensureDefaultSettings(settings = {}) {
  const result = { ...settings };

  // Apply default values for any missing settings
  for (const [key, defaultValue] of Object.entries(DEFAULT_SETTINGS)) {
    if (result[key] === undefined) {
      result[key] = defaultValue;
    }
  }

  return result;
}

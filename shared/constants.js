/**
 * Storage keys and other constants used throughout the extension
 */

export const STORAGE_KEYS = {
  BROWSER_STORAGE: "transparentZenSettings",
  SKIP_FORCE_THEMING: "skipForceThemingList",
  SKIP_THEMING: "skipThemingList",
  FALLBACK_BACKGROUND: "fallbackBackgroundList",
  REPOSITORY_URL: "stylesRepositoryUrl",
  STYLES: "styles",
};

// Legacy exports for backward compatibility
export const BROWSER_STORAGE_KEY = STORAGE_KEYS.BROWSER_STORAGE;
export const SKIP_FORCE_THEMING_KEY = STORAGE_KEYS.SKIP_FORCE_THEMING;
export const FALLBACK_BACKGROUND_KEY = STORAGE_KEYS.FALLBACK_BACKGROUND;

export const DEFAULT_REPOSITORY_URL =
  "https://sameerasw.github.io/my-internet/styles.json";

export const ICON_STATES = {
  ON: {
    48: "assets/images/logo_48.png",
    96: "assets/images/logo_96.png",
  },
  OFF: {
    48: "assets/images/logo-off_48.png",
    96: "assets/images/logo-off_96.png",
  },
};

export const CSS_INJECTION_SETTINGS = {
  STYLESHEET_ID: "zeninternet-custom-styles",
};

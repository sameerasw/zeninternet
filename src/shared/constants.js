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
export const SKIP_THEMING_KEY = STORAGE_KEYS.SKIP_THEMING;
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

// GitHub API configuration
export const GITHUB_CONFIG = {
  OWNER: "sameerasw",
  REPO: "my-internet",
  ADDON_REPO: "zeninternet",
};

// Auto-update settings
export const AUTO_UPDATE_SETTINGS = {
  INTERVAL: 2 * 60 * 60 * 1000, // 2 hours in milliseconds
  CACHE_HEADERS: { "Cache-Control": "no-cache" },
};

// UI Constants
export const UI_CONSTANTS = {
  POPUP_WIDTH: 360,
  POPUP_MIN_HEIGHT: 400,
  ANIMATION_DURATION: 300,
  DEBOUNCE_DELAY: 500,
};

// Message types for runtime communication
export const MESSAGE_TYPES = {
  CONTENT_SCRIPT_READY: "contentScriptReady",
  APPLY_STYLES: "applyStyles",
  ENABLE_AUTO_UPDATE: "enableAutoUpdate",
  DISABLE_AUTO_UPDATE: "disableAutoUpdate",
  STYLES_UPDATED: "stylesUpdated",
};

// Feature types for categorization
export const FEATURE_TYPES = {
  TRANSPARENCY: "transparency",
  HOVER: "hover",
  FOOTER: "footer",
};

// Bug report types
export const BUG_REPORT_TYPES = {
  WEBSITE_THEME: 1,
  EXTENSION_ISSUE: 2,
  TRANSPARENCY_ISSUE: 3,
  FEATURE_REQUEST: 4,
  OTHER: 5,
};

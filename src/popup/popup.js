/**
 * Main popup script - entry point for popup functionality
 * Orchestrates all popup components and functionality
 */

// Import components
import { themeRequest } from "./components/theme-request.js";

// Import utilities
import { popupUtils } from "./utils/popup-utils.js";

// Import shared modules
import { DEFAULT_SETTINGS, ensureDefaultSettings } from "../shared/defaults.js";
import { STORAGE_KEYS } from "../shared/utils/storage-utils.js";
import { normalizeHostname } from "../shared/utils/hostname-utils.js";

/**
 * Main Popup class that orchestrates all popup functionality
 */
class ExtensionPopup {
  constructor() {
    // Storage keys
    this.BROWSER_STORAGE_KEY = STORAGE_KEYS.BROWSER_STORAGE;
    this.SKIP_FORCE_THEMING_KEY = STORAGE_KEYS.SKIP_FORCE_THEMING;
    this.SKIP_THEMING_KEY = STORAGE_KEYS.SKIP_THEMING;
    this.FALLBACK_BACKGROUND_KEY = STORAGE_KEYS.FALLBACK_BACKGROUND;

    // Settings
    this.globalSettings = {};
    this.siteSettings = {};

    // Lists
    this.skipForceThemingList = [];
    this.skipThemingList = [];
    this.fallbackBackgroundList = [];

    // Current site info
    this.currentSiteHostname = "";
    this.normalizedCurrentSiteHostname = "";

    // UI Elements
    this.initializeUIElements();

    // Logging
    this.logging = false;
  }

  /**
   * Initialize UI element references
   */
  initializeUIElements() {
    // Main toggles
    this.enableStylingSwitch = document.getElementById("enable-styling");
    this.whitelistStylingModeSwitch = document.getElementById(
      "whitelist-style-mode"
    );
    this.skipThemingSwitch = document.getElementById("skip-theming");
    this.autoUpdateSwitch = document.getElementById("auto-update");
    this.forceStylingSwitch = document.getElementById("force-styling");
    this.whitelistModeSwitch = document.getElementById("whitelist-mode");
    this.skipForceThemingSwitch = document.getElementById("skip-force-theming");
    this.fallbackBackgroundSwitch = document.getElementById(
      "fallback-background"
    );

    // Labels
    this.whitelistStylingModeLabel = document.getElementById(
      "whitelist-style-mode-label"
    );
    this.siteStyleToggleLabel = document.getElementById(
      "site-style-toggle-label"
    );
    this.whitelistModeLabel = document.getElementById("whitelist-mode-label");
    this.siteToggleLabel = document.getElementById("site-toggle-label");

    // Buttons
    this.refetchCSSButton = document.getElementById("refetch-css");
    this.reloadButton = document.getElementById("reload");
    this.whatsNewButton = document.getElementById("whats-new");
    this.howToUseButton = document.getElementById("how-to-use");

    // Containers
    this.currentSiteFeatures = document.getElementById("current-site-toggles");
    this.lastFetchedTime = document.getElementById("last-fetched-time");
    this.modeIndicator = document.getElementById("mode-indicator");
  }

  /**
   * Initialize the popup
   */
  async initialize() {
    try {
      if (this.logging) {
        console.log("DEBUG: Initializing popup");
      }

      // Get current tab info
      const tabInfo = await popupUtils.getCurrentTabInfo();
      if (tabInfo && tabInfo.isWebPage) {
        this.currentSiteHostname = tabInfo.hostname;
        this.normalizedCurrentSiteHostname = tabInfo.normalizedHostname;
      }

      // Load settings and data
      await this.loadSettings();
      await this.loadSkipLists();

      // Restore UI state
      this.restoreSettings();

      // Bind event listeners
      this.bindEvents();

      // Initialize components
      themeRequest.initialize();

      // Setup additional functionality
      this.setupAutoUpdate();
      this.displayLastFetchedTime();
      this.displayAddonVersion();

      if (this.logging) {
        console.log("DEBUG: Popup initialized successfully");
      }
    } catch (error) {
      console.error("Error initializing popup:", error);
    }
  }

  /**
   * Load settings from storage
   */
  async loadSettings() {
    try {
      // Load global settings
      const globalData = await browser.storage.local.get(
        this.BROWSER_STORAGE_KEY
      );
      this.globalSettings = ensureDefaultSettings(
        globalData[this.BROWSER_STORAGE_KEY] || {}
      );

      // Save back any applied defaults
      if (
        JSON.stringify(this.globalSettings) !==
        JSON.stringify(globalData[this.BROWSER_STORAGE_KEY])
      ) {
        await browser.storage.local.set({
          [this.BROWSER_STORAGE_KEY]: this.globalSettings,
        });
      }

      // Load site-specific settings if on a specific site
      if (this.currentSiteHostname) {
        const siteKey = `${this.BROWSER_STORAGE_KEY}.${this.normalizedCurrentSiteHostname}`;
        const siteData = await browser.storage.local.get(siteKey);
        this.siteSettings = siteData[siteKey] || {};
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    }
  }

  /**
   * Load skip lists from storage
   */
  async loadSkipLists() {
    try {
      // Load skip force theming list
      const skipForceData = await browser.storage.local.get(
        this.SKIP_FORCE_THEMING_KEY
      );
      this.skipForceThemingList =
        skipForceData[this.SKIP_FORCE_THEMING_KEY] || [];

      // Load skip theming list
      const skipThemingData = await browser.storage.local.get(
        this.SKIP_THEMING_KEY
      );
      this.skipThemingList = skipThemingData[this.SKIP_THEMING_KEY] || [];

      // Load fallback background list
      const fallbackData = await browser.storage.local.get(
        this.FALLBACK_BACKGROUND_KEY
      );
      this.fallbackBackgroundList =
        fallbackData[this.FALLBACK_BACKGROUND_KEY] || [];
    } catch (error) {
      console.error("Error loading skip lists:", error);
    }
  }

  /**
   * Restore UI settings
   */
  restoreSettings() {
    try {
      // Restore global settings
      if (this.enableStylingSwitch) {
        this.enableStylingSwitch.checked =
          this.globalSettings.enableStyling ?? true;
      }
      if (this.autoUpdateSwitch) {
        this.autoUpdateSwitch.checked = this.globalSettings.autoUpdate ?? false;
      }
      if (this.forceStylingSwitch) {
        this.forceStylingSwitch.checked =
          this.globalSettings.forceStyling ?? false;
      }
      if (this.whitelistModeSwitch) {
        this.whitelistModeSwitch.checked =
          this.globalSettings.whitelistMode ?? false;
      }
      if (this.whitelistStylingModeSwitch) {
        this.whitelistStylingModeSwitch.checked =
          this.globalSettings.whitelistStyleMode ?? false;
      }

      // Update mode labels
      this.updateModeLabels();

      // Restore site-specific toggles
      if (this.currentSiteHostname) {
        if (this.skipForceThemingSwitch) {
          this.skipForceThemingSwitch.checked =
            this.skipForceThemingList.includes(
              this.normalizedCurrentSiteHostname
            );
        }
        if (this.skipThemingSwitch) {
          this.skipThemingSwitch.checked = this.skipThemingList.includes(
            this.normalizedCurrentSiteHostname
          );
        }
        if (this.fallbackBackgroundSwitch) {
          this.fallbackBackgroundSwitch.checked =
            this.fallbackBackgroundList.includes(
              this.normalizedCurrentSiteHostname
            );
        }

        // Load current site features
        this.loadCurrentSiteFeatures();
      }
    } catch (error) {
      console.error("Error restoring settings:", error);
    }
  }

  /**
   * Bind event listeners
   */
  bindEvents() {
    try {
      // Global setting toggles
      this.enableStylingSwitch?.addEventListener("change", () =>
        this.saveSettings()
      );
      this.autoUpdateSwitch?.addEventListener("change", () =>
        this.saveSettings()
      );
      this.forceStylingSwitch?.addEventListener("change", () =>
        this.saveSettings()
      );
      this.whitelistModeSwitch?.addEventListener("change", () =>
        this.handleWhitelistModeChange()
      );
      this.whitelistStylingModeSwitch?.addEventListener("change", () =>
        this.handleWhitelistStyleModeChange()
      );

      // Site-specific toggles
      this.skipForceThemingSwitch?.addEventListener("change", () =>
        this.saveSkipForceThemingList()
      );
      this.skipThemingSwitch?.addEventListener("change", () =>
        this.saveSkipThemingList()
      );
      this.fallbackBackgroundSwitch?.addEventListener("change", () =>
        this.saveFallbackBackgroundList()
      );

      // Feature toggles container
      this.currentSiteFeatures?.addEventListener("change", (event) => {
        if (event.target.type === "checkbox") {
          this.saveCurrentSiteFeatures();
        }
      });

      // Buttons
      this.refetchCSSButton?.addEventListener("click", () => this.refetchCSS());
      this.refetchCSSButton?.addEventListener("auxclick", (e) =>
        popupUtils.handleMiddleClick(e)
      );
      this.reloadButton?.addEventListener("click", () =>
        popupUtils.reloadPage()
      );
      this.whatsNewButton?.addEventListener("click", () => this.openWhatsNew());
      this.howToUseButton?.addEventListener("click", () => this.openHowToUse());

      // Collapsible sections
      document
        .getElementById("toggle-features")
        ?.addEventListener("click", () => this.toggleFeatures());
      document
        .getElementById("toggle-forcing")
        ?.addEventListener("click", () => this.toggleForcing());
      document
        .getElementById("toggle-faq")
        ?.addEventListener("click", () => this.toggleFAQ());

      // FAQ handling
      document
        .getElementById("faq-content")
        ?.addEventListener("click", (e) => this.handleFAQClick(e));

      // Data viewer
      document.getElementById("view-data")?.addEventListener("click", () => {
        browser.tabs.create({
          url: browser.runtime.getURL("data-viewer/data-viewer.html"),
        });
      });

      // Bug report
      document
        .getElementById("bug-report-link")
        ?.addEventListener("click", (e) => {
          e.preventDefault();
          this.showBugReportOverlay();
        });
    } catch (error) {
      console.error("Error binding events:", error);
    }
  }

  /**
   * Save global settings
   */
  async saveSettings() {
    try {
      // Update global settings object
      this.globalSettings.enableStyling =
        this.enableStylingSwitch?.checked ?? true;
      this.globalSettings.autoUpdate = this.autoUpdateSwitch?.checked ?? false;
      this.globalSettings.forceStyling =
        this.forceStylingSwitch?.checked ?? false;
      this.globalSettings.whitelistMode =
        this.whitelistModeSwitch?.checked ?? false;
      this.globalSettings.whitelistStyleMode =
        this.whitelistStylingModeSwitch?.checked ?? false;

      // Save to storage
      await browser.storage.local.set({
        [this.BROWSER_STORAGE_KEY]: this.globalSettings,
      });

      // Save site-specific settings if applicable
      if (this.currentSiteHostname) {
        const siteKey = `${this.BROWSER_STORAGE_KEY}.${this.normalizedCurrentSiteHostname}`;
        await browser.storage.local.set({ [siteKey]: this.siteSettings });
      }

      if (this.logging) {
        console.log("Settings saved", {
          global: this.globalSettings,
          site: this.siteSettings,
        });
      }
    } catch (error) {
      console.error("Error saving settings:", error);
    }
  }

  /**
   * Save skip force theming list
   */
  async saveSkipForceThemingList() {
    try {
      const isChecked = this.skipForceThemingSwitch?.checked ?? false;
      const hostname = this.normalizedCurrentSiteHostname;
      const index = this.skipForceThemingList.indexOf(hostname);

      if (isChecked && index === -1) {
        this.skipForceThemingList.push(hostname);
      } else if (!isChecked && index !== -1) {
        this.skipForceThemingList.splice(index, 1);
      }

      await browser.storage.local.set({
        [this.SKIP_FORCE_THEMING_KEY]: this.skipForceThemingList,
      });
    } catch (error) {
      console.error("Error saving skip force theming list:", error);
    }
  }

  /**
   * Save skip theming list
   */
  async saveSkipThemingList() {
    try {
      const isChecked = this.skipThemingSwitch?.checked ?? false;
      const hostname = this.normalizedCurrentSiteHostname;
      const index = this.skipThemingList.indexOf(hostname);

      if (isChecked && index === -1) {
        this.skipThemingList.push(hostname);
      } else if (!isChecked && index !== -1) {
        this.skipThemingList.splice(index, 1);
      }

      await browser.storage.local.set({
        [this.SKIP_THEMING_KEY]: this.skipThemingList,
      });
    } catch (error) {
      console.error("Error saving skip theming list:", error);
    }
  }

  /**
   * Save fallback background list
   */
  async saveFallbackBackgroundList() {
    try {
      const isChecked = this.fallbackBackgroundSwitch?.checked ?? false;
      const hostname = this.normalizedCurrentSiteHostname;
      const index = this.fallbackBackgroundList.indexOf(hostname);

      if (isChecked && index === -1) {
        this.fallbackBackgroundList.push(hostname);
      } else if (!isChecked && index !== -1) {
        this.fallbackBackgroundList.splice(index, 1);
      }

      await browser.storage.local.set({
        [this.FALLBACK_BACKGROUND_KEY]: this.fallbackBackgroundList,
      });
    } catch (error) {
      console.error("Error saving fallback background list:", error);
    }
  }

  /**
   * Handle whitelist mode change
   */
  handleWhitelistModeChange() {
    this.updateModeLabels();
    this.saveSettings();
  }

  /**
   * Handle whitelist style mode change
   */
  handleWhitelistStyleModeChange() {
    this.updateModeLabels();
    this.saveSettings();
  }

  /**
   * Update mode labels based on current settings
   */
  updateModeLabels() {
    try {
      const isWhitelistMode = this.whitelistModeSwitch?.checked ?? false;
      const isWhitelistStyleMode =
        this.whitelistStylingModeSwitch?.checked ?? false;

      // Update force mode label
      if (this.whitelistModeLabel) {
        this.whitelistModeLabel.textContent = isWhitelistMode
          ? "Forced Whitelist Mode"
          : "Forced Blacklist Mode";
      }

      // Update style mode label
      if (this.whitelistStylingModeLabel) {
        this.whitelistStylingModeLabel.textContent = isWhitelistStyleMode
          ? "Whitelist Mode"
          : "Blacklist Mode";
      }

      // Update site toggle labels
      if (this.siteToggleLabel) {
        this.siteToggleLabel.textContent = isWhitelistMode
          ? "Enable Forcing for this Site"
          : "Skip Forcing for this Site";
      }

      if (this.siteStyleToggleLabel) {
        this.siteStyleToggleLabel.textContent = isWhitelistStyleMode
          ? "Enable Styling for this Site"
          : "Skip Styling for this Site";
      }
    } catch (error) {
      console.error("Error updating mode labels:", error);
    }
  }

  // Additional methods for specific functionality would go here...
  // Due to length constraints, I'll create the remaining methods in a separate response

  /**
   * Display addon version
   */
  async displayAddonVersion() {
    const versionElement = document.getElementById("addon-version");
    if (versionElement) {
      await popupUtils.displayAddonVersion(versionElement);
    }
  }

  /**
   * Load current site features (placeholder)
   */
  async loadCurrentSiteFeatures() {
    // Implementation would go here
    if (this.logging) {
      console.log(
        "Loading current site features for:",
        this.currentSiteHostname
      );
    }
  }

  /**
   * Save current site features (placeholder)
   */
  async saveCurrentSiteFeatures() {
    // Implementation would go here
    if (this.logging) {
      console.log("Saving current site features");
    }
  }

  // Method stubs for remaining functionality
  async refetchCSS() {
    /* Implementation */
  }
  setupAutoUpdate() {
    /* Implementation */
  }
  displayLastFetchedTime() {
    /* Implementation */
  }
  openWhatsNew() {
    /* Implementation */
  }
  openHowToUse() {
    /* Implementation */
  }
  toggleFeatures() {
    /* Implementation */
  }
  toggleForcing() {
    /* Implementation */
  }
  toggleFAQ() {
    /* Implementation */
  }
  handleFAQClick(event) {
    /* Implementation */
  }
  showBugReportOverlay() {
    /* Implementation */
  }
}

// Initialize popup when DOM is loaded
document.addEventListener("DOMContentLoaded", function () {
  const popup = new ExtensionPopup();
  popup.initialize();
});

/**
 * Popup Controller for Zen Internet extension
 * Main controller that coordinates popup functionality
 */

import { SettingsController } from "./settings-controller.js";
import { ToggleHandler } from "../components/toggle-handler.js";
import { ThemeRequest } from "../components/theme-request.js";
import { BugReport } from "../components/bug-report.js";
import { FAQHandler } from "../components/faq-handler.js";
import { STORAGE_KEYS } from "../../shared/constants.js";
import {
  getGlobalSettings,
  getSiteSettings,
} from "../../shared/utils/storage-utils.js";
import { normalizeHostname } from "../../shared/utils/hostname-utils.js";

export class PopupController {
  constructor() {
    this.logging = false;
    this.currentSiteHostname = "";
    this.normalizedCurrentSiteHostname = "";

    // Sub-controllers and components
    this.settingsController = null;
    this.toggleHandler = null;
    this.themeRequest = null;
    this.bugReport = null;
    this.faqHandler = null;

    // DOM elements
    this.elements = {};

    this.initialize();
  }

  /**
   * Initializes the popup controller
   */
  async initialize() {
    try {
      this.log("Initializing popup controller...");

      // Get current tab info
      await this.getCurrentTabInfo();

      // Cache DOM elements
      this.cacheElements();

      // Initialize sub-controllers
      await this.initializeControllers();

      // Load and restore settings
      await this.loadSettings();

      // Bind events
      this.bindEvents();

      // Setup additional features
      this.setupAdditionalFeatures();

      this.log("Popup controller initialized successfully");
    } catch (error) {
      this.logError("Error initializing popup controller", error);
    }
  }

  /**
   * Gets current tab information
   */
  async getCurrentTabInfo() {
    try {
      const tabs = await browser.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (tabs.length > 0 && tabs[0].url) {
        const url = new URL(tabs[0].url);
        this.currentSiteHostname = url.hostname;
        this.normalizedCurrentSiteHostname = normalizeHostname(
          this.currentSiteHostname
        );

        this.log(
          `Current site: ${this.currentSiteHostname} (normalized: ${this.normalizedCurrentSiteHostname})`
        );
      }
    } catch (error) {
      this.logError("Error getting current tab info", error);
    }
  }

  /**
   * Caches DOM elements for quick access
   */
  cacheElements() {
    const elementIds = [
      "enable-styling",
      "whitelist-style-mode",
      "whitelist-style-mode-label",
      "skip-theming",
      "site-style-toggle-label",
      "refetch-css",
      "current-site-toggles",
      "auto-update",
      "last-fetched-time",
      "force-styling",
      "whitelist-mode",
      "whitelist-mode-label",
      "skip-force-theming",
      "site-toggle-label",
      "reload",
      "mode-indicator",
      "whats-new",
      "how-to-use",
      "fallback-background",
      "site-domain",
      "addon-version",
      "toggle-features",
      "toggle-forcing",
      "toggle-faq",
      "view-data",
      "bug-report-link",
    ];

    elementIds.forEach((id) => {
      this.elements[id] = document.getElementById(id);
    });

    this.log("DOM elements cached");
  }

  /**
   * Initializes sub-controllers and components
   */
  async initializeControllers() {
    // Settings controller
    this.settingsController = new SettingsController();

    // Component handlers
    this.toggleHandler = new ToggleHandler(this.settingsController);
    this.themeRequest = new ThemeRequest();
    this.bugReport = new BugReport();
    this.faqHandler = new FAQHandler();

    this.log("Sub-controllers initialized");
  }

  /**
   * Loads settings from storage
   */
  async loadSettings() {
    try {
      // Load global settings
      const globalSettings = await getGlobalSettings();
      await this.settingsController.setGlobalSettings(globalSettings);

      // Load site-specific settings if available
      if (this.normalizedCurrentSiteHostname) {
        const siteSettings = await getSiteSettings(
          this.normalizedCurrentSiteHostname
        );
        await this.settingsController.setSiteSettings(siteSettings);
      }

      // Restore UI state
      this.restoreSettings();

      this.log("Settings loaded and restored");
    } catch (error) {
      this.logError("Error loading settings", error);
    }
  }

  /**
   * Restores settings to UI elements
   */
  restoreSettings() {
    const globalSettings = this.settingsController.getGlobalSettings();

    // Restore global toggles
    if (this.elements["enable-styling"]) {
      this.elements["enable-styling"].checked =
        globalSettings.enableStyling ?? true;
    }

    if (this.elements["auto-update"]) {
      this.elements["auto-update"].checked = globalSettings.autoUpdate ?? false;
    }

    if (this.elements["force-styling"]) {
      this.elements["force-styling"].checked =
        globalSettings.forceStyling ?? false;
    }

    if (this.elements["whitelist-mode"]) {
      this.elements["whitelist-mode"].checked =
        globalSettings.whitelistMode ?? false;
    }

    if (this.elements["whitelist-style-mode"]) {
      this.elements["whitelist-style-mode"].checked =
        globalSettings.whitelistStyleMode ?? false;
    }

    // Update mode labels
    this.updateModeLabels();

    // Update site domain display
    if (this.elements["site-domain"]) {
      this.elements["site-domain"].textContent =
        this.normalizedCurrentSiteHostname || "Unknown Site";
    }

    this.log("Settings restored to UI");
  }

  /**
   * Binds event listeners
   */
  bindEvents() {
    // Global toggle events
    this.bindToggleEvents();

    // Button events
    this.bindButtonEvents();

    // Component events
    this.bindComponentEvents();

    this.log("Events bound");
  }

  /**
   * Binds toggle events
   */
  bindToggleEvents() {
    const toggles = [
      "enable-styling",
      "auto-update",
      "force-styling",
      "whitelist-mode",
      "whitelist-style-mode",
      "skip-theming",
      "skip-force-theming",
      "fallback-background",
    ];

    toggles.forEach((toggleId) => {
      const element = this.elements[toggleId];
      if (element) {
        element.addEventListener("change", () => {
          this.handleToggleChange(toggleId, element.checked);
        });
      }
    });
  }

  /**
   * Binds button events
   */
  bindButtonEvents() {
    const buttons = [
      { id: "refetch-css", handler: "handleRefetchCSS" },
      { id: "reload", handler: "handleReloadPage" },
      { id: "whats-new", handler: "handleWhatsNew" },
      { id: "how-to-use", handler: "handleHowToUse" },
      { id: "view-data", handler: "handleViewData" },
      { id: "bug-report-link", handler: "handleBugReport" },
      { id: "toggle-features", handler: "handleToggleFeatures" },
      { id: "toggle-forcing", handler: "handleToggleForcing" },
      { id: "toggle-faq", handler: "handleToggleFAQ" },
    ];

    buttons.forEach(({ id, handler }) => {
      const element = this.elements[id];
      if (element && this[handler]) {
        element.addEventListener("click", this[handler].bind(this));
      }
    });
  }

  /**
   * Binds component events
   */
  bindComponentEvents() {
    // Theme request events
    if (this.themeRequest) {
      document.addEventListener("themeRequestSubmitted", (event) => {
        this.log("Theme request submitted", event.detail);
      });
    }

    // Bug report events
    if (this.bugReport) {
      document.addEventListener("bugReportSubmitted", (event) => {
        this.log("Bug report submitted", event.detail);
      });
    }
  }

  /**
   * Handles toggle changes
   * @param {string} toggleId - Toggle element ID
   * @param {boolean} checked - Whether toggle is checked
   */
  async handleToggleChange(toggleId, checked) {
    this.log(`Toggle changed: ${toggleId} = ${checked}`);

    try {
      await this.toggleHandler.handleToggle(
        toggleId,
        checked,
        this.normalizedCurrentSiteHostname
      );

      // Update labels if needed
      if (["whitelist-mode", "whitelist-style-mode"].includes(toggleId)) {
        this.updateModeLabels();
      }
    } catch (error) {
      this.logError(`Error handling toggle change for ${toggleId}`, error);
    }
  }

  /**
   * Updates mode labels based on current settings
   */
  updateModeLabels() {
    const globalSettings = this.settingsController.getGlobalSettings();

    // Update whitelist mode label
    if (this.elements["whitelist-mode-label"]) {
      const modeText = globalSettings.whitelistMode
        ? "Forced Whitelist Mode"
        : "Forced Blacklist Mode";
      this.elements["whitelist-mode-label"].textContent = modeText;
    }

    // Update style mode label
    if (this.elements["whitelist-style-mode-label"]) {
      const modeText = globalSettings.whitelistStyleMode
        ? "Whitelist Mode"
        : "Blacklist Mode";
      this.elements["whitelist-style-mode-label"].textContent = modeText;
    }

    // Update site toggle labels
    this.updateSiteToggleLabels();
  }

  /**
   * Updates site-specific toggle labels
   */
  updateSiteToggleLabels() {
    const globalSettings = this.settingsController.getGlobalSettings();

    // Update force theming label
    if (this.elements["site-toggle-label"]) {
      const forceLabel = globalSettings.whitelistMode
        ? "Enable Forcing for this Site"
        : "Skip Forcing for this Site";
      this.elements["site-toggle-label"].textContent = forceLabel;
    }

    // Update styling label
    if (this.elements["site-style-toggle-label"]) {
      const styleLabel = globalSettings.whitelistStyleMode
        ? "Enable Styling for this Site"
        : "Skip Styling for this Site";
      this.elements["site-style-toggle-label"].textContent = styleLabel;
    }
  }

  /**
   * Sets up additional features
   */
  setupAdditionalFeatures() {
    // Display addon version
    this.displayAddonVersion();

    // Display last fetched time
    this.displayLastFetchedTime();

    // Setup auto-update display
    this.setupAutoUpdateDisplay();

    this.log("Additional features set up");
  }

  /**
   * Displays addon version
   */
  async displayAddonVersion() {
    try {
      const manifest = browser.runtime.getManifest();
      if (this.elements["addon-version"]) {
        this.elements["addon-version"].textContent = `v${manifest.version}`;
      }
    } catch (error) {
      this.logError("Error displaying addon version", error);
    }
  }

  /**
   * Displays last fetched time
   */
  async displayLastFetchedTime() {
    try {
      const settings = await getGlobalSettings();
      const lastFetched = settings.lastFetchedTime;

      if (this.elements["last-fetched-time"] && lastFetched) {
        const timeString = this.formatLastFetchedTime(lastFetched);
        this.elements[
          "last-fetched-time"
        ].textContent = `Last updated: ${timeString}`;
      }
    } catch (error) {
      this.logError("Error displaying last fetched time", error);
    }
  }

  /**
   * Formats last fetched timestamp
   * @param {number} timestamp - Timestamp to format
   * @returns {string} - Formatted time string
   */
  formatLastFetchedTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) {
      return "Just now";
    } else if (diffMinutes < 60) {
      return `${diffMinutes} minute${diffMinutes !== 1 ? "s" : ""} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`;
    } else if (diffDays < 7) {
      return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`;
    } else {
      return date.toLocaleDateString();
    }
  }

  /**
   * Sets up auto-update display
   */
  setupAutoUpdateDisplay() {
    // This could show auto-update status, next update time, etc.
    this.log("Auto-update display set up");
  }

  // Event handlers for buttons
  async handleRefetchCSS() {
    this.log("Refetch CSS requested");
    // Implementation would go to settings controller
    await this.settingsController.refetchCSS();
  }

  handleReloadPage() {
    this.log("Page reload requested");
    browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      if (tabs[0]) {
        browser.tabs.reload(tabs[0].id);
      }
    });
  }

  handleWhatsNew() {
    this.log("What's new requested");
    // Open what's new page
    browser.tabs.create({
      url: "https://github.com/sameerasw/zeninternet/releases",
    });
  }

  handleHowToUse() {
    this.log("How to use requested");
    // Open guide page
    browser.tabs.create({ url: "https://www.sameerasw.com/zen" });
  }

  handleViewData() {
    this.log("View data requested");
    // Open data viewer
    browser.tabs.create({
      url: browser.runtime.getURL("data-viewer/data-viewer.html"),
    });
  }

  handleBugReport(event) {
    event.preventDefault();
    this.log("Bug report requested");
    this.bugReport.show();
  }

  handleToggleFeatures() {
    this.log("Toggle features requested");
    // Toggle features section
    const featuresSection = document.getElementById("current-site-toggles");
    if (featuresSection) {
      featuresSection.classList.toggle("collapsed");
    }
  }

  handleToggleForcing() {
    this.log("Toggle forcing requested");
    // Toggle forcing section
    const forcingSection = document.getElementById("forcing-content");
    if (forcingSection) {
      forcingSection.classList.toggle("collapsed");
    }
  }

  handleToggleFAQ() {
    this.log("Toggle FAQ requested");
    this.faqHandler.toggle();
  }

  /**
   * Logs a message
   * @param {string} message - Message to log
   * @param {any} data - Optional data to log
   */
  log(message, data = null) {
    if (this.logging) {
      if (data) {
        console.log(`[ZenInternet Popup] ${message}`, data);
      } else {
        console.log(`[ZenInternet Popup] ${message}`);
      }
    }
  }

  /**
   * Logs an error message
   * @param {string} message - Error message
   * @param {Error|any} error - Error object or data
   */
  logError(message, error = null) {
    if (error) {
      console.error(`[ZenInternet Popup] ${message}`, error);
    } else {
      console.error(`[ZenInternet Popup] ${message}`);
    }
  }
}

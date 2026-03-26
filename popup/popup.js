let logging = false;
let SKIP_FORCE_THEMING_KEY = "skipForceThemingList";
let SKIP_THEMING_KEY = "skipThemingList";
let FALLBACK_BACKGROUND_KEY = "fallbackBackgroundList";
let STYLES_MAPPING_KEY = "stylesMapping";
const USER_STYLES_MAPPING_KEY = "userStylesMapping";

const DEFAULT_SETTINGS = {
  enableStyling: true,
  autoUpdate: true,
  forceStyling: false,
  whitelistMode: false,
  whitelistStyleMode: false,
  disableTransparency: false,
  disableHover: false,
  disableFooter: false,
  disableDarkReader: false,
  enableLogs: false,
  fallbackBackgroundList: [],
};

/**
 * Ensures all required settings exist with default values.
 */
function ensureDefaultSettings(settings = {}) {
  const result = { ...settings };
  for (const [key, defaultValue] of Object.entries(DEFAULT_SETTINGS)) {
    if (result[key] === undefined) {
      result[key] = defaultValue;
    }
  }
  return result;
}

/**
 * Normalizes hostnames by removing the www. prefix.
 */
function normalizeHostname(hostname) {
  return hostname.startsWith("www.") ? hostname.substring(4) : hostname;
}

const $ = (selector) => document.getElementById(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));
const on = (el, event, handler) => el && el.addEventListener(event, handler);

/**
 * Centralized logging helper that respects the enableLogs setting.
 */
async function log(...args) {
  try {
    const data = await browser.storage.local.get("transparentZenSettings");
    const settings = data["transparentZenSettings"] || {};
    if (settings.enableLogs) {
      console.log("[ZenInternet]", ...args);
    }
  } catch (e) {}
}

/**
 * Sets up a modal overlay with common handlers.
 */
function setupOverlay({ overlayId, cancelId, submitId, onCancel, onSubmit, onShow, onHide }) {
  const overlay = $(overlayId);
  if (!overlay) return;
  if (cancelId) on($(cancelId), 'click', () => { onCancel && onCancel(); hide(); });
  if (submitId) on($(submitId), 'click', () => { onSubmit && onSubmit(); });
  on(overlay, 'click', (e) => { if (e.target === overlay) hide(); });
  function show() { overlay.classList.remove('hidden'); onShow && onShow(); }
  function hide() { overlay.classList.add('hidden'); onHide && onHide(); }
  return { show, hide };
}

new (class ExtensionPopup {
  BROWSER_STORAGE_KEY = "transparentZenSettings";
  globalSettings = {};
  siteSettings = {};
  enableStylingSwitch = $("enable-styling");
  whitelistStylingModeSwitch = $("whitelist-style-mode");
  whitelistStylingModeLabel = $("whitelist-style-mode-label");
  skipThemingSwitch = $("skip-theming");
  siteStyleToggleLabel = $("site-style-toggle-label");
  skipThemingList = [];
  refetchCSSButton = $("refetch-css");
  websitesList = $("websites-list");
  currentSiteFeatures = $("current-site-toggles");
  currentSiteHostname = "";
  normalizedCurrentSiteHostname = "";
  autoUpdateSwitch = $("auto-update");
  lastFetchedTime = $("last-fetched-time");
  forceStylingSwitch = $("force-styling");
  whitelistModeSwitch = $("whitelist-mode");
  whitelistModeLabel = $("whitelist-mode-label");
  skipForceThemingSwitch = $("skip-force-theming");
  siteToggleLabel = $("site-toggle-label");
  skipForceThemingList = [];
  reloadButton = $("reload");
  modeIndicator = $("mode-indicator");
  whatsNewButton = $("whats-new");
  howToUseButton = $("how-to-use");
  fallbackBackgroundSwitch = $("fallback-background");
  fallbackBackgroundList = [];
  hasLoadedFeaturesOnce = false;

  constructor() {
    log("Initializing popup class...");
    this.loadSettings().then(() => {
      this.loadSkipForceThemingList().then(() => {
        this.loadSkipThemingList().then(() => {
          this.loadFallbackBackgroundList().then(() => {
            this.getCurrentTabInfo().then(() => {
              this.restoreSettings();
              this.bindAllEvents();
              this.initializeThemeRequestOverlay();
            });
          });
        });
      });
    });

    this.checkWelcomeScreen();

    this.refetchCSSButton.addEventListener("click", this.refetchCSS.bind(this));
    this.refetchCSSButton.addEventListener(
      "auxclick",
      this.handleMiddleClick.bind(this)
    );
    this.autoUpdateSwitch.addEventListener(
      "change",
      this.saveSettings.bind(this)
    );
    this.forceStylingSwitch.addEventListener(
      "change",
      this.saveSettings.bind(this)
    );
    this.reloadButton.addEventListener("click", this.reloadPage.bind(this));

    document
      .getElementById("toggle-features")
      ?.addEventListener("click", this.toggleFeatures.bind(this));

    document
      .getElementById("toggle-forcing")
      ?.addEventListener("click", this.toggleForcing.bind(this));

    this.whitelistModeSwitch.addEventListener(
      "change",
      this.handleWhitelistModeChange.bind(this)
    );

    this.whitelistStylingModeSwitch.addEventListener(
      "change",
      this.handleWhitelistStyleModeChange.bind(this)
    );

    this.whatsNewButton.addEventListener("click", this.openWhatsNew.bind(this));
    this.howToUseButton.addEventListener("click", this.openHowToUse.bind(this));

    document.getElementById("view-data")?.addEventListener("click", () => {
      browser.tabs.create({
        url: browser.runtime.getURL("data-viewer/data-viewer.html"),
      });
    });

    document
      .getElementById("bug-report-link")
      ?.addEventListener("click", (e) => {
        e.preventDefault();
        this.showBugReportOverlay();
      });

    this.setupAutoUpdate();
    this.displayLastFetchedTime();
    this.displayAddonVersion();

    document.addEventListener("DOMContentLoaded", function () {
      const header = document.querySelector(".app-header");
      window.addEventListener("scroll", () => {
        const scrollPercentage =
          (window.scrollY / document.body.scrollHeight) * 100;
        if (scrollPercentage > 5) {
          header.classList.add("compact");
        } else {
          header.classList.remove("compact");
        }
      });
    });

    browser.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === "local") {
        const isRelevant = 
          changes[this.BROWSER_STORAGE_KEY] || 
          changes[SKIP_THEMING_KEY] || 
          changes[SKIP_FORCE_THEMING_KEY] ||
          changes[FALLBACK_BACKGROUND_KEY];
        
        if (isRelevant) {
          this.loadSettings().then(() => {
            this.loadSkipForceThemingList().then(() => {
              this.loadSkipThemingList().then(() => {
                this.loadFallbackBackgroundList().then(() => {
                  this.restoreSettings();
                });
              });
            });
          });
        }
      }
    });
  }

  /**
   * Retrieves information about the currently active tab.
   */
  async getCurrentTabInfo() {
    log("Fetching current tab info...");
    try {
      const tabs = await browser.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (tabs.length > 0) {
        const url = new URL(tabs[0].url);
        this.currentSiteHostname = url.hostname;
        this.normalizedCurrentSiteHostname = normalizeHostname(
          this.currentSiteHostname
        );

        const siteDomainElement = document.getElementById("site-domain");
        if (siteDomainElement) {
          const displayDomain = normalizeHostname(this.currentSiteHostname);
          siteDomainElement.textContent = displayDomain;
          siteDomainElement.title = displayDomain;
        }
      }
    } catch (error) {
      console.error("Error getting current tab info:", error);
    }
  }

  /**
   * Binds UI events to their respective handlers.
   */
  bindAllEvents() {
    this.enableStylingSwitch.addEventListener("change", () => {
      this.saveSettings();
      this.updateActiveTabStyling();
    });

    this.currentSiteFeatures.addEventListener("change", (event) => {
      if (event.target.type === "checkbox") {
        const checkbox = event.target;
        const row = checkbox.closest(".feature-toggle-row");
        const nameSpan = row ? row.querySelector(".feature-name") : null;
        const featureName = nameSpan ? nameSpan.textContent.replace("[overridden]", "").trim() : "Feature";
        
        this.saveSettings();
        this.updateActiveTabStyling();
        this.showToast(`${featureName}: ${checkbox.checked ? 'On' : 'Off'}`, checkbox.checked);
      }
    });

    this.skipForceThemingSwitch.addEventListener("change", () => {
      this.saveSkipForceThemingList();
    });

    this.skipThemingSwitch.addEventListener("change", () => {
      this.saveSkipThemingList();
    });

    this.fallbackBackgroundSwitch.addEventListener("change", () => {
      this.saveFallbackBackgroundList();
    });

    this.reloadButton.addEventListener("click", this.reloadPage.bind(this));

    document
      .getElementById("toggle-faq")
      ?.addEventListener("click", this.toggleFAQ.bind(this));

    document
      .getElementById("toggle-developer")
      ?.addEventListener("click", this.toggleDeveloper.bind(this));

    document
      .getElementById("faq-content")
      ?.addEventListener("click", this.handleFAQClick.bind(this));
  }

  /**
   * Restores UI state from stored settings.
   */
  restoreSettings() {
    log("Restoring settings to UI...");
    this.enableStylingSwitch.checked =
      this.globalSettings.enableStyling ?? true;
    this.autoUpdateSwitch.checked = this.globalSettings.autoUpdate ?? false;
    this.forceStylingSwitch.checked = this.globalSettings.forceStyling ?? false;
    this.whitelistModeSwitch.checked =
      this.globalSettings.whitelistMode ?? false;
    this.whitelistStylingModeSwitch.checked =
      this.globalSettings.whitelistStyleMode ?? false;

    this.updateModeLabels();

    this.skipForceThemingSwitch.checked = this.skipForceThemingList.includes(
      normalizeHostname(this.currentSiteHostname)
    );

    this.skipThemingSwitch.checked = this.skipThemingList.includes(
      normalizeHostname(this.currentSiteHostname)
    );

    this.fallbackBackgroundSwitch.checked =
      this.fallbackBackgroundList.includes(
        normalizeHostname(this.currentSiteHostname)
      );

    this.loadCurrentSiteFeatures();
  }

  /**
   * Loads global and site-specific settings from storage.
   */
  async loadSettings() {
    const globalData = await browser.storage.local.get(
      this.BROWSER_STORAGE_KEY
    );

    this.globalSettings = ensureDefaultSettings(
      globalData[this.BROWSER_STORAGE_KEY] || {}
    );

    if (
      JSON.stringify(this.globalSettings) !==
      JSON.stringify(globalData[this.BROWSER_STORAGE_KEY])
    ) {
      await browser.storage.local.set({
        [this.BROWSER_STORAGE_KEY]: this.globalSettings,
      });
    }

    if (this.currentSiteHostname) {
      const normalizedSiteKey = `${this.BROWSER_STORAGE_KEY}.${this.normalizedCurrentSiteHostname}`;
      const originalSiteKey = `${this.BROWSER_STORAGE_KEY}.${this.currentSiteHostname}`;

      const normalizedData = await browser.storage.local.get(normalizedSiteKey);
      const originalData = await browser.storage.local.get(originalSiteKey);

      this.siteSettings =
        normalizedData[normalizedSiteKey] ||
        originalData[originalSiteKey] ||
        {};

      if (!normalizedData[normalizedSiteKey] && originalData[originalSiteKey]) {
        await browser.storage.local.set({
          [normalizedSiteKey]: this.siteSettings,
        });
      }

      await this.loadCurrentSiteFeatures();
    }
  }

  /**
   * Saves current settings to storage.
   */
  saveSettings() {
    const prevEnable = this.globalSettings.enableStyling;
    this.globalSettings.enableStyling = this.enableStylingSwitch.checked;
    this.globalSettings.autoUpdate = this.autoUpdateSwitch.checked;
    this.globalSettings.forceStyling = this.forceStylingSwitch.checked;
    this.globalSettings.whitelistMode = this.whitelistModeSwitch.checked;
    this.globalSettings.whitelistStyleMode =
      this.whitelistStylingModeSwitch.checked;

    browser.storage.local
      .set({
        [this.BROWSER_STORAGE_KEY]: this.globalSettings,
      })
      .then(() => {
        this.updateActiveTabStyling();
        if (prevEnable !== this.globalSettings.enableStyling) {
            this.showToast(`Global Styling: ${this.globalSettings.enableStyling ? 'On' : 'Off'}`, this.globalSettings.enableStyling);
        }
      });

    if (this.currentSiteHostname) {
      const siteKey = `${this.BROWSER_STORAGE_KEY}.${this.normalizedCurrentSiteHostname}`;
      const featureSettings = {};

      this.currentSiteFeatures
        .querySelectorAll("input[type=checkbox]")
        .forEach((checkbox) => {
          const [, feature] = checkbox.name.split("|");
          featureSettings[feature] = checkbox.checked;
        });

      this.siteSettings = featureSettings;
      browser.storage.local
        .set({
          [siteKey]: featureSettings,
        })
        .then(() => {
          this.updateActiveTabStyling();
        });
    }
  }

  /**
   * Sends a toast notification to the active tab.
   */
  async showToast(text, isEnabled) {
    log("Showing toast:", text, isEnabled ? "On" : "Off");
    try {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      if (tabs.length > 0 && tabs[0].url?.startsWith("http")) {
        browser.tabs.sendMessage(tabs[0].id, { action: "showToast", text, isEnabled }).catch(() => {});
      }
    } catch (e) {}
  }

  /**
   * Loads the list of sites to skip for forced theming.
   */
  async loadSkipForceThemingList() {
    const data = await browser.storage.local.get(SKIP_FORCE_THEMING_KEY);
    this.skipForceThemingList = data[SKIP_FORCE_THEMING_KEY] || [];

    if (!data[SKIP_FORCE_THEMING_KEY]) {
      await browser.storage.local.set({ [SKIP_FORCE_THEMING_KEY]: [] });
    }
  }

  /**
   * Loads the list of sites to skip for regular theming.
   */
  async loadSkipThemingList() {
    const data = await browser.storage.local.get(SKIP_THEMING_KEY);
    this.skipThemingList = data[SKIP_THEMING_KEY] || [];

    if (!data[SKIP_THEMING_KEY]) {
      await browser.storage.local.set({ [SKIP_THEMING_KEY]: [] });
    }
  }

  /**
   * Loads the list of sites with fallback background enabled.
   */
  async loadFallbackBackgroundList() {
    const data = await browser.storage.local.get(FALLBACK_BACKGROUND_KEY);
    this.fallbackBackgroundList = data[FALLBACK_BACKGROUND_KEY] || [];

    if (!data[FALLBACK_BACKGROUND_KEY]) {
      await browser.storage.local.set({ [FALLBACK_BACKGROUND_KEY]: [] });
    }
  }

  /**
   * Saves the list of sites to skip for forced theming.
   */
  saveSkipForceThemingList() {
    const isChecked = this.skipForceThemingSwitch.checked;
    const index = this.skipForceThemingList.indexOf(
      normalizeHostname(this.currentSiteHostname)
    );

    if (isChecked && index === -1) {
      this.skipForceThemingList.push(
        normalizeHostname(this.currentSiteHostname)
      );
    } else if (!isChecked && index !== -1) {
      this.skipForceThemingList.splice(index, 1);
    }

    browser.storage.local
      .set({
        [SKIP_FORCE_THEMING_KEY]: this.skipForceThemingList,
      })
      .then(() => {
        this.updateActiveTabStyling();
        this.showToast(`Forced Styling: ${!isChecked ? 'On' : 'Off'}`, !isChecked);
      });
  }

  /**
   * Saves the list of sites to skip for regular theming.
   */
  saveSkipThemingList() {
    const isChecked = this.skipThemingSwitch.checked;
    const index = this.skipThemingList.indexOf(
      normalizeHostname(this.currentSiteHostname)
    );

    if (isChecked && index === -1) {
      this.skipThemingList.push(normalizeHostname(this.currentSiteHostname));
    } else if (!isChecked && index !== -1) {
      this.skipThemingList.splice(index, 1);
    }

    browser.storage.local
      .set({
        [SKIP_THEMING_KEY]: this.skipThemingList,
      })
      .then(() => {
        this.updateActiveTabStyling();
        this.showToast(`Site Styling: ${!isChecked ? 'On' : 'Off'}`, !isChecked);
      });
  }

  /**
   * Saves the list of sites with fallback background enabled.
   */
  saveFallbackBackgroundList() {
    const isChecked = this.fallbackBackgroundSwitch.checked;
    const index = this.fallbackBackgroundList.indexOf(
      normalizeHostname(this.currentSiteHostname)
    );

    if (isChecked && index === -1) {
      this.fallbackBackgroundList.push(
        normalizeHostname(this.currentSiteHostname)
      );
    } else if (!isChecked && index !== -1) {
      this.fallbackBackgroundList.splice(index, 1);
    }

    browser.storage.local
      .set({
        [FALLBACK_BACKGROUND_KEY]: this.fallbackBackgroundList,
      })
      .then(() => {
        this.updateActiveTabStyling();
      });
  }

  /**
   * Initializes theme request overlay logic.
   */
  initializeThemeRequestOverlay() {
    const overlay = $("theme-request-overlay");
    const cancelBtn = $("cancel-request");
    const submitBtn = $("submit-request");
    const forcingToggle = $("forcing-toggle");
    const accountToggle = $("account-toggle");

    this.setupCustomToggle(forcingToggle);
    this.setupCustomToggle(accountToggle);

    cancelBtn.addEventListener("click", () => {
      this.hideThemeRequestOverlay();
    });

    submitBtn.addEventListener("click", () => {
      this.submitThemeRequest();
    });

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        this.hideThemeRequestOverlay();
      }
    });
  }

  /**
   * Sets up multi-option toggle buttons.
   */
  setupCustomToggle(toggleElement) {
    const options = toggleElement.querySelectorAll(".toggle-option");

    options.forEach((option) => {
      option.addEventListener("click", () => {
        options.forEach((opt) => opt.classList.remove("active"));
        option.classList.add("active");
      });
    });
  }

  /**
   * Displays the theme request overlay.
   */
  showThemeRequestOverlay() {
    const overlay = $("theme-request-overlay");
    overlay.classList.remove("hidden");

    const forcingToggle = $("forcing-toggle");
    const accountToggle = $("account-toggle");

    forcingToggle
      .querySelectorAll(".toggle-option")
      .forEach((opt) => opt.classList.remove("active"));
    forcingToggle.querySelector('[data-value="off"]').classList.add("active");

    accountToggle
      .querySelectorAll(".toggle-option")
      .forEach((opt) => opt.classList.remove("active"));
    accountToggle.querySelector('[data-value="unset"]').classList.add("active");
  }

  /**
   * Hides the theme request overlay.
   */
  hideThemeRequestOverlay() {
    const overlay = $("theme-request-overlay");
    overlay.classList.add("hidden");
  }

  /**
   * Returns the value selected in a custom toggle.
   */
  getToggleValue(toggleId) {
    const toggle = $(toggleId);
    const activeOption = toggle.querySelector(".toggle-option.active");
    return activeOption ? activeOption.getAttribute("data-value") : "unset";
  }

  /**
   * Submits a theme request to the remote repository.
   */
  async submitThemeRequest() {
    const forcingValue = this.getToggleValue("forcing-toggle");
    const accountValue = this.getToggleValue("account-toggle");

    const submitBtn = $("submit-request");
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Checking...';
    submitBtn.disabled = true;

    try {
      const existingIssue = await this.checkExistingIssue(
        this.currentSiteHostname
      );

      if (existingIssue) {
        this.showExistingIssueScreen(existingIssue, forcingValue, accountValue);
        return;
      }

      this.createNewIssue(forcingValue, accountValue);
    } catch (error) {
      this.createNewIssue(forcingValue, accountValue);
    } finally {
      submitBtn.innerHTML = originalText;
      submitBtn.disabled = false;
    }
  }

  /**
   * Checks for existing theme requests on GitHub.
   */
  async checkExistingIssue(hostname) {
    const owner = "sameerasw";
    const repo = "my-internet";
    const searchTerm = hostname;

    const query = encodeURIComponent(
      `${searchTerm} repo:${owner}/${repo} in:title type:issue state:open`
    );
    const url = `https://api.github.com/search/issues?q=${query}`;

    const response = await fetch(url, {
      headers: {
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!response.ok) {
      if (response.status === 403) {
        return null;
      }
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const data = await response.json();
    const matchingIssues = data.items.filter(
      (issue) =>
        issue.title.toLowerCase().includes(hostname.toLowerCase()) ||
        issue.title.toLowerCase().includes("[theme]")
    );

    return matchingIssues.length > 0 ? matchingIssues[0] : null;
  }

  /**
   * Displays info about an existing theme request.
   */
  showExistingIssueScreen(existingIssue, forcingValue, accountValue) {
    const prompt = document.querySelector(".theme-request-prompt");
    this.pendingRequestData = { forcingValue, accountValue };

    const createdDate = new Date(existingIssue.created_at).toLocaleDateString();
    const issueState = existingIssue.state === "open" ? "Open" : "Closed";
    const stateClass =
      existingIssue.state === "open" ? "status-open" : "status-closed";

    prompt.innerHTML = `
      <h3>Existing Request Found</h3>
      <div class="existing-issue-info">
        <p>An existing theme request was found for <strong>${
          this.currentSiteHostname
        }</strong></p>

        <div class="issue-details">
          <div class="issue-header">
            <h4 class="issue-title">${existingIssue.title}</h4>
            <span class="issue-state ${stateClass}">${issueState}</span>
          </div>

          <div class="issue-meta">
            <div class="issue-meta-item">
              <i class="fas fa-calendar-alt"></i>
              <span>Created: ${createdDate}</span>
            </div>
            <div class="issue-meta-item">
              <i class="fas fa-comments"></i>
              <span>${existingIssue.comments} comments</span>
            </div>
            ${
              existingIssue.assignee
                ? `
              <div class="issue-meta-item">
                <i class="fas fa-user"></i>
                <span>Assigned to ${existingIssue.assignee.login}</span>
              </div>
            `
                : ""
            }
          </div>

          ${
            existingIssue.body
              ? `
            <div class="issue-body">
              <p><strong>Description:</strong></p>
              <p class="issue-description">${this.truncateText(
                existingIssue.body,
                200
              )}</p>
            </div>
          `
              : ""
          }
        </div>

        <div class="existing-issue-actions">
          <button id="view-existing-issue" class="action-button secondary">
            <i class="fas fa-external-link-alt"></i> View Existing Request
          </button>
        </div>
      </div>

      <div class="prompt-actions">
        <button id="submit-anyway" class="action-button secondary">
          Submit Anyway
        </button>
        <button id="close-request" class="action-button primary">
          Close
        </button>
      </div>
    `;

    document
      .getElementById("view-existing-issue")
      .addEventListener("click", () => {
        window.open(existingIssue.html_url, "_blank");
      });

    document.getElementById("submit-anyway").addEventListener("click", () => {
      this.createNewIssue(
        this.pendingRequestData.forcingValue,
        this.pendingRequestData.accountValue
      );
    });

    document.getElementById("close-request").addEventListener("click", () => {
      this.hideThemeRequestOverlay();
    });
  }

  /**
   * Generates a new theme request issue on GitHub.
   */
  createNewIssue(forcingValue, accountValue) {
    let issueBody = `Please add a theme for ${this.currentSiteHostname}\n\n`;

    if (forcingValue === "yes") {
      issueBody += "**Tried forcing:** YES\n";
    } else if (forcingValue === "no") {
      issueBody += "**Tried forcing:** NO\n";
    } else {
      issueBody += "**Tried forcing:** Not specified\n";
    }

    if (accountValue === "yes") {
      issueBody += "**Requires account:** YES\n";
    } else if (accountValue === "no") {
      issueBody += "**Requires account:** NO\n";
    } else {
      issueBody += "**Requires account:** Not specified\n";
    }

    issueBody +=
      "\n---\n\n*This request was generated automatically from the Zen Internet extension.*";

    const issueUrl = `https://github.com/sameerasw/my-internet/issues/new?template=website-theme-request.md&title=[THEME] ${
      this.currentSiteHostname
    }&body=${encodeURIComponent(issueBody)}`;

    window.open(issueUrl, "_blank");
    this.hideThemeRequestOverlay();
  }

  /**
   * Truncates text to a specified length.
   */
  truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  }

  /**
   * Loads specific feature toggles for the current website.
   */
  async loadCurrentSiteFeatures() {
    try {
      const stylesData = await browser.storage.local.get("styles");
      const styles = stylesData.styles?.website || {};

      this.currentSiteFeatures.innerHTML = "";

      let currentSiteKey = Object.keys(styles).find((site) =>
        this.isCurrentSite(site.replace(".css", ""))
      );

      let isMappedStyle = false;
      let mappedSourceStyle = null;
      if (!currentSiteKey) {
        const mappingData = await browser.storage.local.get(STYLES_MAPPING_KEY);
        const userMappingData = await browser.storage.local.get(USER_STYLES_MAPPING_KEY);
        const mergedMapping = { ...(mappingData[STYLES_MAPPING_KEY]?.mapping || {}) };
        if (userMappingData[USER_STYLES_MAPPING_KEY]?.mapping) {
          for (const [src, targets] of Object.entries(userMappingData[USER_STYLES_MAPPING_KEY].mapping)) {
            if (!mergedMapping[src]) mergedMapping[src] = [];
            for (const t of targets) {
              if (!mergedMapping[src].includes(t)) mergedMapping[src].push(t);
            }
          }
        }
        for (const [sourceStyle, targetSites] of Object.entries(mergedMapping)) {
          if (targetSites.includes(this.normalizedCurrentSiteHostname)) {
            currentSiteKey = sourceStyle;
            isMappedStyle = true;
            mappedSourceStyle = sourceStyle;
            break;
          }
        }
      }

      const hasExampleSite = "example.com.css" in styles;
      const hasNoStyles = Object.keys(styles).length === 0;

      const hasSpecificTheme =
        currentSiteKey && (currentSiteKey !== "example.com.css" || isMappedStyle);

      const isMappedToExample = isMappedStyle && mappedSourceStyle === "example.com.css";

      if (isMappedStyle && mappedSourceStyle) {
        const sourceWebsite = mappedSourceStyle.replace('.css', '');
        const mappedIndicator = document.createElement("div");
        mappedIndicator.className = "mapped-theme-indicator";
        mappedIndicator.innerHTML = `
          <span class="mapped-badge">
            <i class="fas fa-link"></i>
            Mapped from ${sourceWebsite}
          </span>
        `;
        this.currentSiteFeatures.appendChild(mappedIndicator);
      }

      const featuresList = $("current-site-toggles");
      const actionsContainer = $("current-site-actions");
      const toggleButton = $("toggle-features");

      const isFirstLoad = !this.hasLoadedFeaturesOnce;
      this.hasLoadedFeaturesOnce = true;

      if (isFirstLoad) {
        if (hasSpecificTheme) {
          featuresList.classList.add("collapsed");
          if (actionsContainer) actionsContainer.classList.add("collapsed");
          if (toggleButton) {
            const icon = toggleButton.querySelector("i");
            if (icon) icon.className = "fas fa-chevron-down";
            toggleButton.classList.remove("active");
          }
        } else {
          featuresList.classList.remove("collapsed");
          if (actionsContainer) actionsContainer.classList.remove("collapsed");
          if (toggleButton) {
            const icon = toggleButton.querySelector("i");
            if (icon) icon.className = "fas fa-chevron-up";
            toggleButton.classList.add("active");
          }
        }
      }

      if (hasSpecificTheme) {
        const skipForceThemingContainer =
          this.skipForceThemingSwitch.closest(".toggle-container");
        if (skipForceThemingContainer) {
          skipForceThemingContainer.style.display = "none";
        }

        const skipThemingContainer =
          this.skipThemingSwitch.closest(".toggle-container");
        if (skipThemingContainer) {
          skipThemingContainer.style.display = "flex";
        }
      } else {
        const skipForceThemingContainer =
          this.skipForceThemingSwitch.closest(".toggle-container");
        if (skipForceThemingContainer) {
          skipForceThemingContainer.style.display = "flex";
        }

        const skipThemingContainer =
          this.skipThemingSwitch.closest(".toggle-container");
        if (skipThemingContainer) {
          skipThemingContainer.style.display = "none";
        }
      }

      const forcingContent = $("forcing-content");
      const toggleForcingButton = $("toggle-forcing");

      if (isFirstLoad) {
        if (hasSpecificTheme) {
          forcingContent.classList.add("collapsed");
          if (toggleForcingButton) {
            const icon = toggleForcingButton.querySelector("i");
            if (icon) icon.className = "fas fa-chevron-down";
            toggleForcingButton.classList.remove("active");
          }
        } else {
          forcingContent.classList.remove("collapsed");
          if (toggleForcingButton) {
            const icon = toggleForcingButton.querySelector("i");
            if (icon) icon.className = "fas fa-chevron-up";
            toggleForcingButton.classList.add("active");
          }
        }
      }

     if (!isMappedToExample) {
        if (!currentSiteKey && this.globalSettings.forceStyling) {
          currentSiteKey = Object.keys(styles).find(
            (site) => site === "example.com.css"
          );
        }
        if (
          (!currentSiteKey || currentSiteKey === "example.com.css") &&
          hasExampleSite
        ) {
          const requestThemeButton = document.createElement("button");
          requestThemeButton.className = "action-button primary";
          requestThemeButton.innerHTML = `Request Theme for ${this.currentSiteHostname}`;
          requestThemeButton.addEventListener("click", () => {
            this.showThemeRequestOverlay();
          });
          this.currentSiteFeatures.appendChild(requestThemeButton);
        } else if (hasNoStyles) {
          const fetchFirstMessage = document.createElement("div");
          fetchFirstMessage.className = "toggle-container";
          fetchFirstMessage.innerHTML = `
            <div class="actions secondary">
              <span class="toggle-label warning">Please fetch styles first using the \"Refetch latest styles\" button</span>
            </div>
          `;
          this.currentSiteFeatures.appendChild(fetchFirstMessage);
        }
      }

      if (!currentSiteKey) {
        return;
      }

      const siteKey = `${this.BROWSER_STORAGE_KEY}.${this.normalizedCurrentSiteHostname}`;
      const siteData = await browser.storage.local.get(siteKey);
      this.siteSettings = siteData[siteKey] || {};

      const features = styles[currentSiteKey];

      if (currentSiteKey === "example.com.css" && !isMappedToExample) {
        const skipForceThemingToggle = document.createElement("div");
        skipForceThemingToggle.className = "toggle-container";
        skipForceThemingToggle.innerHTML = `
        <div class="actions secondary">
          <span class="toggle-label warning">No specific theme found for this website. Using default styling.</span>
        </div>
        `;
        this.currentSiteFeatures.appendChild(skipForceThemingToggle);
      }

      const isTransparencyDisabled =
        this.globalSettings.disableTransparency === true;
      const isHoverDisabled = this.globalSettings.disableHover === true;
      const isFooterDisabled = this.globalSettings.disableFooter === true;
      const isDarkReaderDisabled = this.globalSettings.disableDarkReader === true;

      for (const [feature, css] of Object.entries(features)) {
        let displayFeatureName = feature.includes("-")
          ? feature.split("-")[1]
          : feature;
        let featureCaption = null;
        if (displayFeatureName.includes("$")) {
          const parts = displayFeatureName.split("$");
          displayFeatureName = parts[0].trim();
          featureCaption = parts.slice(1).join("$").trim();
        }

        const isChecked = this.siteSettings[feature] ?? true;
        const isTransparencyFeature = feature
          .toLowerCase()
          .includes("transparency");
        const isHoverFeature = feature.toLowerCase().includes("hover");
        const isFooterFeature = feature.toLowerCase().includes("footer");
        const isDarkReaderFeature = feature.toLowerCase().includes("darkreader") || css.toLowerCase().includes("darkreader");
        
        const isOverridden =
          (isTransparencyDisabled && isTransparencyFeature) ||
          (isHoverDisabled && isHoverFeature) ||
          (isFooterDisabled && isFooterFeature) ||
          (isDarkReaderDisabled && isDarkReaderFeature);

        const featureToggle = document.createElement("div");
        featureToggle.className = "feature-toggle";

        const featureRow = document.createElement("div");
        featureRow.className = "feature-toggle-row";

        const nameSpan = document.createElement("span");
        nameSpan.className = "feature-name feature-title-ellipsis";
        nameSpan.innerHTML = displayFeatureName + (isOverridden ? ' <span class="overridden-label">[overridden]</span>' : "");
        if (featureCaption) {
          nameSpan.title = featureCaption;
          nameSpan.classList.add("feature-has-tooltip");
        }
        featureRow.appendChild(nameSpan);

        const toggleLabel = document.createElement("label");
        toggleLabel.className = `toggle-switch${isOverridden ? " disabled-toggle" : ""}`;
        toggleLabel.innerHTML = `<input type="checkbox" name="${currentSiteKey}|${feature}" ${isChecked ? "checked" : ""} ${isOverridden ? "disabled" : ""}><span class="slider round"></span>`;
        featureRow.appendChild(toggleLabel);

        if (isOverridden) {
          featureRow.classList.add("overridden-feature");
        }

        featureToggle.appendChild(featureRow);
        this.currentSiteFeatures.appendChild(featureToggle);
      }
    } catch (error) {
      console.error("Error loading current site features:", error);
      this.currentSiteFeatures.innerHTML =
        "<div class='feature-toggle'>Error loading features.</div>";
    }
  }

  /**
   * Checks if a site name matches the current website.
   */
  isCurrentSite(siteName) {
    if (!this.normalizedCurrentSiteHostname) return false;

    const normalizedSiteName = normalizeHostname(siteName);

    if (this.normalizedCurrentSiteHostname === normalizedSiteName) {
      return true;
    }

    if (siteName.startsWith("+")) {
      const baseSiteName = siteName.slice(1);
      const normalizedBaseSiteName = normalizeHostname(baseSiteName);

      return (
        this.normalizedCurrentSiteHostname === normalizedBaseSiteName ||
        this.normalizedCurrentSiteHostname.endsWith(
          `.${normalizedBaseSiteName}`
        )
      );
    }

    if (siteName.startsWith("-")) {
      const baseSiteName = siteName.slice(1);
      const cachedDomain = baseSiteName.split(".").slice(0, -1).join(".");
      const hostParts = this.normalizedCurrentSiteHostname.split(".");
      const hostDomain =
        hostParts.length > 1
          ? hostParts.slice(0, -1).join(".")
          : this.normalizedCurrentSiteHostname;

      return !!(cachedDomain && hostDomain && hostDomain === cachedDomain);
    }

    return false;
  }

  /**
   * Triggers a manual refresh of all styles.
   */
  async refetchCSS() {
    this.refetchCSSButton.textContent = "Fetching...";
    try {
      const DEFAULT_REPOSITORY_URL =
        "https://sameerasw.github.io/my-internet/styles.json";
      const repoUrlData = await browser.storage.local.get(
        "stylesRepositoryUrl"
      );
      const repositoryUrl =
        repoUrlData.stylesRepositoryUrl || DEFAULT_REPOSITORY_URL;

      const response = await fetch(repositoryUrl, {
        headers: {
          "Cache-Control": "no-cache",
        },
      });
      if (!response.ok)
        throw new Error(`Failed to fetch styles (Status: ${response.status})`);
      const styles = await response.json();

      const hasNewMappings = styles.mapping && Object.keys(styles.mapping).length > 0;

      let mappingData;
      if (hasNewMappings) {
        mappingData = { mapping: styles.mapping };
      } else {
        const existingData = await browser.storage.local.get(STYLES_MAPPING_KEY);
        mappingData = existingData[STYLES_MAPPING_KEY] || { mapping: {} };
      }

      await browser.storage.local.set({
        styles,
        [STYLES_MAPPING_KEY]: mappingData
      });

      const settingsData = await browser.storage.local.get(
        this.BROWSER_STORAGE_KEY
      );
      if (!settingsData[this.BROWSER_STORAGE_KEY]) {
        const defaultSettings = {
          enableStyling: true,
          autoUpdate: true,
          forceStyling: false,
          whitelistMode: false,
          whitelistStyleMode: false,
          lastFetchedTime: Date.now(),
        };

        await browser.storage.local.set({
          [this.BROWSER_STORAGE_KEY]: defaultSettings,
        });

        this.globalSettings = defaultSettings;

        this.enableStylingSwitch.checked = true;
        this.autoUpdateSwitch.checked = false;
        this.forceStylingSwitch.checked = false;
        this.whitelistModeSwitch.checked = false;
        this.whitelistStylingModeSwitch.checked = false;

        this.updateModeLabels();
      } else {
        const currentSettings = settingsData[this.BROWSER_STORAGE_KEY];
        currentSettings.lastFetchedTime = Date.now();
        await browser.storage.local.set({
          [this.BROWSER_STORAGE_KEY]: currentSettings,
        });
        this.globalSettings.lastFetchedTime = Date.now();
      }

      this.loadCurrentSiteFeatures();
      this.updateActiveTabStyling();

      this.refetchCSSButton.textContent = "Done!";
      setTimeout(() => {
        this.refetchCSSButton.textContent = "Refetch latest styles";
      }, 2000);
      this.displayLastFetchedTime();
    } catch (error) {
      this.refetchCSSButton.textContent = "Error!";
      setTimeout(() => {
        this.refetchCSSButton.textContent = "Refetch latest styles";
      }, 2000);
      alert(`Error fetching styles: ${error.message}`);
    }
  }

  /**
   * Re-evaluates styling for the currently active tab.
   */
  async updateActiveTabStyling() {
    const tabs = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (tabs.length > 0) {
      this.applyCSSToTab(tabs[0]);
    }
  }

  /**
   * Applies CSS to the specified tab using messaging.
   */
  async applyCSSToTab(tab) {
    const url = new URL(tab.url);
    const hostname = url.hostname;
    const normalizedHostname = normalizeHostname(hostname);

    const sendStyles = async (css) => {
      try {
        await browser.tabs.sendMessage(tab.id, { action: "applyStyles", css });
      } catch (e) {}
    };

    const removeStyles = async () => {
      try {
        await browser.tabs.sendMessage(tab.id, { action: "removeStyles" });
      } catch (e) {}
    };

    try {
      if (!this.shouldApplyCSS(hostname)) {
        await removeStyles();
        return;
      }

      const stylesData = await browser.storage.local.get("styles");
      const styles = stylesData.styles?.website || {};

      let bestMatch = null;
      let bestMatchLength = 0;

      for (const site of Object.keys(styles)) {
        const siteName = site.replace(/\.css$/, "");
        const normalizedSiteName = normalizeHostname(siteName);

        if (normalizedHostname === normalizedSiteName) {
          bestMatch = site;
          break;
        }

        if (siteName.startsWith("+")) {
          const baseSiteName = siteName.slice(1);
          const normalizedBaseSiteName = normalizeHostname(baseSiteName);
          if (
            (normalizedHostname === normalizedBaseSiteName ||
              normalizedHostname.endsWith(`.${normalizedBaseSiteName}`)) &&
            normalizedBaseSiteName.length > bestMatchLength
          ) {
            bestMatch = site;
            bestMatchLength = normalizedBaseSiteName.length;
          }
        }
        else if (siteName.startsWith("-")) {
          const baseSiteName = siteName.slice(1);
          const cachedDomain = baseSiteName.split(".").slice(0, -1).join(".");
          const hostParts = hostname.split(".");
          const hostDomain =
            hostParts.length > 1 ? hostParts.slice(0, -1).join(".") : hostname;

          if (cachedDomain && hostDomain && hostDomain === cachedDomain) {
            if (cachedDomain.length > bestMatchLength) {
              bestMatch = site;
              bestMatchLength = cachedDomain.length;
            }
          }
        }
        else if (
          normalizedHostname !== normalizedSiteName &&
          normalizedHostname.endsWith(`.${normalizedSiteName}`) &&
          normalizedSiteName.length > bestMatchLength
        ) {
          bestMatch = site;
          bestMatchLength = normalizedSiteName.length;
        }
      }

      if (bestMatch) {
        const features = styles[bestMatch];
        const normalizedSiteStorageKey = `${this.BROWSER_STORAGE_KEY}.${normalizedHostname}`;
        const siteData = await browser.storage.local.get(normalizedSiteStorageKey);
        const featureSettings = siteData[normalizedSiteStorageKey] || {};

        let combinedCSS = "";
        for (const [feature, css] of Object.entries(features)) {
          if (featureSettings[feature] !== false) {
            combinedCSS += css + "\n";
          }
        }

        if (combinedCSS.trim()) {
          await sendStyles(combinedCSS);
        } else {
          await removeStyles();
        }
        return;
      }

      const mappingData = await browser.storage.local.get(STYLES_MAPPING_KEY);
      const userMappingData = await browser.storage.local.get(USER_STYLES_MAPPING_KEY);
      const mergedMapping = { ...(mappingData[STYLES_MAPPING_KEY]?.mapping || {}) };
      if (userMappingData[USER_STYLES_MAPPING_KEY]?.mapping) {
        for (const [src, targets] of Object.entries(userMappingData[USER_STYLES_MAPPING_KEY].mapping)) {
          if (!mergedMapping[src]) mergedMapping[src] = [];
          for (const t of targets) {
            if (!mergedMapping[src].includes(t)) mergedMapping[src].push(t);
          }
        }
      }
      for (const [sourceStyle, targetSites] of Object.entries(mergedMapping)) {
        if (targetSites.includes(normalizedHostname)) {
          if (styles[sourceStyle]) {
            const features = styles[sourceStyle];
            const normalizedSiteStorageKey = `${this.BROWSER_STORAGE_KEY}.${normalizedHostname}`;
            const siteData = await browser.storage.local.get(normalizedSiteStorageKey);
            const featureSettings = siteData[normalizedSiteStorageKey] || {};

            let combinedCSS = "";
            for (const [feature, css] of Object.entries(features)) {
              if (featureSettings[feature] !== false) {
                combinedCSS += css + "\n";
              }
            }

            if (combinedCSS.trim()) {
              await sendStyles(combinedCSS);
            } else {
              await removeStyles();
            }
            return;
          }
          break;
        }
      }

      if (this.globalSettings.forceStyling) {
        const isInList = this.skipForceThemingList.includes(hostname);
        const isWhitelistMode = this.globalSettings.whitelistMode;
        const shouldApplyForcedStyling =
          (isWhitelistMode && isInList) || (!isWhitelistMode && !isInList);

        if (shouldApplyForcedStyling && styles["example.com.css"]) {
          const features = styles["example.com.css"];
          const siteStorageKey = `${this.BROWSER_STORAGE_KEY}.${hostname}`;
          const siteData = await browser.storage.local.get(siteStorageKey);
          const featureSettings = siteData[siteStorageKey] || {};

          let combinedCSS = "";
          for (const [feature, css] of Object.entries(features)) {
            if (featureSettings[feature] !== false) {
              combinedCSS += css + "\n";
            }
          }

          if (combinedCSS.trim()) {
            await sendStyles(combinedCSS);
          } else {
            await removeStyles();
          }
        } else {
          await removeStyles();
        }
      } else {
        await removeStyles();
      }
    } catch (error) {
      console.error(`Error applying CSS to ${hostname}:`, error);
    }
  }

  /**
   * Returns whether styling is currently enabled globally.
   */
  shouldApplyCSS(hostname) {
    return this.globalSettings.enableStyling !== false;
  }

  /**
   * Displays the current version of the extension.
   */
  async displayAddonVersion() {
    const manifest = browser.runtime.getManifest();
    $("addon-version").textContent = `v${manifest.version}`;
  }

  /**
   * Toggles the automatic update background process.
   */
  setupAutoUpdate() {
    if (this.autoUpdateSwitch.checked) {
      browser.runtime.sendMessage({ action: "enableAutoUpdate" });
    } else {
      browser.runtime.sendMessage({ action: "disableAutoUpdate" });
    }
  }

  /**
   * Displays the time the styles were last successfully fetched.
   */
  displayLastFetchedTime() {
    browser.storage.local.get(this.BROWSER_STORAGE_KEY).then((result) => {
      const settings = result[this.BROWSER_STORAGE_KEY] || {};
      if (settings.lastFetchedTime) {
        $("last-fetched-time").textContent = `Last fetched: ${new Date(
          settings.lastFetchedTime
        ).toLocaleString()}`;
      } else {
        $("last-fetched-time").textContent = "Last fetched: Never";
      }
    });
  }

  /**
   * Reloads the currently active tab.
   */
  reloadPage() {
    browser.tabs.reload();
  }

  /**
   * Handles middle-click on the refetch button to clear all settings.
   */
  handleMiddleClick(event) {
    if (event.button === 1) {
      if (confirm("Are you sure you want to clear all settings?")) {
        browser.storage.local.clear().then(() => {
          location.reload();
        });
      }
    }
  }

  /**
   * Updates settings and UI when blacklist/whitelist mode changes.
   */
  handleWhitelistModeChange() {
    this.updateModeLabels();
    this.saveSettings();
  }

  /**
   * Updates settings and UI when styling specific mode changes.
   */
  handleWhitelistStyleModeChange() {
    this.updateModeLabels();
    this.saveSettings();
  }

  /**
   * Updates the visual indicator for current filtering mode.
   */
  updateModeIndicator() {
    if (this.whitelistModeSwitch.checked) {
      this.modeIndicator.textContent =
        "In Whitelist Mode (apply only to listed sites)";
    } else {
      this.modeIndicator.textContent =
        "In Blacklist Mode (apply to all except listed sites)";
    }
  }

  /**
   * Updates the UI toggle label based on current mode.
   */
  updateSiteToggleLabel() {
    if (this.whitelistModeSwitch.checked) {
      this.siteToggleLabel.textContent = "Enable for this Site";
    } else {
      this.siteToggleLabel.textContent = "Skip Forcing for this Site";
    }
  }

  /**
   * Updates all mode-related labels in the UI.
   */
  updateModeLabels() {
    if (this.whitelistModeSwitch.checked) {
      this.whitelistModeLabel.textContent = "Forced Whitelist Mode";
      this.siteToggleLabel.textContent = "Enable forcing for this Site";
    } else {
      this.whitelistModeLabel.textContent = "Forced Blacklist Mode";
      this.siteToggleLabel.textContent = "Skip forcing for this Site";
    }

    if (this.whitelistStylingModeSwitch.checked) {
      this.whitelistStylingModeLabel.textContent = "Whitelist Mode";
      this.siteStyleToggleLabel.textContent = "Enable for this Site";
    } else {
      this.whitelistStylingModeLabel.textContent = "Blacklist Mode";
      this.siteStyleToggleLabel.textContent = "Skip Styling for this Site";
    }
  }

  /**
   * Opens the extension's version history page.
   */
  openWhatsNew() {
    browser.tabs.create({
      url: "https://addons.mozilla.org/en-US/firefox/addon/zen-internet/versions/",
    });
  }

  /**
   * Opens the extension's usage guide.
   */
  openHowToUse() {
    browser.tabs.create({
      url: "https://www.sameerasw.com/zen",
    });
  }

  /**
   * Expands or collapses the feature settings section.
   */
  toggleFeatures() {
    const featuresList = $("current-site-toggles");
    const actionsContainer = $("current-site-actions");
    const toggleButton = $("toggle-features");

    featuresList.classList.toggle("collapsed");
    if (actionsContainer) {
      actionsContainer.classList.toggle(
        "collapsed",
        featuresList.classList.contains("collapsed")
      );
    }
    
    if (toggleButton) {
      toggleButton.classList.toggle("active", !featuresList.classList.contains("collapsed"));
    }

    if (!featuresList.classList.contains("collapsed")) {
      setTimeout(() => {
        featuresList.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 300);
    }
  }

  /**
   * Expands or collapses the forcing settings section.
   */
  toggleForcing() {
    const forcingContent = $("forcing-content");
    const toggleButton = $("toggle-forcing");
    forcingContent.classList.toggle("collapsed");
    
    if (toggleButton) {
      toggleButton.classList.toggle("active", !forcingContent.classList.contains("collapsed"));
    }
    
    if (!forcingContent.classList.contains("collapsed")) {
      setTimeout(() => {
        forcingContent.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 300);
    }
  }

  /**
   * Expands or collapses the FAQ section.
   */
  toggleFAQ() {
    const faqContent = $("faq-content");
    const toggleButton = $("toggle-faq");
    faqContent.classList.toggle("collapsed");
    
    if (toggleButton) {
      toggleButton.classList.toggle("active", !faqContent.classList.contains("collapsed"));
    }

    if (!faqContent.classList.contains("collapsed")) {
      setTimeout(() => {
        faqContent.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 300);
    }
  }

  toggleDeveloper() {
    const devContent = $("developer-content");
    const toggleButton = $("toggle-developer");
    if (!devContent) return;

    devContent.classList.toggle("collapsed");
    
    if (toggleButton) {
      toggleButton.classList.toggle("active", !devContent.classList.contains("collapsed"));
    }

    if (!devContent.classList.contains("collapsed")) {
      setTimeout(() => {
        devContent.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 300);
    }
  }

  /**
   * Handles individual FAQ question expansion.
   */
  handleFAQClick(event) {
    const faqItem = event.target.closest(".faq-item");
    if (!faqItem) return;

    const question = faqItem.querySelector(".faq-question");
    const answer = faqItem.querySelector(".faq-answer");

    if (!question || !answer) return;

    const isCurrentlyActive = question.classList.contains("active");

    document.querySelectorAll(".faq-question").forEach((q) => {
      q.classList.remove("active");
      const a = q.nextElementSibling;
      if (a) a.classList.remove("active");
    });

    if (!isCurrentlyActive) {
      question.classList.add("active");
      answer.classList.add("active");
    }
  }

  /**
   * Displays the bug report selection overlay.
   */
  showBugReportOverlay() {
    const overlay = $("bug-report-overlay");
    overlay.classList.remove("hidden");

    document.querySelectorAll(".bug-option").forEach((option) => {
      option.classList.remove("selected");
    });

    const submitBtn = $("submit-bug-report");
    submitBtn.disabled = true;

    document.querySelectorAll(".bug-option").forEach((option) => {
      option.addEventListener("click", () => {
        document.querySelectorAll(".bug-option").forEach((opt) => {
          opt.classList.remove("selected");
        });
        option.classList.add("selected");
        submitBtn.disabled = false;
      });
    });

    document
      .getElementById("cancel-bug-report")
      .addEventListener("click", () => {
        this.hideBugReportOverlay();
      });

    submitBtn.addEventListener("click", () => {
      this.submitBugReport();
    });

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        this.hideBugReportOverlay();
      }
    });
  }

  /**
   * Hides the bug report overlay.
   */
  hideBugReportOverlay() {
    const overlay = $("bug-report-overlay");
    overlay.classList.add("hidden");
  }

  /**
   * Gathers extension state and redirects to GitHub for bug reporting.
   */
  async submitBugReport() {
    const selectedOption = document.querySelector(".bug-option.selected");
    if (!selectedOption) return;

    const bugType = selectedOption.getAttribute("data-type");
    const submitBtn = $("submit-bug-report");

    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';
    submitBtn.disabled = true;

    try {
      const bugData = await this.collectDataForBugType(bugType);
      const repoInfo = this.getRepositoryForBugType(bugType);
      const issueBody = this.createBugReportBodyForType(bugType, bugData);

      let issueUrl = `https://github.com/${repoInfo.owner}/${repoInfo.repo}/issues/new`;
      if (repoInfo.template) {
        issueUrl += `?template=${repoInfo.template}.md`;
      }

      const urlParams = new URLSearchParams();
      urlParams.append("title", repoInfo.title);
      urlParams.append("body", issueBody);

      const separator = repoInfo.template ? "&" : "?";
      issueUrl += separator + urlParams.toString();

      browser.tabs.create({ url: issueUrl });
      this.hideBugReportOverlay();
    } catch (error) {
      console.error("Error submitting bug report:", error);
      alert("Failed to create bug report. Please try again.");
    } finally {
      submitBtn.innerHTML = originalText;
      submitBtn.disabled = false;
    }
  }

  /**
   * Returns repository metadata based on bug report category.
   */
  getRepositoryForBugType(bugType) {
    const repos = {
      1: {
        owner: "sameerasw",
        repo: "my-internet",
        title: "[BUG] Website Theme Issue",
        template: "bug_report",
      },
      2: {
        owner: "sameerasw",
        repo: "zeninternet",
        title: "[BUG] Extension Issue",
        template: "bug_report",
      },
      3: {
        owner: "sameerasw",
        repo: "my-internet",
        title: "[TRANSPARENCY] Browser Transparency Issue",
        template: "bug_report",
      },
      4: {
        owner: "sameerasw",
        repo: "zeninternet",
        title: "[FEATURE] Feature Request",
        template: "bug_report",
      },
      5: {
        owner: "sameerasw",
        repo: "my-internet",
        title: "[OTHER] General Issue",
      },
    };

    return repos[bugType] || repos["5"];
  }

  /**
   * Collects settings and environment details for troubleshooting.
   */
  async collectDataForBugType(bugType) {
    try {
      const allData = await browser.storage.local.get(null);
      const manifest = browser.runtime.getManifest();
      const tabs = await browser.tabs.query({
        active: true,
        currentWindow: true,
      });
      const currentTab = tabs[0];

      const baseData = {
        reportDate: new Date().toISOString(),
        addonVersion: manifest.version,
        currentTabUrl: currentTab ? currentTab.url : "N/A",
        currentTabHostname: currentTab
          ? new URL(currentTab.url).hostname
          : "N/A",
        browserInfo: {
          userAgent: navigator.userAgent,
          platform: navigator.platform,
        },
      };

      const globalSettings = allData[this.BROWSER_STORAGE_KEY] || {};
      const skipForceList = allData[SKIP_FORCE_THEMING_KEY] || [];
      const skipThemingList = allData[SKIP_THEMING_KEY] || [];
      const fallbackBackgroundList = allData[FALLBACK_BACKGROUND_KEY] || [];

      switch (bugType) {
        case "1":
          const currentHostname = currentTab
            ? normalizeHostname(new URL(currentTab.url).hostname)
            : null;
          const siteSettings = currentHostname
            ? allData[`${this.BROWSER_STORAGE_KEY}.${currentHostname}`] || {}
            : {};

          return {
            ...baseData,
            settings: {
              globalSettings,
              skipForceList,
              skipThemingList,
              fallbackBackgroundList,
              currentSiteSettings: siteSettings,
            },
          };

        case "2":
        case "3":
        case "5":
          return {
            ...baseData,
            settings: {
              globalSettings,
              skipForceList,
              skipThemingList,
              fallbackBackgroundList,
            },
          };

        case "4":
          return baseData;

        default:
          return baseData;
      }
    } catch (error) {
      return { error: "Failed to collect data: " + error.message };
    }
  }

  /**
   * Generates markdown body for GitHub bug reports.
   */
  createBugReportBodyForType(bugType, data) {
    const typeDescriptions = {
      1: "Website Theme Issue",
      2: "Extension Issue",
      3: "Browser Transparency Issue",
      4: "Feature Request",
      5: "Other Issue",
    };

    const description = typeDescriptions[bugType] || "General Issue";
    const currentUrl =
      data.currentTabUrl && data.currentTabUrl !== "N/A"
        ? data.currentTabUrl
        : "";

    let body = `## Describe the ${
      bugType === "4" ? "feature request" : "bug"
    }\n`;
    body += `<!-- Please provide a clear description of ${
      bugType === "4"
        ? "the feature you'd like to see"
        : "the issue you're experiencing"
    } -->\n\n`;

    if (bugType !== "4") {
      body += `## Steps to reproduce\n`;
      body += `Steps to reproduce the behavior:\n1. \n2. \n3. \n\n`;

      body += `## Expected behavior\n`;
      body += `<!-- What you expected to happen -->\n\n`;

      body += `## Actual behavior\n`;
      body += `<!-- What actually happened -->\n\n`;
    } else {
      body += `## Feature Description\n`;
      body += `<!-- Describe the feature you'd like to see -->\n\n`;

      body += `## Use Case\n`;
      body += `<!-- Why would this feature be useful? -->\n\n`;
    }

    if (data.settings && bugType !== "4") {
      body += `## ZenInternet Settings Data\n`;
      body += `*This data was automatically collected to help with debugging.*\n\n`;
      body += `<details>\n<summary>Click to expand settings data</summary>\n\n`;
      body += `\`\`\`json\n${JSON.stringify(
        data,
        null,
        2
      )}\n\`\`\`\n\n</details>\n\n`;
    }

    body += `## Browser Information\n`;
    body += `- **Zen Browser Version:** <!-- Please specify your Zen browser version -->\n`;
    body += `- **Platform:** ${
      data.browserInfo?.platform || "<!-- Your OS -->"
    }\n`;
    body += `- **Extension Version:** ${data.addonVersion}\n\n`;

    if (currentUrl && bugType === "1") {
      body += `## Website\n`;
      body += `Current website: ${currentUrl}\n\n`;
    }

    body += `## Additional context\n`;
    body += `<!-- Add any other relevant information here -->\n`;

    return body;
  }

  /**
   * Legacy data collection method for backups.
   */
  async collectBugReportData() {
    try {
      const allData = await browser.storage.local.get(null);
      const manifest = browser.runtime.getManifest();
      const tabs = await browser.tabs.query({
        active: true,
        currentWindow: true,
      });
      const currentTab = tabs[0];
      const fallbackBackgroundList = allData[FALLBACK_BACKGROUND_KEY] || [];

      const settingsToInclude = {
        [this.BROWSER_STORAGE_KEY]: allData[this.BROWSER_STORAGE_KEY] || {},
        [SKIP_FORCE_THEMING_KEY]: allData[SKIP_FORCE_THEMING_KEY] || [],
        [SKIP_THEMING_KEY]: allData[SKIP_THEMING_KEY] || [],
        [FALLBACK_BACKGROUND_KEY]: fallbackBackgroundList,
        stylesRepositoryUrl:
          allData.stylesRepositoryUrl ||
          "https://sameerasw.github.io/my-internet/styles.json",
      };

      if (settingsToInclude[this.BROWSER_STORAGE_KEY].fallbackBackgroundList) {
        delete settingsToInclude[this.BROWSER_STORAGE_KEY]
          .fallbackBackgroundList;
      }

      const stylesData = allData.styles || {};
      const websiteStylesCount = Object.keys(stylesData.website || {}).length;

      let siteSettingsCount = 0;
      for (const key of Object.keys(allData)) {
        if (key.startsWith(this.BROWSER_STORAGE_KEY + ".")) {
          siteSettingsCount++;
        }
      }

      return {
        reportDate: new Date().toISOString(),
        addonVersion: manifest.version,
        currentTabUrl: currentTab ? currentTab.url : "N/A",
        currentTabHostname: currentTab
          ? new URL(currentTab.url).hostname
          : "N/A",
        browserInfo: {
          userAgent: navigator.userAgent,
          platform: navigator.platform,
        },
        extensionData: {
          settings: settingsToInclude,
          siteSettingsCount: siteSettingsCount,
          stylesCount: websiteStylesCount,
          hasStyles: websiteStylesCount > 0,
        },
      };
    } catch (error) {
      const manifest = browser.runtime.getManifest();
      return {
        reportDate: new Date().toISOString(),
        addonVersion: manifest.version,
        error: "Failed to collect full data: " + error.message,
      };
    }
  }

  /**
   * Checks whether the welcome screen should be displayed.
   */
  async checkWelcomeScreen() {
    try {
      const shouldShow = await window.checkAndShowWelcome();

      if (shouldShow) {
        const container = document.querySelector(".container");
        if (container) {
          container.style.opacity = "0.3";
          container.style.pointerEvents = "none";
        }

        const checkWelcomeComplete = setInterval(() => {
          const welcomeOverlay = $("welcome-overlay");
          if (!welcomeOverlay || welcomeOverlay.classList.contains("hidden")) {
            clearInterval(checkWelcomeComplete);
            if (container) {
              container.style.opacity = "1";
              container.style.pointerEvents = "auto";
            }
            this.loadSettings().then(() => {
              this.restoreSettings();
              this.updateModeLabels();
              this.updateModeIndicator();
            });
          }
        }, 100);
      }
    } catch (error) {}
  }
})();

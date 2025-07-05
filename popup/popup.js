let logging = false;
let SKIP_FORCE_THEMING_KEY = "skipForceThemingList";
let SKIP_THEMING_KEY = "skipThemingList";
let FALLBACK_BACKGROUND_KEY = "fallbackBackgroundList";

// Default settings to use when values are missing
const DEFAULT_SETTINGS = {
  enableStyling: true, // Enable styling globally
  autoUpdate: true, // Auto-update styles
  forceStyling: false, // Force styling on sites without themes
  whitelistMode: false, // Use blacklist mode by default for force styling
  whitelistStyleMode: false, // Use blacklist mode by default for regular styling
  disableTransparency: false, // Don't disable transparency by default
  disableHover: false, // Don't disable hover effects by default
  disableFooter: false, // Don't disable footers by default
  fallbackBackgroundList: [], // Empty array for fallback background sites
};

// Helper function to ensure all required settings exist
function ensureDefaultSettings(settings = {}) {
  const result = { ...settings };

  // Apply default values for any missing settings
  for (const [key, defaultValue] of Object.entries(DEFAULT_SETTINGS)) {
    if (result[key] === undefined) {
      result[key] = defaultValue;
    }
  }

  return result;
}

// Helper function to normalize hostnames by removing www. prefix
function normalizeHostname(hostname) {
  return hostname.startsWith("www.") ? hostname.substring(4) : hostname;
}

new (class ExtensionPopup {
  BROWSER_STORAGE_KEY = "transparentZenSettings";
  globalSettings = {};
  siteSettings = {};
  enableStylingSwitch = document.getElementById("enable-styling");
  whitelistStylingModeSwitch = document.getElementById("whitelist-style-mode");
  whitelistStylingModeLabel = document.getElementById(
    "whitelist-style-mode-label"
  );
  skipThemingSwitch = document.getElementById("skip-theming");
  siteStyleToggleLabel = document.getElementById("site-style-toggle-label");
  skipThemingList = [];
  refetchCSSButton = document.getElementById("refetch-css");
  websitesList = document.getElementById("websites-list");
  currentSiteFeatures = document.getElementById("current-site-toggles");
  currentSiteHostname = "";
  normalizedCurrentSiteHostname = "";
  autoUpdateSwitch = document.getElementById("auto-update");
  lastFetchedTime = document.getElementById("last-fetched-time");
  forceStylingSwitch = document.getElementById("force-styling");
  whitelistModeSwitch = document.getElementById("whitelist-mode");
  whitelistModeLabel = document.getElementById("whitelist-mode-label");
  skipForceThemingSwitch = document.getElementById("skip-force-theming");
  siteToggleLabel = document.getElementById("site-toggle-label");
  skipForceThemingList = [];
  reloadButton = document.getElementById("reload");
  modeIndicator = document.getElementById("mode-indicator");
  whatsNewButton = document.getElementById("whats-new");
  howToUseButton = document.getElementById("how-to-use");
  fallbackBackgroundSwitch = document.getElementById("fallback-background");
  fallbackBackgroundList = [];

  constructor() {
    if (logging) console.log("Initializing ExtensionPopup");
    // Load settings and initialize the popup
    this.loadSettings().then(() => {
      this.loadSkipForceThemingList().then(() => {
        this.loadSkipThemingList().then(() => {
          this.loadFallbackBackgroundList().then(() => {
            this.getCurrentTabInfo().then(() => {
              this.restoreSettings();
              this.bindEvents();
              this.initializeThemeRequestOverlay(); // Add this line
            });
          });
        });
      });
    });

    // Check and show welcome screen for first-time users
    this.checkWelcomeScreen();

    // Bind event listeners
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

    // Add toggle features button event listener
    document
      .getElementById("toggle-features")
      ?.addEventListener("click", this.toggleFeatures.bind(this));

    // Add toggle forcing button event listener
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

    // Add event listener for the "What's New" button
    this.whatsNewButton.addEventListener("click", this.openWhatsNew.bind(this));

    // Add event listener for the "How to use?" button
    this.howToUseButton.addEventListener("click", this.openHowToUse.bind(this));

    // Add event listener for the data viewer button
    document.getElementById("view-data")?.addEventListener("click", () => {
      browser.tabs.create({
        url: browser.runtime.getURL("data-viewer/data-viewer.html"),
      });
    });

    // Add event listener for bug report
    document
      .getElementById("bug-report-link")
      ?.addEventListener("click", (e) => {
        e.preventDefault();
        this.showBugReportOverlay();
      });

    // Setup auto-update and display last fetched time
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
  }

  async getCurrentTabInfo() {
    if (logging) console.log("getCurrentTabInfo called");
    try {
      const tabs = await browser.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (tabs.length > 0) {
        const url = new URL(tabs[0].url);
        this.currentSiteHostname = url.hostname;
        // Store normalized hostname
        this.normalizedCurrentSiteHostname = normalizeHostname(
          this.currentSiteHostname
        );
        console.info(
          "Current site hostname:",
          this.currentSiteHostname,
          "(normalized:",
          this.normalizedCurrentSiteHostname,
          ")"
        );

        // Update the site label with current hostname (without www.)
        const siteDomainElement = document.getElementById("site-domain");
        if (siteDomainElement) {
          const displayDomain = normalizeHostname(this.currentSiteHostname);
          siteDomainElement.textContent = displayDomain;
          siteDomainElement.title = displayDomain; // Add full domain as tooltip for long domains
        }
      }
    } catch (error) {
      console.error("Error getting current tab info:", error);
    }
  }

  bindEvents() {
    if (logging) console.log("bindEvents called");
    // Bind event listeners for settings changes
    this.enableStylingSwitch.addEventListener("change", () => {
      this.saveSettings();
      this.updateActiveTabStyling();
    });

    this.currentSiteFeatures.addEventListener("change", (event) => {
      if (event.target.type === "checkbox") {
        this.saveSettings();
        this.updateActiveTabStyling();
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

    // Add FAQ event listeners
    document
      .getElementById("toggle-faq")
      ?.addEventListener("click", this.toggleFAQ.bind(this));

    // Add event delegation for FAQ items
    document
      .getElementById("faq-content")
      ?.addEventListener("click", this.handleFAQClick.bind(this));
  }

  restoreSettings() {
    if (logging) console.log("restoreSettings called");
    // Restore global settings
    this.enableStylingSwitch.checked =
      this.globalSettings.enableStyling ?? true;
    this.autoUpdateSwitch.checked = this.globalSettings.autoUpdate ?? false;
    this.forceStylingSwitch.checked = this.globalSettings.forceStyling ?? false;
    this.whitelistModeSwitch.checked =
      this.globalSettings.whitelistMode ?? false;
    this.whitelistStylingModeSwitch.checked =
      this.globalSettings.whitelistStyleMode ?? false;

    this.updateModeLabels();

    // In whitelist mode, checked means "include this site"
    // In blacklist mode, checked means "skip this site"
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

  async loadSettings() {
    if (logging) console.log("loadSettings called");
    // Load global settings
    const globalData = await browser.storage.local.get(
      this.BROWSER_STORAGE_KEY
    );

    // Apply defaults for any missing settings
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
      if (logging) console.log("Applied missing default settings");
    }

    // Load site-specific settings if on a specific site
    if (this.currentSiteHostname) {
      // Try both normalized and original hostnames for backwards compatibility
      const normalizedSiteKey = `${this.BROWSER_STORAGE_KEY}.${this.normalizedCurrentSiteHostname}`;
      const originalSiteKey = `${this.BROWSER_STORAGE_KEY}.${this.currentSiteHostname}`;

      const normalizedData = await browser.storage.local.get(normalizedSiteKey);
      const originalData = await browser.storage.local.get(originalSiteKey);

      this.siteSettings =
        normalizedData[normalizedSiteKey] ||
        originalData[originalSiteKey] ||
        {};

      // Make sure we always save to the normalized key going forward
      if (!normalizedData[normalizedSiteKey] && originalData[originalSiteKey]) {
        // Migrate settings from original to normalized key
        await browser.storage.local.set({
          [normalizedSiteKey]: this.siteSettings,
        });
        if (logging)
          console.log(
            "Migrated settings to normalized key:",
            normalizedSiteKey
          );
      }

      await this.loadCurrentSiteFeatures();
    }
  }

  saveSettings() {
    if (logging) console.log("saveSettings called");
    // Save global settings
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
        if (logging) console.log("Global settings saved");
        this.updateActiveTabStyling();
      });

    // Save site-specific settings
    if (this.currentSiteHostname) {
      // UPDATED: Always save site settings using the normalized hostname
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
          if (logging)
            console.log("Site settings saved to normalized key:", siteKey);
          this.updateActiveTabStyling();
        });
    }

    console.info("Settings saved", {
      global: this.globalSettings,
      site: this.siteSettings,
    });
  }

  async loadSkipForceThemingList() {
    const data = await browser.storage.local.get(SKIP_FORCE_THEMING_KEY);
    this.skipForceThemingList = data[SKIP_FORCE_THEMING_KEY] || [];

    // Initialize with empty array if missing
    if (!data[SKIP_FORCE_THEMING_KEY]) {
      await browser.storage.local.set({ [SKIP_FORCE_THEMING_KEY]: [] });
      if (logging) console.log("Initialized empty skip force theming list");
    }
  }

  async loadSkipThemingList() {
    const data = await browser.storage.local.get(SKIP_THEMING_KEY);
    this.skipThemingList = data[SKIP_THEMING_KEY] || [];

    // Initialize with empty array if missing
    if (!data[SKIP_THEMING_KEY]) {
      await browser.storage.local.set({ [SKIP_THEMING_KEY]: [] });
      if (logging) console.log("Initialized empty skip theming list");
    }
  }

  async loadFallbackBackgroundList() {
    const data = await browser.storage.local.get(FALLBACK_BACKGROUND_KEY);
    this.fallbackBackgroundList = data[FALLBACK_BACKGROUND_KEY] || [];

    // Initialize with empty array if missing
    if (!data[FALLBACK_BACKGROUND_KEY]) {
      await browser.storage.local.set({ [FALLBACK_BACKGROUND_KEY]: [] });
      if (logging) console.log("Initialized empty fallback background list");
    }
  }

  saveSkipForceThemingList() {
    const isChecked = this.skipForceThemingSwitch.checked;
    const index = this.skipForceThemingList.indexOf(
      normalizeHostname(this.currentSiteHostname)
    );

    if (isChecked && index === -1) {
      // Add to the list (whitelist: include, blacklist: skip)
      this.skipForceThemingList.push(
        normalizeHostname(this.currentSiteHostname)
      );
    } else if (!isChecked && index !== -1) {
      // Remove from the list (whitelist: exclude, blacklist: include)
      this.skipForceThemingList.splice(index, 1);
    }

    browser.storage.local
      .set({
        [SKIP_FORCE_THEMING_KEY]: this.skipForceThemingList,
      })
      .then(() => {
        this.updateActiveTabStyling();
      });
  }

  saveSkipThemingList() {
    const isChecked = this.skipThemingSwitch.checked;
    const index = this.skipThemingList.indexOf(
      normalizeHostname(this.currentSiteHostname)
    );

    if (isChecked && index === -1) {
      // Add to the list (whitelist: include, blacklist: skip)
      this.skipThemingList.push(normalizeHostname(this.currentSiteHostname));
    } else if (!isChecked && index !== -1) {
      // Remove from the list (whitelist: exclude, blacklist: include)
      this.skipThemingList.splice(index, 1);
    }

    browser.storage.local
      .set({
        [SKIP_THEMING_KEY]: this.skipThemingList,
      })
      .then(() => {
        this.updateActiveTabStyling();
      });
  }

  saveFallbackBackgroundList() {
    const isChecked = this.fallbackBackgroundSwitch.checked;
    const index = this.fallbackBackgroundList.indexOf(
      normalizeHostname(this.currentSiteHostname)
    );

    if (isChecked && index === -1) {
      // Add to the list
      this.fallbackBackgroundList.push(
        normalizeHostname(this.currentSiteHostname)
      );
    } else if (!isChecked && index !== -1) {
      // Remove from the list
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

  initializeThemeRequestOverlay() {
    const overlay = document.getElementById("theme-request-overlay");
    const cancelBtn = document.getElementById("cancel-request");
    const submitBtn = document.getElementById("submit-request");
    const forcingToggle = document.getElementById("forcing-toggle");
    const accountToggle = document.getElementById("account-toggle");

    // Handle custom toggle clicks
    this.setupCustomToggle(forcingToggle);
    this.setupCustomToggle(accountToggle);

    // Handle cancel button
    cancelBtn.addEventListener("click", () => {
      this.hideThemeRequestOverlay();
    });

    // Handle submit button
    submitBtn.addEventListener("click", () => {
      this.submitThemeRequest();
    });

    // Close overlay when clicking outside
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        this.hideThemeRequestOverlay();
      }
    });
  }

  setupCustomToggle(toggleElement) {
    const options = toggleElement.querySelectorAll(".toggle-option");

    options.forEach((option) => {
      option.addEventListener("click", () => {
        // Remove active class from all options
        options.forEach((opt) => opt.classList.remove("active"));
        // Add active class to clicked option
        option.classList.add("active");
      });
    });
  }

  showThemeRequestOverlay() {
    const overlay = document.getElementById("theme-request-overlay");
    overlay.classList.remove("hidden");

    // Reset toggles to default states
    const forcingToggle = document.getElementById("forcing-toggle");
    const accountToggle = document.getElementById("account-toggle");

    // Reset forcing toggle to "Off" (middle position)
    forcingToggle
      .querySelectorAll(".toggle-option")
      .forEach((opt) => opt.classList.remove("active"));
    forcingToggle.querySelector('[data-value="off"]').classList.add("active");

    // Reset account toggle to "Unset" (middle position)
    accountToggle
      .querySelectorAll(".toggle-option")
      .forEach((opt) => opt.classList.remove("active"));
    accountToggle.querySelector('[data-value="unset"]').classList.add("active");
  }

  hideThemeRequestOverlay() {
    const overlay = document.getElementById("theme-request-overlay");
    overlay.classList.add("hidden");
  }

  getToggleValue(toggleId) {
    const toggle = document.getElementById(toggleId);
    const activeOption = toggle.querySelector(".toggle-option.active");
    return activeOption ? activeOption.getAttribute("data-value") : "unset";
  }

  async submitThemeRequest() {
    const forcingValue = this.getToggleValue("forcing-toggle");
    const accountValue = this.getToggleValue("account-toggle");

    // Show loading state
    const submitBtn = document.getElementById("submit-request");
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Checking...';
    submitBtn.disabled = true;

    try {
      // Check if issue already exists
      const existingIssue = await this.checkExistingIssue(
        this.currentSiteHostname
      );

      if (existingIssue) {
        // Show existing issue found screen
        this.showExistingIssueScreen(existingIssue, forcingValue, accountValue);
        return;
      }

      // No existing issue found, proceed with creation
      this.createNewIssue(forcingValue, accountValue);
    } catch (error) {
      console.warn(
        "Failed to check existing issues, proceeding anyway:",
        error
      );
      // If API check fails, proceed with creating the issue
      this.createNewIssue(forcingValue, accountValue);
    } finally {
      // Reset button state
      submitBtn.innerHTML = originalText;
      submitBtn.disabled = false;
    }
  }

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
        // Using anonymous requests to avoid token management
      },
    });

    if (!response.ok) {
      if (response.status === 403) {
        // Rate limit exceeded, proceed without checking
        console.warn(
          "GitHub API rate limit exceeded, skipping duplicate check"
        );
        return null;
      }
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const data = await response.json();

    // Look for issues that contain the hostname in the title
    const matchingIssues = data.items.filter(
      (issue) =>
        issue.title.toLowerCase().includes(hostname.toLowerCase()) ||
        issue.title.toLowerCase().includes("[theme]")
    );

    return matchingIssues.length > 0 ? matchingIssues[0] : null;
  }

  showExistingIssueScreen(existingIssue, forcingValue, accountValue) {
    const prompt = document.querySelector(".theme-request-prompt");

    // Store the original values for potential submission
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

    // Bind new event listeners
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

  createNewIssue(forcingValue, accountValue) {
    // Build the issue body with the responses
    let issueBody = `Please add a theme for ${this.currentSiteHostname}\n\n`;

    // Add forcing status
    if (forcingValue === "yes") {
      issueBody += "**Tried forcing:** YES\n";
    } else if (forcingValue === "no") {
      issueBody += "**Tried forcing:** NO\n";
    } else {
      issueBody += "**Tried forcing:** Not specified\n";
    }

    // Add account requirement status
    if (accountValue === "yes") {
      issueBody += "**Requires account:** YES\n";
    } else if (accountValue === "no") {
      issueBody += "**Requires account:** NO\n";
    } else {
      issueBody += "**Requires account:** Not specified\n";
    }

    issueBody +=
      "\n---\n\n*This request was generated automatically from the Zen Internet extension.*";

    // Create the GitHub issue URL
    const issueUrl = `https://github.com/sameerasw/my-internet/issues/new?template=website-theme-request.md&title=[THEME] ${
      this.currentSiteHostname
    }&body=${encodeURIComponent(issueBody)}`;

    // Open the URL and hide the overlay
    window.open(issueUrl, "_blank");
    this.hideThemeRequestOverlay();
  }

  truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  }

  async loadCurrentSiteFeatures() {
    if (logging) console.log("loadCurrentSiteFeatures called");
    try {
      const stylesData = await browser.storage.local.get("styles");
      const styles = stylesData.styles?.website || {};

      this.currentSiteFeatures.innerHTML = "";

      // Debug which hostname we're searching for
      console.log(
        "Looking for styles for:",
        this.normalizedCurrentSiteHostname,
        "(original:",
        this.currentSiteHostname,
        ")"
      );

      // Find any matching style for this site
      let currentSiteKey = Object.keys(styles).find((site) =>
        this.isCurrentSite(site.replace(".css", ""))
      );

      if (logging && currentSiteKey) {
        console.log("Found matching site key:", currentSiteKey);
      } else if (logging) {
        console.log("No matching site key found");
      }

      // Check if we have any styles at all, including example.com
      const hasExampleSite = "example.com.css" in styles;
      const hasNoStyles = Object.keys(styles).length === 0;

      // Only collapse if we found a specific theme for this site
      // Otherwise keep it expanded to show the request theme button
      const hasSpecificTheme =
        currentSiteKey && currentSiteKey !== "example.com.css";

      // Apply collapsed class based on whether we have a theme
      const featuresList = document.getElementById("current-site-toggles");
      const actionsContainer = document.getElementById("current-site-actions");

      if (hasSpecificTheme) {
        featuresList.classList.add("collapsed");
        if (actionsContainer) actionsContainer.classList.add("collapsed");

        // Hide the entire skip force theming toggle container when we have a specific theme
        const skipForceThemingContainer =
          this.skipForceThemingSwitch.closest(".toggle-container");
        if (skipForceThemingContainer) {
          skipForceThemingContainer.style.display = "none";
        }

        // show the skip theming toggle
        const skipThemingContainer =
          this.skipThemingSwitch.closest(".toggle-container");
        if (skipThemingContainer) {
          skipThemingContainer.style.display = "flex";
        }

        // Update the icon to show collapsed state
        const toggleButton = document.getElementById("toggle-features");
        if (toggleButton) {
          const icon = toggleButton.querySelector("i");
          if (icon) icon.className = "fas fa-chevron-down";
        }
      } else {
        // Show the skip force theming toggle container when no specific theme
        const skipForceThemingContainer =
          this.skipForceThemingSwitch.closest(".toggle-container");
        if (skipForceThemingContainer) {
          skipForceThemingContainer.style.display = "flex";
        }

        // hide the skip theming toggle
        const skipThemingContainer =
          this.skipThemingSwitch.closest(".toggle-container");
        if (skipThemingContainer) {
          skipThemingContainer.style.display = "none";
        }

        // Keep expanded when no theme was found or using default
        featuresList.classList.remove("collapsed");
        if (actionsContainer) actionsContainer.classList.remove("collapsed");

        // Update the icon to show expanded state
        const toggleButton = document.getElementById("toggle-features");
        if (toggleButton) {
          const icon = toggleButton.querySelector("i");
          if (icon) icon.className = "fas fa-chevron-up";
        }
      }

      // Set the forcing section's initial collapsed state
      const forcingContent = document.getElementById("forcing-content");
      const toggleForcingButton = document.getElementById("toggle-forcing");

      if (hasSpecificTheme) {
        // We have a specific theme, collapse the forcing section
        forcingContent.classList.add("collapsed");
        if (toggleForcingButton) {
          const icon = toggleForcingButton.querySelector("i");
          if (icon) icon.className = "fas fa-chevron-down";
        }
      } else {
        // No specific theme found, expand the forcing section
        forcingContent.classList.remove("collapsed");
        if (toggleForcingButton) {
          const icon = toggleForcingButton.querySelector("i");
          if (icon) icon.className = "fas fa-chevron-up";
        }
      }

      if (!currentSiteKey && this.globalSettings.forceStyling) {
        currentSiteKey = Object.keys(styles).find(
          (site) => site === "example.com.css"
        );
      }

      // Only show the request theme button if we have at least the example.com style
      // but no specific theme for this site
      if (
        (!currentSiteKey || currentSiteKey === "example.com.css") &&
        hasExampleSite
      ) {
        const requestThemeButton = document.createElement("button");
        requestThemeButton.className = "action-button primary";
        requestThemeButton.innerHTML = `Request Theme for ${this.currentSiteHostname}`;
        requestThemeButton.addEventListener("click", () => {
          this.showThemeRequestOverlay(); // Changed from direct URL opening
        });

        this.currentSiteFeatures.appendChild(requestThemeButton);
      } else if (hasNoStyles) {
        // No styles at all, suggest to fetch first
        const fetchFirstMessage = document.createElement("div");
        fetchFirstMessage.className = "toggle-container";
        fetchFirstMessage.innerHTML = `
          <div class="actions secondary">
            <span class="toggle-label warning">Please fetch styles first using the "Refetch latest styles" button</span>
          </div>
        `;
        this.currentSiteFeatures.appendChild(fetchFirstMessage);
      }

      if (!currentSiteKey) {
        return;
      }

      // Load site-specific settings before creating toggles
      // UPDATED: Use normalized hostname for consistent settings retrieval
      const siteKey = `${this.BROWSER_STORAGE_KEY}.${this.normalizedCurrentSiteHostname}`;
      const siteData = await browser.storage.local.get(siteKey);
      this.siteSettings = siteData[siteKey] || {};
      console.log("Loaded site settings from:", siteKey, this.siteSettings);

      const features = styles[currentSiteKey];

      if (currentSiteKey === "example.com.css") {
        const skipForceThemingToggle = document.createElement("div");
        skipForceThemingToggle.className = "toggle-container";
        skipForceThemingToggle.innerHTML = `
        <div class="actions secondary">
          <span class="toggle-label warning">No specific theme found for this website. Using default styling.</span>
        </div>
        `;

        this.currentSiteFeatures.appendChild(skipForceThemingToggle);
      }

      // Check if transparency is globally disabled
      const isTransparencyDisabled =
        this.globalSettings.disableTransparency === true;
      const isHoverDisabled = this.globalSettings.disableHover === true;
      const isFooterDisabled = this.globalSettings.disableFooter === true;

      for (const [feature, css] of Object.entries(features)) {
        const displayFeatureName = feature.includes("-")
          ? feature.split("-")[1]
          : feature;

        const isChecked = this.siteSettings[feature] ?? true;
        const isTransparencyFeature = feature
          .toLowerCase()
          .includes("transparency");
        const isHoverFeature = feature.toLowerCase().includes("hover");
        const isFooterFeature = feature.toLowerCase().includes("footer");

        const isOverridden =
          (isTransparencyDisabled && isTransparencyFeature) ||
          (isHoverDisabled && isHoverFeature) ||
          (isFooterDisabled && isFooterFeature);

        const featureToggle = document.createElement("div");
        featureToggle.className = "feature-toggle";

        // Create the base toggle HTML
        let toggleHTML = `
          <span class="feature-name">${displayFeatureName}${
          isOverridden
            ? ' <span class="overridden-label">[overridden]</span>'
            : ""
        }</span>
          <label class="toggle-switch ${isOverridden ? "disabled-toggle" : ""}">
            <input type="checkbox" name="${currentSiteKey}|${feature}" ${
          isChecked ? "checked" : ""
        } ${isOverridden ? "disabled" : ""}>
            <span class="slider round"></span>
          </label>
        `;

        featureToggle.innerHTML = toggleHTML;

        // If this feature is overridden by global settings, add a class
        if (isOverridden) {
          featureToggle.classList.add("overridden-feature");
        }

        this.currentSiteFeatures.appendChild(featureToggle);
      }
    } catch (error) {
      console.error("Error loading current site features:", error);
      this.currentSiteFeatures.innerHTML =
        "<div class='feature-toggle'>Error loading features.</div>";
    }
  }

  isCurrentSite(siteName) {
    if (logging) console.log("isCurrentSite called with", siteName);
    if (!this.normalizedCurrentSiteHostname) return false;

    // Normalize the site name too
    const normalizedSiteName = normalizeHostname(siteName);

    if (logging)
      console.log(
        `Comparing: current=${this.normalizedCurrentSiteHostname}, style=${normalizedSiteName}`
      );

    // Exact match has priority
    if (this.normalizedCurrentSiteHostname === normalizedSiteName) {
      if (logging) console.log("✓ Exact match!");
      return true;
    }

    // Wildcard match (with proper domain boundary)
    if (siteName.startsWith("+")) {
      const baseSiteName = siteName.slice(1);
      const normalizedBaseSiteName = normalizeHostname(baseSiteName);

      const isMatch =
        this.normalizedCurrentSiteHostname === normalizedBaseSiteName ||
        this.normalizedCurrentSiteHostname.endsWith(
          `.${normalizedBaseSiteName}`
        );

      if (isMatch && logging) console.log("✓ Wildcard match!");
      return isMatch;
    }

    // TLD suffix match (match domain regardless of TLD)
    if (siteName.startsWith("-")) {
      const baseSiteName = siteName.slice(1);

      // Extract domain name without the TLD
      // For site name: Use everything before the last dot(s)
      const cachedDomain = baseSiteName.split(".").slice(0, -1).join(".");

      // For current hostname: Similarly extract the domain without the TLD
      const hostParts = this.normalizedCurrentSiteHostname.split(".");
      const hostDomain =
        hostParts.length > 1
          ? hostParts.slice(0, -1).join(".")
          : this.normalizedCurrentSiteHostname;

      if (logging)
        console.log(
          `isCurrentSite comparing domains - cached: ${cachedDomain}, host: ${hostDomain}`
        );

      // Match if the domain part (without TLD) matches
      const isMatch = cachedDomain && hostDomain && hostDomain === cachedDomain;
      if (isMatch && logging) console.log("✓ TLD suffix match!");
      return isMatch;
    }

    // Don't match partial domain names
    return false;
  }

  async refetchCSS() {
    if (logging) console.log("refetchCSS called");
    this.refetchCSSButton.textContent = "Fetching...";
    try {
      // Get the repository URL from storage or use the default one
      const DEFAULT_REPOSITORY_URL =
        "https://sameerasw.github.io/my-internet/styles.json";
      const repoUrlData = await browser.storage.local.get(
        "stylesRepositoryUrl"
      );
      const repositoryUrl =
        repoUrlData.stylesRepositoryUrl || DEFAULT_REPOSITORY_URL;

      console.log("Fetching styles from:", repositoryUrl);

      const response = await fetch(repositoryUrl, {
        headers: {
          "Cache-Control": "no-cache",
        },
      });
      if (!response.ok)
        throw new Error(`Failed to fetch styles (Status: ${response.status})`);
      const styles = await response.json();
      await browser.storage.local.set({ styles });

      // Check if we need to initialize default settings
      const settingsData = await browser.storage.local.get(
        this.BROWSER_STORAGE_KEY
      );
      if (!settingsData[this.BROWSER_STORAGE_KEY]) {
        // Initialize default settings if none exist
        const defaultSettings = {
          enableStyling: true,
          autoUpdate: true,
          forceStyling: false,
          whitelistMode: false,
          whitelistStyleMode: false,
          lastFetchedTime: Date.now(),
        };

        // Save default settings
        await browser.storage.local.set({
          [this.BROWSER_STORAGE_KEY]: defaultSettings,
        });
        console.info("Initialized default settings during first fetch");

        // Update our internal global settings
        this.globalSettings = defaultSettings;

        // Update UI to reflect these defaults
        this.enableStylingSwitch.checked = true;
        this.autoUpdateSwitch.checked = false;
        this.forceStylingSwitch.checked = false;
        this.whitelistModeSwitch.checked = false;
        this.whitelistStylingModeSwitch.checked = false;

        // Update labels
        this.updateModeLabels();
      } else {
        // Update the lastFetchedTime in settings
        const currentSettings = settingsData[this.BROWSER_STORAGE_KEY];
        currentSettings.lastFetchedTime = Date.now();
        await browser.storage.local.set({
          [this.BROWSER_STORAGE_KEY]: currentSettings,
        });
        // Update our internal settings
        this.globalSettings.lastFetchedTime = Date.now();
      }

      this.loadCurrentSiteFeatures();
      this.updateActiveTabStyling();

      this.refetchCSSButton.textContent = "Done!";
      setTimeout(() => {
        this.refetchCSSButton.textContent = "Refetch latest styles";
      }, 2000);
      console.info(`All styles refetched and updated from ${repositoryUrl}`);
      this.displayLastFetchedTime();
    } catch (error) {
      this.refetchCSSButton.textContent = "Error!";
      setTimeout(() => {
        this.refetchCSSButton.textContent = "Refetch latest styles";
      }, 2000);
      console.error("Error refetching styles:", error);
      alert(`Error fetching styles: ${error.message}`);
    }
  }

  async updateActiveTabStyling() {
    if (logging) console.log("updateActiveTabStyling called");
    const tabs = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (tabs.length > 0) {
      this.applyCSSToTab(tabs[0]);
    }
  }

  async applyCSSToTab(tab) {
    if (logging) console.log("applyCSSToTab called with", tab);
    const url = new URL(tab.url);
    const hostname = url.hostname;
    const normalizedHostname = normalizeHostname(hostname);

    if (logging)
      console.log(
        "Applying CSS to tab with hostname:",
        normalizedHostname,
        "(original:",
        hostname,
        ")"
      );

    try {
      // Try to remove any existing CSS first
      try {
        await browser.tabs.removeCSS(tab.id, {
          code: "/* Placeholder for removing CSS */",
        });
      } catch (error) {
        // Ignore errors as they may occur if no CSS was previously applied
      }

      if (!this.shouldApplyCSS(hostname)) return;

      const stylesData = await browser.storage.local.get("styles");
      const styles = stylesData.styles?.website || {};

      // First try to find a direct match for a CSS file
      let bestMatch = null;
      let bestMatchLength = 0;

      for (const site of Object.keys(styles)) {
        const siteName = site.replace(/\.css$/, "");
        const normalizedSiteName = normalizeHostname(siteName);

        // Exact match has highest priority
        if (normalizedHostname === normalizedSiteName) {
          bestMatch = site;
          if (logging) console.log("Popup: Found exact match:", site);
          break;
        }

        // Then check wildcard matches
        if (siteName.startsWith("+")) {
          const baseSiteName = siteName.slice(1);
          const normalizedBaseSiteName = normalizeHostname(baseSiteName);
          // Ensure we're matching with proper domain boundary
          if (
            (normalizedHostname === normalizedBaseSiteName ||
              normalizedHostname.endsWith(`.${normalizedBaseSiteName}`)) &&
            normalizedBaseSiteName.length > bestMatchLength
          ) {
            bestMatch = site;
            bestMatchLength = normalizedBaseSiteName.length;
            if (logging) console.log("Popup: Found wildcard match:", site);
          }
        }
        // Check TLD suffix matches (-domain.com)
        else if (siteName.startsWith("-")) {
          const baseSiteName = siteName.slice(1);

          // Extract domain name without the TLD
          // For site name: Use everything before the last dot(s)
          const cachedDomain = baseSiteName.split(".").slice(0, -1).join(".");

          // For hostname: Similarly extract the domain without the TLD
          const hostParts = hostname.split(".");
          const hostDomain =
            hostParts.length > 1 ? hostParts.slice(0, -1).join(".") : hostname;

          if (logging)
            console.log(
              `Popup comparing domains - cached: ${cachedDomain}, host: ${hostDomain}`
            );

          // Match if the domain part (without TLD) matches
          if (cachedDomain && hostDomain && hostDomain === cachedDomain) {
            // Use this match if it's better than what we have
            if (cachedDomain.length > bestMatchLength) {
              bestMatch = site;
              bestMatchLength = cachedDomain.length;
              if (logging) console.log("Popup: Found TLD suffix match:", site);
            }
          }
        }
        // Last, check subdomain matches with proper domain boundary
        else if (
          normalizedHostname !== normalizedSiteName &&
          normalizedHostname.endsWith(`.${normalizedSiteName}`) &&
          normalizedSiteName.length > bestMatchLength
        ) {
          bestMatch = site;
          bestMatchLength = normalizedSiteName.length;
          if (logging) console.log("Popup: Found subdomain match:", site);
        }
      }

      // If we found a direct match, use it
      if (bestMatch) {
        const features = styles[bestMatch];
        // UPDATED: Use normalized hostname for settings storage/retrieval
        const normalizedSiteStorageKey = `${this.BROWSER_STORAGE_KEY}.${normalizedHostname}`;
        const siteData = await browser.storage.local.get(
          normalizedSiteStorageKey
        );
        const featureSettings = siteData[normalizedSiteStorageKey] || {};

        if (logging)
          console.log(
            "Using settings from:",
            normalizedSiteStorageKey,
            "for match:",
            bestMatch
          );

        let combinedCSS = "";
        for (const [feature, css] of Object.entries(features)) {
          if (featureSettings[feature] !== false) {
            combinedCSS += css + "\n";
          }
        }

        if (combinedCSS) {
          await browser.tabs.insertCSS(tab.id, { code: combinedCSS });
          console.info(`Applied CSS to ${hostname} (direct match)`);
        }
      } else if (this.globalSettings.forceStyling) {
        // Otherwise check for forced styling
        const isInList = this.skipForceThemingList.includes(hostname);
        const isWhitelistMode = this.globalSettings.whitelistMode;

        // Determine if we should apply forced styling
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

          if (combinedCSS) {
            await browser.tabs.insertCSS(tab.id, { code: combinedCSS });
            console.info(`Applied forced CSS to ${hostname}`);
          }
        } else {
          console.info(`Skipping forced styling for ${hostname}`);
        }
      }
    } catch (error) {
      console.error(`Error applying CSS to ${hostname}:`, error);
    }
  }

  shouldApplyCSS(hostname) {
    if (logging) console.log("shouldApplyCSS called with", hostname);
    // Use default if not explicitly set
    return this.globalSettings.enableStyling !== false;
  }

  async displayAddonVersion() {
    if (logging) console.log("displayAddonVersion called");
    const manifest = browser.runtime.getManifest();
    const version = manifest.version;
    document.getElementById("addon-version").textContent = `v${version}`;
  }

  setupAutoUpdate() {
    if (logging) console.log("setupAutoUpdate called");
    if (this.autoUpdateSwitch.checked) {
      browser.runtime.sendMessage({ action: "enableAutoUpdate" });
    } else {
      browser.runtime.sendMessage({ action: "disableAutoUpdate" });
    }
  }

  displayLastFetchedTime() {
    if (logging) console.log("displayLastFetchedTime called");
    browser.storage.local.get(this.BROWSER_STORAGE_KEY).then((result) => {
      const settings = result[this.BROWSER_STORAGE_KEY] || {};
      if (settings.lastFetchedTime) {
        this.lastFetchedTime.textContent = `Last fetched: ${new Date(
          settings.lastFetchedTime
        ).toLocaleString()}`;
      } else {
        this.lastFetchedTime.textContent = "Last fetched: Never";
      }
    });
  }

  reloadPage() {
    if (logging) console.log("reloadPage called");
    browser.tabs.reload();
  }

  handleMiddleClick(event) {
    if (event.button === 1) {
      // Middle click
      if (confirm("Are you sure you want to clear all settings?")) {
        browser.storage.local.clear().then(() => {
          alert("All settings have been cleared.");
          location.reload(); // Reload the popup to reflect changes
        });
      }
    }
  }

  handleWhitelistModeChange() {
    this.updateModeLabels();
    this.saveSettings();
  }

  handleWhitelistStyleModeChange() {
    this.updateModeLabels();
    this.saveSettings();
  }

  updateModeIndicator() {
    if (this.whitelistModeSwitch.checked) {
      this.modeIndicator.textContent =
        "In Whitelist Mode (apply only to listed sites)";
    } else {
      this.modeIndicator.textContent =
        "In Blacklist Mode (apply to all except listed sites)";
    }
  }

  updateSiteToggleLabel() {
    // Update the label based on the current mode
    if (this.whitelistModeSwitch.checked) {
      this.siteToggleLabel.textContent = "Enable for this Site";
    } else {
      this.siteToggleLabel.textContent = "Skip Forcing for this Site";
    }
  }

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

  // Open the What's New page
  openWhatsNew() {
    browser.tabs.create({
      url: "https://addons.mozilla.org/en-US/firefox/addon/zen-internet/versions/",
    });
  }

  // Open the How to Use guide
  openHowToUse() {
    browser.tabs.create({
      url: "https://www.sameerasw.com/zen",
    });
  }

  // Toggle features section visibility
  toggleFeatures() {
    const featuresList = document.getElementById("current-site-toggles");
    const actionsContainer = document.getElementById("current-site-actions");
    const toggleButton = document.getElementById("toggle-features");

    featuresList.classList.toggle("collapsed");
    if (actionsContainer) {
      actionsContainer.classList.toggle(
        "collapsed",
        featuresList.classList.contains("collapsed")
      );
    }

    // Update the icon
    const icon = toggleButton.querySelector("i");
    if (featuresList.classList.contains("collapsed")) {
      icon.className = "fas fa-chevron-down";
    } else {
      icon.className = "fas fa-chevron-up";
    }
  }

  // Toggle forcing section visibility
  toggleForcing() {
    const forcingContent = document.getElementById("forcing-content");
    const toggleButton = document.getElementById("toggle-forcing");

    forcingContent.classList.toggle("collapsed");

    // Update the icon
    const icon = toggleButton.querySelector("i");
    if (forcingContent.classList.contains("collapsed")) {
      icon.className = "fas fa-chevron-down";
    } else {
      icon.className = "fas fa-chevron-up";
    }
  }

  // Toggle FAQ section visibility
  toggleFAQ() {
    const faqContent = document.getElementById("faq-content");
    const toggleButton = document.getElementById("toggle-faq");

    faqContent.classList.toggle("collapsed");

    // Update the icon
    const icon = toggleButton.querySelector("i");
    if (faqContent.classList.contains("collapsed")) {
      icon.className = "fas fa-chevron-down";
    } else {
      icon.className = "fas fa-chevron-up";
    }
  }

  // Handle FAQ item clicks (only one open at a time)
  handleFAQClick(event) {
    // Find the closest FAQ item container
    const faqItem = event.target.closest(".faq-item");
    if (!faqItem) return;

    const question = faqItem.querySelector(".faq-question");
    const answer = faqItem.querySelector(".faq-answer");

    if (!question || !answer) return;

    const isCurrentlyActive = question.classList.contains("active");

    // Close all FAQ items
    document.querySelectorAll(".faq-question").forEach((q) => {
      q.classList.remove("active");
      const a = q.nextElementSibling;
      if (a) a.classList.remove("active");
    });

    // If the clicked item wasn't active, open it
    if (!isCurrentlyActive) {
      question.classList.add("active");
      answer.classList.add("active");
    }
  }

  // Show bug report overlay
  showBugReportOverlay() {
    const overlay = document.getElementById("bug-report-overlay");
    overlay.classList.remove("hidden");

    // Reset all bug option selections
    document.querySelectorAll(".bug-option").forEach((option) => {
      option.classList.remove("selected");
    });

    // Reset submit button
    const submitBtn = document.getElementById("submit-bug-report");
    submitBtn.disabled = true;

    // Setup bug option event listeners
    document.querySelectorAll(".bug-option").forEach((option) => {
      option.addEventListener("click", () => {
        // Remove selected class from all options
        document.querySelectorAll(".bug-option").forEach((opt) => {
          opt.classList.remove("selected");
        });

        // Add selected class to clicked option
        option.classList.add("selected");

        // Enable submit button
        submitBtn.disabled = false;
      });
    });

    // Cancel button event listener
    document
      .getElementById("cancel-bug-report")
      .addEventListener("click", () => {
        this.hideBugReportOverlay();
      });

    // Submit button event listener
    submitBtn.addEventListener("click", () => {
      this.submitBugReport();
    });

    // Close overlay when clicking outside
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        this.hideBugReportOverlay();
      }
    });
  }

  // Hide bug report overlay
  hideBugReportOverlay() {
    const overlay = document.getElementById("bug-report-overlay");
    overlay.classList.add("hidden");
  }

  // Submit bug report
  async submitBugReport() {
    const selectedOption = document.querySelector(".bug-option.selected");
    if (!selectedOption) return;

    const bugType = selectedOption.getAttribute("data-type");
    const submitBtn = document.getElementById("submit-bug-report");

    // Show loading state
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';
    submitBtn.disabled = true;

    try {
      // Collect relevant data based on bug type
      const bugData = await this.collectDataForBugType(bugType);

      // Get repository information
      const repoInfo = this.getRepositoryForBugType(bugType);

      // Create issue body
      const issueBody = this.createBugReportBodyForType(bugType, bugData);

      // Create GitHub issue URL with proper template
      let issueUrl = `https://github.com/${repoInfo.owner}/${repoInfo.repo}/issues/new`;

      // Add template parameter if available
      if (repoInfo.template) {
        issueUrl += `?template=${repoInfo.template}.md`;
      }

      // Add title and body parameters
      const urlParams = new URLSearchParams();
      urlParams.append("title", repoInfo.title);
      urlParams.append("body", issueBody);

      // Combine URL with parameters
      const separator = repoInfo.template ? "&" : "?";
      issueUrl += separator + urlParams.toString();

      // Open the URL
      browser.tabs.create({ url: issueUrl });

      // Hide overlay
      this.hideBugReportOverlay();
    } catch (error) {
      console.error("Error submitting bug report:", error);
      alert("Failed to create bug report. Please try again.");
    } finally {
      // Restore button state
      submitBtn.innerHTML = originalText;
      submitBtn.disabled = false;
    }
  }

  // Get repository information based on bug type
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

  // Collect data based on bug type
  async collectDataForBugType(bugType) {
    try {
      const allData = await browser.storage.local.get(null);
      const manifest = browser.runtime.getManifest();
      const tabs = await browser.tabs.query({
        active: true,
        currentWindow: true,
      });
      const currentTab = tabs[0];

      // Base data for all types
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

      // Global settings
      const globalSettings = allData[this.BROWSER_STORAGE_KEY] || {};
      const skipForceList = allData[SKIP_FORCE_THEMING_KEY] || [];
      const skipThemingList = allData[SKIP_THEMING_KEY] || [];
      const fallbackBackgroundList = allData[FALLBACK_BACKGROUND_KEY] || [];

      switch (bugType) {
        case "1": // Current website's theme - include site-specific settings
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

        case "2": // Extension issue - global settings only
        case "3": // Transparency issue - global settings only
        case "5": // Other - global settings only
          return {
            ...baseData,
            settings: {
              globalSettings,
              skipForceList,
              skipThemingList,
              fallbackBackgroundList,
            },
          };

        case "4": // Feature request - no settings data
          return baseData;

        default:
          return baseData;
      }
    } catch (error) {
      console.error("Error collecting bug data:", error);
      return { error: "Failed to collect data: " + error.message };
    }
  }

  // Create bug report body for specific type
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

    // Add settings data if available
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

  // Collect all extension data for bug report (legacy method - still used by export)
  async collectBugReportData() {
    try {
      // Get all storage data
      const allData = await browser.storage.local.get(null);

      // Get addon version
      const manifest = browser.runtime.getManifest();

      // Get current tab info
      const tabs = await browser.tabs.query({
        active: true,
        currentWindow: true,
      });
      const currentTab = tabs[0];

      // Extract the same data structure as the export function, but exclude site-specific settings
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

      // Remove fallbackBackgroundList from global settings if it exists there
      if (settingsToInclude[this.BROWSER_STORAGE_KEY].fallbackBackgroundList) {
        delete settingsToInclude[this.BROWSER_STORAGE_KEY]
          .fallbackBackgroundList;
      }

      // Get styles count for context (but don't include the actual styles data)
      const stylesData = allData.styles || {};
      const websiteStylesCount = Object.keys(stylesData.website || {}).length;

      // Count site-specific settings without including them
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
          siteSettingsCount: siteSettingsCount, // Just the count, not the actual data
          stylesCount: websiteStylesCount,
          hasStyles: websiteStylesCount > 0,
        },
      };
    } catch (error) {
      console.error("Error collecting bug report data:", error);
      // Return minimal data if collection fails
      const manifest = browser.runtime.getManifest();
      return {
        reportDate: new Date().toISOString(),
        addonVersion: manifest.version,
        error: "Failed to collect full data: " + error.message,
      };
    }
  }

  // Create formatted issue body for bug report
  createBugReportBody(jsonData, currentUrl) {
    return `## Describe the bug
<!-- A clear and concise description of what the bug is. -->

## Steps to reproduce
Steps to reproduce the behavior:
1. 
2. 
3. 

## Expected behavior
<!-- A clear and concise description of what you expected to happen. -->

## Actual behavior
<!-- Describe what actually happened. -->

## ZenInternet Backup JSON (Auto-Generated)
*This data was automatically collected to help with debugging.*

<details>
<summary>Click to expand JSON data</summary>

\`\`\`json
${jsonData}
\`\`\`

</details>

## Zen Browser Version
<!-- Please specify the version of the Zen browser you are using -->

## Platform
<!-- What platform are you using? (e.g., Windows, macOS, Linux, Android, iOS, etc.) -->

## Website (if applicable)
${
  currentUrl
    ? `Current tab: ${currentUrl}`
    : "<!-- If this bug relates to a specific website, please provide its URL -->"
}

## Additional context
<!-- Add any other context about the problem here. -->`;
  }

  // Add welcome screen check method
  async checkWelcomeScreen() {
    try {
      // Check if welcome screen should be shown
      const shouldShow = await window.checkAndShowWelcome();

      if (shouldShow) {
        // Hide the main popup content while welcome is shown
        const container = document.querySelector(".container");
        if (container) {
          container.style.opacity = "0.3";
          container.style.pointerEvents = "none";
        }

        // Listen for welcome screen completion
        const checkWelcomeComplete = setInterval(() => {
          const welcomeOverlay = document.getElementById("welcome-overlay");
          if (!welcomeOverlay || welcomeOverlay.classList.contains("hidden")) {
            clearInterval(checkWelcomeComplete);
            // Restore main popup content
            if (container) {
              container.style.opacity = "1";
              container.style.pointerEvents = "auto";
            }
            // Reload settings to reflect welcome screen changes
            this.loadSettings().then(() => {
              this.restoreSettings();
              this.updateModeLabels();
              this.updateModeIndicator();
            });
          }
        }, 100);
      }
    } catch (error) {
      console.error("Error checking welcome screen:", error);
    }
  }
})();

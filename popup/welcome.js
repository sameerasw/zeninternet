class WelcomeScreen {
  constructor() {
    this.currentStep = 1;
    this.totalSteps = 5;
    this.selectedThemeMode = null;
    this.disclaimerAccepted = false;

    this.createWelcomeOverlay();
    this.bindEvents();
  }

  createWelcomeOverlay() {
    const overlay = document.createElement("div");
    overlay.id = "welcome-overlay";
    overlay.className = "welcome-overlay";

    overlay.innerHTML = `
      <div class="welcome-container">
        <div class="welcome-progress">
          <div class="progress-dot active"></div>
          <div class="progress-dot"></div>
          <div class="progress-dot"></div>
          <div class="progress-dot"></div>
          <div class="progress-dot"></div>
        </div>

        <!-- Step 1: Welcome -->
        <div class="welcome-step step-welcome active" data-step="1">
          <img src="../assets/images/logo.png" alt="Zen Internet Logo" class="welcome-logo">
          <h1 class="welcome-title">Zen Internet</h1>
          <p class="welcome-subtitle">Welcome to a cleaner, more elegant internet experience!</p>
          <div class="welcome-actions">
            <button class="welcome-button primary" id="setup-start">
              <i class="fas fa-arrow-right"></i>
              Setup
            </button>
          </div>
        </div>

        <!-- Step 2: Disclaimer -->
        <div class="welcome-step step-disclaimer" data-step="2">
          <h2 class="disclaimer-title">Important Disclaimer</h2>
          <div class="disclaimer-content">
            <div class="disclaimer-highlight">
              <p><strong>⚠️ This is a third party modification.<br/> </strong> If you encounter any issues regarding transparency or website colors, <br/><strong>DO NOT</strong> report issues to the official browser repository or issue tracker.<br/>Instead use the built-in issue/bug report feature in this addon or report it directly to the developer.</p>
            </div>
            
            <p><strong>Some common issues you may experience are:</strong></p>
            <ol class="disclaimer-list">
              <li>White background</li>
              <li>Unreadable text</li>
              <li>No transparency</li>
              <li>No blur</li>
              <li>And many others</li>
            </ol>
            
            <div class="disclaimer-instructions">
              <p><strong>📖 Before reporting issues:</strong></p>
              <p>First check the <strong>FAQ</strong> in the addon popup page at the bottom. <br/>If that does not solve your problem, then reach out to me through the proper channels.</p>
            </div>
            
            <div class="disclaimer-question">
              <p><strong>Do you understand this disclaimer and agree to comply with the given options and <br/>not to bother the browser development and other developers?</strong></p>
            </div>
          
          <div class="disclaimer-checkbox">
            <input type="checkbox" id="understand-checkbox">
            <label for="understand-checkbox">Yes, <br/>I understand and agree</label>
          </div></div>
          <div class="welcome-actions">
            <button class="welcome-button secondary" id="disclaimer-back">
              <i class="fas fa-arrow-left"></i>
              Back
            </button>
            <button class="welcome-button primary" id="disclaimer-next" disabled>
              Next
              <i class="fas fa-arrow-right"></i>
            </button>
          </div>
        </div>

        <!-- Step 3: Theme Mode Selection -->
        <div class="welcome-step step-theme-mode" data-step="3">
          <h2 class="theme-mode-title">Choose Your Theming Preference</h2>
          <p class="theme-mode-description">How would you like themes to be applied?</p>
          
          <div class="theme-mode-options">
            <div class="theme-mode-option" data-mode="blacklist">
              <h4>Enable themes by default</h4>
              <p>Themes will be applied to all websites automatically. You can skip websites if needed.</p>
            </div>
            <div class="theme-mode-option" data-mode="whitelist">
              <h4>Only apply to websites I choose</h4>
              <p>Themes will only be applied to websites you specifically select in the addon.</p>
            </div>
          </div>

          <div class="welcome-actions">
            <button class="welcome-button secondary" id="theme-mode-back">
              <i class="fas fa-arrow-left"></i>
              Back
            </button>
            <button class="welcome-button primary" id="theme-mode-next" disabled>
              Next
              <i class="fas fa-arrow-right"></i>
            </button>
          </div>
        </div>

        <!-- Step 4: Fetch Styles -->
        <div class="welcome-step step-fetch-styles" data-step="4">
          <h2 class="fetch-styles-title">Download Latest Themes</h2>
          <p class="fetch-styles-description">Click below to fetch the latest themes from our repository.</p>
          
          <div class="fetch-styles-actions">
            <button class="welcome-button primary fetch-styles-button" id="welcome-fetch-styles">
              <i class="fas fa-download"></i>
              Fetch Latest Styles
            </button>
            
            <div class="auto-update-container">
              <label class="toggle-switch">
                <input type="checkbox" id="welcome-auto-update" checked>
                <span class="slider round"></span>
              </label>
              <span class="toggle-label">Auto Update Styles (2h)</span>
            </div>
          </div>

          <div id="welcome-fetch-status" class="fetch-status" style="display: none;"></div>

          <div class="welcome-actions" style="margin-top: 32px;">
            <button class="welcome-button secondary" id="fetch-styles-back">
              <i class="fas fa-arrow-left"></i>
              Back
            </button>
            <button class="welcome-button primary" id="fetch-styles-next" disabled>
              Next
              <i class="fas fa-arrow-right"></i>
            </button>
          </div>
        </div>

        <!-- Step 5: Complete -->
        <div class="welcome-step step-complete" data-step="5">
          <div class="complete-icon">
            <i class="fas fa-check-circle"></i>
          </div>
          <h2 class="complete-title">All Done!</h2>
          <p class="complete-description">
            Zen Internet extension is now ready to use!<br>
            Read FAQ if you find anything confusing or reach out for help.
          </p>
          
          <div class="welcome-actions">
            <button class="welcome-button primary" id="welcome-close">
              <i class="fas fa-check"></i>
              Start Using Zen Internet
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
  }

  bindEvents() {
    // Step 1: Setup start
    document.getElementById("setup-start").addEventListener("click", () => {
      this.nextStep();
    });

    // Step 2: Disclaimer
    const understandCheckbox = document.getElementById("understand-checkbox");
    const disclaimerNext = document.getElementById("disclaimer-next");

    understandCheckbox.addEventListener("change", (e) => {
      this.disclaimerAccepted = e.target.checked;
      disclaimerNext.disabled = !this.disclaimerAccepted;
    });

    document.getElementById("disclaimer-back").addEventListener("click", () => {
      this.previousStep();
    });

    document.getElementById("disclaimer-next").addEventListener("click", () => {
      this.nextStep();
    });

    // Step 3: Theme mode selection
    const themeModeOptions = document.querySelectorAll(".theme-mode-option");
    const themeModeNext = document.getElementById("theme-mode-next");

    themeModeOptions.forEach((option) => {
      option.addEventListener("click", () => {
        themeModeOptions.forEach((opt) => opt.classList.remove("selected"));
        option.classList.add("selected");
        this.selectedThemeMode = option.dataset.mode;
        themeModeNext.disabled = false;
      });
    });

    document.getElementById("theme-mode-back").addEventListener("click", () => {
      this.previousStep();
    });

    document.getElementById("theme-mode-next").addEventListener("click", () => {
      this.applyThemeMode();
      this.nextStep();
    });

    // Step 4: Fetch styles
    document
      .getElementById("welcome-fetch-styles")
      .addEventListener("click", () => {
        this.fetchStyles();
      });

    document
      .getElementById("fetch-styles-back")
      .addEventListener("click", () => {
        this.previousStep();
      });

    document
      .getElementById("fetch-styles-next")
      .addEventListener("click", () => {
        this.nextStep();
      });

    // Step 5: Complete
    document.getElementById("welcome-close").addEventListener("click", () => {
      this.closeWelcome();
    });
  }

  nextStep() {
    if (this.currentStep < this.totalSteps) {
      this.currentStep++;
      this.updateStep();
      this.updateProgress();
    }
  }

  previousStep() {
    if (this.currentStep > 1) {
      this.currentStep--;
      this.updateStep();
      this.updateProgress();
    }
  }

  updateStep() {
    const steps = document.querySelectorAll(".welcome-step");
    steps.forEach((step, index) => {
      step.classList.toggle("active", index + 1 === this.currentStep);
    });
  }

  updateProgress() {
    const dots = document.querySelectorAll(".progress-dot");
    dots.forEach((dot, index) => {
      dot.classList.remove("active", "completed");
      if (index + 1 === this.currentStep) {
        dot.classList.add("active");
      } else if (index + 1 < this.currentStep) {
        dot.classList.add("completed");
      }
    });
  }

  async applyThemeMode() {
    try {
      const BROWSER_STORAGE_KEY = "transparentZenSettings";
      const data = await browser.storage.local.get(BROWSER_STORAGE_KEY);
      const settings = data[BROWSER_STORAGE_KEY] || {};

      // Apply theme mode settings
      if (this.selectedThemeMode === "whitelist") {
        settings.whitelistStyleMode = true;
        settings.forceStyling = false;
      } else {
        settings.whitelistStyleMode = false;
        settings.forceStyling = false;
      }

      // Ensure other default settings
      settings.enableStyling = true;
      settings.autoUpdate = document.getElementById(
        "welcome-auto-update"
      ).checked;

      await browser.storage.local.set({ [BROWSER_STORAGE_KEY]: settings });
    } catch (error) {
      console.error("Error applying theme mode:", error);
    }
  }

  async fetchStyles() {
    const fetchButton = document.getElementById("welcome-fetch-styles");
    const fetchStatus = document.getElementById("welcome-fetch-status");
    const nextButton = document.getElementById("fetch-styles-next");

    // Show loading state
    fetchButton.disabled = true;
    fetchButton.innerHTML =
      '<i class="fas fa-spinner fa-spin"></i> Fetching...';
    fetchStatus.style.display = "block";
    fetchStatus.className = "fetch-status loading";
    fetchStatus.textContent = "Downloading latest themes...";

    try {
      // Get the repository URL from storage or use the default one
      const DEFAULT_REPOSITORY_URL =
        "https://sameerasw.github.io/my-internet/styles.json";
      const repoUrlData = await browser.storage.local.get(
        "stylesRepositoryUrl"
      );
      const repositoryUrl =
        repoUrlData.stylesRepositoryUrl || DEFAULT_REPOSITORY_URL;

      const response = await fetch(repositoryUrl, {
        headers: { "Cache-Control": "no-cache" },
      });

      if (!response.ok)
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);

      const styles = await response.json();
      await browser.storage.local.set({ styles });

      // Update auto-update setting
      const BROWSER_STORAGE_KEY = "transparentZenSettings";
      const data = await browser.storage.local.get(BROWSER_STORAGE_KEY);
      const settings = data[BROWSER_STORAGE_KEY] || {};
      settings.autoUpdate = document.getElementById(
        "welcome-auto-update"
      ).checked;
      settings.lastFetchedTime = Date.now();
      await browser.storage.local.set({ [BROWSER_STORAGE_KEY]: settings });

      // Show success state
      fetchStatus.className = "fetch-status success";
      fetchStatus.textContent = `Successfully downloaded ${
        Object.keys(styles.website || {}).length
      } website themes!`;
      fetchButton.innerHTML = '<i class="fas fa-check"></i> Download Complete';
      nextButton.disabled = false;

      // Enable auto-update if selected
      if (settings.autoUpdate) {
        try {
          await browser.runtime.sendMessage({ action: "enableAutoUpdate" });
        } catch (e) {
          // Background script might not be ready, ignore
        }
      }
    } catch (error) {
      console.error("Error fetching styles:", error);
      fetchStatus.className = "fetch-status error";
      fetchStatus.textContent = `Failed to download themes: ${error.message}`;
      fetchButton.innerHTML =
        '<i class="fas fa-exclamation-triangle"></i> Retry Download';
      fetchButton.disabled = false;
    }
  }

  closeWelcome() {
    const overlay = document.getElementById("welcome-overlay");
    overlay.classList.add("hidden");

    // Mark welcome as shown
    this.markWelcomeAsShown();

    // Remove the overlay after animation completes
    setTimeout(() => {
      overlay.remove();
    }, 300);
  }

  async markWelcomeAsShown() {
    try {
      const BROWSER_STORAGE_KEY = "transparentZenSettings";
      const data = await browser.storage.local.get(BROWSER_STORAGE_KEY);
      const settings = data[BROWSER_STORAGE_KEY] || {};

      settings.welcomeShown = true;
      await browser.storage.local.set({ [BROWSER_STORAGE_KEY]: settings });
    } catch (error) {
      console.error("Error marking welcome as shown:", error);
    }
  }

  showAgreementOnly() {
    // Show the overlay first
    this.show();

    // Set up for agreement-only flow (steps 2 and 5)
    this.currentStep = 2;
    this.totalSteps = 2; // Only agreement and completion steps
    this.isAgreementOnlyFlow = true;

    // Update the progress dots for agreement-only flow
    const progressContainer = document.querySelector(".welcome-progress");
    if (progressContainer) {
      progressContainer.innerHTML = `
        <div class="progress-dot active"></div>
        <div class="progress-dot"></div>
      `;
    }

    // Update steps visibility
    this.updateStepForAgreementFlow();

    // Update the disclaimer navigation for agreement-only flow
    this.updateDisclaimerForAgreementFlow();
  }

  updateStepForAgreementFlow() {
    const steps = document.querySelectorAll(".welcome-step");
    steps.forEach((step) => {
      step.classList.remove("active");
    });

    if (this.currentStep === 2) {
      // Show disclaimer step
      document.querySelector(".step-disclaimer").classList.add("active");
    } else if (this.currentStep === 5) {
      // Show completion step
      document.querySelector(".step-complete").classList.add("active");
    }
  }

  updateDisclaimerForAgreementFlow() {
    const disclaimerNext = document.getElementById("disclaimer-next");
    const disclaimerBack = document.getElementById("disclaimer-back");

    // Hide back button in agreement-only flow
    if (disclaimerBack) {
      disclaimerBack.style.display = "none";
    }

    // Update next button event for agreement-only flow
    if (disclaimerNext) {
      disclaimerNext.removeEventListener("click", this.nextStep);
      disclaimerNext.addEventListener("click", () => {
        if (this.isAgreementOnlyFlow) {
          this.currentStep = 5; // Jump to completion step
          this.updateStepForAgreementFlow();
          this.updateProgressForAgreementFlow();
        } else {
          this.nextStep();
        }
      });
    }
  }

  updateProgressForAgreementFlow() {
    const dots = document.querySelectorAll(".progress-dot");
    if (this.isAgreementOnlyFlow) {
      dots.forEach((dot, index) => {
        dot.classList.remove("active", "completed");
        if (this.currentStep === 2 && index === 0) {
          dot.classList.add("completed");
        } else if (this.currentStep === 5 && index === 1) {
          dot.classList.add("active");
        }
      });
    }
  }

  show() {
    const overlay = document.getElementById("welcome-overlay");
    if (overlay) {
      overlay.classList.remove("hidden");
    }
  }

  hide() {
    const overlay = document.getElementById("welcome-overlay");
    if (overlay) {
      overlay.classList.add("hidden");
    }
  }
}

// Function to check if user is first-time and show welcome screen
async function checkAndShowWelcome() {
  try {
    const BROWSER_STORAGE_KEY = "transparentZenSettings";
    const data = await browser.storage.local.get([
      BROWSER_STORAGE_KEY,
      "styles",
    ]);

    const settings = data[BROWSER_STORAGE_KEY] || {};
    const hasStyles =
      data.styles &&
      data.styles.website &&
      Object.keys(data.styles.website).length > 0;
    const welcomeShown = settings.welcomeShown;

    // New users (no styles fetched) - show full welcome flow
    if (!hasStyles) {
      const welcome = new WelcomeScreen();
      welcome.show();
      return true; // Welcome screen is shown
    }

    // Existing users who haven't seen the new agreement - show agreement-only flow
    if (hasStyles && (welcomeShown === undefined || welcomeShown === false)) {
      const welcome = new WelcomeScreen();
      welcome.showAgreementOnly();
      return true; // Welcome screen is shown
    }

    return false; // Welcome screen not needed
  } catch (error) {
    console.error("Error checking welcome screen status:", error);
    return false;
  }
}

// Export for use in other files
window.WelcomeScreen = WelcomeScreen;
window.checkAndShowWelcome = checkAndShowWelcome;

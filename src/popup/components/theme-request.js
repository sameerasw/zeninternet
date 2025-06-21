/**
 * Theme request component for handling theme requests
 */

import { GitHubService } from "../../shared/services/github-service.js";

/**
 * Theme Request component class
 */
export class ThemeRequest {
  constructor() {
    this.githubService = new GitHubService();
    this.overlay = null;
    this.isInitialized = false;
  }

  /**
   * Initialize theme request component
   */
  initialize() {
    if (this.isInitialized) {
      return;
    }

    this.overlay = document.getElementById("theme-request-overlay");
    if (!this.overlay) {
      console.error("Theme request overlay not found");
      return;
    }

    this.setupEventListeners();
    this.isInitialized = true;
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    const cancelBtn = document.getElementById("cancel-request");
    const submitBtn = document.getElementById("submit-request");
    const forcingToggle = document.getElementById("forcing-toggle");
    const accountToggle = document.getElementById("account-toggle");

    // Handle custom toggle clicks
    this.setupCustomToggle(forcingToggle);
    this.setupCustomToggle(accountToggle);

    // Handle cancel button
    cancelBtn?.addEventListener("click", () => {
      this.hide();
    });

    // Handle submit button
    submitBtn?.addEventListener("click", () => {
      this.submitRequest();
    });

    // Close overlay when clicking outside
    this.overlay.addEventListener("click", (e) => {
      if (e.target === this.overlay) {
        this.hide();
      }
    });
  }

  /**
   * Setup custom toggle functionality
   * @param {HTMLElement} toggleElement - Toggle element
   */
  setupCustomToggle(toggleElement) {
    if (!toggleElement) return;

    const options = toggleElement.querySelectorAll(".toggle-option");
    const slider = toggleElement.querySelector(".toggle-slider");

    options.forEach((option) => {
      option.addEventListener("click", () => {
        // Remove active class from all options
        options.forEach((opt) => opt.classList.remove("active"));

        // Add active class to clicked option
        option.classList.add("active");

        // Update slider position
        this.updateSliderPosition(toggleElement, option);
      });
    });
  }

  /**
   * Update slider position based on active option
   * @param {HTMLElement} toggleElement - Toggle element
   * @param {HTMLElement} activeOption - Active option element
   */
  updateSliderPosition(toggleElement, activeOption) {
    const options = toggleElement.querySelectorAll(".toggle-option");
    const optionIndex = Array.from(options).indexOf(activeOption);
    const optionCount = options.length;
    const slider = toggleElement.querySelector(".toggle-slider");

    if (slider && optionIndex !== -1) {
      const percentage = (optionIndex / (optionCount - 1)) * 100;
      slider.style.left = `${percentage}%`;
    }
  }

  /**
   * Show theme request overlay
   * @param {string} hostname - Current hostname
   */
  show(hostname) {
    if (!this.isInitialized) {
      this.initialize();
    }

    this.currentHostname = hostname;
    this.overlay?.classList.remove("hidden");
  }

  /**
   * Hide theme request overlay
   */
  hide() {
    this.overlay?.classList.add("hidden");
  }

  /**
   * Get toggle value
   * @param {string} toggleId - Toggle element ID
   * @returns {string} - Toggle value
   */
  getToggleValue(toggleId) {
    const toggle = document.getElementById(toggleId);
    if (!toggle) return "";

    const activeOption = toggle.querySelector(".toggle-option.active");
    return activeOption ? activeOption.dataset.value : "";
  }

  /**
   * Submit theme request
   */
  async submitRequest() {
    try {
      const submitBtn = document.getElementById("submit-request");
      const originalText = submitBtn.textContent;

      // Show loading state
      submitBtn.textContent = "Submitting...";
      submitBtn.disabled = true;

      const forcingValue = this.getToggleValue("forcing-toggle");
      const accountValue = this.getToggleValue("account-toggle");

      if (!this.currentHostname) {
        throw new Error("No hostname available");
      }

      // Check for existing issue
      const existingIssue = await this.checkExistingIssue(this.currentHostname);

      if (existingIssue) {
        this.showExistingIssueScreen(existingIssue, forcingValue, accountValue);
      } else {
        this.createNewIssue(forcingValue, accountValue);
      }

      // Reset button state
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
    } catch (error) {
      console.error("Error submitting theme request:", error);

      // Reset button state
      const submitBtn = document.getElementById("submit-request");
      if (submitBtn) {
        submitBtn.textContent = "Submit Request";
        submitBtn.disabled = false;
      }

      alert("Error submitting request: " + error.message);
    }
  }

  /**
   * Check for existing issue
   * @param {string} hostname - Hostname to check
   * @returns {Promise<Object|null>} - Existing issue or null
   */
  async checkExistingIssue(hostname) {
    try {
      const repo = this.githubService.getRepositoryForBugType("1");
      return await this.githubService.searchIssues(
        repo.owner,
        repo.repo,
        hostname
      );
    } catch (error) {
      console.error("Error checking existing issue:", error);
      return null;
    }
  }

  /**
   * Show existing issue screen
   * @param {Object} existingIssue - Existing issue data
   * @param {string} forcingValue - Forcing option value
   * @param {string} accountValue - Account option value
   */
  showExistingIssueScreen(existingIssue, forcingValue, accountValue) {
    const overlay = this.overlay;
    const prompt = overlay.querySelector(".theme-request-prompt");

    // Create existing issue content
    const existingIssueContent = this.createExistingIssueContent(existingIssue);

    // Replace prompt content
    prompt.innerHTML = existingIssueContent;

    // Add event listeners for new buttons
    const viewIssueBtn = prompt.querySelector("#view-existing-issue");
    const createNewBtn = prompt.querySelector("#create-new-anyway");
    const goBackBtn = prompt.querySelector("#go-back-request");

    viewIssueBtn?.addEventListener("click", () => {
      browser.tabs.create({ url: existingIssue.html_url });
      this.hide();
    });

    createNewBtn?.addEventListener("click", () => {
      this.createNewIssue(forcingValue, accountValue);
    });

    goBackBtn?.addEventListener("click", () => {
      // Restore original content and show overlay again
      location.reload(); // Simple way to restore original state
    });
  }

  /**
   * Create existing issue content HTML
   * @param {Object} issue - Issue data
   * @returns {string} - HTML content
   */
  createExistingIssueContent(issue) {
    const truncatedBody = this.truncateText(issue.body || "", 150);
    const createdDate = new Date(issue.created_at).toLocaleDateString();

    return `
      <div class="existing-issue-info">
        <h3>Existing Request Found</h3>
        <div class="issue-details">
          <div class="issue-header">
            <h4 class="issue-title">${issue.title}</h4>
            <span class="issue-state status-${issue.state}">${issue.state}</span>
          </div>
          <div class="issue-meta">
            <div class="issue-meta-item">
              <i class="fas fa-calendar"></i>
              Created: ${createdDate}
            </div>
            <div class="issue-meta-item">
              <i class="fas fa-comments"></i>
              ${issue.comments} comments
            </div>
          </div>
          <div class="issue-body">
            <p class="issue-description">${truncatedBody}</p>
          </div>
        </div>
        <div class="existing-issue-actions">
          <button id="view-existing-issue" class="action-button primary">
            <i class="fas fa-external-link-alt"></i> View Existing Request
          </button>
          <button id="create-new-anyway" class="action-button secondary">
            Create New Anyway
          </button>
          <button id="go-back-request" class="action-button secondary">
            Go Back
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Create new issue
   * @param {string} forcingValue - Forcing option value
   * @param {string} accountValue - Account option value
   */
  createNewIssue(forcingValue, accountValue) {
    try {
      const repo = this.githubService.getRepositoryForBugType("1");
      const title = `[THEME] ${this.currentHostname}`;
      const body = this.githubService.createThemeRequestBody(
        this.currentHostname,
        forcingValue,
        accountValue
      );

      const issueUrl = this.githubService.createIssueUrl(
        repo.owner,
        repo.repo,
        {
          template: repo.template,
          title: title,
          body: body,
        }
      );

      // Open GitHub in new tab
      browser.tabs.create({ url: issueUrl });
      this.hide();
    } catch (error) {
      console.error("Error creating new issue:", error);
      throw error;
    }
  }

  /**
   * Truncate text to specified length
   * @param {string} text - Text to truncate
   * @param {number} maxLength - Maximum length
   * @returns {string} - Truncated text
   */
  truncateText(text, maxLength) {
    if (text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength) + "...";
  }
}

// Export singleton instance
export const themeRequest = new ThemeRequest();

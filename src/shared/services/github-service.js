/**
 * GitHub API service for issue creation and management
 */

import { isValidUrl } from "../utils/validation-utils.js";

/**
 * GitHub API service class
 */
export class GitHubService {
  constructor() {
    this.apiBase = "https://api.github.com";
  }

  /**
   * Search for existing issues in a repository
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {string} searchTerm - Search term
   * @returns {Promise<Object|null>} - Matching issue or null
   */
  async searchIssues(owner, repo, searchTerm) {
    try {
      const query = encodeURIComponent(
        `${searchTerm} repo:${owner}/${repo} in:title type:issue state:open`
      );
      const url = `${this.apiBase}/search/issues?q=${query}`;

      const response = await fetch(url, {
        headers: {
          Accept: "application/vnd.github.v3+json",
        },
      });

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`);
      }

      const data = await response.json();

      // Look for issues that contain the search term in the title
      const matchingIssues = data.items.filter(
        (issue) =>
          issue.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          issue.title.toLowerCase().includes("[theme]")
      );

      return matchingIssues.length > 0 ? matchingIssues[0] : null;
    } catch (error) {
      console.error("Error searching GitHub issues:", error);
      throw error;
    }
  }

  /**
   * Create GitHub issue URL with pre-filled data
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {Object} issueData - Issue data
   * @returns {string} - GitHub issue creation URL
   */
  createIssueUrl(owner, repo, issueData) {
    const { template, title, body } = issueData;

    let url = `https://github.com/${owner}/${repo}/issues/new`;

    const params = new URLSearchParams();
    if (template) params.append("template", template);
    if (title) params.append("title", title);
    if (body) params.append("body", body);

    if (params.toString()) {
      url += "?" + params.toString();
    }

    return url;
  }

  /**
   * Get repository information for different bug types
   * @param {string} bugType - Type of bug report
   * @returns {Object} - Repository information
   */
  getRepositoryForBugType(bugType) {
    switch (bugType) {
      case "1": // Current website's theme
      case "4": // Feature request
        return {
          owner: "sameerasw",
          repo: "my-internet",
          template:
            bugType === "1" ? "website-theme-request.md" : "feature_request.md",
        };
      case "2": // Extension issue
      case "3": // Browser transparency issue
      case "5": // Other
      default:
        return {
          owner: "sameerasw",
          repo: "zeninternet",
          template: "bug_report.md",
        };
    }
  }

  /**
   * Create theme request issue body
   * @param {string} hostname - Website hostname
   * @param {string} forcingValue - Forcing option value
   * @param {string} accountValue - Account requirement value
   * @returns {string} - Issue body
   */
  createThemeRequestBody(hostname, forcingValue, accountValue) {
    let issueBody = `Please add a theme for ${hostname}\n\n`;

    // Add forcing status
    if (forcingValue === "yes") {
      issueBody +=
        "✅ **Forcing attempted:** Yes, I have tried enabling force styling for this website and it still needs a proper theme.\n\n";
    } else if (forcingValue === "no") {
      issueBody +=
        "❌ **Forcing attempted:** No, I have not tried enabling force styling yet.\n\n";
    }

    // Add account requirement status
    if (accountValue === "yes") {
      issueBody +=
        "🔐 **Account required:** Yes, this website requires an account to access its content.\n\n";
    } else if (accountValue === "no") {
      issueBody +=
        "🌐 **Account required:** No, this website can be accessed without an account.\n\n";
    }

    issueBody +=
      "\n---\n\n*This request was generated automatically from the Zen Internet extension.*";

    return issueBody;
  }

  /**
   * Create bug report issue body
   * @param {string} bugType - Type of bug
   * @param {Object} data - Bug report data
   * @returns {string} - Issue body
   */
  createBugReportBody(bugType, data) {
    const { currentUrl, extensionData } = data;

    let body = `## Bug Report\n\n`;

    if (currentUrl) {
      body += `**Current URL:** ${currentUrl}\n\n`;
    }

    body += `**Bug Type:** ${this.getBugTypeDescription(bugType)}\n\n`;

    if (extensionData) {
      body += `## Extension Data\n\n`;
      body += `\`\`\`json\n${JSON.stringify(
        extensionData,
        null,
        2
      )}\n\`\`\`\n\n`;
    }

    body += `---\n\n*This report was generated automatically from the Zen Internet extension.*`;

    return body;
  }

  /**
   * Get bug type description
   * @param {string} bugType - Bug type number
   * @returns {string} - Bug type description
   */
  getBugTypeDescription(bugType) {
    switch (bugType) {
      case "1":
        return "Current website's theme";
      case "2":
        return "Extension issue";
      case "3":
        return "Browser transparency issue";
      case "4":
        return "Feature request";
      case "5":
        return "Other";
      default:
        return "Unknown";
    }
  }
}

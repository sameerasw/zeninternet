document.addEventListener("DOMContentLoaded", function () {
  const BROWSER_STORAGE_KEY = "transparentZenSettings";
  const SKIP_FORCE_THEMING_KEY = "skipForceThemingList";
  const SKIP_THEMING_KEY = "skipThemingList";
  const FALLBACK_BACKGROUND_KEY = "fallbackBackgroundList";
  const REPOSITORY_URL_KEY = "stylesRepositoryUrl";
  const DEFAULT_REPOSITORY_URL =
    "https://sameerasw.github.io/my-internet/styles.json";

  const globalSettingsElement = document.getElementById("global-settings-data");
  const skipListElement = document.getElementById("skip-list-data");
  const combinedWebsitesElement = document.getElementById(
    "combined-websites-data"
  );
  const deleteAllButton = document.getElementById("delete-all-data");
  const versionElement = document.getElementById("addon-version");
  const disableTransparencyToggle = document.getElementById(
    "disable-transparency"
  );
  // New toggle elements
  const disableHoverToggle = document.getElementById("disable-hover");
  const disableFooterToggle = document.getElementById("disable-footer");

  // Repository URL Elements
  const repositoryUrlInput = document.getElementById("repository-url");
  const setRepositoryUrlButton = document.getElementById("set-repository-url");
  const resetRepositoryUrlButton = document.getElementById(
    "reset-repository-url"
  );
  const repositoryUrlStatus = document.getElementById("repository-url-status");

  // Backup & Restore Elements
  const exportButton = document.getElementById("export-settings");
  const importFileInput = document.getElementById("import-file");
  const importStatusElement = document.getElementById("import-status");

  // Load and display the data
  loadAllData();

  // Display addon version
  displayAddonVersion();

  // Event listener for disable transparency toggle
  disableTransparencyToggle.addEventListener("change", function () {
    saveTransparencySettings(this.checked);
  });

  // Event listeners for new toggles
  disableHoverToggle.addEventListener("change", function () {
    saveHoverSettings(this.checked);
  });

  disableFooterToggle.addEventListener("change", function () {
    saveFooterSettings(this.checked);
  });

  // Event listener for delete all data button
  deleteAllButton.addEventListener("click", function () {
    if (
      confirm(
        "WARNING: This will delete ALL extension data including settings, website styles, and preferences. This action cannot be undone!\n\nAre you sure you want to proceed?"
      )
    ) {
      deleteAllData();
    }
  });

  // Repository URL event listeners
  setRepositoryUrlButton.addEventListener("click", setRepositoryUrl);
  resetRepositoryUrlButton.addEventListener("click", resetRepositoryUrl);

  // New event listeners for export and import functionality
  exportButton.addEventListener("click", exportSettings);
  importFileInput.addEventListener("change", importSettings);

  // Load the repository URL from storage
  loadRepositoryUrl();

  async function loadRepositoryUrl() {
    try {
      const data = await browser.storage.local.get(REPOSITORY_URL_KEY);
      const repositoryUrl = data[REPOSITORY_URL_KEY] || DEFAULT_REPOSITORY_URL;
      repositoryUrlInput.value = repositoryUrl;
    } catch (error) {
      console.error("Error loading repository URL:", error);
      repositoryUrlInput.value = DEFAULT_REPOSITORY_URL;
    }
  }

  async function setRepositoryUrl() {
    try {
      const newUrl = repositoryUrlInput.value.trim();

      if (!newUrl) {
        showRepositoryUrlStatus("Repository URL cannot be empty", "error");
        return;
      }

      // Simple URL validation
      try {
        new URL(newUrl);
      } catch (e) {
        showRepositoryUrlStatus("Invalid URL format", "error");
        return;
      }

      // Save the new URL to storage
      await browser.storage.local.set({ [REPOSITORY_URL_KEY]: newUrl });

      showRepositoryUrlStatus("Repository URL saved successfully", "success");

      // Prompt the user to clear styles data
      if (
        confirm(
          "Would you like to clear existing styles data to avoid conflicts with the new repository?\n\nThis will clear saved styles and website-specific settings, but keep your global settings."
        )
      ) {
        await clearStylesData();
      }
    } catch (error) {
      console.error("Error setting repository URL:", error);
      showRepositoryUrlStatus(`Error saving URL: ${error.message}`, "error");
    }
  }

  async function resetRepositoryUrl() {
    try {
      repositoryUrlInput.value = DEFAULT_REPOSITORY_URL;
      await browser.storage.local.set({
        [REPOSITORY_URL_KEY]: DEFAULT_REPOSITORY_URL,
      });

      showRepositoryUrlStatus("Repository URL reset to default", "success");

      // Prompt to clear styles data
      if (
        confirm(
          "Would you like to clear existing styles data to avoid conflicts?\n\nThis will clear saved styles and website-specific settings, but keep your global settings."
        )
      ) {
        await clearStylesData();
      }
    } catch (error) {
      console.error("Error resetting repository URL:", error);
      showRepositoryUrlStatus(`Error resetting URL: ${error.message}`, "error");
    }
  }

  async function clearStylesData() {
    try {
      // Get all storage data to filter what to keep and what to remove
      const allData = await browser.storage.local.get(null);

      // Create a new object with just the data we want to keep
      const dataToKeep = {};

      // Keep global settings
      if (allData[BROWSER_STORAGE_KEY]) {
        dataToKeep[BROWSER_STORAGE_KEY] = allData[BROWSER_STORAGE_KEY];
      }

      // Keep repository URL
      if (allData[REPOSITORY_URL_KEY]) {
        dataToKeep[REPOSITORY_URL_KEY] = allData[REPOSITORY_URL_KEY];
      }

      // Clear all storage first
      await browser.storage.local.clear();

      // Then restore the data we want to keep
      await browser.storage.local.set(dataToKeep);

      // Refresh the data display
      loadAllData();

      showRepositoryUrlStatus("Styles data cleared successfully", "success");
    } catch (error) {
      console.error("Error clearing styles data:", error);
      showRepositoryUrlStatus(`Error clearing data: ${error.message}`, "error");
    }
  }

  function showRepositoryUrlStatus(message, type) {
    repositoryUrlStatus.textContent = message;
    repositoryUrlStatus.className = `repository-url-status status-${type}`;

    // Clear the message after 5 seconds
    setTimeout(() => {
      repositoryUrlStatus.textContent = "";
      repositoryUrlStatus.className = "repository-url-status";
    }, 5000);
  }

  async function deleteAllData() {
    try {
      // Clear all storage data
      await browser.storage.local.clear();

      // Show confirmation message
      alert(
        "All data has been deleted successfully. The page will now reload."
      );

      // Reload the page to show empty state
      window.location.reload();
    } catch (error) {
      console.error("Error deleting data:", error);
      alert("An error occurred while trying to delete data: " + error.message);
    }
  }

  async function saveTransparencySettings(isDisabled) {
    try {
      const data = await browser.storage.local.get(BROWSER_STORAGE_KEY);
      const settings = data[BROWSER_STORAGE_KEY] || {};

      // Update the disableTransparency setting
      settings.disableTransparency = isDisabled;

      await browser.storage.local.set({ [BROWSER_STORAGE_KEY]: settings });
      // No notification - just save the setting silently
    } catch (error) {
      console.error("Error saving transparency settings:", error);
    }
  }

  // New functions to save hover and footer settings
  async function saveHoverSettings(isDisabled) {
    try {
      const data = await browser.storage.local.get(BROWSER_STORAGE_KEY);
      const settings = data[BROWSER_STORAGE_KEY] || {};

      // Update the disableHover setting
      settings.disableHover = isDisabled;

      await browser.storage.local.set({ [BROWSER_STORAGE_KEY]: settings });
      // No notification - just save the setting silently
    } catch (error) {
      console.error("Error saving hover settings:", error);
    }
  }

  async function saveFooterSettings(isDisabled) {
    try {
      const data = await browser.storage.local.get(BROWSER_STORAGE_KEY);
      const settings = data[BROWSER_STORAGE_KEY] || {};

      // Update the disableFooter setting
      settings.disableFooter = isDisabled;

      await browser.storage.local.set({ [BROWSER_STORAGE_KEY]: settings });
      // No notification - just save the setting silently
    } catch (error) {
      console.error("Error saving footer settings:", error);
    }
  }

  // Export settings functionality
  async function exportSettings() {
    try {
      // Retrieve all storage data to find site-specific settings
      const allData = await browser.storage.local.get(null);

      // Get the fallback background list once
      const fallbackBackgroundList = allData[FALLBACK_BACKGROUND_KEY] || [];

      // Extract only the settings we want to backup
      const settingsToBackup = {
        [BROWSER_STORAGE_KEY]: allData[BROWSER_STORAGE_KEY] || {},
        [SKIP_FORCE_THEMING_KEY]: allData[SKIP_FORCE_THEMING_KEY] || [],
        [SKIP_THEMING_KEY]: allData[SKIP_THEMING_KEY] || [],
        [FALLBACK_BACKGROUND_KEY]: fallbackBackgroundList,
        [REPOSITORY_URL_KEY]:
          allData[REPOSITORY_URL_KEY] || DEFAULT_REPOSITORY_URL,
      };

      // Remove fallbackBackgroundList from global settings if it exists there
      if (settingsToBackup[BROWSER_STORAGE_KEY].fallbackBackgroundList) {
        delete settingsToBackup[BROWSER_STORAGE_KEY].fallbackBackgroundList;
      }

      // Also extract site-specific settings (keys that start with BROWSER_STORAGE_KEY.)
      const siteSpecificSettings = {};
      for (const [key, value] of Object.entries(allData)) {
        if (key.startsWith(BROWSER_STORAGE_KEY + ".")) {
          siteSpecificSettings[key] = value;
        }
      }

      // Add export timestamp and version
      const manifest = browser.runtime.getManifest();
      const exportData = {
        exportDate: new Date().toISOString(),
        addonVersion: manifest.version,
        settings: settingsToBackup,
        siteSettings: siteSpecificSettings,
      };

      // Convert to JSON
      const jsonData = JSON.stringify(exportData, null, 2);

      // Create a blob and download link
      const blob = new Blob([jsonData], { type: "application/json" });
      const url = URL.createObjectURL(blob);

      // Create a temporary anchor and trigger download
      const a = document.createElement("a");
      a.href = url;
      a.download = `zen-internet-settings-${
        new Date().toISOString().split("T")[0]
      }.json`;
      document.body.appendChild(a);
      a.click();

      // Cleanup
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 0);

      // Show success message
      showImportStatus("Settings exported successfully!", "success");
    } catch (error) {
      console.error("Error exporting settings:", error);
      showImportStatus(`Export failed: ${error.message}`, "error");
    }
  }

  // Import settings functionality
  async function importSettings(event) {
    try {
      const file = event.target.files[0];
      if (!file) return;

      const reader = new FileReader();

      reader.onload = async (e) => {
        try {
          const importData = JSON.parse(e.target.result);

          // Validate the imported data structure
          if (
            !importData.settings ||
            !importData.settings[BROWSER_STORAGE_KEY]
          ) {
            throw new Error("Invalid settings file format");
          }

          // Confirm the import
          if (
            confirm(
              `Are you sure you want to import settings from ${importData.exportDate}? This will overwrite your current settings.`
            )
          ) {
            // First store the global settings, lists, and repository URL
            const importOperations = {
              [BROWSER_STORAGE_KEY]: importData.settings[BROWSER_STORAGE_KEY],
              [SKIP_FORCE_THEMING_KEY]:
                importData.settings[SKIP_FORCE_THEMING_KEY] || [],
              [SKIP_THEMING_KEY]: importData.settings[SKIP_THEMING_KEY] || [],
              [REPOSITORY_URL_KEY]:
                importData.settings[REPOSITORY_URL_KEY] ||
                DEFAULT_REPOSITORY_URL,
            };

            // Then add any site-specific settings if they exist
            if (importData.siteSettings) {
              for (const [key, value] of Object.entries(
                importData.siteSettings
              )) {
                importOperations[key] = value;
              }
            }

            // Apply all settings at once
            await browser.storage.local.set(importOperations);

            showImportStatus(
              "Settings imported successfully! Reloading...",
              "success"
            );

            // Reload the page after a short delay
            setTimeout(() => {
              window.location.reload();
            }, 1500);
          } else {
            // User cancelled
            importFileInput.value = "";
            showImportStatus("Import cancelled", "error");
          }
        } catch (parseError) {
          console.error("Error parsing import file:", parseError);
          showImportStatus(`Import failed: ${parseError.message}`, "error");
        }
      };

      reader.readAsText(file);
    } catch (error) {
      console.error("Error handling import:", error);
      showImportStatus(`Import failed: ${error.message}`, "error");
    }
  }

  // Helper function to show import status messages
  function showImportStatus(message, type) {
    importStatusElement.textContent = message;
    importStatusElement.className = `import-status status-${type}`;

    // Clear the message after 5 seconds
    setTimeout(() => {
      importStatusElement.textContent = "";
      importStatusElement.className = "import-status";
    }, 5000);
  }

  async function displayAddonVersion() {
    const manifest = browser.runtime.getManifest();
    versionElement.textContent = `Version: ${manifest.version}`;
  }

  async function loadAllData() {
    try {
      // Load all data from storage
      const allData = await browser.storage.local.get(null);

      // Extract global settings
      const globalSettings = allData[BROWSER_STORAGE_KEY] || {};

      // Restore the toggle states based on actual values
      disableTransparencyToggle.checked =
        globalSettings.disableTransparency || false;
      disableHoverToggle.checked = globalSettings.disableHover || false;
      disableFooterToggle.checked = globalSettings.disableFooter || false;

      // Extract skip lists
      const skipForceList = allData[SKIP_FORCE_THEMING_KEY] || [];
      const skipThemingList = allData[SKIP_THEMING_KEY] || [];
      const fallbackBackgroundList = allData[FALLBACK_BACKGROUND_KEY] || [];

      // Display the data
      displayGlobalSettings(globalSettings);
      displayCombinedSkipLists(
        skipForceList,
        skipThemingList,
        fallbackBackgroundList,
        globalSettings.whitelistMode || false,
        globalSettings.whitelistStyleMode || false
      );
      displayCombinedWebsiteData(allData);
    } catch (error) {
      console.error("Error loading data:", error);
    }
  }

  function displayGlobalSettings(settings) {
    globalSettingsElement.innerHTML = "";

    const table = document.createElement("table");
    table.classList.add("data-table");

    // Table header
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    headerRow.innerHTML = `<th>Setting</th><th>Value</th>`;
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Table body
    const tbody = document.createElement("tbody");

    for (const [key, value] of Object.entries(settings)) {
      // Skip lastFetchedTime as it will be formatted differently
      if (key === "lastFetchedTime") continue;

      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${formatSettingName(key)}</td>
        <td>${formatSettingValue(value)}</td>
      `;
      tbody.appendChild(row);
    }

    // Add last fetched time with formatted date if available
    if (settings.lastFetchedTime) {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${formatSettingName("lastFetchedTime")}</td>
        <td>${new Date(settings.lastFetchedTime).toLocaleString()}</td>
      `;
      tbody.appendChild(row);
    } else {
      // Show "Never" if no lastFetchedTime is found
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${formatSettingName("lastFetchedTime")}</td>
        <td><span class="null-value">Never</span></td>
      `;
      tbody.appendChild(row);
    }

    table.appendChild(tbody);
    globalSettingsElement.appendChild(table);
  }

  function displayCombinedSkipLists(
    skipForceList,
    skipThemingList,
    fallbackBackgroundList,
    isWhitelistMode,
    isWhitelistStyleMode
  ) {
    skipListElement.innerHTML = "";

    // Create title and description section
    const titleSection = document.createElement("div");
    titleSection.className = "list-title-section";

    const forceModeName = isWhitelistMode ? "Whitelist" : "Blacklist";
    const styleModeName = isWhitelistStyleMode ? "Whitelist" : "Blacklist";

    titleSection.innerHTML = `
      <h3>Website Lists Overview</h3>
      <div class="mode-info">
        <div><strong>Force Styling Mode:</strong> ${forceModeName} Mode (${
      isWhitelistMode
        ? "only apply to sites in the list"
        : "apply to all except sites in the list"
    })</div>
        <div><strong>General Styling Mode:</strong> ${styleModeName} Mode (${
      isWhitelistStyleMode
        ? "only apply to sites in the list"
        : "apply to all except sites in the list"
    })</div>
      </div>
    `;

    skipListElement.appendChild(titleSection);

    // Add Clear All Lists button
    if (
      skipForceList.length > 0 ||
      skipThemingList.length > 0 ||
      fallbackBackgroundList.length > 0
    ) {
      const clearAllButton = document.createElement("button");
      clearAllButton.classList.add(
        "action-button",
        "danger",
        "clear-list-button"
      );
      clearAllButton.innerHTML = '<i class="fas fa-trash"></i> Clear All Lists';
      clearAllButton.addEventListener("click", clearAllSkipLists);
      skipListElement.appendChild(clearAllButton);
    }

    // Create container for the three tables
    const tablesContainer = document.createElement("div");
    tablesContainer.className = "tables-container";

    // Create force styling list
    const forceListSection = createSingleListSection(
      skipForceList,
      isWhitelistMode,
      "Force Styling List",
      isWhitelistMode
        ? "Sites where forced styling IS applied"
        : "Sites where forced styling is NOT applied",
      SKIP_FORCE_THEMING_KEY
    );

    // Create regular styling list
    const regularListSection = createSingleListSection(
      skipThemingList,
      isWhitelistStyleMode,
      "Regular Styling List",
      isWhitelistStyleMode
        ? "Sites where regular styling IS applied"
        : "Sites where regular styling is NOT applied",
      SKIP_THEMING_KEY
    );

    // Create fallback background list
    const fallbackListSection = createSingleListSection(
      fallbackBackgroundList,
      false, // Fallback background is not whitelist/blacklist based
      "Fallback Background List",
      "Sites where a default background added, no transparency",
      FALLBACK_BACKGROUND_KEY
    );

    tablesContainer.appendChild(forceListSection);
    tablesContainer.appendChild(regularListSection);
    tablesContainer.appendChild(fallbackListSection);
    skipListElement.appendChild(tablesContainer);
  }

  function createSingleListSection(
    list,
    isWhitelistMode,
    title,
    description,
    storageKey
  ) {
    const section = document.createElement("div");
    section.className = "list-section";

    const sectionTitle = document.createElement("h4");
    sectionTitle.textContent = title;
    section.appendChild(sectionTitle);

    const sectionDescription = document.createElement("p");
    sectionDescription.className = "list-description";
    sectionDescription.textContent = description;
    section.appendChild(sectionDescription);

    if (list.length === 0) {
      const emptyMessage = document.createElement("div");
      emptyMessage.className = "no-data";
      emptyMessage.textContent = "No websites in this list";
      section.appendChild(emptyMessage);
      return section;
    }

    const table = document.createElement("table");
    table.classList.add("data-table");

    // Table header
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    headerRow.innerHTML = `<th>Website</th><th>Action</th>`;
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Table body
    const tbody = document.createElement("tbody");

    for (const site of list) {
      const row = document.createElement("tr");

      // Website column
      const siteCell = document.createElement("td");
      siteCell.textContent = site;
      row.appendChild(siteCell);

      // Action column
      const actionCell = document.createElement("td");
      const removeButton = document.createElement("button");
      removeButton.className = "remove-site-button";
      removeButton.innerHTML = '<i class="fas fa-times"></i>';
      removeButton.title = "Remove from list";
      removeButton.addEventListener("click", function () {
        removeSiteFromList(site, storageKey);
      });
      actionCell.appendChild(removeButton);
      row.appendChild(actionCell);

      tbody.appendChild(row);
    }

    table.appendChild(tbody);
    section.appendChild(table);
    return section;
  }

  async function removeSiteFromList(site, listKey) {
    try {
      // Get current list
      const data = await browser.storage.local.get(listKey);
      const list = data[listKey] || [];

      // Remove the site
      const newList = list.filter((item) => item !== site);

      // Save updated list
      await browser.storage.local.set({ [listKey]: newList });

      // Refresh the display
      loadAllData();

      console.log(`Removed ${site} from ${listKey}`);
    } catch (error) {
      console.error(`Error removing site from list: ${error}`);
      alert(`An error occurred: ${error.message}`);
    }
  }

  async function clearAllSkipLists() {
    try {
      if (
        confirm(
          "Are you sure you want to clear ALL website lists? This will remove all entries from:\n- Force Styling List\n- Regular Styling List\n- Fallback Background List\n\nThis action cannot be undone."
        )
      ) {
        await browser.storage.local.set({
          [SKIP_FORCE_THEMING_KEY]: [],
          [SKIP_THEMING_KEY]: [],
          [FALLBACK_BACKGROUND_KEY]: [],
        });
        loadAllData(); // Reload to show empty lists
        console.log("All skip lists cleared");
      }
    } catch (error) {
      console.error("Error clearing skip lists:", error);
      alert("An error occurred while clearing the lists: " + error.message);
    }
  }

  function displayCombinedWebsiteData(data) {
    combinedWebsitesElement.innerHTML = "";

    const styles = data.styles || {};
    const websites = styles.website || {};
    const websiteKeys = Object.keys(websites);

    // Find all site-specific settings
    const siteSettings = {};
    for (const [key, value] of Object.entries(data)) {
      if (key.startsWith(BROWSER_STORAGE_KEY + ".")) {
        const siteName = key.substring(BROWSER_STORAGE_KEY.length + 1);
        siteSettings[siteName] = value;
      }
    }

    if (websiteKeys.length === 0) {
      combinedWebsitesElement.innerHTML =
        '<div class="no-data">No websites found. Try fetching styles first.</div>';
      return;
    }

    // Create search filter
    const searchContainer = document.createElement("div");
    searchContainer.classList.add("search-container");

    const searchInput = document.createElement("input");
    searchInput.type = "text";
    searchInput.placeholder = "Search websites...";
    searchInput.classList.add("search-input");
    searchInput.addEventListener("input", function () {
      filterWebsites(this.value.toLowerCase());
    });

    const searchIcon = document.createElement("i");
    searchIcon.className = "fas fa-search search-icon";

    searchContainer.appendChild(searchIcon);
    searchContainer.appendChild(searchInput);

    combinedWebsitesElement.appendChild(searchContainer);

    // Create expand all button
    const expandAllButton = document.createElement("button");
    expandAllButton.classList.add(
      "action-button",
      "secondary",
      "view-all-button"
    );
    expandAllButton.textContent = "Expand All";
    expandAllButton.addEventListener("click", function () {
      const expanded = this.textContent === "Collapse All";
      const panels = document.querySelectorAll(".website-panel");

      panels.forEach((panel) => {
        const header = panel.querySelector(".website-header");
        const content = panel.querySelector(".website-content");

        if (expanded) {
          header.classList.remove("active");
          content.style.maxHeight = null;

          // Also collapse all CSS blocks
          content.querySelectorAll(".css-block-header").forEach((cssHeader) => {
            cssHeader.classList.remove("active");
            const cssContent = cssHeader.nextElementSibling;
            if (cssContent) cssContent.style.maxHeight = null;
          });
        } else {
          header.classList.add("active");
          content.style.maxHeight = content.scrollHeight + "px";
        }
      });

      this.textContent = expanded ? "Expand All" : "Collapse All";
    });

    combinedWebsitesElement.appendChild(expandAllButton);

    const websitesContainer = document.createElement("div");
    websitesContainer.classList.add("websites-container");
    combinedWebsitesElement.appendChild(websitesContainer);

    // Sort websites alphabetically
    websiteKeys.sort();

    // Create panels for each website
    for (const website of websiteKeys) {
      const websitePanel = document.createElement("div");
      websitePanel.classList.add("website-panel");
      websitePanel.dataset.website = website.toLowerCase();

      const header = document.createElement("div");
      header.classList.add("website-header");

      // Create website name with feature count
      const features = websites[website];
      const featureCount = Object.keys(features).length;

      // Get site settings if available
      const siteName = website.replace(".css", "");
      let domainName;
      // Declare settingsData at a higher scope so it's accessible throughout the function
      let settingsData = {};

      // Handle wildcard sites correctly
      if (siteName.startsWith("+")) {
        domainName = siteName.slice(1);
        // For wildcard sites, we need to find any matching domain in settings
        const matchingDomains = Object.keys(siteSettings).filter(
          (domain) => domain === domainName || domain.endsWith(`.${domainName}`)
        );

        // Use the first matching domain's settings if any found
        const settingsKey =
          matchingDomains.length > 0 ? matchingDomains[0] : null;
        settingsData = settingsKey ? siteSettings[settingsKey] : {};
      } else {
        // For direct domains, just check the domain and www.domain
        domainName = siteName;
        settingsData =
          siteSettings[domainName] || siteSettings[`www.${domainName}`] || {};
      }

      header.innerHTML = `
        <div class="website-header-content">
          <span class="website-name">${website}</span>
          <span class="feature-count">${featureCount} features</span>
        </div>
      `;

      header.addEventListener("click", function () {
        this.classList.toggle("active");
        const content = this.nextElementSibling;
        if (content.style.maxHeight) {
          content.style.maxHeight = null;
        } else {
          content.style.maxHeight = content.scrollHeight + "px";
        }
      });

      const content = document.createElement("div");
      content.classList.add("website-content");

      // Create CSS blocks for each feature
      for (const [feature, css] of Object.entries(features)) {
        const cssBlock = document.createElement("div");
        cssBlock.classList.add("css-block");

        // Get the feature's enabled status from site settings
        const isEnabled = settingsData[feature] !== false; // true by default

        // Create the block header with feature name and status
        const cssBlockHeader = document.createElement("div");
        cssBlockHeader.classList.add("css-block-header");
        cssBlockHeader.innerHTML = `
          <span class="feature-name">${feature}</span>
          <span class="feature-status ${isEnabled ? "enabled" : "disabled"}">${
          isEnabled ? "Enabled" : "Disabled"
        }</span>
        `;

        // Make the CSS block header toggleable
        cssBlockHeader.addEventListener("click", function (e) {
          // Don't expand if clicking on status badge
          if (e.target.classList.contains("feature-status")) return;

          this.classList.toggle("active");
          const cssContent = this.nextElementSibling;
          if (cssContent.style.maxHeight) {
            cssContent.style.maxHeight = null;
          } else {
            cssContent.style.maxHeight = cssContent.scrollHeight + "px";
          }
        });

        // Create the CSS content area
        const cssContent = document.createElement("div");
        cssContent.classList.add("css-content");

        const cssCode = document.createElement("pre");
        cssCode.classList.add("css-code");
        cssCode.textContent = css;
        cssContent.appendChild(cssCode);

        cssBlock.appendChild(cssBlockHeader);
        cssBlock.appendChild(cssContent);
        content.appendChild(cssBlock);
      }

      websitePanel.appendChild(header);
      websitePanel.appendChild(content);
      websitesContainer.appendChild(websitePanel);
    }

    // Filter function for search
    function filterWebsites(query) {
      const panels = websitesContainer.querySelectorAll(".website-panel");

      panels.forEach((panel) => {
        const website = panel.dataset.website;
        if (website.includes(query)) {
          panel.style.display = "";
        } else {
          panel.style.display = "none";
        }
      });
    }
  }

  // Helper Functions
  function formatSettingName(name) {
    // Convert camelCase to Title Case with spaces
    return name
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (str) => str.toUpperCase());
  }

  function formatSettingValue(value) {
    if (typeof value === "boolean") {
      return value
        ? '<span class="badge enabled">Enabled</span>'
        : '<span class="badge disabled">Disabled</span>';
    } else if (value === null) {
      return '<span class="null-value">null</span>';
    } else if (typeof value === "object") {
      return '<span class="object-value">{Object}</span>';
    } else {
      return value;
    }
  }
});

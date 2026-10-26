document.addEventListener("DOMContentLoaded", async function () {
  const BROWSER_STORAGE_KEY = "transparentZenSettings";
  const SKIP_FORCE_THEMING_KEY = "skipForceThemingList";
  const SKIP_THEMING_KEY = "skipThemingList";
  const FALLBACK_BACKGROUND_KEY = "fallbackBackgroundList";
  const REPOSITORY_URL_KEY = "stylesRepositoryUrl";
  const STYLES_MAPPING_KEY = "stylesMapping";
  const DEFAULT_REPOSITORY_URL =
    "https://sameerasw.github.io/my-internet/styles.json";
  const USER_STYLES_MAPPING_KEY = "userStylesMapping";

  const t = (key, substitutions) => window.ZenI18n.t(key, substitutions);

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
  const disableHoverToggle = document.getElementById("disable-hover");
  const disableFooterToggle = document.getElementById("disable-footer");
  const disableDarkReaderToggle = document.getElementById("disable-darkreader");
  const enableLogsToggle = document.getElementById("enable-logs");
  const interfaceLanguageSelect = document.getElementById("interface-language");

  const repositoryUrlInput = document.getElementById("repository-url");
  const setRepositoryUrlButton = document.getElementById("set-repository-url");
  const resetRepositoryUrlButton = document.getElementById(
    "reset-repository-url"
  );
  const repositoryUrlStatus = document.getElementById("repository-url-status");

  const exportButton = document.getElementById("export-settings");
  const importFileInput = document.getElementById("import-file");
  const importStatusElement = document.getElementById("import-status");

  await window.ZenI18n.init();
  window.ZenI18n.apply();
  await loadInterfaceLanguage();

  loadAllData();
  displayAddonVersion();

  disableTransparencyToggle.addEventListener("change", function () {
    saveTransparencySettings(this.checked);
  });

  disableHoverToggle.addEventListener("change", function () {
    saveHoverSettings(this.checked);
  });

  disableFooterToggle.addEventListener("change", function () {
    saveFooterSettings(this.checked);
  });

  disableDarkReaderToggle.addEventListener("change", function () {
    saveDarkReaderSettings(this.checked);
  });

  enableLogsToggle.addEventListener("change", function () {
    saveLogSettings(this.checked);
  });

  deleteAllButton.addEventListener("click", function () {
    if (confirm(t("settingsConfirmDeleteAll"))) {
      deleteAllData();
    }
  });

  setRepositoryUrlButton.addEventListener("click", setRepositoryUrl);
  resetRepositoryUrlButton.addEventListener("click", resetRepositoryUrl);
  exportButton.addEventListener("click", exportSettings);
  importFileInput.addEventListener("change", importSettings);

  combinedWebsitesElement.addEventListener("change", async (event) => {
    if (event.target.type === "checkbox" && event.target.dataset.website && event.target.dataset.feature) {
      await saveFeatureToggle(event.target.dataset.website, event.target.dataset.feature, event.target.checked);
    }
  });

  loadRepositoryUrl();

  /**
   * Populates the interface language selector and saves the preference.
   */
  async function loadInterfaceLanguage() {
    if (!interfaceLanguageSelect) return;

    const languages = await window.ZenI18n.getLanguages();
    const preference = await window.ZenI18n.getPreference();

    interfaceLanguageSelect.innerHTML = "";

    const autoOption = document.createElement("option");
    autoOption.value = window.ZenI18n.AUTO;
    autoOption.textContent = t("settingsLanguageAuto");
    interfaceLanguageSelect.appendChild(autoOption);

    for (const [localeId, info] of Object.entries(languages)) {
      const option = document.createElement("option");
      option.value = localeId;
      option.textContent = (info && info.name) || localeId;
      interfaceLanguageSelect.appendChild(option);
    }

    interfaceLanguageSelect.value = preference;

    interfaceLanguageSelect.addEventListener("change", async function () {
      await window.ZenI18n.setLanguage(this.value);
      window.location.reload();
    });
  }

  /**
   * Loads the current repository URL from storage.
   */
  async function loadRepositoryUrl() {
    try {
      const data = await browser.storage.local.get(REPOSITORY_URL_KEY);
      const repositoryUrl = data[REPOSITORY_URL_KEY] || DEFAULT_REPOSITORY_URL;
      repositoryUrlInput.value = repositoryUrl;
    } catch (error) {
      repositoryUrlInput.value = DEFAULT_REPOSITORY_URL;
    }
  }

  /**
   * Saves a new repository URL to storage.
   */
  async function setRepositoryUrl() {
    try {
      const newUrl = repositoryUrlInput.value.trim();

      if (!newUrl) {
        showRepositoryUrlStatus(t("settingsRepoUrlEmpty"), "error");
        return;
      }

      try {
        new URL(newUrl);
      } catch (e) {
        showRepositoryUrlStatus(t("settingsInvalidUrl"), "error");
        return;
      }

      await browser.storage.local.set({ [REPOSITORY_URL_KEY]: newUrl });
      showRepositoryUrlStatus(t("settingsRepoUrlSaved"), "success");

      if (confirm(t("settingsConfirmClearForNewRepo"))) {
        await clearStylesData();
      }
    } catch (error) {
      showRepositoryUrlStatus(
        t("settingsErrorSavingUrl", error.message),
        "error"
      );
    }
  }

  /**
   * Resets the repository URL to its default value.
   */
  async function resetRepositoryUrl() {
    try {
      repositoryUrlInput.value = DEFAULT_REPOSITORY_URL;
      await browser.storage.local.set({
        [REPOSITORY_URL_KEY]: DEFAULT_REPOSITORY_URL,
      });

      showRepositoryUrlStatus(t("settingsRepoUrlReset"), "success");

      if (confirm(t("settingsConfirmClearStyles"))) {
        await clearStylesData();
      }
    } catch (error) {
      showRepositoryUrlStatus(
        t("settingsErrorResettingUrl", error.message),
        "error"
      );
    }
  }

  /**
   * Clears styled website data from storage.
   */
  async function clearStylesData() {
    try {
      const allData = await browser.storage.local.get(null);
      const dataToKeep = {};

      if (allData[BROWSER_STORAGE_KEY]) {
        dataToKeep[BROWSER_STORAGE_KEY] = allData[BROWSER_STORAGE_KEY];
      }
      if (allData[REPOSITORY_URL_KEY]) {
        dataToKeep[REPOSITORY_URL_KEY] = allData[REPOSITORY_URL_KEY];
      }
      if (allData[STYLES_MAPPING_KEY]) {
        dataToKeep[STYLES_MAPPING_KEY] = allData[STYLES_MAPPING_KEY];
      }

      await browser.storage.local.clear();
      await browser.storage.local.set(dataToKeep);
      loadAllData();
      showRepositoryUrlStatus(t("settingsStylesCleared"), "success");
    } catch (error) {
      showRepositoryUrlStatus(
        t("settingsErrorClearingData", error.message),
        "error"
      );
    }
  }

  /**
   * Displays the current operation status of the repository URL.
   */
  function showRepositoryUrlStatus(message, type) {
    repositoryUrlStatus.textContent = message;
    repositoryUrlStatus.className = `repository-url-status status-${type}`;
    setTimeout(() => {
      repositoryUrlStatus.textContent = "";
      repositoryUrlStatus.className = "repository-url-status";
    }, 5000);
  }

  /**
   * Deletes all extension data from storage.
   */
  async function deleteAllData() {
    try {
      await browser.storage.local.clear();
      alert(t("settingsDeleteSuccess"));
      window.location.reload();
    } catch (error) {
      alert(t("settingsDeleteError", error.message));
    }
  }

  /**
   * Saves transparency preference to storage.
   */
  async function saveTransparencySettings(isDisabled) {
    try {
      const data = await browser.storage.local.get(BROWSER_STORAGE_KEY);
      const settings = data[BROWSER_STORAGE_KEY] || {};
      settings.disableTransparency = isDisabled;
      await browser.storage.local.set({ [BROWSER_STORAGE_KEY]: settings });
    } catch (error) {
      console.error("Error saving transparency settings:", error);
    }
  }

  /**
   * Saves hover preference to storage.
   */
  async function saveHoverSettings(isDisabled) {
    try {
      const data = await browser.storage.local.get(BROWSER_STORAGE_KEY);
      const settings = data[BROWSER_STORAGE_KEY] || {};
      settings.disableHover = isDisabled;
      await browser.storage.local.set({ [BROWSER_STORAGE_KEY]: settings });
    } catch (error) {
      console.error("Error saving hover settings:", error);
    }
  }

  /**
   * Saves footer preference to storage.
   */
  async function saveFooterSettings(isDisabled) {
    try {
      const data = await browser.storage.local.get(BROWSER_STORAGE_KEY);
      const settings = data[BROWSER_STORAGE_KEY] || {};
      settings.disableFooter = isDisabled;
      await browser.storage.local.set({ [BROWSER_STORAGE_KEY]: settings });
    } catch (error) {
      console.error("Error saving footer settings:", error);
    }
  }

  /**
   * Saves darkreader preference to storage.
   */
  async function saveDarkReaderSettings(isDisabled) {
    try {
      const data = await browser.storage.local.get(BROWSER_STORAGE_KEY);
      const settings = data[BROWSER_STORAGE_KEY] || {};
      settings.disableDarkReader = isDisabled;
      await browser.storage.local.set({ [BROWSER_STORAGE_KEY]: settings });
    } catch (error) {
      console.error("Error saving darkreader settings:", error);
    }
  }

  /**
   * Saves logging preference to storage.
   */
  async function saveLogSettings(isEnabled) {
    try {
      const data = await browser.storage.local.get(BROWSER_STORAGE_KEY);
      const settings = data[BROWSER_STORAGE_KEY] || {};
      settings.enableLogs = isEnabled;
      await browser.storage.local.set({ [BROWSER_STORAGE_KEY]: settings });
    } catch (error) {
      console.error("Error saving log settings:", error);
    }
  }

  /**
   * Saves individual feature toggle preference for a website.
   */
  async function saveFeatureToggle(websiteDomain, feature, isEnabled) {
    try {
      const siteKey = `${BROWSER_STORAGE_KEY}.${websiteDomain}`;
      const data = await browser.storage.local.get(siteKey);
      const siteSettings = data[siteKey] || {};
      siteSettings[feature] = isEnabled;
      await browser.storage.local.set({ [siteKey]: siteSettings });
    } catch (error) {
      console.error("Error saving feature toggle:", error);
    }
  }

  /**
   * Exports settings and site-specific preferences as a JSON file.
   */
  async function exportSettings() {
    try {
      const allData = await browser.storage.local.get(null);
      const fallbackBackgroundList = allData[FALLBACK_BACKGROUND_KEY] || [];

      const settingsToBackup = {
        [BROWSER_STORAGE_KEY]: allData[BROWSER_STORAGE_KEY] || {},
        [SKIP_FORCE_THEMING_KEY]: allData[SKIP_FORCE_THEMING_KEY] || [],
        [SKIP_THEMING_KEY]: allData[SKIP_THEMING_KEY] || [],
        [FALLBACK_BACKGROUND_KEY]: fallbackBackgroundList,
        [REPOSITORY_URL_KEY]:
          allData[REPOSITORY_URL_KEY] || DEFAULT_REPOSITORY_URL,
      };

      if (settingsToBackup[BROWSER_STORAGE_KEY].fallbackBackgroundList) {
        delete settingsToBackup[BROWSER_STORAGE_KEY].fallbackBackgroundList;
      }

      const siteSpecificSettings = {};
      for (const [key, value] of Object.entries(allData)) {
        if (key.startsWith(BROWSER_STORAGE_KEY + ".")) {
          siteSpecificSettings[key] = value;
        }
      }

      const userMappingData = allData[USER_STYLES_MAPPING_KEY] || { mapping: {} };
      settingsToBackup.userMappings = userMappingData;

      const manifest = browser.runtime.getManifest();
      const exportData = {
        exportDate: new Date().toISOString(),
        addonVersion: manifest.version,
        settings: settingsToBackup,
        siteSettings: siteSpecificSettings,
      };

      const jsonData = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonData], { type: "application/json" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `zen-internet-settings-${
        new Date().toISOString().split("T")[0]
      }.json`;
      document.body.appendChild(a);
      a.click();

      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 0);

      showImportStatus(t("settingsSettingsExported"), "success");
    } catch (error) {
      showImportStatus(t("settingsExportFailed", error.message), "error");
    }
  }

  /**
   * Imports settings and site-specific preferences from a JSON file.
   */
  async function importSettings(event) {
    try {
      const file = event.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const importData = JSON.parse(e.target.result);

          if (
            !importData.settings ||
            !importData.settings[BROWSER_STORAGE_KEY]
          ) {
            throw new Error(t("settingsInvalidFile"));
          }

          if (confirm(t("settingsImportConfirm", importData.exportDate))) {
            const importOperations = {
              [BROWSER_STORAGE_KEY]: importData.settings[BROWSER_STORAGE_KEY],
              [SKIP_FORCE_THEMING_KEY]:
                importData.settings[SKIP_FORCE_THEMING_KEY] || [],
              [SKIP_THEMING_KEY]: importData.settings[SKIP_THEMING_KEY] || [],
              [REPOSITORY_URL_KEY]:
                importData.settings[REPOSITORY_URL_KEY] ||
                DEFAULT_REPOSITORY_URL,
            };

            if (importData.siteSettings) {
              for (const [key, value] of Object.entries(
                importData.siteSettings
              )) {
                importOperations[key] = value;
              }
            }

            if (importData.userMappings) {
              importOperations[USER_STYLES_MAPPING_KEY] = importData.userMappings;
            }

            await browser.storage.local.set(importOperations);
            showImportStatus(t("settingsImportSuccess"), "success");

            setTimeout(() => {
              window.location.reload();
            }, 1500);
          } else {
            importFileInput.value = "";
            showImportStatus(t("settingsImportCancelled"), "error");
          }
        } catch (parseError) {
          showImportStatus(
            t("settingsImportFailed", parseError.message),
            "error"
          );
        }
      };

      reader.readAsText(file);
    } catch (error) {
      showImportStatus(t("settingsImportFailed", error.message), "error");
    }
  }

  /**
   * Displays the status of an import or export operation.
   */
  function showImportStatus(message, type) {
    importStatusElement.textContent = message;
    importStatusElement.className = `import-status status-${type}`;
    setTimeout(() => {
      importStatusElement.textContent = "";
      importStatusElement.className = "import-status";
    }, 5000);
  }

  /**
   * Displays the current version of the extension.
   */
  async function displayAddonVersion() {
    const manifest = browser.runtime.getManifest();
    versionElement.textContent = t("settingsVersion", manifest.version);
  }

  /**
   * Loads all stored data and updates the UI.
   */
  async function loadAllData() {
    log("Loading all extension data for viewer...");
    try {
      const data = await browser.storage.local.get(null);
      displayGlobalSettings(data);
      displaySkipLists(data);
      displayCombinedWebsiteData(data);
      displayMappingData(data);
      await loadUserMappingsUI();
      setupCollapsibleSections();
    } catch (error) {
      console.error("Error loading data:", error);
    }
  }

  /**
   * Renders global settings in a table.
   */
  function displayGlobalSettings(data) {
    const settings = data[BROWSER_STORAGE_KEY] || {};
    disableTransparencyToggle.checked = settings.disableTransparency || false;
    disableHoverToggle.checked = settings.disableHover || false;
    disableFooterToggle.checked = settings.disableFooter || false;
    disableDarkReaderToggle.checked = settings.disableDarkReader || false;
    enableLogsToggle.checked = settings.enableLogs || false;

    globalSettingsElement.innerHTML = "";
    const table = document.createElement("table");
    table.classList.add("data-table");

    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    headerRow.innerHTML = `<th>${t("settingsTableSetting")}</th><th>${t(
      "settingsTableValue"
    )}</th>`;
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");

    for (const [key, value] of Object.entries(settings)) {
      if (key === "lastFetchedTime") continue;
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${formatSettingName(key)}</td>
        <td>${formatSettingValue(value)}</td>
      `;
      tbody.appendChild(row);
    }

    if (settings.lastFetchedTime) {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${formatSettingName("lastFetchedTime")}</td>
        <td>${new Date(settings.lastFetchedTime).toLocaleString()}</td>
      `;
      tbody.appendChild(row);
    } else {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${formatSettingName("lastFetchedTime")}</td>
        <td><span class="null-value">${t("settingsNever")}</span></td>
      `;
      tbody.appendChild(row);
    }

    table.appendChild(tbody);
    globalSettingsElement.appendChild(table);
  }

  /**
   * Displays the various website lists and their current modes.
   */
  function displaySkipLists(data) {
    const settings = data[BROWSER_STORAGE_KEY] || {};
    const skipForceList = data[SKIP_FORCE_THEMING_KEY] || [];
    const skipThemingList = data[SKIP_THEMING_KEY] || [];
    const fallbackBackgroundList = data[FALLBACK_BACKGROUND_KEY] || [];
    const isWhitelistMode = settings.whitelistMode || false;
    const isWhitelistStyleMode = settings.whitelistStyleMode || false;

    displayCombinedSkipLists(
      skipForceList,
      skipThemingList,
      fallbackBackgroundList,
      isWhitelistMode,
      isWhitelistStyleMode
    );
  }

  /**
   * Renders a combined view of all defined website lists.
   */
  function displayCombinedSkipLists(
    skipForceList,
    skipThemingList,
    fallbackBackgroundList,
    isWhitelistMode,
    isWhitelistStyleMode
  ) {
    skipListElement.innerHTML = "";
    const titleSection = document.createElement("div");
    titleSection.className = "list-title-section";

    const forceModeName = isWhitelistMode
      ? t("popupWhitelistMode")
      : t("popupBlacklistMode");
    const styleModeName = isWhitelistStyleMode
      ? t("popupWhitelistMode")
      : t("popupBlacklistMode");
    const forceModeScope = isWhitelistMode
      ? t("settingsModeOnlyListed")
      : t("settingsModeAllExceptListed");
    const styleModeScope = isWhitelistStyleMode
      ? t("settingsModeOnlyListed")
      : t("settingsModeAllExceptListed");

    titleSection.innerHTML = `
      <h3>${t("settingsListsOverview")}</h3>
      <div class="mode-info">
        <div><strong>${t("settingsForceModeLabel")}</strong> ${forceModeName} (${forceModeScope})</div>
        <div><strong>${t("settingsGeneralModeLabel")}</strong> ${styleModeName} (${styleModeScope})</div>
      </div>
    `;

    skipListElement.appendChild(titleSection);

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
      clearAllButton.innerHTML = `<i class="fas fa-trash"></i> ${t(
        "settingsClearAllLists"
      )}`;
      clearAllButton.addEventListener("click", clearAllSkipLists);
      skipListElement.appendChild(clearAllButton);
    }

    const tablesContainer = document.createElement("div");
    tablesContainer.className = "tables-container";

    const forceListSection = createSingleListSection(
      skipForceList,
      isWhitelistMode,
      t("settingsForceListTitle"),
      isWhitelistMode
        ? t("settingsForceListApplied")
        : t("settingsForceListSkipped"),
      SKIP_FORCE_THEMING_KEY
    );

    const regularListSection = createSingleListSection(
      skipThemingList,
      isWhitelistStyleMode,
      t("settingsRegularListTitle"),
      isWhitelistStyleMode
        ? t("settingsRegularListApplied")
        : t("settingsRegularListSkipped"),
      SKIP_THEMING_KEY
    );

    const fallbackListSection = createSingleListSection(
      fallbackBackgroundList,
      false,
      t("settingsFallbackListTitle"),
      t("settingsFallbackListDescription"),
      FALLBACK_BACKGROUND_KEY
    );

    tablesContainer.appendChild(forceListSection);
    tablesContainer.appendChild(regularListSection);
    tablesContainer.appendChild(fallbackListSection);
    skipListElement.appendChild(tablesContainer);
  }

  /**
   * Creates a table section for a single website list.
   */
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
      emptyMessage.textContent = t("settingsEmptyList");
      section.appendChild(emptyMessage);
      return section;
    }

    const table = document.createElement("table");
    table.classList.add("data-table");

    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    headerRow.innerHTML = `<th>${t("settingsTableWebsite")}</th><th>${t(
      "settingsTableAction"
    )}</th>`;
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");

    for (const site of list) {
      const row = document.createElement("tr");
      const siteCell = document.createElement("td");
      siteCell.textContent = site;
      row.appendChild(siteCell);

      const actionCell = document.createElement("td");
      const removeButton = document.createElement("button");
      removeButton.className = "remove-site-button";
      removeButton.innerHTML = '<i class="fas fa-times"></i>';
      removeButton.title = t("settingsRemoveFromList");
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

  /**
   * Removes a website from a specific list in storage.
   */
  async function removeSiteFromList(site, listKey) {
    try {
      const data = await browser.storage.local.get(listKey);
      const list = data[listKey] || [];
      const newList = list.filter((item) => item !== site);
      await browser.storage.local.set({ [listKey]: newList });
      loadAllData();
    } catch (error) {
      alert(t("settingsErrorOccurred", error.message));
    }
  }

  /**
   * Clears all three website exception lists.
   */
  async function clearAllSkipLists() {
    try {
      if (confirm(t("settingsConfirmClearLists"))) {
        await browser.storage.local.set({
          [SKIP_FORCE_THEMING_KEY]: [],
          [SKIP_THEMING_KEY]: [],
          [FALLBACK_BACKGROUND_KEY]: [],
        });
        loadAllData();
      }
    } catch (error) {
      alert(t("settingsErrorClearingLists", error.message));
    }
  }

  /**
   * Displays all website styles and their feature toggles.
   */
  function displayCombinedWebsiteData(data) {
    combinedWebsitesElement.innerHTML = "";

    const styles = data.styles || {};
    const websites = styles.website || {};
    const websiteKeys = Object.keys(websites);

    const siteSettings = {};
    for (const [key, value] of Object.entries(data)) {
      if (key.startsWith(BROWSER_STORAGE_KEY + ".")) {
        const siteName = key.substring(BROWSER_STORAGE_KEY.length + 1);
        siteSettings[siteName] = value;
      }
    }

    if (websiteKeys.length === 0) {
      combinedWebsitesElement.innerHTML = `<div class="no-data">${t(
        "settingsNoWebsites"
      )}</div>`;
      return;
    }

    const searchContainer = document.createElement("div");
    searchContainer.classList.add("search-container");

    const searchInput = document.createElement("input");
    searchInput.type = "text";
    searchInput.placeholder = t("settingsSearchPlaceholder");
    searchInput.classList.add("search-input");
    searchInput.addEventListener("input", function () {
      filterWebsites(this.value.toLowerCase());
    });

    const searchIcon = document.createElement("i");
    searchIcon.className = "fas fa-search search-icon";

    searchContainer.appendChild(searchIcon);
    searchContainer.appendChild(searchInput);
    combinedWebsitesElement.appendChild(searchContainer);

    const expandAllButton = document.createElement("button");
    expandAllButton.classList.add(
      "action-button",
      "secondary",
      "view-all-button"
    );
    expandAllButton.textContent = t("settingsExpandAll");
    expandAllButton.dataset.expanded = "false";
    expandAllButton.addEventListener("click", function () {
      const expanded = this.dataset.expanded === "true";
      const panels = document.querySelectorAll(".website-panel");

      panels.forEach((panel) => {
        const header = panel.querySelector(".website-header");
        const content = panel.querySelector(".website-content");

        if (expanded) {
          header.classList.remove("active");
          content.style.maxHeight = null;
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

      this.dataset.expanded = expanded ? "false" : "true";
      this.textContent = expanded
        ? t("settingsExpandAll")
        : t("settingsCollapseAll");
    });

    combinedWebsitesElement.appendChild(expandAllButton);

    const websitesContainer = document.createElement("div");
    websitesContainer.classList.add("websites-container");
    combinedWebsitesElement.appendChild(websitesContainer);

    websiteKeys.sort();

    for (const website of websiteKeys) {
      const websitePanel = document.createElement("div");
      websitePanel.classList.add("website-panel");
      websitePanel.dataset.website = website.toLowerCase();

      const header = document.createElement("div");
      header.classList.add("website-header");

      const features = websites[website];
      const featureCount = Object.keys(features).length;
      const siteName = website.replace(".css", "");
      let domainName;
      let settingsData = {};

      if (siteName.startsWith("+")) {
        domainName = siteName.slice(1);
        const matchingDomains = Object.keys(siteSettings).filter(
          (domain) => domain === domainName || domain.endsWith(`.${domainName}`)
        );
        const settingsKey =
          matchingDomains.length > 0 ? matchingDomains[0] : null;
        settingsData = settingsKey ? siteSettings[settingsKey] : {};
      } else {
        domainName = siteName;
        settingsData =
          siteSettings[domainName] || siteSettings[`www.${domainName}`] || {};
      }

      header.innerHTML = `
        <div class="website-header-content">
          <span class="website-name">${website}</span>
          <span class="feature-count">${t(
            "settingsFeatureCount",
            featureCount
          )}</span>
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

      for (const [feature, css] of Object.entries(features)) {
        const cssBlock = document.createElement("div");
        cssBlock.classList.add("css-block");

        const isEnabled = settingsData[feature] !== false;

        const cssBlockHeader = document.createElement("div");
        cssBlockHeader.classList.add("css-block-header");
        cssBlockHeader.innerHTML = `
          <span class="feature-name">${feature}</span>
          <label class="toggle-switch">
            <input type="checkbox" 
                   data-website="${domainName}" 
                   data-feature="${feature}" 
                   ${isEnabled ? "checked" : ""}>
            <span class="slider round"></span>
          </label>
        `;

        cssBlockHeader.addEventListener("click", function (e) {
          if (e.target.type === 'checkbox' || e.target.classList.contains('slider') || e.target.classList.contains('toggle-switch')) {
            return;
          }
          this.classList.toggle("active");
          const cssContent = this.nextElementSibling;
          if (cssContent.style.maxHeight) {
            cssContent.style.maxHeight = null;
          } else {
            cssContent.style.maxHeight = cssContent.scrollHeight + "px";
          }
        });

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

    function filterWebsites(query) {
      const panels = websitesContainer.querySelectorAll(".website-panel");
      panels.forEach((panel) => {
        const website = panel.dataset.website;
        panel.style.display = website.includes(query) ? "" : "none";
      });
    }
  }

  /**
   * Initializes the user-defined style mapping interface.
   */
  async function loadUserMappingsUI() {
    const userMappingsList = document.getElementById("user-mappings-list");
    const addMappingForm = document.getElementById("add-mapping-form");
    const sourceInput = document.getElementById("source-style-input");
    const targetInput = document.getElementById("target-site-input");

    const data = await browser.storage.local.get(USER_STYLES_MAPPING_KEY);
    let userMapping = data[USER_STYLES_MAPPING_KEY] || { mapping: {} };

    function renderUserMappings() {
      userMappingsList.innerHTML = '';
      const mapping = userMapping.mapping || {};
      const keys = Object.keys(mapping);
      if (keys.length === 0) {
        userMappingsList.innerHTML = `<div class="no-mappings">${t(
          "settingsNoCustomMappings"
        )}</div>`;
        return;
      }
      keys.sort();
      keys.forEach(source => {
        mapping[source].forEach((site, idx) => {
          const item = document.createElement('div');
          item.className = 'user-mapping-item';
          item.innerHTML = `<span class="source-style">${source}</span> → <span class="target-site-tag">${site}</span> <button class="remove-user-mapping" data-source="${source}" data-site="${site}"><i class="fas fa-times"></i></button>`;
          userMappingsList.appendChild(item);
        });
      });
      userMappingsList.querySelectorAll('.remove-user-mapping').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const source = btn.getAttribute('data-source');
          const site = btn.getAttribute('data-site');
          if (userMapping.mapping[source]) {
            userMapping.mapping[source] = userMapping.mapping[source].filter(s => s !== site);
            if (userMapping.mapping[source].length === 0) delete userMapping.mapping[source];
            await browser.storage.local.set({ [USER_STYLES_MAPPING_KEY]: userMapping });
            renderUserMappings();
            loadAllData();
          }
        });
      });
    }
    renderUserMappings();

    addMappingForm.onsubmit = async (e) => {
      e.preventDefault();
      const source = sourceInput.value.trim();
      const site = targetInput.value.trim().replace(/^https?:\/\//, '').replace(/^www\./, '');
      if (!source || !site) return;
      if (!userMapping.mapping[source]) userMapping.mapping[source] = [];
      if (!userMapping.mapping[source].includes(site)) {
        userMapping.mapping[source].push(site);
        await browser.storage.local.set({ [USER_STYLES_MAPPING_KEY]: userMapping });
        renderUserMappings();
        loadAllData();
      }
      addMappingForm.reset();
    };
  }

  /**
   * Displays style mappings (both fetched and user-defined).
   */
  function displayMappingData(data) {
    const mappingData = data[STYLES_MAPPING_KEY];
    const userMappingData = data[USER_STYLES_MAPPING_KEY] || { mapping: {} };
    const mappingsContainer = document.getElementById("mappings-data");
    const merged = {};
    if (mappingData && mappingData.mapping) {
      for (const [src, targets] of Object.entries(mappingData.mapping)) {
        merged[src] = [...targets];
      }
    }
    if (userMappingData && userMappingData.mapping) {
      for (const [src, targets] of Object.entries(userMappingData.mapping)) {
        if (!merged[src]) merged[src] = [];
        for (const target of targets) {
          if (!merged[src].includes(target)) merged[src].push(target);
        }
      }
    }
    const mappingKeys = Object.keys(merged);
    if (mappingKeys.length === 0) {
      mappingsContainer.innerHTML = `<div class="no-mappings">${t(
        "settingsNoStyleMappings"
      )}</div>`;
      return;
    }
    mappingKeys.sort();
    const mappingsHTML = mappingKeys.map(sourceStyle => {
      const user = (userMappingData && userMappingData.mapping && userMappingData.mapping[sourceStyle]) || [];
      const targetSitesHTML = merged[sourceStyle].map(site => {
        const isUser = user.includes(site);
        return `<span class="target-site-tag${isUser ? ' user-mapping' : ''}">${site}${isUser ? ` <i class='fas fa-user-edit' title='${t("settingsCustomMapping")}'></i>` : ''}</span>`;
      }).join('');
      return `
        <div class="mapping-item">
          <div class="mapping-header">
            <span class="source-style">${sourceStyle}</span>
            <span class="target-count">${t(
              "settingsMappedSites",
              merged[sourceStyle].length
            )}</span>
          </div>
          <div class="target-sites-list">
            ${targetSitesHTML}
          </div>
        </div>
      `;
    }).join('');
    mappingsContainer.innerHTML = `<div class="mappings-container">${mappingsHTML}</div>`;
  }

  /**
   * Sets up event listeners for collapsible UI sections.
   */
  function setupCollapsibleSections() {
    const collapsibleHeaders = document.querySelectorAll('.collapsible');

    collapsibleHeaders.forEach(header => {
      header.addEventListener('click', () => {
        const targetId = header.getAttribute('data-target');
        const targetSection = document.querySelector(`[data-section="${targetId}"]`);
        const icon = header.querySelector('i');

        if (targetSection) {
          const isCollapsed = targetSection.classList.contains('collapsed');

          if (isCollapsed) {
            targetSection.classList.remove('collapsed');
            header.classList.add('expanded');
            icon.className = 'fas fa-chevron-up';
          } else {
            targetSection.classList.add('collapsed');
            header.classList.remove('expanded');
            icon.className = 'fas fa-chevron-down';
          }
        }
      });
    });
  }

  /**
   * Centralized logging helper that respects the enableLogs setting.
   */
  async function log(...args) {
    try {
      const data = await browser.storage.local.get(BROWSER_STORAGE_KEY);
      const settings = data[BROWSER_STORAGE_KEY] || {};
      if (settings.enableLogs) {
        console.log("[ZenInternet]", ...args);
      }
    } catch (e) {}
  }

  /**
   * Formats internal setting keys into human-readable labels.
   */
  function formatSettingName(name) {
    const key = `setting${name.charAt(0).toUpperCase()}${name.slice(1)}`;
    const label = t(key);
    if (label !== key) return label;

    return name
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (str) => str.toUpperCase());
  }

  /**
   * Formats setting values into styled HTML badges.
   */
  function formatSettingValue(value) {
    if (typeof value === "boolean") {
      return value
        ? `<span class="badge enabled">${t("settingsEnabled")}</span>`
        : `<span class="badge disabled">${t("settingsDisabled")}</span>`;
    } else if (value === null) {
      return '<span class="null-value">null</span>';
    } else if (typeof value === "object") {
      return '<span class="object-value">{Object}</span>';
    } else {
      return value;
    }
  }
});

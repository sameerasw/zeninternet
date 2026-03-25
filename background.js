let SKIP_FORCE_THEMING_KEY = "skipForceThemingList";
let SKIP_THEMING_KEY = "skipThemingList";
let FALLBACK_BACKGROUND_KEY = "fallbackBackgroundList";
let BROWSER_STORAGE_KEY = "transparentZenSettings";
let STYLES_MAPPING_KEY = "stylesMapping";
let USER_STYLES_MAPPING_KEY = "userStylesMapping";
let logging = false;

const cssCache = new Map();
const activeTabs = new Map();
const stylingStateCache = new Map();

const ICON_ON = {
  48: "assets/images/logo_48.png",
  96: "assets/images/logo_96.png",
};
const ICON_OFF = {
  48: "assets/images/logo-off_48.png",
  96: "assets/images/logo-off_96.png",
};

const DEFAULT_SETTINGS = {
  enableStyling: true,
  autoUpdate: true,
  forceStyling: false,
  whitelistMode: false,
  whitelistStyleMode: false,
  disableTransparency: false,
  disableHover: false,
  disableFooter: false,
  fallbackBackgroundList: [],
};

/**
 * Normalizes hostnames by removing the www. prefix.
 */
function normalizeHostname(hostname) {
  return hostname.startsWith("www.") ? hostname.substring(4) : hostname;
}

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
 * Determines whether styling should be applied for a given hostname.
 */
async function shouldApplyStyling(hostname) {
  try {
    if (cssCache.size === 0) {
      await preloadStyles();
    }
    const cacheKey = `styling:${hostname}`;
    if (stylingStateCache.has(cacheKey)) {
      return stylingStateCache.get(cacheKey);
    }

    const normalizedHostname = normalizeHostname(hostname);
    const settingsData = await browser.storage.local.get(BROWSER_STORAGE_KEY);
    const settings = ensureDefaultSettings(
      settingsData[BROWSER_STORAGE_KEY] || {}
    );

    if (!settings.enableStyling) {
      const result = {
        shouldApply: false,
        reason: "globally_disabled",
      };
      stylingStateCache.set(cacheKey, result);
      return result;
    }

    let hasSpecificStyle = false;
    if (
      cssCache.has(normalizedHostname) ||
      cssCache.has(`www.${normalizedHostname}`)
    ) {
      hasSpecificStyle = true;
    } else {
      for (const cachedSite of cssCache.keys()) {
        if (cachedSite.startsWith("+")) {
          const baseSite = cachedSite.slice(1);
          if (
            normalizedHostname === baseSite ||
            normalizedHostname.endsWith(`.${baseSite}`)
          ) {
            hasSpecificStyle = true;
            break;
          }
        }
        else if (cachedSite.startsWith("-")) {
          const baseSite = cachedSite.slice(1);
          const cachedDomain = baseSite.split(".").slice(0, -1).join(".");
          const hostParts = normalizedHostname.split(".");
          const hostDomain =
            hostParts.length > 1
              ? hostParts.slice(0, -1).join(".")
              : normalizedHostname;

          if (cachedDomain && hostDomain && hostDomain === cachedDomain) {
            hasSpecificStyle = true;
            break;
          }
        }
        else if (
          normalizedHostname !== cachedSite &&
          normalizedHostname.endsWith(`.${cachedSite}`) &&
          !cachedSite.startsWith("-")
        ) {
          hasSpecificStyle = true;
          break;
        }
      }
    }

    if (!hasSpecificStyle) {
      const mappingData = await browser.storage.local.get([STYLES_MAPPING_KEY, USER_STYLES_MAPPING_KEY]);
      const mergedMapping = { ...(mappingData[STYLES_MAPPING_KEY]?.mapping || {}) };
      
      if (mappingData[USER_STYLES_MAPPING_KEY]?.mapping) {
        for (const [source, targets] of Object.entries(mappingData[USER_STYLES_MAPPING_KEY].mapping)) {
          if (!mergedMapping[source]) mergedMapping[source] = [];
          for (const target of targets) {
            if (!mergedMapping[source].includes(target)) mergedMapping[source].push(target);
          }
        }
      }

      for (const [sourceStyle, targetSites] of Object.entries(mergedMapping)) {
        if (targetSites.includes(normalizedHostname)) {
          hasSpecificStyle = true;
          break;
        }
      }
    }

    if (hasSpecificStyle) {
      const skipStyleListData = await browser.storage.local.get(
        SKIP_THEMING_KEY
      );
      const skipStyleList = skipStyleListData[SKIP_THEMING_KEY] || [];
      const styleMode = settings.whitelistStyleMode || false;

      if (styleMode) {
        const shouldApply = skipStyleList.includes(normalizedHostname);
        const result = {
          shouldApply,
          reason: shouldApply ? "whitelisted" : "not_whitelisted",
        };
        stylingStateCache.set(cacheKey, result);
        return result;
      } else {
        const shouldApply = !skipStyleList.includes(normalizedHostname);
        const result = {
          shouldApply,
          reason: shouldApply ? "not_blacklisted" : "blacklisted",
        };
        stylingStateCache.set(cacheKey, result);
        return result;
      }
    }

    if (settings.forceStyling) {
      const skipForceListData = await browser.storage.local.get(
        SKIP_FORCE_THEMING_KEY
      );
      const skipForceList = skipForceListData[SKIP_FORCE_THEMING_KEY] || [];
      const isWhitelistMode = settings.whitelistMode || false;

      if (isWhitelistMode) {
        const shouldApply = skipForceList.includes(normalizedHostname);
        const result = {
          shouldApply,
          reason: shouldApply ? "force_whitelisted" : "force_not_whitelisted",
        };
        stylingStateCache.set(cacheKey, result);
        return result;
      } else {
        const shouldApply = !skipForceList.includes(normalizedHostname);
        const result = {
          shouldApply,
          reason: shouldApply ? "force_not_blacklisted" : "force_blacklisted",
        };
        stylingStateCache.set(cacheKey, result);
        return result;
      }
    }

    const result = {
      shouldApply: false,
      reason: "no_styling_rules",
    };
    stylingStateCache.set(cacheKey, result);
    return result;
  } catch (error) {
    console.error("Error determining styling state:", error);
    return { shouldApply: false, reason: "error" };
  }
}

/**
 * Updates the browser action icon for a specific tab.
 */
async function updateIconForTab(tabId, url) {
  try {
    if (!url) {
      const tab = await browser.tabs.get(tabId);
      url = tab.url;
    }

    if (!url || !url.startsWith("http")) {
      setIcon(tabId, false);
      return;
    }

    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    const stylingState = await shouldApplyStyling(hostname);

    setIcon(tabId, stylingState.shouldApply);
  } catch (error) {
    setIcon(tabId, false);
  }
}

/**
 * Sets the browser action icon state.
 */
function setIcon(tabId, isEnabled) {
  const iconSet = isEnabled ? ICON_ON : ICON_OFF;
  browser.browserAction.setIcon({
    path: iconSet,
    tabId: tabId,
  });
}

/**
 * Compiles and caches styles for rapid injection.
 */
async function preloadStyles() {
  try {
    const data = await browser.storage.local.get([
      "styles",
      BROWSER_STORAGE_KEY,
      STYLES_MAPPING_KEY,
      USER_STYLES_MAPPING_KEY,
    ]);

    const settings = ensureDefaultSettings(data[BROWSER_STORAGE_KEY] || {});

    if (
      JSON.stringify(settings) !== JSON.stringify(data[BROWSER_STORAGE_KEY])
    ) {
      await browser.storage.local.set({ [BROWSER_STORAGE_KEY]: settings });
    }

    if (settings.enableStyling === false) return;

    cssCache.clear();

    if (data.styles?.website) {
      const mergedMapping = { ...(data[STYLES_MAPPING_KEY]?.mapping || {}) };
      if (data[USER_STYLES_MAPPING_KEY]?.mapping) {
        for (const [source, targets] of Object.entries(data[USER_STYLES_MAPPING_KEY].mapping)) {
          if (!mergedMapping[source]) mergedMapping[source] = [];
          for (const target of targets) {
            if (!mergedMapping[source].includes(target)) mergedMapping[source].push(target);
          }
        }
      }

      const reverseMapping = {};
      for (const [sourceStyle, targetSites] of Object.entries(mergedMapping)) {
        for (const targetSite of targetSites) {
          reverseMapping[targetSite] = sourceStyle;
        }
      }

      for (const [website, features] of Object.entries(data.styles.website)) {
        let combinedCSS = "";
        for (const [feature, css] of Object.entries(features)) {
          combinedCSS += css + "\n";
        }

        const websiteKey = website.replace(".css", "");
        cssCache.set(websiteKey, combinedCSS);

        if (mergedMapping[website]) {
          const mappedSites = mergedMapping[website];
          for (const mappedSite of mappedSites) {
            const normalizedMappedSite = normalizeHostname(mappedSite);
            cssCache.set(normalizedMappedSite, combinedCSS);
          }
        }
      }
    }
  } catch (error) {
    console.error("Error preloading styles:", error);
  }
}

/**
 * Pre-fetches styles during navigation.
 */
browser.webNavigation.onBeforeNavigate.addListener((details) => {
  if (details.frameId === 0) {
    activeTabs.set(details.tabId, details.url);
    const url = new URL(details.url);
    const normalizedHostname = normalizeHostname(url.hostname);
    prepareStylesForUrl(normalizedHostname, details.tabId);
    updateIconForTab(details.tabId, details.url);
  }
});

/**
 * Handles communication with the content script.
 */
browser.runtime.onMessage.addListener(async (message, sender) => {
  if (message.action === "contentScriptReady" && message.hostname) {
    try {
      const normalizedHostname = normalizeHostname(message.hostname);
      const settingsData = await browser.storage.local.get(BROWSER_STORAGE_KEY);
      const settings = ensureDefaultSettings(
        settingsData[BROWSER_STORAGE_KEY] || {}
      );

      if (settings.enableStyling === false) return;

      const css = await getStylesForHostname(normalizedHostname, settings);

      if (css) {
        browser.tabs
          .sendMessage(sender.tab.id, {
            action: "applyStyles",
            css: css,
          })
          .catch((err) => {
            if (logging) console.log("Failed to send immediate CSS:", err);
          });
      }
    } catch (error) {
      console.error("Error handling content script ready message:", error);
    }
  } else if (message.action === "enableAutoUpdate") {
    startAutoUpdate();
    return true;
  } else if (message.action === "disableAutoUpdate") {
    stopAutoUpdate();
    return true;
  }

  if (message.action === "contentScriptReady" && sender.tab) {
    updateIconForTab(sender.tab.id, sender.tab.url);
  }

  return false;
});

/**
 * Retrieves matching styles for a hostname based on current settings.
 */
async function getStylesForHostname(hostname, settings) {
  settings = ensureDefaultSettings(settings);

  if (cssCache.has(hostname)) {
    return cssCache.get(hostname);
  } else if (cssCache.has(`www.${hostname}`)) {
    return cssCache.get(`www.${hostname}`);
  } else {
    for (const [cachedSite, cachedCSS] of cssCache.entries()) {
      if (cachedSite.startsWith("+")) {
        const baseSite = cachedSite.slice(1);
        if (hostname === baseSite || hostname.endsWith(`.${baseSite}`)) {
          return cachedCSS;
        }
      }
      else if (cachedSite.startsWith("-")) {
        const baseSite = cachedSite.slice(1);
        const cachedDomain = baseSite.split(".").slice(0, -1).join(".");
        const hostParts = hostname.split(".");
        const hostDomain =
          hostParts.length > 1 ? hostParts.slice(0, -1).join(".") : hostname;

        if (cachedDomain && hostDomain && hostDomain === cachedDomain) {
          return cachedCSS;
        }
      }
      else if (
        cachedSite !== hostname &&
        cachedSite !== `www.${hostname}` &&
        hostname.endsWith(`.${cachedSite}`) &&
        !cachedSite.startsWith("-")
      ) {
        return cachedCSS;
      }
    }

    const mappingData = await browser.storage.local.get([STYLES_MAPPING_KEY, USER_STYLES_MAPPING_KEY]);
    const mergedMapping = { ...(mappingData[STYLES_MAPPING_KEY]?.mapping || {}) };
    if (mappingData[USER_STYLES_MAPPING_KEY]?.mapping) {
      for (const [source, targets] of Object.entries(mappingData[USER_STYLES_MAPPING_KEY].mapping)) {
        if (!mergedMapping[source]) mergedMapping[source] = [];
        for (const target of targets) {
          if (!mergedMapping[source].includes(target)) mergedMapping[source].push(target);
        }
      }
    }

    if (mergedMapping) {
      for (const [sourceStyle, targetSites] of Object.entries(mergedMapping)) {
        if (targetSites.includes(hostname)) {
          const sourceStyleKey = sourceStyle.replace(".css", "");
          if (cssCache.has(sourceStyleKey)) {
            return cssCache.get(sourceStyleKey);
          }
        }
      }
    }

    if (settings.forceStyling) {
      const skipListData = await browser.storage.local.get(
        SKIP_FORCE_THEMING_KEY
      );
      const siteList = skipListData[SKIP_FORCE_THEMING_KEY] || [];
      const isWhitelistMode = settings.whitelistMode || false;
      const siteInList = siteList.includes(hostname);

      if (
        (isWhitelistMode && siteInList) ||
        (!isWhitelistMode && !siteInList)
      ) {
        if (cssCache.has("example.com")) {
          return cssCache.get("example.com");
        } else {
          return "/* Default fallback CSS */";
        }
      }
    }
  }

  return null;
}

/**
 * Prepares and caches styles for a URL before connection.
 */
async function prepareStylesForUrl(hostname, tabId) {
  try {
    const settingsData = await browser.storage.local.get(BROWSER_STORAGE_KEY);
    const settings = ensureDefaultSettings(
      settingsData[BROWSER_STORAGE_KEY] || {}
    );

    if (settings.enableStyling === false) return;

    const css = await getStylesForHostname(hostname, settings);

    if (css && tabId) {
      activeTabs.set(tabId, {
        hostname: hostname,
        css: css,
      });
    }
  } catch (error) {
    console.error("Error preparing styles for URL:", error);
  }
}

/**
 * Evaluates and applies CSS to a specific tab.
 */
async function applyCSSToTab(tab) {
  try {
    const url = new URL(tab.url);
    const originalHostname = url.hostname;
    const hostname = normalizeHostname(originalHostname);

    const settingsData = await browser.storage.local.get(BROWSER_STORAGE_KEY);
    const globalSettings = ensureDefaultSettings(
      settingsData[BROWSER_STORAGE_KEY] || {}
    );

    const stylingState = await shouldApplyStyling(hostname);
    setIcon(tab.id, stylingState.shouldApply);

    const fallbackData = await browser.storage.local.get(
      FALLBACK_BACKGROUND_KEY
    );
    const fallbackBackgroundList = fallbackData[FALLBACK_BACKGROUND_KEY] || [];
    const hasFallbackBackground = fallbackBackgroundList.includes(hostname);

    if (stylingState.reason === "globally_disabled") {
      setIcon(tab.id, false);
      browser.tabs.sendMessage(tab.id, { action: "removeStyles" }).catch(() => {});
      return;
    }

    if (!stylingState.shouldApply && !hasFallbackBackground) {
      setIcon(tab.id, false);
      browser.tabs.sendMessage(tab.id, { action: "removeStyles" }).catch(() => {});
      return;
    }

    if (hasFallbackBackground) {
      let combinedCSS = `
html {
    background-color: light-dark(#fff, #111);
}
`;
      const data = await browser.storage.local.get("styles");
      let features = null;
      let bestMatch = null;
      let bestMatchLength = 0;
      for (const key of Object.keys(data.styles?.website || {})) {
        const siteName = key.replace(".css", "");
        const normalizedSiteName = normalizeHostname(siteName);
        if (hostname === normalizedSiteName) {
          bestMatch = key;
          break;
        }
        if (
          siteName.startsWith("+") &&
          (hostname === siteName.slice(1) ||
            hostname.endsWith(`.${siteName.slice(1)}`)) &&
          siteName.slice(1).length > bestMatchLength
        ) {
          bestMatch = key;
          bestMatchLength = siteName.slice(1).length;
        }
        if (siteName.startsWith("-")) {
          const baseSite = siteName.slice(1);
          const cachedDomain = baseSite.split(".").slice(0, -1).join(".");
          const hostParts = hostname.split(".");
          const hostDomain =
            hostParts.length > 1 ? hostParts.slice(0, -1).join(".") : hostname;
          if (
            cachedDomain &&
            hostDomain &&
            hostDomain === cachedDomain &&
            cachedDomain.length > bestMatchLength
          ) {
            bestMatch = key;
            bestMatchLength = cachedDomain.length;
          }
        }
        if (
          hostname !== normalizedSiteName &&
          hostname.endsWith(`.${normalizedSiteName}`) &&
          !siteName.startsWith("-") &&
          normalizedSiteName.length > bestMatchLength
        ) {
          bestMatch = key;
          bestMatchLength = normalizedSiteName.length;
        }
      }
      if (bestMatch) {
        features = data.styles.website[bestMatch];
      }
      if (features) {
        const siteKey = `transparentZenSettings.${hostname}`;
        const siteData = await browser.storage.local.get(siteKey);
        const featureSettings = siteData[siteKey] || {};
        for (const [feature, css] of Object.entries(features)) {
          const isTransparencyFeature = feature
            .toLowerCase()
            .includes("transparency");
          const isHoverFeature = feature.toLowerCase().includes("hover");
          const isFooterFeature = feature.toLowerCase().includes("footer");
          if (
            !isTransparencyFeature &&
            !isHoverFeature &&
            !isFooterFeature &&
            featureSettings[feature] !== false
          ) {
            combinedCSS += css + "\n";
          }
        }
      }
      await browser.tabs.sendMessage(tab.id, {
        action: "applyStyles",
        css: combinedCSS,
      }).catch(() => {});
      setIcon(tab.id, true);
      return;
    }

    if (stylingState.shouldApply) {
      const data = await browser.storage.local.get("styles");

      let bestMatch = null;
      let bestMatchLength = 0;

      for (const key of Object.keys(data.styles?.website || {})) {
        const siteName = key.replace(".css", "");
        const normalizedSiteName = normalizeHostname(siteName);

        if (hostname === normalizedSiteName) {
          bestMatch = key;
          break;
        }

        if (siteName.startsWith("+")) {
          const baseSite = siteName.slice(1);
          if (
            (hostname === baseSite || hostname.endsWith(`.${baseSite}`)) &&
            baseSite.length > bestMatchLength
          ) {
            bestMatch = key;
            bestMatchLength = baseSite.length;
          }
        }
        else if (siteName.startsWith("-")) {
          const baseSite = siteName.slice(1);
          const cachedDomain = baseSite.split(".").slice(0, -1).join(".");
          const hostParts = hostname.split(".");
          const hostDomain =
            hostParts.length > 1 ? hostParts.slice(0, -1).join(".") : hostname;

          if (cachedDomain && hostDomain && hostDomain === cachedDomain) {
            if (cachedDomain.length > bestMatchLength) {
              bestMatch = key;
              bestMatchLength = cachedDomain.length;
            }
          }
        }
        else if (
          hostname !== normalizedSiteName &&
          hostname.endsWith(`.${normalizedSiteName}`) &&
          !siteName.startsWith("-") &&
          normalizedSiteName.length > bestMatchLength
        ) {
          bestMatch = key;
          bestMatchLength = normalizedSiteName.length;
        }
      }

      if (bestMatch) {
        await applyCSS(tab.id, hostname, data.styles.website[bestMatch]);
        return;
      } else {
        const mappingData = await browser.storage.local.get([STYLES_MAPPING_KEY, USER_STYLES_MAPPING_KEY]);
        const mergedMapping = { ...(mappingData[STYLES_MAPPING_KEY]?.mapping || {}) };
        if (mappingData[USER_STYLES_MAPPING_KEY]?.mapping) {
          for (const [source, targets] of Object.entries(mappingData[USER_STYLES_MAPPING_KEY].mapping)) {
            if (!mergedMapping[source]) mergedMapping[source] = [];
            for (const target of targets) {
              if (!mergedMapping[source].includes(target)) mergedMapping[source].push(target);
            }
          }
        }

        for (const [sourceStyle, targetSites] of Object.entries(mergedMapping)) {
          if (targetSites.includes(hostname)) {
            if (data.styles.website[sourceStyle]) {
              await applyCSS(tab.id, hostname, data.styles.website[sourceStyle]);
              return;
            }
            break;
          }
        }

        if (
          globalSettings.forceStyling &&
          data.styles.website["example.com.css"]
        ) {
          await applyCSS(
            tab.id,
            hostname,
            data.styles.website["example.com.css"]
          );
          return;
        }
      }
    }
  } catch (error) {
    setIcon(tab.id, false);
  }
}

/**
 * Processes and injects feature-specific CSS into a tab.
 */
async function applyCSS(tabId, hostname, features) {
  if (!features) return;

  const settingsData = await browser.storage.local.get(BROWSER_STORAGE_KEY);
  const globalSettings = ensureDefaultSettings(
    settingsData[BROWSER_STORAGE_KEY] || {}
  );

  const fallbackData = await browser.storage.local.get(FALLBACK_BACKGROUND_KEY);
  const fallbackBackgroundList = fallbackData[FALLBACK_BACKGROUND_KEY] || [];
  const normalizedHostname = normalizeHostname(hostname);
  const hasFallbackBackground =
    fallbackBackgroundList.includes(normalizedHostname);

  const siteKey = `transparentZenSettings.${normalizedHostname}`;
  const siteData = await browser.storage.local.get(siteKey);
  const featureSettings = siteData[siteKey] || {};

  let combinedCSS = "";

  for (const [feature, css] of Object.entries(features)) {
    const isTransparencyFeature = feature
      .toLowerCase()
      .includes("transparency");
    const isHoverFeature = feature.toLowerCase().includes("hover");
    const isFooterFeature = feature.toLowerCase().includes("footer");

    if (
      isTransparencyFeature &&
      (globalSettings.disableTransparency || hasFallbackBackground)
    ) {
      continue;
    }

    if (isHoverFeature && globalSettings.disableHover) {
      continue;
    }

    if (isFooterFeature && globalSettings.disableFooter) {
      continue;
    }

    if (featureSettings[feature] === false) {
      continue;
    }

    combinedCSS += css + "\n";
  }

  if (hasFallbackBackground) {
    combinedCSS += `
html{
    background-color: light-dark(#fff, #111);
}
`;
  }

  if (combinedCSS.trim()) {
    await browser.tabs.sendMessage(tabId, {
      action: "applyStyles",
      css: combinedCSS,
    }).catch((e) => {});
  } else {
    browser.tabs.sendMessage(tabId, { action: "removeStyles" }).catch(() => {});
  }
}

browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete") {
    updateIconForTab(tabId, tab.url);
  }
});

browser.tabs.onActivated.addListener((activeInfo) => {
  updateIconForTab(activeInfo.tabId);
});

browser.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local") {
    const isRelevantChange =
      changes[BROWSER_STORAGE_KEY] ||
      changes[SKIP_THEMING_KEY] ||
      changes[SKIP_FORCE_THEMING_KEY] ||
      changes[STYLES_MAPPING_KEY] ||
      changes[USER_STYLES_MAPPING_KEY] ||
      Object.keys(changes).some((k) => k.startsWith(`${BROWSER_STORAGE_KEY}.`)) ||
      changes[FALLBACK_BACKGROUND_KEY];

    if (isRelevantChange) {
      stylingStateCache.clear();
      preloadStyles().then(() => {
        browser.tabs.query({}).then((tabs) => {
          for (const tab of tabs) {
            if (tab.url && tab.url.startsWith("http")) {
              applyCSSToTab(tab).catch(() => {});
            }
          }
        });
      });
    }
  }
});

let autoUpdateInterval;

/**
 * Initializes the automatic style update interval.
 */
function startAutoUpdate() {
  if (autoUpdateInterval) clearInterval(autoUpdateInterval);
  autoUpdateInterval = setInterval(refetchCSS, 2 * 60 * 60 * 1000);
}

/**
 * Stops the automatic style update interval.
 */
function stopAutoUpdate() {
  if (autoUpdateInterval) clearInterval(autoUpdateInterval);
}

/**
 * Fetches the latest styles from the remote repository.
 */
async function refetchCSS() {
  try {
    const DEFAULT_REPOSITORY_URL =
      "https://sameerasw.github.io/my-internet/styles.json";
    const repoUrlData = await browser.storage.local.get("stylesRepositoryUrl");
    const repositoryUrl =
      repoUrlData.stylesRepositoryUrl || DEFAULT_REPOSITORY_URL;

    const response = await fetch(repositoryUrl, {
      headers: { "Cache-Control": "no-cache" },
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

    const settingsData = await browser.storage.local.get(BROWSER_STORAGE_KEY);
    if (!settingsData[BROWSER_STORAGE_KEY]) {
      const defaultSettings = {
        enableStyling: true,
        autoUpdate: true,
        forceStyling: false,
        whitelistMode: false,
        whitelistStyleMode: false,
        lastFetchedTime: Date.now(),
      };

      await browser.storage.local.set({
        [BROWSER_STORAGE_KEY]: defaultSettings,
      });
    } else {
      const currentSettings = settingsData[BROWSER_STORAGE_KEY];
      currentSettings.lastFetchedTime = Date.now();
      await browser.storage.local.set({
        [BROWSER_STORAGE_KEY]: currentSettings,
      });
    }

    preloadStyles();
  } catch (error) {
    console.error("Error refetching styles:", error);
  }
}

/**
 * Initializes extension state, settings, and preloads styles.
 */
async function initializeExtension() {
  const data = await browser.storage.local.get(BROWSER_STORAGE_KEY);
  const currentSettings = data[BROWSER_STORAGE_KEY] || {};
  const validatedSettings = ensureDefaultSettings(currentSettings);

  if (JSON.stringify(validatedSettings) !== JSON.stringify(currentSettings)) {
    await browser.storage.local.set({
      [BROWSER_STORAGE_KEY]: validatedSettings,
    });
  }

  const skipForceData = await browser.storage.local.get(SKIP_FORCE_THEMING_KEY);
  if (!skipForceData[SKIP_FORCE_THEMING_KEY]) {
    await browser.storage.local.set({ [SKIP_FORCE_THEMING_KEY]: [] });
  }

  const skipThemingData = await browser.storage.local.get(SKIP_THEMING_KEY);
  if (!skipThemingData[SKIP_THEMING_KEY]) {
    await browser.storage.local.set({ [SKIP_THEMING_KEY]: [] });
  }

  const fallbackBackgroundData = await browser.storage.local.get(
    FALLBACK_BACKGROUND_KEY
  );
  if (!fallbackBackgroundData[FALLBACK_BACKGROUND_KEY]) {
    await browser.storage.local.set({ [FALLBACK_BACKGROUND_KEY]: [] });
  }

  const mappingData = await browser.storage.local.get(STYLES_MAPPING_KEY);
  if (!mappingData[STYLES_MAPPING_KEY]) {
    await browser.storage.local.set({ [STYLES_MAPPING_KEY]: { mapping: {} } });
  }

  await preloadStyles();

  if (validatedSettings.autoUpdate) {
    startAutoUpdate();
  }

  const tabs = await browser.tabs.query({});
  for (const tab of tabs) {
    updateIconForTab(tab.id, tab.url);
  }
}

browser.webNavigation.onCommitted.addListener((details) => {
  if (details.frameId === 0) {
    browser.tabs
      .get(details.tabId)
      .then((tab) => {
        applyCSSToTab(tab);
      })
      .catch(() => {});
  }
});

initializeExtension();

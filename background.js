let SKIP_FORCE_THEMING_KEY = "skipForceThemingList";
let SKIP_THEMING_KEY = "skipThemingList";
let BROWSER_STORAGE_KEY = "transparentZenSettings";
let logging = true; // Enable logging for debugging

// Create a cache for pre-processed CSS to speed up repeated visits
const cssCache = new Map();
const activeTabs = new Map();
// Cache for styling state to avoid repeated storage lookups
const stylingStateCache = new Map();

// Icon states for the browser action
const ICON_ON = {
  48: "assets/images/logo_48.png",
  96: "assets/images/logo_96.png",
};
const ICON_OFF = {
  48: "assets/images/logo-off_48.png",
  96: "assets/images/logo-off_96.png",
};

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
};

// Helper function to normalize hostnames by removing www. prefix
function normalizeHostname(hostname) {
  return hostname.startsWith("www.") ? hostname.substring(4) : hostname;
}

// Ensure all required settings exist
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

// Determine if styling should be applied to a hostname
// This is the centralized logic for both CSS application and icon updates
async function shouldApplyStyling(hostname) {
  try {
    // Check if we already have the answer cached
    const cacheKey = `styling:${hostname}`;
    if (stylingStateCache.has(cacheKey)) {
      return stylingStateCache.get(cacheKey);
    }

    const normalizedHostname = normalizeHostname(hostname);

    // Get global settings - this is an unavoidable storage lookup
    const settingsData = await browser.storage.local.get(BROWSER_STORAGE_KEY);
    const settings = ensureDefaultSettings(
      settingsData[BROWSER_STORAGE_KEY] || {}
    );

    // If styling is globally disabled, styling is disabled
    if (!settings.enableStyling) {
      stylingStateCache.set(cacheKey, false);
      return false;
    }

    // Check if we have a specific style for this site
    let hasSpecificStyle = false;

    // Check for exact match first
    if (
      cssCache.has(normalizedHostname) ||
      cssCache.has(`www.${normalizedHostname}`)
    ) {
      hasSpecificStyle = true;
    } else {
      // Check for wildcard and TLD matches
      for (const cachedSite of cssCache.keys()) {
        // Wildcard match
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
        // TLD suffix match
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
        // Subdomain match
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

    // If we have a specific style, check blacklist/whitelist for regular styling
    if (hasSpecificStyle) {
      // Get skip styling list - only do this lookup if we have a specific style
      const skipStyleListData = await browser.storage.local.get(
        SKIP_THEMING_KEY
      );
      const skipStyleList = skipStyleListData[SKIP_THEMING_KEY] || [];

      // In whitelist mode: only apply if site is in the list
      // In blacklist mode: apply unless site is in the list
      const styleMode = settings.whitelistStyleMode || false;

      if (styleMode) {
        // Whitelist mode
        const shouldApply = skipStyleList.includes(normalizedHostname);
        stylingStateCache.set(cacheKey, shouldApply);
        return shouldApply;
      } else {
        // Blacklist mode
        const shouldApply = !skipStyleList.includes(normalizedHostname);
        stylingStateCache.set(cacheKey, shouldApply);
        return shouldApply;
      }
    }

    // If no specific style, check if we should apply forced styling
    if (settings.forceStyling) {
      // Get skip force list - only do this lookup if force styling is enabled
      const skipForceListData = await browser.storage.local.get(
        SKIP_FORCE_THEMING_KEY
      );
      const skipForceList = skipForceListData[SKIP_FORCE_THEMING_KEY] || [];
      const isWhitelistMode = settings.whitelistMode || false;

      // In whitelist mode: only apply if site is in the list
      // In blacklist mode: apply unless site is in the list
      if (isWhitelistMode) {
        const shouldApply = skipForceList.includes(normalizedHostname);
        stylingStateCache.set(cacheKey, shouldApply);
        return shouldApply;
      } else {
        const shouldApply = !skipForceList.includes(normalizedHostname);
        stylingStateCache.set(cacheKey, shouldApply);
        return shouldApply;
      }
    }

    // No styling applies
    stylingStateCache.set(cacheKey, false);
    return false;
  } catch (error) {
    console.error("Error determining styling state:", error);
    return false;
  }
}

// Update the icon based on whether styling is active for the current tab
async function updateIconForTab(tabId, url) {
  try {
    if (!url) {
      const tab = await browser.tabs.get(tabId);
      url = tab.url;
    }

    // Non-HTTP URLs don't get styling
    if (!url || !url.startsWith("http")) {
      setIcon(tabId, false);
      return;
    }

    const urlObj = new URL(url);
    const hostname = urlObj.hostname;

    // Determine if we should apply styling using the centralized logic
    const isStylingEnabled = await shouldApplyStyling(hostname);

    // Update the icon based on whether styling is enabled for this site
    setIcon(tabId, isStylingEnabled);

    if (logging)
      console.log(
        `Icon updated for ${hostname}: styling ${
          isStylingEnabled ? "ON" : "OFF"
        }`
      );
  } catch (error) {
    console.error("Error updating icon:", error);
    // Default to off icon in case of error
    setIcon(tabId, false);
  }
}

// Set the icon to either on or off state
function setIcon(tabId, isEnabled) {
  const iconSet = isEnabled ? ICON_ON : ICON_OFF;
  browser.browserAction.setIcon({
    path: iconSet,
    tabId: tabId,
  });
}

// Preload styles for faster injection
async function preloadStyles() {
  try {
    const data = await browser.storage.local.get([
      "styles",
      BROWSER_STORAGE_KEY,
    ]);

    // Ensure we have all required settings with defaults
    const settings = ensureDefaultSettings(data[BROWSER_STORAGE_KEY] || {});

    // Save the validated settings back to storage if any defaults were applied
    if (
      JSON.stringify(settings) !== JSON.stringify(data[BROWSER_STORAGE_KEY])
    ) {
      if (logging)
        console.log("Missing settings detected, applying defaults:", settings);
      await browser.storage.local.set({ [BROWSER_STORAGE_KEY]: settings });
    }

    // No point in preloading if styling is disabled
    if (settings.enableStyling === false) return;

    // Clear the cache when reloaded to ensure fresh styles
    cssCache.clear();

    if (data.styles?.website) {
      for (const [website, features] of Object.entries(data.styles.website)) {
        // Process and store default CSS for each website (with all features enabled)
        let combinedCSS = "";
        for (const [feature, css] of Object.entries(features)) {
          combinedCSS += css + "\n";
        }
        cssCache.set(website.replace(".css", ""), combinedCSS);
      }
      if (logging) console.log("Styles preloaded for faster injection");
    }
  } catch (error) {
    console.error("Error preloading styles:", error);
  }
}

// Handle web requests - allow injecting CSS before any content is loaded
browser.webNavigation.onBeforeNavigate.addListener((details) => {
  if (details.frameId === 0) {
    // Only for main frame
    // Track active navigations
    activeTabs.set(details.tabId, details.url);

    // Pre-fetch any styling needed for this URL
    const url = new URL(details.url);
    const normalizedHostname = normalizeHostname(url.hostname);
    prepareStylesForUrl(normalizedHostname, details.tabId);

    // Update icon for this tab
    updateIconForTab(details.tabId, details.url);
  }
});

// Listen for content scripts announcing they're ready
browser.runtime.onMessage.addListener(async (message, sender) => {
  if (message.action === "contentScriptReady" && message.hostname) {
    try {
      // Look for cached styles for this hostname or its domain match
      const normalizedHostname = normalizeHostname(message.hostname);

      // Get the parent frame's hostname if this is an iframe
      let parentHostname = null;
      if (sender.frameId !== 0 && sender.tab && sender.tab.url) {
        try {
          const parentUrl = new URL(sender.tab.url);
          parentHostname = normalizeHostname(parentUrl.hostname);
        } catch (e) {
          console.error("Error parsing parent URL:", e);
        }
      }

      console.log(
        `Content script ready in ${
          sender.frameId === 0 ? "main frame" : "iframe"
        }: ${normalizedHostname}${
          parentHostname ? ` (parent: ${parentHostname})` : ""
        }`
      );

      // Get settings to check if styling is enabled
      const settingsData = await browser.storage.local.get(BROWSER_STORAGE_KEY);
      const settings = ensureDefaultSettings(
        settingsData[BROWSER_STORAGE_KEY] || {}
      );

      if (settings.enableStyling === false) return;

      // First try to get specific styles for this hostname
      let css = await getStylesForHostname(normalizedHostname, settings);

      // If this is an iframe, add iframe-specific transparency styles
      if (message.isIframe) {
        const iframeTransparencyCSS = `
          /* Make iframe content transparent */
          html, body { 
            background: transparent !important;
            background-color: transparent !important;
          }
        `;

        // Add transparency CSS to any existing CSS, or use it alone
        css = css ? css + iframeTransparencyCSS : iframeTransparencyCSS;

        // Also try to find the iframe in the parent document and make it transparent
        if (sender.tab && sender.tab.id) {
          try {
            // The iframe host is the current content script's host
            const iframeHost = normalizedHostname;

            // Inject a script to make the iframe element transparent in the parent page
            const makeIframeTransparentCode = `
              (function() {
                // Try finding iframes by source containing the host
                const iframes = document.querySelectorAll('iframe');
                for (const iframe of iframes) {
                  if (iframe.src && iframe.src.includes('${iframeHost}')) {
                    iframe.style.background = 'transparent';
                    iframe.allowTransparency = true;
                    iframe.setAttribute('allowtransparency', 'true');
                    console.log('ZenInternet: Made iframe transparent:', iframe.src);
                  }
                }
              })();
            `;

            // Execute this in the parent frame only
            browser.tabs
              .executeScript(sender.tab.id, {
                code: makeIframeTransparentCode,
                frameId: 0, // Execute in the main frame
              })
              .catch((err) => {
                // This might fail due to CSP, which is fine
                console.log(
                  "Failed to execute iframe transparency script:",
                  err
                );
              });
          } catch (err) {
            console.error(
              "Error trying to make iframe transparent in parent:",
              err
            );
          }
        }
      }

      // If we're in an iframe and didn't find specific styles, try using parent styles
      if (!css && sender.frameId !== 0 && parentHostname) {
        // Check if we should use parent site's style for this iframe
        // This is useful for cases like tasks.google.com in calendar.google.com
        const parentDomain = parentHostname.split(".").slice(-2).join(".");
        const iframeDomain = normalizedHostname.split(".").slice(-2).join(".");

        // If the iframe and parent share the same base domain, try applying parent styles
        if (parentDomain === iframeDomain) {
          console.log(
            `Trying to use parent styles for iframe: ${normalizedHostname} (parent: ${parentHostname})`
          );
          css = await getStylesForHostname(parentHostname, settings);

          // Also add iframe-specific transparency styles
          if (css) {
            css += `
              /* Make iframe content transparent */
              html, body { 
                background: transparent !important;
                background-color: transparent !important;
              }
            `;
          }
        }
      }

      // If we found matching CSS, send it immediately to the content script
      if (css) {
        browser.tabs
          .sendMessage(
            sender.tab.id,
            {
              action: "applyStyles",
              css: css,
            },
            { frameId: sender.frameId }
          )
          .catch((err) => {
            if (logging) console.log("Failed to send immediate CSS:", err);
          });
      } else if (message.isIframe) {
        // Even if we have no CSS, ensure iframe transparency
        browser.tabs
          .sendMessage(
            sender.tab.id,
            {
              action: "makeTransparent",
            },
            { frameId: sender.frameId }
          )
          .catch((err) => {
            if (logging)
              console.log("Failed to send iframe transparency command:", err);
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

  // Update the icon when the content script reports ready
  if (message.action === "contentScriptReady" && sender.tab) {
    updateIconForTab(sender.tab.id, sender.tab.url);
  }

  return false;
});

// Get appropriate styles for a hostname based on all rules
async function getStylesForHostname(hostname, settings) {
  // Ensure all required settings have defaults before proceeding
  settings = ensureDefaultSettings(settings);

  console.log("DEBUG: Finding styles for hostname:", hostname);

  // Check for exact matches first (highest priority)
  if (cssCache.has(hostname)) {
    console.log("DEBUG: Found exact hostname match in cache");
    return cssCache.get(hostname);
  } else if (cssCache.has(`www.${hostname}`)) {
    console.log("DEBUG: Found www prefix match in cache");
    return cssCache.get(`www.${hostname}`);
  } else {
    // Check for wildcard matches (+domain.com) and suffix matches (-domain.com)
    for (const [cachedSite, cachedCSS] of cssCache.entries()) {
      // Handle wildcard domain prefix matches (+example.com)
      if (cachedSite.startsWith("+")) {
        const baseSite = cachedSite.slice(1);
        // Ensure we're matching with proper domain boundary (dot or exact match)
        if (hostname === baseSite || hostname.endsWith(`.${baseSite}`)) {
          console.log(
            `DEBUG: Found wildcard match: ${cachedSite} for ${hostname}`
          );
          return cachedCSS;
        }
      }
      // Handle TLD suffix matches (-domain.com)
      else if (cachedSite.startsWith("-")) {
        const baseSite = cachedSite.slice(1);

        // Extract domain name without the TLD
        // For cached site: Use everything before the last dot(s)
        const cachedDomain = baseSite.split(".").slice(0, -1).join(".");

        // For hostname: Similarly extract the domain without the TLD
        const hostParts = hostname.split(".");
        const hostDomain =
          hostParts.length > 1 ? hostParts.slice(0, -1).join(".") : hostname;

        console.log(
          `DEBUG: Comparing domains - cached: ${cachedDomain}, host: ${hostDomain}`
        );

        if (cachedDomain && hostDomain && hostDomain === cachedDomain) {
          console.log(
            `DEBUG: Found TLD suffix match: ${cachedSite} for ${hostname}`
          );
          return cachedCSS;
        }
      }
      // Regular subdomain handling (exact match already checked above)
      else if (
        cachedSite !== hostname &&
        cachedSite !== `www.${hostname}` &&
        hostname.endsWith(`.${cachedSite}`) &&
        !cachedSite.startsWith("-")
      ) {
        // Only match subdomains, not partial domain names
        console.log(
          `DEBUG: Found subdomain match: ${cachedSite} for ${hostname}`
        );
        return cachedCSS;
      }
    }

    // Check for forced styles
    if (settings.forceStyling) {
      const skipListData = await browser.storage.local.get(
        SKIP_FORCE_THEMING_KEY
      );
      const siteList = skipListData[SKIP_FORCE_THEMING_KEY] || [];
      const isWhitelistMode = settings.whitelistMode || false;
      const siteInList = siteList.includes(hostname);

      // In whitelist mode: apply only if site is in the list
      // In blacklist mode: apply only if site is NOT in the list
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

// Prepare styles for a URL that's about to load
async function prepareStylesForUrl(hostname, tabId) {
  try {
    const settingsData = await browser.storage.local.get(BROWSER_STORAGE_KEY);

    // Ensure all required settings have defaults
    const settings = ensureDefaultSettings(
      settingsData[BROWSER_STORAGE_KEY] || {}
    );

    if (settings.enableStyling === false) return;

    const css = await getStylesForHostname(hostname, settings);

    if (css && tabId) {
      // Store the CSS to be ready as soon as the content script connects
      activeTabs.set(tabId, {
        hostname: hostname,
        css: css,
      });
    }
  } catch (error) {
    console.error("Error preparing styles for URL:", error);
  }
}

async function applyCSSToTab(tab) {
  console.log("DEBUG: applyCSSToTab called for tab", tab.id, "URL:", tab.url);

  try {
    const url = new URL(tab.url);
    const originalHostname = url.hostname;
    const hostname = normalizeHostname(originalHostname);
    console.log(
      "DEBUG: Processing hostname:",
      hostname,
      "(original:",
      originalHostname,
      ")"
    );

    const settings = await browser.storage.local.get(BROWSER_STORAGE_KEY);

    // Ensure defaults for any missing settings
    const globalSettings = ensureDefaultSettings(
      settings[BROWSER_STORAGE_KEY] || {}
    );

    // Save back any missing defaults
    if (
      JSON.stringify(globalSettings) !==
      JSON.stringify(settings[BROWSER_STORAGE_KEY])
    ) {
      await browser.storage.local.set({
        [BROWSER_STORAGE_KEY]: globalSettings,
      });
      if (logging)
        console.log("Applied missing default settings during CSS application");
    }

    console.log("DEBUG: Global settings:", JSON.stringify(globalSettings));

    const skipStyleListData = await browser.storage.local.get(SKIP_THEMING_KEY);
    const skipStyleList = skipStyleListData[SKIP_THEMING_KEY] || [];

    // Use default from settings if not explicitly set
    const styleMode =
      globalSettings.whitelistStyleMode ?? DEFAULT_SETTINGS.whitelistStyleMode;

    if (
      globalSettings.enableStyling === false ||
      (!styleMode && skipStyleList.includes(hostname)) ||
      (styleMode && !skipStyleList.includes(hostname))
    ) {
      console.log("DEBUG: Styling is disabled, exiting early");
      // Make sure the icon is updated to reflect the disabled state
      setIcon(tab.id, false);

      // Clear the cache entry to ensure we don't have stale data
      const cacheKey = `styling:${hostname}`;
      stylingStateCache.set(cacheKey, false);
      return;
    }

    const data = await browser.storage.local.get("styles");
    console.log(
      "DEBUG: Loaded styles count:",
      Object.keys(data.styles?.website || {}).length
    );

    const skipListData = await browser.storage.local.get(
      SKIP_FORCE_THEMING_KEY
    );
    const siteList = skipListData[SKIP_FORCE_THEMING_KEY] || [];
    console.log("DEBUG: Skip/Whitelist contains", siteList.length, "sites");
    console.log("DEBUG: Current site in list:", siteList.includes(hostname));

    const isWhitelistMode = globalSettings.whitelistMode || false;
    console.log("DEBUG: Using whitelist mode:", isWhitelistMode);

    // Find the best matching CSS file
    let bestMatch = null;
    let bestMatchLength = 0;
    let matchType = "none";

    for (const key of Object.keys(data.styles?.website || {})) {
      const siteName = key.replace(".css", "");

      // For site names in the styles list, also normalize by removing www. if present
      const normalizedSiteName = normalizeHostname(siteName);

      // Exact match has highest priority - compare normalized hostnames
      if (hostname === normalizedSiteName) {
        bestMatch = key;
        matchType = "exact";
        console.log("DEBUG: Found exact match:", key);
        break;
      }

      // Then check wildcard matches
      if (siteName.startsWith("+")) {
        const baseSite = siteName.slice(1);
        // Ensure we're matching with proper domain boundary
        if (
          (hostname === baseSite || hostname.endsWith(`.${baseSite}`)) &&
          baseSite.length > bestMatchLength
        ) {
          bestMatch = key;
          bestMatchLength = baseSite.length;
          matchType = "wildcard";
          console.log(
            "DEBUG: Found wildcard match:",
            key,
            "with length",
            baseSite.length
          );
        }
      }
      // Check TLD suffix matches (-domain.com) - fixed implementation
      else if (siteName.startsWith("-")) {
        const baseSite = siteName.slice(1);

        // Extract domain name without the TLD
        // For cached site: Use everything before the last dot(s)
        const cachedDomain = baseSite.split(".").slice(0, -1).join(".");

        // For hostname: Similarly extract the domain without the TLD
        const hostParts = hostname.split(".");
        const hostDomain =
          hostParts.length > 1 ? hostParts.slice(0, -1).join(".") : hostname;

        console.log(
          `DEBUG: Comparing domains - cached: ${cachedDomain}, host: ${hostDomain}`
        );

        // Match if the domain part (without TLD) matches
        if (cachedDomain && hostDomain && hostDomain === cachedDomain) {
          // Only update if it's a better match (longer domain name part)
          if (cachedDomain.length > bestMatchLength) {
            bestMatch = key;
            bestMatchLength = cachedDomain.length;
            matchType = "suffix";
            console.log(
              "DEBUG: Found TLD suffix match:",
              key,
              "for",
              hostname,
              "with domain part:",
              cachedDomain
            );
          }
        }
      }
      // Last, check subdomain matches with proper domain boundary
      else if (
        hostname !== normalizedSiteName &&
        hostname.endsWith(`.${normalizedSiteName}`) &&
        !siteName.startsWith("-") &&
        normalizedSiteName.length > bestMatchLength
      ) {
        bestMatch = key;
        bestMatchLength = normalizedSiteName.length;
        matchType = "subdomain";
        console.log(
          "DEBUG: Found domain suffix match:",
          key,
          "with length",
          normalizedSiteName.length
        );
      }
    }

    // If we found a direct match, use it
    if (bestMatch) {
      console.log("DEBUG: Using match:", bestMatch, "of type:", matchType);
      await applyCSS(tab.id, hostname, data.styles.website[bestMatch]);
      return;
    } else {
      console.log("DEBUG: No direct style match found for:", hostname);
    }

    // Otherwise, check if we should apply forced styling
    console.log("DEBUG: Force styling enabled:", globalSettings.forceStyling);
    if (globalSettings.forceStyling) {
      const siteInList = siteList.includes(hostname);
      console.log("DEBUG: Site in list:", siteInList);

      // Use default from settings if not explicitly set
      const isWhitelistMode =
        globalSettings.whitelistMode ?? DEFAULT_SETTINGS.whitelistMode;
      console.log("DEBUG: Using whitelist mode:", isWhitelistMode);

      // In whitelist mode: apply only if site is in the list
      // In blacklist mode: apply only if site is NOT in the list
      const shouldApplyForcedStyling =
        (isWhitelistMode && siteInList) || (!isWhitelistMode && !siteInList);
      console.log(
        "DEBUG: Should apply forced styling:",
        shouldApplyForcedStyling,
        "(Whitelist mode:",
        isWhitelistMode,
        ", Site in list:",
        siteInList,
        ")"
      );

      if (shouldApplyForcedStyling) {
        if (data.styles.website["example.com.css"]) {
          console.log("DEBUG: Applying forced styling with example.com.css");
          await applyCSS(
            tab.id,
            hostname,
            data.styles.website["example.com.css"]
          );
        } else {
          console.log("DEBUG: example.com.css not found in styles");
        }
      } else {
        console.log("DEBUG: Skipping forced styling due to site list rules");
      }
    } else {
      console.log("DEBUG: Force styling is disabled, no styles applied");
    }

    // After successfully applying CSS, update the icon to ON state
    // and update the styling state cache
    const cacheKey = `styling:${hostname}`;
    stylingStateCache.set(cacheKey, true);
    setIcon(tab.id, true);
  } catch (error) {
    console.error(`DEBUG ERROR: Error applying CSS:`, error);
    // If there's an error, make sure the icon is OFF
    setIcon(tab.id, false);
  }
}

async function applyCSS(tabId, hostname, features) {
  console.log("DEBUG: applyCSS called for tab", tabId, "hostname", hostname);

  if (!features) {
    console.log("DEBUG: No features to apply, exiting early");
    return;
  }

  console.log("DEBUG: Features count:", Object.keys(features).length);

  const settingsData = await browser.storage.local.get(BROWSER_STORAGE_KEY);

  // Ensure defaults for any missing settings
  const globalSettings = ensureDefaultSettings(
    settingsData[BROWSER_STORAGE_KEY] || {}
  );

  console.log(
    "DEBUG: Global settings in applyCSS:",
    JSON.stringify(globalSettings)
  );

  // UPDATED: Use normalized hostname for consistent settings retrieval
  const normalizedHostname = normalizeHostname(hostname);
  const siteKey = `transparentZenSettings.${normalizedHostname}`;
  const siteData = await browser.storage.local.get(siteKey);
  const featureSettings = siteData[siteKey] || {};

  console.log(
    "DEBUG: Site-specific settings from normalized key:",
    siteKey,
    JSON.stringify(featureSettings)
  );

  let combinedCSS = "";
  let includedFeatures = 0;
  let skippedTransparencyFeatures = 0;
  let skippedHoverFeatures = 0;
  let skippedFooterFeatures = 0;
  let skippedDisabledFeatures = 0;

  for (const [feature, css] of Object.entries(features)) {
    const isTransparencyFeature = feature
      .toLowerCase()
      .includes("transparency");
    const isHoverFeature = feature.toLowerCase().includes("hover");
    const isFooterFeature = feature.toLowerCase().includes("footer");

    // Skip any transparency feature if disableTransparency is enabled globally
    if (globalSettings.disableTransparency && isTransparencyFeature) {
      console.log(`DEBUG: Skipping transparency feature: ${feature}`);
      skippedTransparencyFeatures++;
      continue;
    }

    // Skip any hover feature if disableHover is enabled globally
    if (globalSettings.disableHover && isHoverFeature) {
      console.log(`DEBUG: Skipping hover feature: ${feature}`);
      skippedHoverFeatures++;
      continue;
    }

    // Skip any footer feature if disableFooter is enabled globally
    if (globalSettings.disableFooter && isFooterFeature) {
      console.log(`DEBUG: Skipping footer feature: ${feature}`);
      skippedFooterFeatures++;
      continue;
    }

    const isFeatureEnabled = featureSettings[feature] !== false;
    if (isFeatureEnabled) {
      combinedCSS += css + "\n";
      includedFeatures++;
      console.log(`DEBUG: Including feature: ${feature}`);
    } else {
      console.log(`DEBUG: Feature disabled in site settings: ${feature}`);
      skippedDisabledFeatures++;
    }
  }

  console.log(
    `DEBUG: CSS Summary - included: ${includedFeatures}, skipped transparency: ${skippedTransparencyFeatures}, skipped hover: ${skippedHoverFeatures}, skipped footer: ${skippedFooterFeatures}, skipped disabled: ${skippedDisabledFeatures}`
  );

  if (combinedCSS) {
    try {
      // Add iframe transparency CSS to all CSS
      const withIframeSupport =
        combinedCSS +
        `
        /* Support for iframes */
        iframe {
          background: transparent !important;
          background-color: transparent !important;
        }
      `;

      // Try to send via messaging to all frames (most reliable for instant application)
      console.log(
        `DEBUG: Sending styles to tab ${tabId} via messaging (${withIframeSupport.length} bytes)`
      );

      // First try sending to the main frame
      await browser.tabs.sendMessage(
        tabId,
        {
          action: "applyStyles",
          css: withIframeSupport,
        },
        { frameId: 0 }
      ); // Main frame

      // Then try to send to all frames (this might fail for cross-origin iframes)
      try {
        await browser.tabs.executeScript(tabId, {
          code: `
            (function() {
              // Find all iframes and make them transparent
              const iframes = document.querySelectorAll('iframe');
              for (const iframe of iframes) {
                iframe.style.background = 'transparent';
                iframe.allowTransparency = true;
                iframe.setAttribute('allowtransparency', 'true');
              }
            })();
          `,
          allFrames: false, // Just in the main frame
        });
      } catch (e) {
        console.log("Failed to make iframes transparent:", e);
      }
    } catch (e) {
      // Fallback to insertCSS if messaging fails
      console.log(
        `DEBUG: Messaging failed, falling back to insertCSS: ${e.message}`
      );
      try {
        await browser.tabs.insertCSS(tabId, {
          code:
            combinedCSS +
            `
            /* Support for iframes */
            iframe {
              background: transparent !important;
              background-color: transparent !important;
            }
          `,
          runAt: "document_start",
          allFrames: true, // Apply to all frames
        });
      } catch (insertError) {
        console.error(`DEBUG: insertCSS also failed: ${insertError.message}`);
      }
    }
    console.log(`DEBUG: Successfully injected custom CSS for ${hostname}`);
  } else {
    console.log(`DEBUG: No CSS to inject after filtering features`);
  }

  // Update the icon based on our current state
  setIcon(tabId, stylingStateCache.get(`styling:${hostname}`) || false);
}

// Also update icons when tabs are updated
browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete") {
    updateIconForTab(tabId, tab.url);
  }
});

// Update the icon when a tab becomes active
browser.tabs.onActivated.addListener((activeInfo) => {
  updateIconForTab(activeInfo.tabId);
});

// Clear cache on settings changes
browser.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local") {
    if (
      changes[BROWSER_STORAGE_KEY] ||
      changes[SKIP_THEMING_KEY] ||
      changes[SKIP_FORCE_THEMING_KEY]
    ) {
      // Clear the styling state cache when relevant settings change
      stylingStateCache.clear();

      if (logging)
        console.log("Cleared styling state cache due to settings change");
    }
  }
});

let autoUpdateInterval;

function startAutoUpdate() {
  if (logging) console.log("startAutoUpdate called");
  if (autoUpdateInterval) clearInterval(autoUpdateInterval);
  autoUpdateInterval = setInterval(refetchCSS, 2 * 60 * 60 * 1000);
}

function stopAutoUpdate() {
  if (logging) console.log("stopAutoUpdate called");
  if (autoUpdateInterval) clearInterval(autoUpdateInterval);
}

async function refetchCSS() {
  if (logging) console.log("refetchCSS called");
  try {
    // Get the repository URL from storage or use the default one
    const DEFAULT_REPOSITORY_URL =
      "https://sameerasw.github.io/my-internet/styles.json";
    const repoUrlData = await browser.storage.local.get("stylesRepositoryUrl");
    const repositoryUrl =
      repoUrlData.stylesRepositoryUrl || DEFAULT_REPOSITORY_URL;

    console.log("Background: Fetching styles from:", repositoryUrl);

    const response = await fetch(repositoryUrl, {
      headers: { "Cache-Control": "no-cache" },
    });
    if (!response.ok)
      throw new Error(`Failed to fetch styles (Status: ${response.status})`);
    const styles = await response.json();
    await browser.storage.local.set({ styles });

    // Check if we need to initialize default settings
    const settingsData = await browser.storage.local.get(BROWSER_STORAGE_KEY);
    if (!settingsData[BROWSER_STORAGE_KEY]) {
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
        [BROWSER_STORAGE_KEY]: defaultSettings,
      });
      console.info("Initialized default settings during first fetch");
    } else {
      // Just update the lastFetchedTime
      await browser.storage.local.set({ lastFetchedTime: Date.now() });
    }

    console.info(`All styles refetched and updated from ${repositoryUrl}`);

    // Preload the new styles
    preloadStyles();
  } catch (error) {
    console.error("Error refetching styles:", error);
  }
}

// Create a directory to store CSS files
async function initializeExtension() {
  // Check and initialize default settings
  const data = await browser.storage.local.get(BROWSER_STORAGE_KEY);
  const currentSettings = data[BROWSER_STORAGE_KEY] || {};
  const validatedSettings = ensureDefaultSettings(currentSettings);

  // If we had to apply any defaults, save them
  if (JSON.stringify(validatedSettings) !== JSON.stringify(currentSettings)) {
    console.info(
      "Initializing missing settings with defaults:",
      validatedSettings
    );
    await browser.storage.local.set({
      [BROWSER_STORAGE_KEY]: validatedSettings,
    });
  }

  // Ensure empty lists exist
  const skipForceData = await browser.storage.local.get(SKIP_FORCE_THEMING_KEY);
  if (!skipForceData[SKIP_FORCE_THEMING_KEY]) {
    await browser.storage.local.set({ [SKIP_FORCE_THEMING_KEY]: [] });
  }

  const skipThemingData = await browser.storage.local.get(SKIP_THEMING_KEY);
  if (!skipThemingData[SKIP_THEMING_KEY]) {
    await browser.storage.local.set({ [SKIP_THEMING_KEY]: [] });
  }

  // Preload styles immediately
  await preloadStyles();

  // Initialize auto-update based on stored settings
  if (validatedSettings.autoUpdate) {
    startAutoUpdate();
  }

  // Update icons for all tabs on extension startup
  const tabs = await browser.tabs.query({});
  for (const tab of tabs) {
    updateIconForTab(tab.id, tab.url);
  }
}

// Listen for specific navigation events to apply CSS as early as possible
browser.webNavigation.onCommitted.addListener((details) => {
  if (details.frameId === 0) {
    browser.tabs
      .get(details.tabId)
      .then((tab) => {
        applyCSSToTab(tab);
      })
      .catch((err) => {
        console.error("Error getting tab info:", err);
      });
  }
});

// Application start
initializeExtension();

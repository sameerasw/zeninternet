function applyCSSToTab(tab) {
  const url = new URL(tab.url);
  const hostname = url.hostname;

  browser.storage.local.get("transparentZenSettings").then((settings) => {
    if (settings.transparentZenSettings?.enableStyling) {
      browser.storage.local.get("styles").then((data) => {
        const cssFileName = Object.keys(data.styles?.website || {}).find(
          (key) => {
            const siteName = key.replace(".css", "");
            return hostname === siteName || hostname === `www.${siteName}`;
          }
        );

        if (cssFileName) {
          const features = data.styles.website[cssFileName];
          const featureSettings =
            settings.transparentZenSettings.featureSettings?.[cssFileName] ||
            {};

          let combinedCSS = "";
          for (const [feature, css] of Object.entries(features)) {
            if (featureSettings[feature] !== false) {
              combinedCSS += css + "\n";
            }
          }

          if (combinedCSS) {
            browser.tabs
              .insertCSS(tab.id, { code: combinedCSS })
              .then(() => {
                console.log(`Injected custom CSS for ${hostname}`);
              })
              .catch((error) => {
                console.error(`Error applying CSS to ${hostname}:`, error);
              });
          }
        }
      });
    }
  });
}

let autoUpdateInterval;

function startAutoUpdate() {
  if (autoUpdateInterval) clearInterval(autoUpdateInterval);
  autoUpdateInterval = setInterval(refetchCSS, 2 * 60 * 60 * 1000);
}

function stopAutoUpdate() {
  if (autoUpdateInterval) clearInterval(autoUpdateInterval);
}

async function refetchCSS() {
  try {
    const response = await fetch(
      "https://sameerasw.github.io/my-internet/styles.json",
      {
        headers: { "Cache-Control": "no-cache" },
      }
    );
    if (!response.ok) throw new Error("Failed to fetch styles.json");
    const styles = await response.json();
    await browser.storage.local.set({ styles });
    await browser.storage.local.set({ lastFetchedTime: Date.now() });
    console.info("All styles refetched and updated from GitHub.");
  } catch (error) {
    console.error("Error refetching styles:", error);
  }
}

browser.runtime.onMessage.addListener((message) => {
  if (message.action === "enableAutoUpdate") {
    startAutoUpdate();
  } else if (message.action === "disableAutoUpdate") {
    stopAutoUpdate();
  }
});

// Initialize auto-update based on stored settings
browser.storage.local.get("transparentZenSettings").then((settings) => {
  if (settings.transparentZenSettings?.autoUpdate) {
    startAutoUpdate();
  }
});

browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete") {
    applyCSSToTab(tab);
  }
});

browser.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await browser.tabs.get(activeInfo.tabId);
  applyCSSToTab(tab);
});

new (class ExtensionPopup {
  BROWSER_STORAGE_KEY = "transparentZenSettings";
  browserStorageSettings = {};
  enableStylingSwitch = document.getElementById("enable-styling");
  refetchCSSButton = document.getElementById("refetch-css");

  constructor() {
    this.loadSettings().then((settings) => {
      if (settings) {
        this.browserStorageSettings = settings;
        this.restoreSettings();
        this.bindEvents();
      }
    });
    this.refetchCSSButton.addEventListener("click", this.refetchCSS.bind(this));
    document
      .getElementById("restart-background")
      .addEventListener("click", this.restartBackground);
  }

  bindEvents() {
    this.enableStylingSwitch.addEventListener("change", () => {
      this.saveSettings();
    });
  }

  restoreSettings() {
    if (this.browserStorageSettings.enableStyling !== undefined) {
      this.enableStylingSwitch.checked =
        this.browserStorageSettings.enableStyling;
    }
  }

  async loadSettings() {
    const settings = await browser.storage.local.get(this.BROWSER_STORAGE_KEY);
    console.info("Settings loaded", settings?.[this.BROWSER_STORAGE_KEY]);
    return settings?.[this.BROWSER_STORAGE_KEY] || {};
  }

  saveSettings() {
    this.browserStorageSettings.enableStyling =
      this.enableStylingSwitch.checked;

    browser.storage.local.set({
      [this.BROWSER_STORAGE_KEY]: this.browserStorageSettings,
    });
    browser.storage.sync.set({
      [this.BROWSER_STORAGE_KEY]: this.browserStorageSettings,
    });
    console.info("Settings saved", this.browserStorageSettings);
  }

  async refetchCSS() {
    this.refetchCSSButton.textContent = "Fetching...";
    try {
      const response = await fetch("/mapper.json", {
        headers: {
          "Cache-Control": "no-cache",
        },
      });
      if (!response.ok) throw new Error("Failed to fetch mapper.json");
      const mapping = await response.json();
      for (const [site, cssFileName] of Object.entries(mapping)) {
        const cssResponse = await fetch(
          `https://sameerasw.github.io/my-internet/${cssFileName}`,
          {
            headers: {
              "Cache-Control": "no-cache",
            },
          }
        );
        if (!cssResponse.ok) throw new Error(`Failed to fetch CSS for ${site}`);
        const cssText = await cssResponse.text();
        await browser.storage.local.set({ [cssFileName]: cssText });
        await browser.storage.sync.set({ [cssFileName]: cssText });
      }
      this.refetchCSSButton.textContent = "Done!";
      setTimeout(() => {
        this.refetchCSSButton.textContent = "Refetch latest styles";
      }, 2000);
      console.info("All CSS files refetched and updated from GitHub.");
    } catch (error) {
      this.refetchCSSButton.textContent = "Error!";
      setTimeout(() => {
        this.refetchCSSButton.textContent = "Refetch latest styles";
      }, 2000);
      console.error("Error refetching CSS:", error);
    }
  }

  async restartBackground() {
    browser.runtime.reload();
    console.info("Background script restart requested.");
  }
})();

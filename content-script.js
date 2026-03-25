(function () {
  const STYLE_ID = "zeninternet-styles";
  let observer = null;

  /**
   * Centralized logging helper that respects the enableLogs setting.
   */
  async function log(...args) {
    try {
      const result = await browser.storage.local.get("transparentZenSettings");
      const settings = result["transparentZenSettings"] || {};
      if (settings.enableLogs) {
        console.log("[ZenInternet]", ...args);
      }
    } catch (e) {}
  }

  /**
   * Returns our style element or creates it if it doesn't exist.
   */
  function getOrCreateStyleEl() {
    let el = document.getElementById(STYLE_ID);
    if (!el) {
      el = document.createElement("style");
      el.id = STYLE_ID;
    }
    return el;
  }

  /**
   * Positions our style element at the end of head for maximum cascade priority.
   */
  function ensureLastInHead() {
    const head = document.head || document.documentElement;
    const el = getOrCreateStyleEl();
    if (head.lastChild !== el) {
      head.appendChild(el);
    }
  }

  /**
   * Watches head for dynamically injected stylesheets and re-anchors ours.
   */
  function startObserver() {
    if (observer) return;
    const head = document.head || document.documentElement;
    observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.addedNodes.length) {
          const addedOurs = Array.from(m.addedNodes).some(
            (n) => n.id === STYLE_ID
          );
          if (!addedOurs) {
            log("Head mutation detected, re-applying styles...");
            ensureLastInHead();
          }
          break;
        }
      }
    });
    observer.observe(head, { childList: true });
  }

  /**
   * Updates style content and ensures they are applied with top priority.
   */
  function applyStyles(css) {
    log("Applying styles to page...");
    const el = getOrCreateStyleEl();
    el.textContent = css || "";
    ensureLastInHead();
    startObserver();
  }

  /**
   * Clears the current styles.
   */
  function removeStyles() {
    const el = document.getElementById(STYLE_ID);
    if (el) el.textContent = "";
  }

  /**
   * Displays a premium toast notification in the top-right corner.
   */
  function showToast(text, isEnabled) {
    const existing = document.getElementById("zeninternet-toast");
    if (existing) existing.remove();

    const isLightMode = window.matchMedia("(prefers-color-scheme: light)").matches;

    const toast = document.createElement("div");
    toast.id = "zeninternet-toast";
    
    // Theme-aware styling matching extension
    const accentColor = "#f98764";
    const switchBgOff = isLightMode ? "#ced4da" : "#4c4c63";
    const toastBg = isLightMode ? "rgba(245, 247, 250, 0.9)" : "rgba(25, 25, 25, 0.85)";
    const toastColor = isLightMode ? "#343a40" : "#ffffff";
    const shadowColor = isLightMode ? "rgba(0, 0, 0, 0.15)" : "rgba(0, 0, 0, 0.4)";
    const borderColor = isLightMode ? "rgba(0, 0, 0, 0.05)" : "rgba(255, 255, 255, 0.1)";

    Object.assign(toast.style, {
      position: "fixed",
      top: "20px",
      right: "20px",
      padding: "10px 16px",
      background: toastBg,
      backdropFilter: "blur(12px)",
      webkitBackdropFilter: "blur(12px)",
      color: toastColor,
      borderRadius: "14px",
      fontSize: "14px",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      fontWeight: "500",
      boxShadow: `0 8px 32px ${shadowColor}, 0 0 0 1px ${borderColor}`,
      zIndex: "2147483647",
      opacity: "0",
      transform: "translateY(-10px) scale(0.95)",
      transition: "all 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
      pointerEvents: "none",
      display: "flex",
      alignItems: "center",
      gap: "12px"
    });

    const iconUrl = browser.runtime.getURL("assets/images/logo.png");
    
    toast.innerHTML = `
      <img src="${iconUrl}" style="width: 20px; height: 20px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));">
      <span style="margin-right: 4px;">${text}</span>
      <div class="zen-toast-switch" style="
        position: relative;
        width: 32px;
        height: 18px;
        background-color: ${isEnabled ? accentColor : switchBgOff};
        border-radius: 18px;
        transition: background-color 0.2s;
      ">
        <div style="
          position: absolute;
          top: 2px;
          left: 2px;
          width: 14px;
          height: 14px;
          background-color: white;
          border-radius: 50%;
          transition: transform 0.2s;
          transform: translateX(${isEnabled ? "14px" : "0"});
          box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        "></div>
      </div>
    `;

    document.documentElement.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => {
      toast.style.opacity = "1";
      toast.style.transform = "translateY(0) scale(1)";
    });

    // Auto-remove
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(-10px) scale(0.95)";
      setTimeout(() => toast.remove(), 400);
    }, 2800);
  }

  browser.runtime.onMessage.addListener((message) => {
    if (message.action === "applyStyles") {
      applyStyles(message.css);
      return Promise.resolve({ success: true });
    }
    if (message.action === "removeStyles") {
      removeStyles();
      return Promise.resolve({ success: true });
    }
    if (message.action === "showToast") {
      showToast(message.text, message.isEnabled);
      return Promise.resolve({ success: true });
    }
    return false;
  });

  try {
    browser.runtime.sendMessage({
      action: "contentScriptReady",
      hostname: window.location.hostname,
    }).catch(() => {});
  } catch (e) {}
})();

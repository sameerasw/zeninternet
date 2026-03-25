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
   * Injects the required CSS for the  glow animations.
   */
  function injectAnimationCSS() {
    const id = "zen-animations-styles";
    if (document.getElementById(id)) return;
    const style = document.createElement("style");
    style.id = id;
    style.textContent = `
      @keyframes zen-glow-out {
        0% { transform: translate(-50%, -50%) scale(0.1); opacity: 0.6; }
        100% { transform: translate(-50%, -50%) scale(15); opacity: 0; }
      }
      @keyframes zen-glow-in {
        0% { transform: translate(-50%, -50%) scale(15); opacity: 0; }
        100% { transform: translate(-50%, -50%) scale(0.1); opacity: 0.6; }
      }
      @keyframes zen-toast-in {
        0% { transform: translateX(120%) scale(0.9); opacity: 0; }
        70% { transform: translateX(-10px) scale(1.02); opacity: 1; }
        100% { transform: translateX(0) scale(1); opacity: 1; }
      }
      @keyframes zen-toast-out {
        0% { transform: translateX(0) scale(1); opacity: 1; }
        100% { transform: translateX(120%) scale(0.9); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Creates a  glow ring animation originating from the toast position.
   */
  function createGlowRing(isEnabled) {
    injectAnimationCSS();
    const ring = document.createElement("div");
    const accentColor = "#f98764";
    
    Object.assign(ring.style, {
      position: "fixed",
      top: "40px",
      right: "40px",
      width: "150px",
      height: "150px",
      borderRadius: "50%",
      border: `4px solid ${accentColor}`,
      boxShadow: `0 0 60px ${accentColor}, inset 0 0 60px ${accentColor}`,
      filter: "blur(20px)",
      pointerEvents: "none",
      zIndex: "2147483646",
      opacity: "0",
      transform: "translate(-50%, -50%)"
    });

    ring.style.animation = isEnabled 
      ? "zen-glow-out 1.6s cubic-bezier(0.16, 1, 0.3, 1) forwards" 
      : "zen-glow-in 1.6s cubic-bezier(0.16, 1, 0.3, 1) forwards";

    document.documentElement.appendChild(ring);
    setTimeout(() => ring.remove(), 1300);
  }

  /**
   * Displays a premium toast notification in the top-right corner.
   */
  function showToast(text, isEnabled) {
    createGlowRing(isEnabled);
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
      display: "flex",
      alignItems: "center",
      gap: "12px",
      pointerEvents: "none",
      transform: "translateX(120%) scale(0.9)",
      opacity: "0",
      animation: "zen-toast-in 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards"
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
          top: 3px;
          ${isEnabled ? "right: 3px;" : "left: 3px;"}
          width: 12px;
          height: 12px;
          background-color: white;
          border-radius: 50%;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        "></div>
      </div>
    `;

    document.documentElement.appendChild(toast);

    const closeToast = () => {
      toast.style.animation = "zen-toast-out 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards";
      setTimeout(() => toast.remove(), 500);
    };

    setTimeout(closeToast, 3000);
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

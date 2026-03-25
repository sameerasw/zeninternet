(function () {
  const STYLE_ID = "zeninternet-styles";
  let observer = null;

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

  browser.runtime.onMessage.addListener((message) => {
    if (message.action === "applyStyles") {
      applyStyles(message.css);
      return Promise.resolve({ success: true });
    }
    if (message.action === "removeStyles") {
      removeStyles();
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

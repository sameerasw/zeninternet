(function () {
  const BG_DATA_KEY = "backgroundImageData";
  const STYLE_ID = "zen-wallpaper-layer";

  function apply(dataUrl) {
    let s = document.getElementById(STYLE_ID);
    if (!dataUrl) {
      if (s) s.remove();
      return;
    }
    if (!s) {
      s = document.createElement("style");
      s.id = STYLE_ID;
      (document.head || document.documentElement).appendChild(s);
    }
    s.textContent = `
body::before {
  content: '';
  position: fixed;
  inset: 0;
  background-image: url('${dataUrl}');
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  z-index: -9999;
  pointer-events: none;
}
`;
  }

  chrome.storage.local.get(BG_DATA_KEY, (d) => apply(d[BG_DATA_KEY] || ""));

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes[BG_DATA_KEY]) {
      apply(changes[BG_DATA_KEY].newValue || "");
    }
  });
})();

// Theme Switcher UI Controller
(function () {
  const MODES = ["light", "dark"];
  const PALETTES = [
    { id: "default", label: "薄荷" },
    { id: "forest",  label: "森林" },
    { id: "sakura",  label: "樱花" },
    { id: "ocean",   label: "海洋" },
    { id: "sunset",  label: "落日" },
    { id: "mono",    label: "极简" },
  ];
  const EFFECTS = [
    { id: "none",   label: "关闭", icon: "🚫" },
    { id: "star",   label: "星空", icon: "✨" },
    { id: "heart",  label: "爱心", icon: "💖" },
    { id: "flower", label: "花朵", icon: "🌸" },
    { id: "snow",   label: "雪花", icon: "❄️" },
    { id: "meteor", label: "星星", icon: "⭐" },
  ];
  // 只保留 默认（无） 和 彗星
  const CURSORS = [
    { id: "none",  label: "默认", icon: "🖱️" },
    { id: "comet", label: "彗星", icon: "☄️" },
  ];
  
  const KEY_MODE = "theme";
  const KEY_PALETTE = "palette";
  const KEY_EFFECT = "effect";
  const KEY_OPACITY = "effect_opacity";
  const KEY_CURSOR = "cursorStyle";
  const html = document.documentElement;

  const currentMode = () => (html.getAttribute("data-theme") === "dark" ? "dark" : "light");
  const currentPalette = () => html.getAttribute("data-palette") || "default";
  const currentEffect = () => localStorage.getItem(KEY_EFFECT) || "flower";
  const currentOpacity = () => localStorage.getItem(KEY_OPACITY) || "0.6";
  const currentCursor = () => localStorage.getItem(KEY_CURSOR) || "comet";

  const syncUI = () => {
    const mode = currentMode();
    const palette = currentPalette();
    const effect = currentEffect();
    const cursor = currentCursor();
    
    document.querySelectorAll("#theme-panel .mode-btn").forEach(b => {
      b.classList.toggle("is-active", b.dataset.mode === mode);
    });
    document.querySelectorAll("#theme-panel .palette-btn").forEach(b => {
      b.classList.toggle("is-active", b.dataset.palette === palette);
    });
    document.querySelectorAll("#theme-panel .effect-btn").forEach(b => {
      b.classList.toggle("is-active", b.dataset.effect === effect);
    });
    document.querySelectorAll("#theme-panel .cursor-btn").forEach(b => {
      b.classList.toggle("is-active", b.dataset.cursor === cursor);
    });

    const slider = document.getElementById("effect-opacity");
    if (slider) slider.value = currentOpacity();
  };

  const buildPanel = () => {
    if (document.getElementById("theme-fab")) return;

    const mode = currentMode();
    const palette = currentPalette();
    const effect = currentEffect();
    const opacity = currentOpacity();
    const cursor = currentCursor();

    const modeHtml = MODES.map(m => `
      <button class="mode-btn ${m === mode ? "is-active" : ""}" data-mode="${m}">
        <i class="fas ${m === "light" ? "fa-sun" : "fa-moon"}"></i>
        ${m === "light" ? "亮色" : "暗色"}
      </button>`).join("");

    const paletteHtml = PALETTES.map(p => `
      <button class="palette-btn ${p.id === palette ? "is-active" : ""}"
              data-palette="${p.id}" data-label="${p.label}" title="${p.label}"></button>`).join("");

    const effectHtml = EFFECTS.map(e => `
      <button class="effect-btn ${e.id === effect ? "is-active" : ""}" data-effect="${e.id}" title="${e.label}">
        <span style="font-size: 1.15em; line-height: 1;">${e.icon}</span>
      </button>`).join("");

    // 渲染光标按钮（只有两个）
    const cursorHtml = CURSORS.map(c => `
      <button class="effect-btn cursor-btn ${c.id === cursor ? "is-active" : ""}" data-cursor="${c.id}" title="${c.label}">
        <span style="font-size: 1.15em; line-height: 1;">${c.icon}</span>
      </button>`).join("");

    document.body.insertAdjacentHTML("beforeend", `
      <button id="theme-fab" title="切换主题" aria-label="切换主题">
        <i class="fas fa-palette"></i>
      </button>
      <div id="theme-panel" role="dialog" aria-label="主题选择">
        <p class="panel-title">显示模式</p>
        <div class="mode-row">${modeHtml}</div>
        <div class="panel-divider"></div>
        <p class="panel-title">配色方案</p>
        <div class="palette-grid">${paletteHtml}</div>
        <div class="panel-divider"></div>
        <p class="panel-title">页面特效</p>
        <div class="effect-grid" style="grid-template-columns: repeat(3, 1fr);">${effectHtml}</div>
        <div class="opacity-row">
          <span>透明度</span>
          <input type="range" id="effect-opacity" min="0" max="1" step="0.1" value="${opacity}">
        </div>
        <div class="panel-divider"></div>
        <p class="panel-title">光标样式</p>
        <div class="effect-grid" style="grid-template-columns: repeat(2, 1fr);">${cursorHtml}</div>
      </div>
    `);

    const fab = document.getElementById("theme-fab");
    const panel = document.getElementById("theme-panel");

    fab.addEventListener("click", (e) => {
      e.stopPropagation();
      panel.classList.toggle("is-open");
    });
    document.addEventListener("click", (e) => {
      if (!panel.contains(e.target) && e.target !== fab) panel.classList.remove("is-open");
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") panel.classList.remove("is-open");
    });

    panel.addEventListener("click", (e) => {
      const modeBtn = e.target.closest(".mode-btn");
      if (modeBtn) {
        localStorage.setItem(KEY_MODE, modeBtn.dataset.mode);
        window.__applyTheme(); if(window.__updateEffectColor) window.__updateEffectColor();
        setTimeout(syncUI, 0); 
        return;
      }
      const palBtn = e.target.closest(".palette-btn");
      if (palBtn) {
        localStorage.setItem(KEY_PALETTE, palBtn.dataset.palette);
        window.__applyTheme(); if(window.__updateEffectColor) window.__updateEffectColor();
        setTimeout(syncUI, 0); 
        return;
      }
      const effBtn = e.target.closest(".effect-btn:not(.cursor-btn)");
      if (effBtn) {
        if (window.__setEffect) window.__setEffect(effBtn.dataset.effect);
        setTimeout(syncUI, 0);
        return;
      }
      const curBtn = e.target.closest(".cursor-btn");
      if (curBtn) {
        if (window.__setCursorStyle) window.__setCursorStyle(curBtn.dataset.cursor);
        setTimeout(syncUI, 0);
      }
    });

    const slider = document.getElementById("effect-opacity");
    slider.addEventListener("input", (e) => {
      if (window.__setEffectOpacity) window.__setEffectOpacity(e.target.value);
    });
  };

  const init = () => {
    buildPanel();
    syncUI();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
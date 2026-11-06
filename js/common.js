// 公共逻辑：加载 config、注入主题色、深色模式、渲染 navbar、全文搜索、回到顶部

async function loadConfig() {
  try {
    const res = await fetch("config.json");
    if (!res.ok) throw new Error("HTTP " + res.status);
    const cfg = await res.json();
    window.__CONFIG__ = cfg;
    return cfg;
  } catch (e) {
    console.warn("读取 config.json 失败，使用内联兜底数据。");
    return window.__CONFIG__ || {};
  }
}

// ================= 核心主题控制逻辑 =================
// 挂载到 window 以便 theme.js 调用
window.__applyTheme = function() {
  const html = document.documentElement;
  const KEY_MODE = "theme";
  const KEY_PALETTE = "palette";

  // 1. 处理深浅模式
  const savedMode = localStorage.getItem(KEY_MODE);
  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const mode = savedMode || (prefersDark ? "dark" : "light");

  if (mode === "dark") html.setAttribute("data-theme", "dark");
  else html.removeAttribute("data-theme");

  // 同步代码高亮
  const hljs = document.getElementById("hljs-theme");
  if (hljs) hljs.href = mode === "dark" ? "libs/github-dark.min.css" : "libs/github.min.css";

  // 2. 处理配色方案（完全绕开 CSS 类名，直接用 JS 注入最高优先级的行内变量）
  const palette = localStorage.getItem(KEY_PALETTE) || "default";
  html.setAttribute("data-palette", palette === "default" ? "" : palette);

  // 定义所有颜色的 HSL 值
  const colorMap = {
    "default": { h: 171, s: 100, l: 41 }, // 薄荷
    "forest":  { h: 145, s: 63,  l: 42 }, // 森林
    "sakura":  { h: 340, s: 82,  l: 62 }, // 樱花
    "ocean":   { h: 200, s: 90,  l: 48 }, // 海洋
    "sunset":  { h: 25,  s: 95,  l: 55 }, // 落日
    "mono":    { h: 220, s: 10,  l: 45 }  // 极简
  };

  const target = colorMap[palette] || colorMap["default"];

  // 强行覆盖行内样式（这是最高优先级，任何 CSS 都覆盖不掉）
  html.style.setProperty("--bulma-primary-h", target.h);
  html.style.setProperty("--bulma-primary-s", target.s + "%");
  html.style.setProperty("--bulma-primary-l", target.l + "%");
  
  html.style.setProperty("--bulma-link-h", target.h);
  html.style.setProperty("--bulma-link-s", target.s + "%");
  html.style.setProperty("--bulma-link-l", target.l + "%");
};

// ================= 全文搜索模态框 =================
function initSearchModal() {
  const modalHtml = `
    <div id="search-modal" class="modal">
      <div class="modal-background"></div>
      <div class="modal-card" style="width: 90%; max-width: 600px;">
        <section class="modal-card-body">
          <div class="field">
            <p class="control has-icons-left">
              <input id="search-input" class="input is-medium" type="text" placeholder="搜索全文内容... (Ctrl+K)" autocomplete="off">
              <span class="icon is-left"><i class="fas fa-search"></i></span>
            </p>
          </div>
          <div id="search-results" class="menu mt-4" style="max-height: 50vh; overflow-y: auto;">
            <p class="has-text-grey-light is-size-7 text-center mt-4">输入关键词开始搜索...</p>
          </div>
        </section>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML("beforeend", modalHtml);

  const modal = document.getElementById("search-modal");
  const input = document.getElementById("search-input");
  const resultsEl = document.getElementById("search-results");
  const closeBtn = modal.querySelector(".modal-background");

  let searchIndex = [];
  fetch("posts/search-index.json")
    .then(res => res.json())
    .then(data => searchIndex = data)
    .catch(() => {
      console.warn("全文索引加载失败，使用兜底数据");
      if (window.__SEARCH_FALLBACK__) searchIndex = window.__SEARCH_FALLBACK__;
    });

  const highlight = (text, keyword) => {
    if (!keyword) return text;
    const regex = new RegExp(`(${keyword})`, "gi");
    return text.replace(regex, `<mark class="has-background-warning-light">$1</mark>`);
  };

  input.addEventListener("input", (e) => {
    const keyword = e.target.value.trim().toLowerCase();
    if (!keyword) {
      resultsEl.innerHTML = `<p class="has-text-grey-light is-size-7 text-center mt-4">输入关键词开始搜索...</p>`;
      return;
    }

    const matches = [];
    searchIndex.forEach(item => {
      const titleMatch = item.title.toLowerCase().includes(keyword);
      const contentMatch = item.content.toLowerCase().includes(keyword);

      if (titleMatch || contentMatch) {
        let snippet = "";
        if (contentMatch) {
          const idx = item.content.toLowerCase().indexOf(keyword);
          const start = Math.max(0, idx - 20);
          const end = Math.min(item.content.length, idx + 50);
          snippet = item.content.slice(start, end).replace(/\n/g, " ");
          snippet = "..." + highlight(snippet, keyword) + "...";
        }

        matches.push({
          ...item,
          titleHtml: highlight(item.title, keyword),
          snippetHtml: snippet
        });
      }
    });

    if (matches.length === 0) {
      resultsEl.innerHTML = `<p class="has-text-grey-light p-2">没有找到匹配的内容。</p>`;
    } else {
      resultsEl.innerHTML = `<ul class="menu-list">
        ${matches.map(p => `
          <li class="mb-3">
            <a href="post?slug=${encodeURIComponent(p.slug)}" class="is-size-6 has-text-weight-semibold">
              ${p.titleHtml}
            </a>
            ${p.snippetHtml ? `<p class="is-size-7 has-text-grey mt-1 ml-2">${p.snippetHtml}</p>` : ""}
          </li>
        `).join("")}
      </ul>`;
    }
  });

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("#search-toggle");
    if (btn) {
      modal.classList.add("is-active");
      input.focus();
    }
  });

  closeBtn.addEventListener("click", () => modal.classList.remove("is-active"));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.classList.contains("is-active")) {
      modal.classList.remove("is-active");
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "k") {
      e.preventDefault();
      modal.classList.add("is-active");
      input.focus();
    }
  });
}

function renderNavbar(config, page) {
  const mount = document.getElementById("site-navbar");
  if (!mount) return;
  
  const cleanPage = page.replace(".html", "");
  
  const navItems = (config.nav || []).map(item => {
    const active = item.href === cleanPage ? " is-active" : "";
    return `<a class="navbar-item${active}" href="${item.href}">${item.label}</a>`;
  }).join("");
  
  const socialItems = (config.social || []).map(s =>
    `<a class="navbar-item" href="${s.href}" target="_blank" rel="noopener"><span class="icon"><i class="${s.icon}"></i></span><span>${s.label}</span></a>`
  ).join("");

  // 获取文章页的返回按钮数据
  let postNavAction = "";
  if (cleanPage === "post" && window.__CURRENT_POST_META__) {
    const meta = window.__CURRENT_POST_META__;
    const cat = meta.category;
    const series = meta.series;
    
    if (cat || series) {
      let url = "posts?view=series";
      if (cat) url += `&category=${encodeURIComponent(cat)}`;
      if (series) url += `&series=${encodeURIComponent(series)}`;
      else if (cat) url += `&series=all`;

      // 拼接展示的文字：比如 "课程笔记 / SQL"
      let labelText = "";
      if (cat && series) labelText = `${cat} / ${series}`;
      else if (cat) labelText = cat;
      else labelText = series;

      // 为了让按钮好看且不撑爆导航栏，我们通过 style 限制最大宽度
      postNavAction = `
        <a href="${url}" class="button is-small is-rounded nav-return-btn" title="返回目录：${labelText}">
          <span class="icon is-small"><i class="fas fa-folder-open"></i></span>
          <span class="nav-return-text" style="max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            ${labelText}
          </span>
        </a>
      `;
    }
  }

  mount.innerHTML = `
    <nav class="navbar is-fixed-top has-shadow" role="navigation">
      <div class="container">
        <div class="navbar-brand">
          <a class="navbar-item" href="index"><strong>${config.siteTitle}</strong></a>
          
          <!-- 窄屏显示 -->
          <div class="navbar-item is-hidden-desktop" style="display: flex; align-items: center; padding: 0 0.5rem;">
            ${postNavAction}
          </div>

          <a role="button" class="navbar-burger" aria-label="menu" aria-expanded="false" data-target="navMenu">
            <span aria-hidden="true"></span><span aria-hidden="true"></span><span aria-hidden="true"></span>
          </a>
        </div>
        <div id="navMenu" class="navbar-menu">
          <div class="navbar-start">
            ${navItems}
            <!-- 宽屏显示 -->
            <div class="navbar-item is-hidden-touch">
              ${postNavAction}
            </div>
          </div>
          <div class="navbar-end">
            ${socialItems}
            <div class="navbar-item">
              <button id="search-toggle" class="button is-ghost" title="搜索 (Ctrl+K)">
                <span class="icon"><i class="fas fa-search"></i></span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </nav>`;
    
  const burger = mount.querySelector(".navbar-burger");
  const menu = mount.querySelector("#navMenu");
  burger.addEventListener("click", () => {
    burger.classList.toggle("is-active");
    menu.classList.toggle("is-active");
  });
}

function renderFooter(config) {
  const mount = document.getElementById("site-footer");
  if (!mount) return;
  const year = new Date().getFullYear();
  mount.innerHTML = `
    <footer class="footer">
      <div class="content has-text-centered">
        <p><strong>${config.siteTitle}</strong> · ${config.siteSubtitle || ""}</p>
        <p>© ${year} ${config.author?.name || ""} · Powered by GitHub Pages</p>
      </div>
    </footer>`;
}

function initBackToTop() {
  const btn = document.createElement("button");
  btn.id = "back-to-top";
  btn.className = "button is-primary is-rounded has-shadow";
  btn.innerHTML = `<span class="icon"><i class="fas fa-arrow-up"></i></span>`;
  btn.title = "回到顶部";
  document.body.appendChild(btn);

  window.addEventListener("scroll", () => {
    if (window.scrollY > 300) btn.classList.add("is-visible");
    else btn.classList.remove("is-visible");
  });

  btn.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

async function initLayout(page) {
  const config = await loadConfig();
  
  // 应用主题
  window.__applyTheme();

  renderNavbar(config, page);
  renderFooter(config);
  initSearchModal();
  
  // ===== 新增：自动设置浏览器标签页标题 =====
  try {
    const siteTitle = config.siteTitle || "我的博客";
    // 将传入的 "posts.html" 或 "index.html" 转为 "postsPage" 或 "indexPage"
    const pageKey = page.replace(".html", "Page"); 
    const pageCopy = (config.pageCopy || {});
    
    // 尝试从对应的页面配置里拿 browserTitle，如果没有就拿网站总标题
    const browserTitle = pageCopy[pageKey] && pageCopy[pageKey].browserTitle 
      ? pageCopy[pageKey].browserTitle 
      : "";

    if (browserTitle) {
      document.title = `${browserTitle} · ${siteTitle}`;
    } else if (page === "index.html") {
      document.title = siteTitle;
    } else {
      document.title = `${siteTitle} · ${siteTitle}`; // 兜底
    }
  } catch (e) {
    console.warn("设置标题失败", e);
  }
  // ===========================================

  const pc404 = (config.pageCopy || {}).page404 || {};
  const ec = document.getElementById("error-code");
  const et = document.getElementById("error-title");
  const ed = document.getElementById("error-desc");
  const bl = document.getElementById("back-home-label");
  if (ec) ec.textContent = pc404.code || "404";
  if (et) et.textContent = pc404.title || "页面走丢了";
  if (ed) ed.textContent = pc404.description || "";
  if (bl) bl.textContent = pc404.backHome || "返回首页";
  initBackToTop();
  return config;
}

window.initLayout = initLayout;
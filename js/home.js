// 首页：按系列分组，全局排序，系列内紧凑行列表，状态持久化

let ALL_POSTS = [];
let SITE_CONFIG = {};
let ACTIVE_TAG = "__all__";

// 全局排序（与时间线页共用 globalSort）
let GLOBAL_SORT = "desc";
const SORT_KEY = "globalSort";
const POSTS_PER_PAGE = 8;

// 系列状态持久化到 localStorage
const SERIES_PAGES = JSON.parse(localStorage.getItem("seriesPages") || "{}");
const OPEN_SERIES = JSON.parse(localStorage.getItem("openSeries") || "{}");
function savePages() { localStorage.setItem("seriesPages", JSON.stringify(SERIES_PAGES)); }
function saveOpen() { localStorage.setItem("openSeries", JSON.stringify(OPEN_SERIES)); }

async function loadPostIndex() {
  try {
    const res = await fetch("posts/index.json");
    if (!res.ok) throw new Error("HTTP " + res.status);
    return await res.json();
  } catch (e) {
    if (window.__POSTS_FALLBACK__) return window.__POSTS_FALLBACK__;
    throw e;
  }
}

// ================= 打字机 =================
function typeWriter(element, text, speed = 100) {
  let i = 0;
  element.textContent = "";
  const chars = Array.from(text);
  return new Promise((resolve) => {
    function type() {
      if (i < chars.length) {
        element.textContent += chars[i];
        i++;
        setTimeout(type, speed);
      } else resolve();
    }
    type();
  });
}

// ================= 动态问候 =================
function getDynamicGreeting() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 9) return "🌅 早上好，新的一天开始了";
  if (hour >= 9 && hour < 12) return "☀️ 上午好，专注高效";
  if (hour >= 12 && hour < 14) return "🍵 中午好，记得午休哦";
  if (hour >= 14 && hour < 18) return "☕ 下午好，来杯咖啡吧";
  if (hour >= 18 && hour < 22) return "🌇 晚上好，今天过得怎么样？";
  return "🌙 夜深了，早点休息哦";
}

// ================= 紧凑行 =================
function renderPostRow(post) {
  const tags = (post.tags || [])
    .map(t => `<span class="tag">${t}</span>`)
    .join("");
  return `
    <a class="series-card" href="post.html?slug=${encodeURIComponent(post.slug)}">
      <div class="series-card-title">${post.title}</div>
      ${post.summary ? `<div class="series-card-summary">${post.summary}</div>` : ""}
      <div class="series-card-meta">
        <span class="series-card-date">${post.date}</span>
        <span class="series-card-tags">${tags}</span>
      </div>
    </a>`;
}

function collectTags(posts) {
  const set = new Set();
  posts.forEach(p => (p.tags || []).forEach(t => set.add(t)));
  return Array.from(set);
}

// ================= 标签过滤 =================
function renderTagFilter() {
  const el = document.getElementById("tag-filter");
  const tags = collectTags(ALL_POSTS);
  const items = [{ label: "全部", value: "__all__" }, ...tags.map(t => ({ label: t, value: t }))];

  el.innerHTML = items.map(item => {
    const active = item.value === ACTIVE_TAG ? " is-primary" : " is-light";
    return `<span class="tag is-medium is-clickable${active}" data-tag="${item.value}">${item.label}</span>`;
  }).join("");

  el.querySelectorAll("[data-tag]").forEach(node => {
    node.addEventListener("click", () => {
      const tag = node.dataset.tag;
      if (tag === ACTIVE_TAG) return;
      ACTIVE_TAG = tag;

      const url = new URL(window.location);
      if (ACTIVE_TAG === "__all__") url.searchParams.delete("tag");
      else url.searchParams.set("tag", ACTIVE_TAG);
      window.history.pushState({}, "", url);

      renderTagFilter();
      renderList();
    });
  });
}

// ================= 全局排序 UI =================
function renderSortControl() {
  const mount = document.getElementById("sort-control");
  if (!mount) return;
  mount.innerHTML = `
    <span class="is-size-7 has-text-grey mr-2">排序：</span>
    <div class="select is-small is-rounded">
      <select id="global-sort-select" style="border-color: var(--bulma-border-weak);">
        <option value="desc">时间倒序</option>
        <option value="asc">时间正序</option>
        <option value="order">自定义 ID</option>
      </select>
    </div>`;
  const select = document.getElementById("global-sort-select");
  select.value = GLOBAL_SORT;
  select.addEventListener("change", (e) => {
    GLOBAL_SORT = e.target.value;
    localStorage.setItem(SORT_KEY, GLOBAL_SORT);
    // 排序变了，所有系列回到第 1 页
    Object.keys(SERIES_PAGES).forEach(k => SERIES_PAGES[k] = 1);
    savePages();
    renderList();
  });
}

// ================= 系列内分页渲染 =================
function renderSeriesPaginated(seriesName, postsInSeries, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!SERIES_PAGES[seriesName]) SERIES_PAGES[seriesName] = 1;

  const sortedPosts = [...postsInSeries].sort((a, b) => {
    if (GLOBAL_SORT === "order") return (a.order || 0) - (b.order || 0);
    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();
    return GLOBAL_SORT === "asc" ? dateA - dateB : dateB - dateA;
  });

  const totalPages = Math.ceil(sortedPosts.length / POSTS_PER_PAGE) || 1;
  // 页码越界兜底（标签过滤后可能变少）
  if (SERIES_PAGES[seriesName] > totalPages) SERIES_PAGES[seriesName] = totalPages;
  const currentPage = SERIES_PAGES[seriesName];

  const startIndex = (currentPage - 1) * POSTS_PER_PAGE;
  const currentPosts = sortedPosts.slice(startIndex, startIndex + POSTS_PER_PAGE);

let html = `<div class="series-card-grid">${currentPosts.map(renderPostRow).join("")}</div>`;

  if (totalPages > 1) {
    html += `
      <nav class="pagination is-small is-centered mt-4" role="navigation">
        <a class="pagination-previous ${currentPage === 1 ? "is-disabled" : ""}" data-series="${seriesName}" data-dir="prev">上一页</a>
        <a class="pagination-next ${currentPage === totalPages ? "is-disabled" : ""}" data-series="${seriesName}" data-dir="next">下一页</a>
        <ul class="pagination-list">
          ${Array.from({ length: totalPages }, (_, i) => i + 1).map(p => `
            <li><a class="pagination-link ${p === currentPage ? "is-current" : ""}" data-series="${seriesName}" data-page="${p}">${p}</a></li>
          `).join("")}
        </ul>
      </nav>`;
  }

  container.innerHTML = html;

  container.querySelectorAll("a[data-series]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      if (btn.classList.contains("is-disabled")) return;

      if (btn.dataset.dir === "prev") SERIES_PAGES[seriesName]--;
      else if (btn.dataset.dir === "next") SERIES_PAGES[seriesName]++;
      else if (btn.dataset.page) SERIES_PAGES[seriesName] = parseInt(btn.dataset.page, 10);
      savePages();

      renderSeriesPaginated(seriesName, postsInSeries, containerId);
    });
  });
}

// ================= 主列表 =================
function renderList() {
  const listEl = document.getElementById("post-list");
  const statusEl = document.getElementById("post-status");

  let filteredPosts = ACTIVE_TAG === "__all__"
    ? ALL_POSTS
    : ALL_POSTS.filter(p => (p.tags || []).includes(ACTIVE_TAG));

  if (filteredPosts.length === 0) {
    statusEl.innerHTML = `<div class="notification is-warning">该标签下暂无文章。</div>`;
    listEl.innerHTML = "";
    return;
  }
  statusEl.innerHTML = "";

  const grouped = {};
  filteredPosts.forEach(post => {
    const s = post.series || "未分类文章";
    if (!grouped[s]) grouped[s] = [];
    grouped[s].push(post);
  });

  // 系列按名字排序，保证渲染顺序稳定
  const seriesNames = Object.keys(grouped).sort((a, b) => a.localeCompare(b, "zh"));

  let html = "";
  seriesNames.forEach((seriesName, idx) => {
    const postsInSeries = grouped[seriesName];
    const containerId = `series-content-${idx}`;

    // 默认展开；用户手动折叠过则记住
    const isOpen = OPEN_SERIES[seriesName] !== false;
    const displayStyle = isOpen ? "display: block;" : "display: none;";
    const iconRotate = isOpen ? "transform: rotate(180deg);" : "transform: rotate(0deg);";

    html += `
      <div class="mb-5">
        <div class="series-accordion" data-series-name="${seriesName}">
          <div class="series-header toggle-trigger" style="user-select: none;">
            <div class="series-title-wrapper">
              <span class="icon has-text-primary"><i class="fas fa-layer-group"></i></span>
              ${seriesName}
              <span class="series-count ml-2">${postsInSeries.length} 篇</span>
            </div>
            <span class="icon is-small series-icon-toggle ml-auto" style="${iconRotate}"><i class="fas fa-chevron-down"></i></span>
          </div>
          <div id="${containerId}" class="series-content" style="${displayStyle}"></div>
        </div>
      </div>`;

    setTimeout(() => renderSeriesPaginated(seriesName, postsInSeries, containerId), 0);
  });

  listEl.innerHTML = html;

  // 折叠事件
  listEl.querySelectorAll(".toggle-trigger").forEach(trigger => {
    trigger.addEventListener("click", () => {
      const accordion = trigger.closest(".series-accordion");
      const content = accordion.querySelector(".series-content");
      const icon = trigger.querySelector(".series-icon-toggle");
      const sName = accordion.dataset.seriesName;

      const isHidden = content.style.display === "none";
      content.style.display = isHidden ? "block" : "none";
      icon.style.transform = isHidden ? "rotate(180deg)" : "rotate(0deg)";
      OPEN_SERIES[sName] = isHidden;
      saveOpen();
    });
  });
}

// ================= 初始化 =================
async function initHome() {
  const config = await initLayout("index.html");

  // Hero 打字机
  const hero = (config && config.hero) || {};
  const heroTitle = document.getElementById("hero-title");
  const heroSubtitle = document.getElementById("hero-subtitle");
  if (heroTitle) {
    const textToType = hero.title || "";
    heroTitle.innerHTML = '<span id="typewriter-text"></span><span class="cursor" style="display:inline-block;width:3px;height:1em;background:var(--bulma-primary);vertical-align:text-bottom;margin-left:2px;animation:blink 0.8s infinite;"></span>';
    typeWriter(document.getElementById("typewriter-text"), textToType, 100);
  }
  if (heroSubtitle) heroSubtitle.textContent = hero.subtitle || "";

  SITE_CONFIG = config || {};

  // 全局排序初始化
  GLOBAL_SORT = localStorage.getItem(SORT_KEY) || (SITE_CONFIG.defaultSort || "desc");
  renderSortControl();

  const statusEl = document.getElementById("post-status");
  const profileEl = document.getElementById("sidebar-profile");
  const sidebarProjects = document.getElementById("sidebar-projects");

  // 侧边栏项目
  if (sidebarProjects) {
    let projects = [];
    try {
      const res = await fetch("projects.json");
      if (res.ok) projects = await res.json();
    } catch (e) {
      projects = window.__PROJECTS_FALLBACK__ || [];
    }
    sidebarProjects.innerHTML = projects.slice(0, 2).map(p => `
      <li class="mb-2">
        <a href="${p.url}" target="_blank" class="is-size-6">${p.name}</a>
        <p class="is-size-7 has-text-grey">${p.description || ""}</p>
      </li>
    `).join("");
  }

  // 个人名片
  if (profileEl && config && config.author) {
    const a = config.author;
    const greeting = getDynamicGreeting();
    profileEl.innerHTML = `
      <div class="box has-text-centered" style="border-radius: var(--bulma-radius-large);">
        <figure class="image is-96x96 is-inline-block mb-3"><img class="is-rounded" src="${a.avatar || "images/avatar.png"}" style="object-fit: cover;"></figure>
        <h3 class="title is-5 mb-1">${a.name || "佚名"}</h3>
        <p class="is-size-7 has-text-grey mb-2">${a.bio || "开发者"}</p>
        <div class="has-text-primary is-size-7 mb-3 font-weight-bold" style="background: var(--bulma-primary-soft); padding: 0.2rem 0.5rem; border-radius: 4px; display: inline-block;">
          ${greeting}
        </div>
        <br>
        <a href="about.html" class="button is-small is-rounded is-light">了解更多</a>
      </div>`;
  }

  try {
    ALL_POSTS = await loadPostIndex();
    if (ALL_POSTS.length === 0) {
      statusEl.innerHTML = `<div class="notification is-warning">还没有文章。</div>`;
      return;
    }

    const urlTag = new URLSearchParams(window.location.search).get("tag");
    if (urlTag && collectTags(ALL_POSTS).includes(urlTag)) ACTIVE_TAG = urlTag;
    else ACTIVE_TAG = "__all__";

    renderTagFilter();
    renderList();
  } catch (e) {
    statusEl.innerHTML = `<div class="notification is-danger">读取文章清单失败：${e.message}</div>`;
  }
}

initHome();
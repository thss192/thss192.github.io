// 首页：新布局逻辑（拆分右侧渲染节点）
let ALL_POSTS = [];

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

function getDynamicGreeting() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 9) return "🌅 早上好，新的一天开始了";
  if (hour >= 9 && hour < 12) return "☀️ 上午好，专注高效";
  if (hour >= 12 && hour < 14) return "🍵 中午好，记得午休哦";
  if (hour >= 14 && hour < 18) return "☕ 下午好，来杯咖啡吧";
  if (hour >= 18 && hour < 22) return "🌇 晚上好，今天过得怎么样？";
  return "🌙 夜深了，早点休息哦";
}

function renderCard(post) {
  const tags = (post.tags || []).map(t => `<span class="tag is-info is-light">${t}</span>`).join("");

  let seriesHtml = "";
  if (post.category && post.series) {
    seriesHtml = `<span class="timeline-card-series">
      <i class="fas fa-folder-open"></i> ${post.category} / ${post.series}
    </span>`;
  } else if (post.category) {
    seriesHtml = `<span class="timeline-card-series">
      <i class="fas fa-folder"></i> ${post.category}
    </span>`;
  } else if (post.series) {
    seriesHtml = `<span class="timeline-card-series">
      <i class="fas fa-folder"></i> ${post.series}
    </span>`;
  }

  return `
    <a class="timeline-card" href="post?slug=${encodeURIComponent(post.slug)}">
      ${seriesHtml}
      <div class="timeline-card-title">${post.title}</div>
      ${post.summary ? `<div class="timeline-card-summary">${post.summary}</div>` : ""}
      <div class="timeline-card-meta">
        <span class="timeline-card-date">${post.date}</span>
        <span class="timeline-card-tags">${tags}</span>
      </div>
    </a>`;
}

function renderLatestPosts(posts) {
  const listEl = document.getElementById("latest-posts");
  if (!listEl) return;
  const latest = posts.slice().sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
  listEl.innerHTML = latest.map(p => renderCard(p)).join("");
}

// ================= 交互式标签云引擎 =================
function initInteractiveTagCloud(posts) {
  const container = document.getElementById("tag-cloud-container");
  if (!container) return;
  container.innerHTML = "";

  const tagMap = new Map();
  posts.forEach(p => {
    (p.tags || []).forEach(t => tagMap.set(t, (tagMap.get(t) || 0) + 1));
  });

  if (tagMap.size === 0) {
    container.innerHTML = `<span class="is-size-7 has-text-grey">暂无标签</span>`;
    return;
  }

  const sortedTags = Array.from(tagMap.entries()).sort((a, b) => b[1] - a[1]);

  sortedTags.forEach(([tag, count]) => {
    const tagEl = document.createElement("button");
    tagEl.className = "tag-cloud-chip";
    tagEl.innerHTML = `
      <span class="tag-name"># ${tag}</span>
      <span class="tag-count">${count}</span>
    `;
    tagEl.addEventListener("click", () => {
      if (window.openTagDrawer) window.openTagDrawer(encodeURIComponent(tag));
    });
    container.appendChild(tagEl);
  });
}

// ================= 右侧：个人信息 + 开源项目 + 探索博客/看板 =================
async function renderSidebar(config) {
  const profileTopEl = document.getElementById("sidebar-profile-top");
  const projectsEl = document.getElementById("sidebar-projects");
  const statsEl = document.getElementById("sidebar-stats");
  
  if (!profileTopEl || !projectsEl) return;

  const a = (config && config.author) || {};
  const greeting = getDynamicGreeting();

  let projects = [];
  try {
    const res = await fetch("data/projects.json");
    if (!res.ok) throw new Error("HTTP " + res.status);
    projects = await res.json();
  } catch (e) {
    console.warn("读取 projects.json 失败，使用兜底数据", e);
    projects = window.__PROJECTS_FALLBACK__ || [];
  }

  // 卡片1：个人信息
  profileTopEl.innerHTML = `
    <div class="profile-top">
      <a href="about" class="flex-shrink-0" title="点击了解我">
        <figure class="image is-128x128 mx-auto">
          <img class="is-rounded" src="${a.avatar || "images/avatar.png"}" style="object-fit: cover;" alt="头像">
        </figure>
      </a>
      <div>
        <h3 class="title is-4 mb-1">${a.name || "佚名"}</h3>
        <p class="is-size-6 has-text-grey mb-3">${a.bio || "开发者"}</p>
        <div class="profile-greeting">
          ${greeting}
        </div>
      </div>
    </div>`;

  // 卡片2：开源项目
  const projectListHtml = projects.length
    ? projects.slice(0, 2).map(p => `
        <li>
          <a href="${p.url}" target="_blank" rel="noopener" class="is-size-6 has-text-weight-bold">${p.name}</a>
          <p class="is-size-7 has-text-grey mt-1">${p.description || ""}</p>
        </li>
      `).join("")
    : `<li class="is-size-7 has-text-grey">暂无项目</li>`;

  projectsEl.innerHTML = `
    <div class="profile-projects">
      <h4 class="sidebar-card-title">
        <i class="fas fa-code-branch has-text-primary mr-2"></i>开源项目
      </h4>
      <ul class="menu-list mb-0">${projectListHtml}</ul>
      <div class="has-text-left mt-2">
        <a href="projects" class="is-size-7 has-text-link">查看全部 →</a>
      </div>
    </div>`;

  // ================= 新增：数据看板（渲染在“探索博客”卡片内部下方） =================
  if (statsEl && window.__POSTS_FALLBACK__) {
    const posts = window.__POSTS_FALLBACK__;
    const totalPosts = posts.length;
    const totalTags = new Set(posts.flatMap(p => p.tags || [])).size;
    const totalSeries = new Set(posts.map(p => p.series).filter(Boolean)).size;
    
    // 计算运行天数 (使用 config 中的 startDate)
    let runningDays = 0;
    if (a.startDate) {
      const start = new Date(a.startDate);
      const today = new Date();
      runningDays = Math.max(1, Math.ceil((today - start) / (1000 * 60 * 60 * 24)));
    }

    statsEl.innerHTML = `
      <div class="stats-grid mt-4 pt-3" style="border-top: 1px dashed var(--bulma-border-weak);">
        <div class="stat-item" title="文章总数">
          <span class="stat-value">${totalPosts}</span>
          <span class="stat-label">文章总数</span>
        </div>
        <div class="stat-item" title="系列总数">
          <span class="stat-value">${totalSeries}</span>
          <span class="stat-label">系列总数</span>
        </div>
        <div class="stat-item" title="标签总数">
          <span class="stat-value">${totalTags}</span>
          <span class="stat-label">标签总数</span>
        </div>
        <div class="stat-item" title="博客运行天数">
          <span class="stat-value">${runningDays}</span>
          <span class="stat-label">运行天数</span>
        </div>
      </div>
    `;
  }
}

async function initHome() {
  const config = await initLayout("index.html");

  // Hero 打字机
  const hero = (config && config.hero) || {};
  const heroTitle = document.getElementById("hero-title");
  const heroSubtitle = document.getElementById("hero-subtitle");
  if (heroTitle) {
    heroTitle.innerHTML = '<span id="typewriter-text"></span><span class="cursor" style="display:inline-block;width:3px;height:1em;background:var(--bulma-primary);vertical-align:text-bottom;margin-left:2px;animation:blink 0.8s infinite;"></span>';
    typeWriter(document.getElementById("typewriter-text"), hero.title || "", 100);
  }
  if (heroSubtitle) heroSubtitle.textContent = hero.subtitle || "";

  // 右侧卡片
  renderSidebar(config);

  // 左侧文章与标签云
  const statusEl = document.getElementById("post-status");
  try {
    ALL_POSTS = await loadPostIndex();
    if (ALL_POSTS.length === 0) {
      if (statusEl) statusEl.innerHTML = `<div class="notification is-warning">还没有文章。</div>`;
      return;
    }
    renderLatestPosts(ALL_POSTS);
    initInteractiveTagCloud(ALL_POSTS);
  } catch (e) {
    if (statusEl) statusEl.innerHTML = `<div class="notification is-danger">读取文章清单失败：${e.message}</div>`;
  }
}

// ================= 标签文章列表浮窗 =================
window.openTagDrawer = async function(encodedTag) {
  const tag = decodeURIComponent(encodedTag);

  if (document.getElementById("tag-drawer")) {
    window.closeTagDrawer();
    await new Promise(r => setTimeout(r, 300));
  }

  if (!ALL_POSTS || ALL_POSTS.length === 0) {
    console.warn("文章清单尚未加载，无法按标签筛选");
    return;
  }

  const allFiltered = ALL_POSTS
    .filter(p => (p.tags || []).includes(tag))
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const listHtml = allFiltered.length === 0
    ? `<div class="has-text-grey p-4 is-size-7">没有找到相关文章。</div>`
    : allFiltered.map(p => `
        <a href="post?slug=${encodeURIComponent(p.slug)}" class="drawer-item">
          <div class="drawer-item-title">${p.title}</div>
          <div class="drawer-item-date">${p.date}</div>
        </a>
      `).join("");

  const drawerHtml = `
    <div id="tag-drawer" class="tag-drawer-panel">
      <div class="drawer-header">
        <span class="is-size-6 has-text-weight-bold"><i class="fas fa-tags mr-2"></i>标签：${tag}</span>
        <button class="delete" onclick="window.closeTagDrawer()"></button>
      </div>
      <div class="drawer-body">${listHtml}</div>
    </div>
    <div id="tag-drawer-backdrop" onclick="window.closeTagDrawer()"></div>
  `;
  document.body.insertAdjacentHTML("beforeend", drawerHtml);

  setTimeout(() => {
    const panel = document.getElementById("tag-drawer");
    const backdrop = document.getElementById("tag-drawer-backdrop");
    if (panel) panel.classList.add("is-open");
    if (backdrop) backdrop.classList.add("is-open");
  }, 20);
};

window.closeTagDrawer = function() {
  const panel = document.getElementById("tag-drawer");
  const backdrop = document.getElementById("tag-drawer-backdrop");
  if (panel) panel.classList.remove("is-open");
  if (backdrop) backdrop.classList.remove("is-open");
  setTimeout(() => {
    if (panel) panel.remove();
    if (backdrop) backdrop.remove();
  }, 300);
};

initHome();
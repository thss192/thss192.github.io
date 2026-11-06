// 首页：门户式布局，突出个人名片与最新文章
let ALL_POSTS = [];
let SITE_CONFIG = {};

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

// 生成统一的网格卡片
function renderCard(post) {
  const tags = (post.tags || []).map(t => `<span class="tag is-info is-light">${t}</span>`).join("");
  return `
    <a class="timeline-card" href="post?slug=${encodeURIComponent(post.slug)}">
      <div class="timeline-card-title">${post.title}</div>
      ${post.summary ? `<div class="timeline-card-summary">${post.summary}</div>` : ""}
      <div class="timeline-card-meta">
        <span class="timeline-card-date">${post.date}</span>
        <span class="timeline-card-tags">${tags}</span>
      </div>
    </a>`;
}

// 渲染最新的文章列表
function renderLatestPosts(posts) {
  const listEl = document.getElementById("latest-posts");
  if (!listEl) return;

  // 按时间倒序取最新 4 篇
  const latest = [...posts].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 4);

  if (latest.length === 0) {
    listEl.innerHTML = `<div class="notification is-warning">还没有文章。</div>`;
    return;
  }

  listEl.innerHTML = latest.map(p => renderCard(p)).join("");
}

async function initHome() {
  const config = await initLayout("index.html");

  // 1. 渲染 Hero 打字机
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
  const statusEl = document.getElementById("post-status");
  const profileEl = document.getElementById("sidebar-profile");
  const sidebarProjects = document.getElementById("sidebar-projects");

  // 2. 渲染侧边栏项目
  if (sidebarProjects) {
    let projects = [];
    try {
      const res = await fetch("data/projects.json");
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

  // 3. 渲染左侧个人名片（更宽大、更像横幅）
  if (profileEl && config && config.author) {
    const a = config.author;
    const greeting = getDynamicGreeting();
      profileEl.innerHTML = `
      <div class="profile-banner">
        <figure class="image is-96x96 flex-shrink-0">
          <img class="is-rounded" src="${a.avatar || "images/avatar.png"}" style="object-fit: cover;">
        </figure>
        <div>
          <h3 class="title is-4 mb-1">${a.name || "佚名"}</h3>
          <p class="is-size-6 has-text-grey mb-2">${a.bio || "开发者"}</p>
          <div class="has-text-primary is-size-7 font-weight-bold" style="background: var(--bulma-primary-soft); padding: 0.2rem 0.5rem; border-radius: 4px; display: inline-block;">
            ${greeting}
          </div>
          <a href="about" class="button is-small is-rounded is-light ml-3">了解更多</a>
        </div>
      </div>`;
  }

  // 4. 获取文章并渲染最近动态
  try {
    ALL_POSTS = await loadPostIndex();
    if (ALL_POSTS.length === 0) {
      statusEl.innerHTML = `<div class="notification is-warning">还没有文章。</div>`;
      return;
    }
    
    renderLatestPosts(ALL_POSTS);
  } catch (e) {
    statusEl.innerHTML = `<div class="notification is-danger">读取文章清单失败：${e.message}</div>`;
  }
}

initHome();
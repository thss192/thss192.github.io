// 首页：按分类聚合，网格卡片展示最新文章
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

// 构建首页数据
function buildHomeData(posts) {
  const tree = new Map();

  posts.forEach(p => {
    const cat = p.category || p.series || "未分类";
    const sub = p.category ? (p.series || "默认子系列") : null;

    if (!tree.has(cat)) {
      tree.set(cat, { name: cat, subMap: new Map(), directPosts: [] });
    }

    if (sub) {
      if (!tree.get(cat).subMap.has(sub)) {
        tree.get(cat).subMap.set(sub, []);
      }
      tree.get(cat).subMap.get(sub).push(p);
    } else {
      tree.get(cat).directPosts.push(p);
    }
  });

  const result = [];
  const sortedCats = Array.from(tree.keys()).sort((a, b) => a.localeCompare(b, "zh"));

  sortedCats.forEach(cat => {
    const catData = tree.get(cat);
    const allCatPosts = [];

    const sortedSubs = Array.from(catData.subMap.keys()).sort((a, b) => a.localeCompare(b, "zh"));
    sortedSubs.forEach(sub => {
      const seriesPosts = catData.subMap.get(sub).sort((a, b) => new Date(b.date) - new Date(a.date));
      allCatPosts.push(...seriesPosts);
    });

    if (catData.directPosts.length > 0) {
      const direct = catData.directPosts.sort((a, b) => new Date(b.date) - new Date(a.date));
      allCatPosts.push(...direct);
    }

    allCatPosts.sort((a, b) => new Date(b.date) - new Date(a.date));

    result.push({
      key: cat,
      name: cat,
      latestPosts: allCatPosts.slice(0, 3),
      totalCount: allCatPosts.length
    });
  });

  result.sort((a, b) => {
    const da = a.latestPosts[0] ? new Date(a.latestPosts[0].date) : 0;
    const db = b.latestPosts[0] ? new Date(b.latestPosts[0].date) : 0;
    return db - da;
  });

  return result;
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

function renderHomeList(homeData) {
  const listEl = document.getElementById("post-list");
  
  if (homeData.length === 0) {
    listEl.innerHTML = `<div class="notification is-warning">还没有文章。</div>`;
    return;
  }

  listEl.innerHTML = homeData.map(cat => `
    <div class="category-wrapper" style="margin-bottom: 2rem;">
      <div class="category-header">
        <h3 class="category-title">
          <span class="icon has-text-primary mr-2"><i class="fas fa-folder-open"></i></span>
          ${cat.name}
          <span class="posts-group-count">${cat.totalCount} 篇</span>
        </h3>
        <a href="posts?view=series&category=${encodeURIComponent(cat.name)}" class="button is-small is-rounded is-light mt-2">
          查看全部 <i class="fas fa-arrow-right ml-1" style="font-size:0.8em;"></i>
        </a>
      </div>
      
      <div class="category-body posts-cards" style="padding-top: 0.5rem;">
        ${cat.latestPosts.map(p => renderCard(p)).join("")}
      </div>
    </div>
  `).join("");
}

async function initHome() {
  const config = await initLayout("index.html");

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
        <a href="about" class="button is-small is-rounded is-light">了解更多</a>
      </div>`;
  }

  try {
    ALL_POSTS = await loadPostIndex();
    if (ALL_POSTS.length === 0) {
      statusEl.innerHTML = `<div class="notification is-warning">还没有文章。</div>`;
      return;
    }
    
    const homeData = buildHomeData(ALL_POSTS);
    renderHomeList(homeData);
  } catch (e) {
    statusEl.innerHTML = `<div class="notification is-danger">读取文章清单失败：${e.message}</div>`;
  }
}

initHome();
// 统一文章页：支持按系列分类和按时间归档切换
let ALL_POSTS = [];
let CURRENT_VIEW = "series"; // "series" 或 "time"
let activeKey = null;

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

/* ---------------- 数据处理 ---------------- */
function getSeriesData() {
  const map = new Map();
  ALL_POSTS.forEach(p => {
    const s = p.series || "未分类文章";
    if (!map.has(s)) map.set(s, []);
    map.get(s).push(p);
  });
  
  const keys = Array.from(map.keys()).sort((a, b) => a.localeCompare(b, "zh"));
  return keys.map(key => ({
    key: key,
    label: key,
    year: "",
    posts: map.get(key).sort((a, b) => new Date(b.date) - new Date(a.date))
  }));
}

function getTimeData() {
  const map = new Map();
  ALL_POSTS.forEach(p => {
    const match = /^(\d{4})-(\d{2})/.exec(p.date || "");
    const key = match ? `${match[1]}-${match[2]}` : "unknown";
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(p);
  });

  const keys = Array.from(map.keys()).sort((a, b) => {
    if (a === "unknown") return 1;
    if (b === "unknown") return -1;
    return b.localeCompare(a); // 新的月份在前
  });

  return keys.map(key => {
    const posts = map.get(key).sort((a, b) => new Date(b.date) - new Date(a.date));
    let label = "未标注日期", year = "";
    if (key !== "unknown") {
      const [y, m] = key.split("-");
      label = `${parseInt(m, 10)} 月`;
      year = y;
    }
    return { key, label, year, posts };
  });
}

/* ---------------- 渲染左侧 ---------------- */
function renderSidebar(data) {
  const inner = document.getElementById("posts-sidebar-inner");
  inner.innerHTML = data.map(g => `
    <button class="post-nav-item" data-key="${g.key}">
      <span style="display: flex; align-items: baseline; gap: 0.5rem;">
        ${g.year ? `<span style="font-size: 0.8em; opacity: 0.6;">${g.year}</span>` : ""}
        <span>${g.label}</span>
      </span>
      <span class="count">${g.posts.length}</span>
    </button>
  `).join("");

  inner.querySelectorAll(".post-nav-item").forEach(btn => {
    btn.addEventListener("click", () => {
      scrollToGroup(btn.dataset.key, true);
    });
  });
}

/* ---------------- 渲染右侧 ---------------- */
function renderMain(data) {
  const main = document.getElementById("posts-main");
  main.innerHTML = data.map(g => `
    <section class="posts-group" id="group-${encodeURIComponent(g.key)}" data-key="${g.key}">
      <h2 class="posts-group-title">
        ${g.year ? `<span class="year">${g.year} 年</span>` : ""}
        <span>${g.label}</span>
        <span class="posts-group-count">${g.posts.length} 篇</span>
      </h2>
      <div class="posts-cards">
        ${g.posts.map(renderCard).join("")}
      </div>
    </section>
  `).join("");
}

function renderCard(post) {
  const tags = (post.tags || []).map(t => `<span class="tag is-info is-light">${t}</span>`).join("");
  return `
    <a class="timeline-card" href="post.html?slug=${encodeURIComponent(post.slug)}">
      <div class="timeline-card-title">${post.title}</div>
      ${post.summary ? `<div class="timeline-card-summary">${post.summary}</div>` : ""}
      <div class="timeline-card-meta">
        <span class="timeline-card-date">${post.date}</span>
        <span class="timeline-card-tags">${tags}</span>
      </div>
    </a>`;
}

/* ---------------- 交互逻辑 ---------------- */
function setActive(key) {
  if (activeKey === key) return;
  activeKey = key;
  
  document.querySelectorAll(".post-nav-item").forEach(b => {
    b.classList.toggle("is-active", b.dataset.key === key);
  });
}

function scrollToGroup(key, userClick) {
  const section = document.getElementById(`group-${encodeURIComponent(key)}`);
  if (!section) return;
  if (userClick) setActive(key);
  const yOffset = -80;
  const y = section.getBoundingClientRect().top + window.pageYOffset + yOffset;
  window.scrollTo({ top: y, behavior: "smooth" });
}

function initScrollSpy() {
  const sections = Array.from(document.querySelectorAll(".posts-group"));
  if (!sections.length) return;
  window.addEventListener("scroll", () => {
    const probe = window.scrollY + 120;
    let current = sections[0].dataset.key;
    for (const s of sections) {
      if (s.offsetTop <= probe) current = s.dataset.key;
      else break;
    }
    setActive(current);
  }, { passive: true });
}

/* ---------------- 切换视图 ---------------- */
function updateView(view) {
  CURRENT_VIEW = view;
  
  // 更新按钮状态
  const btnSeries = document.getElementById("view-by-series");
  const btnTime = document.getElementById("view-by-time");
  if (view === "series") {
    btnSeries.classList.replace("is-light", "is-primary");
    btnTime.classList.replace("is-primary", "is-light");
  } else {
    btnTime.classList.replace("is-light", "is-primary");
    btnSeries.classList.replace("is-primary", "is-light");
  }

  // 获取数据并渲染
  const data = view === "series" ? getSeriesData() : getTimeData();
  renderSidebar(data);
  renderMain(data);

  if (data.length > 0) setActive(data[0].key);
  window.scrollTo({ top: 0, behavior: "smooth" }); // 切换时回到顶部
}

/* ---------------- 初始化 ---------------- */
async function initPosts() {
  const config = await initLayout("posts.html");
  const statusEl = document.getElementById("posts-status");

  const pp = ((config && config.pageCopy) || {}).postsPage || {};
  const titleEl = document.getElementById("posts-title-text");
  const subtitleEl = document.getElementById("page-subtitle");
  if (titleEl) titleEl.textContent = pp.title || "全部文章";
  if (subtitleEl) subtitleEl.textContent = pp.subtitle || "记录代码、思考与生活的碎片。";

  try {
    ALL_POSTS = await loadPostIndex();
  } catch (e) {
    statusEl.innerHTML = `<div class="notification is-danger">读取文章清单失败：${e.message}</div>`;
    return;
  }

  if (!ALL_POSTS.length) {
    statusEl.innerHTML = `<div class="notification is-warning">还没有文章。</div>`;
    return;
  }

  // 绑定切换按钮
  document.getElementById("view-by-series").addEventListener("click", () => updateView("series"));
  document.getElementById("view-by-time").addEventListener("click", () => updateView("time"));

  // 默认按系列渲染
  updateView("series");
  initScrollSpy();
}

initPosts();
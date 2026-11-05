// 归档页：左侧年月纵向导航（可滚动/拖动）+ 右侧文章卡片
// 新年在上，无排序切换、无标签筛选

let ALL_POSTS = [];
let MONTH_GROUPS = [];     // [{ key:'2026-11', year:'2026', month:'11', label:'11 月', posts:[...] }]
let activeKey = null;
let spyLock = false;       // 点击跳转期间暂停 scroll-spy

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

function monthKey(dateStr) {
  const m = /^(\d{4})-(\d{2})/.exec(dateStr || "");
  return m ? `${m[1]}-${m[2]}` : "unknown";
}

function buildMonthGroups(posts) {
  // 时间倒序（新→旧）
  const sorted = [...posts].sort((a, b) => {
    const da = new Date(a.date).getTime() || 0;
    const db = new Date(b.date).getTime() || 0;
    return db - da;
  });

  const map = new Map();
  sorted.forEach(p => {
    const key = monthKey(p.date);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(p);
  });

  // 组顺序：新→旧
  const keys = Array.from(map.keys()).sort((a, b) => {
    if (a === "unknown") return 1;
    if (b === "unknown") return -1;
    return b.localeCompare(a);
  });

  return keys.map(key => {
    const posts = map.get(key);
    if (key === "unknown") {
      return { key, year: "未知", month: "", label: "未标注日期", posts };
    }
    const [y, m] = key.split("-");
    return { key, year: y, month: m, label: `${parseInt(m, 10)} 月`, posts };
  });
}

/* ---------------- 左侧渲染 ---------------- */
function renderSidebar() {
  const inner = document.getElementById("timeline-sidebar-inner");
  let html = "";
  let lastYear = null;

  MONTH_GROUPS.forEach(g => {
    if (g.year !== lastYear) {
      html += `<div class="timeline-year">${g.year} 年</div>`;
      lastYear = g.year;
    }
    html += `
      <button class="timeline-month" data-key="${g.key}">
        <span>${g.label}</span>
        <span class="timeline-month-count">${g.posts.length}</span>
      </button>`;
  });

  inner.innerHTML = html;

  inner.querySelectorAll(".timeline-month").forEach(btn => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.key;
      scrollToMonth(key, true);
    });
  });
}

/* ---------------- 右侧渲染 ---------------- */
function renderMain() {
  const main = document.getElementById("timeline-main");
  main.innerHTML = MONTH_GROUPS.map(g => `
    <section class="timeline-section" id="month-${g.key}" data-key="${g.key}">
      <h2 class="timeline-section-title">
        <span class="timeline-section-year">${g.year} 年</span>
        <span>${g.label}</span>
        <span class="timeline-section-count">${g.posts.length} 篇</span>
      </h2>
      <div class="timeline-cards">
        ${g.posts.map(renderCard).join("")}
      </div>
    </section>
  `).join("");
}

function renderCard(post) {
  const tags = (post.tags || [])
    .map(t => `<span class="tag is-info is-light">${t}</span>`)
    .join("");
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

/* ---------------- 高亮与滚动联动 ---------------- */
function setActive(key) {
  if (activeKey === key) return;
  activeKey = key;

  document.querySelectorAll(".timeline-month").forEach(b => {
    b.classList.toggle("is-active", b.dataset.key === key);
  });

  // 保证左栏激活项可见
  const activeBtn = document.querySelector(`.timeline-month[data-key="${key}"]`);
  if (activeBtn) {
    const sidebar = document.getElementById("timeline-sidebar");
    const btnTop = activeBtn.offsetTop - sidebar.offsetTop;
    const btnBottom = btnTop + activeBtn.offsetHeight;
    if (btnTop < sidebar.scrollTop) {
      sidebar.scrollTo({ top: btnTop - 16, behavior: "smooth" });
    } else if (btnBottom > sidebar.scrollTop + sidebar.clientHeight) {
      sidebar.scrollTo({ top: btnBottom - sidebar.clientHeight + 16, behavior: "smooth" });
    }
  }
}

function scrollToMonth(key, userClick) {
  const section = document.getElementById(`month-${key}`);
  if (!section) return;

  if (userClick) {
    spyLock = true;
    setActive(key);
  }

  const yOffset = -80;
  const y = section.getBoundingClientRect().top + window.pageYOffset + yOffset;
  window.scrollTo({ top: y, behavior: "smooth" });

  if (userClick) {
    // 平滑滚动结束后释放锁
    setTimeout(() => { spyLock = false; }, 600);
  }
}

// scroll-spy：根据右栏哪个区块最接近视口顶部来高亮左侧
function initScrollSpy() {
  const sections = Array.from(document.querySelectorAll(".timeline-section"));
  if (!sections.length) return;

  const onScroll = () => {
    if (spyLock) return;
    const probe = window.scrollY + 120;   // 视口上方偏移
    let current = sections[0].dataset.key;
    for (const s of sections) {
      if (s.offsetTop <= probe) current = s.dataset.key;
      else break;
    }
    // 到底部时强制选最后一个
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
      current = sections[sections.length - 1].dataset.key;
    }
    setActive(current);
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
}

/* ---------------- 左栏拖动滚动 ---------------- */
function initDragScroll() {
  const el = document.getElementById("timeline-sidebar");
  if (!el) return;

  let isDown = false;
  let startY = 0;
  let startScroll = 0;
  let moved = false;

  el.addEventListener("mousedown", (e) => {
    // 点击按钮时不启动拖动
    if (e.target.closest(".timeline-month")) return;
    isDown = true;
    moved = false;
    startY = e.clientY;
    startScroll = el.scrollTop;
    el.classList.add("is-dragging");
  });

  document.addEventListener("mousemove", (e) => {
    if (!isDown) return;
    const dy = e.clientY - startY;
    if (Math.abs(dy) > 3) moved = true;
    el.scrollTop = startScroll - dy;
  });

  document.addEventListener("mouseup", () => {
    if (!isDown) return;
    isDown = false;
    el.classList.remove("is-dragging");
  });

  // 拖动结束后抑制误触的 click
  el.addEventListener("click", (e) => {
    if (moved) {
      e.stopPropagation();
      e.preventDefault();
      moved = false;
    }
  }, true);
}

/* ---------------- 初始化 ---------------- */
async function initTimeline() {
  const config = await initLayout("timeline.html");
  const statusEl = document.getElementById("timeline-status");

  const tp = ((config && config.pageCopy) || {}).timelinePage || {};
  const titleEl = document.getElementById("timeline-title-text");
  const subtitleEl = document.getElementById("page-subtitle");
  if (titleEl) titleEl.textContent = tp.title || "归档";
  if (subtitleEl) subtitleEl.textContent = tp.subtitle || "按时间翻阅所有文章。";

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

  MONTH_GROUPS = buildMonthGroups(ALL_POSTS);
  renderSidebar();
  renderMain();

  // 初始高亮最新月份（不触发滚动，页面本来就在顶部）
  if (MONTH_GROUPS.length) {
    setActive(MONTH_GROUPS[0].key);
  }

  initScrollSpy();
  initDragScroll();
}

initTimeline();
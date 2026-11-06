// 统一文章页：强制左右侧边栏，优雅折叠，支持全部，分类标签聚合
let ALL_POSTS = [];
let CURRENT_VIEW = "series"; 
let ACTIVE_CAT_KEY = null;
let ACTIVE_SERIES_KEY = "all"; 

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

/* ================= 数据处理 ================= */
function getSeriesData() {
  const tree = new Map();
  ALL_POSTS.forEach(p => {
    const cat = p.category || p.series || "未分类";
    const sub = p.category ? (p.series || "默认子系列") : null;

    if (!tree.has(cat)) tree.set(cat, { name: cat, subMap: new Map(), directPosts: [] });
    if (sub) {
      if (!tree.get(cat).subMap.has(sub)) tree.get(cat).subMap.set(sub, []);
      tree.get(cat).subMap.get(sub).push(p);
    } else {
      tree.get(cat).directPosts.push(p);
    }
  });

  const result = [];
  const sortedCats = Array.from(tree.keys()).sort((a, b) => a.localeCompare(b, "zh"));

  sortedCats.forEach(cat => {
    const catData = tree.get(cat);
    const children = [];
    let totalCount = catData.directPosts.length;
    const catTags = new Set();
    
    const sortedSubs = Array.from(catData.subMap.keys()).sort((a, b) => a.localeCompare(b, "zh"));
    sortedSubs.forEach(sub => {
      const posts = catData.subMap.get(sub).sort((a, b) => new Date(b.date) - new Date(a.date));
      
      const subTags = new Set();
      posts.forEach(p => (p.tags || []).forEach(t => {
        subTags.add(t);
        catTags.add(t);
      }));

      children.push({ name: sub, posts: posts, tags: Array.from(subTags).sort() });
      totalCount += posts.length;
    });

    if (catData.directPosts.length > 0) {
      const posts = catData.directPosts.sort((a, b) => new Date(b.date) - new Date(a.date));
      
      const subTags = new Set();
      posts.forEach(p => (p.tags || []).forEach(t => {
        subTags.add(t);
        catTags.add(t);
      }));

      children.push({ name: "综合文章", posts: posts, tags: Array.from(subTags).sort() });
      totalCount += posts.length;
    }

    result.push({ 
      key: cat, 
      name: cat, 
      children: children, 
      totalCount: totalCount,
      tags: Array.from(catTags).sort()
    });
  });

  return result;
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
    return b.localeCompare(a);
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

/* ================= 渲染侧边栏 ================= */
function renderSidebar(data) {
  const inner = document.getElementById("posts-sidebar-inner");
  
  if (CURRENT_VIEW === "time") {
    let html = `
      <div class="sidebar-cat-group">
        <button class="post-nav-item ${ACTIVE_CAT_KEY === 'all' ? 'is-active' : ''}" data-key="all">
          <span class="icon is-small mr-1"><i class="fas fa-clock"></i></span>
          <span>全部时间</span>
          <span class="count">${ALL_POSTS.length}</span>
        </button>
      </div>
    `;
    
    let currentYear = null;
    data.forEach(g => {
      if (g.year && g.year !== currentYear) {
        currentYear = g.year;
        html += `<div class="post-nav-year">${currentYear} 年</div>`;
      }
      html += `
        <button class="post-nav-item ${ACTIVE_CAT_KEY === g.key ? 'is-active' : ''}" data-key="${g.key}">
          <span style="padding-left: 1.25rem;">${g.label}</span>
          <span class="count">${g.posts.length}</span>
        </button>
      `;
    });
    inner.innerHTML = html;
  } else {
    let html = `
      <div class="sidebar-cat-group">
        <button class="sidebar-cat-btn ${ACTIVE_CAT_KEY === 'all' ? 'is-active' : ''}" data-cat="all">
          <span class="icon is-small"><i class="fas fa-layer-group"></i></span>
          <span>全部</span>
          <span class="count">${ALL_POSTS.length}</span>
        </button>
      </div>
    `;
    
    html += data.map(cat => {
      const isCatActive = ACTIVE_CAT_KEY === cat.key;
      let subHtml = `
        <div class="sidebar-series-list">
          <button class="sidebar-series-btn ${isCatActive && ACTIVE_SERIES_KEY === 'all' ? 'is-active' : ''}" data-cat="${cat.key}" data-series="all">全部</button>
          ${cat.children.map(sub => `
            <button class="sidebar-series-btn ${isCatActive && ACTIVE_SERIES_KEY === sub.name ? 'is-active' : ''}" data-cat="${cat.key}" data-series="${sub.name}">
              ${sub.name}
            </button>
          `).join("")}
        </div>
      `;

      return `
      <div class="sidebar-cat-group">
        <button class="sidebar-cat-btn ${isCatActive ? 'is-active' : ''}" data-cat="${cat.key}">
          <span class="icon is-small"><i class="fas fa-folder"></i></span>
          <span>${cat.name}</span>
          <span class="count">${cat.totalCount}</span>
        </button>
        ${subHtml}
      </div>
    `}).join("");
    inner.innerHTML = html;
  }

  const checkAndCollapse = () => {
    if (window.innerWidth <= 900) {
      document.getElementById("posts-workspace").classList.add("is-collapsed");
      localStorage.setItem("postsSidebarCollapsed", "true");
      setTimeout(() => applyStateFromURL(), 10);
    }
  };

  if (CURRENT_VIEW === "time") {
    inner.querySelectorAll(".post-nav-item").forEach(btn => {
      btn.addEventListener("click", () => {
        updateURL({ category: btn.dataset.key, series: null });
        checkAndCollapse();
      });
    });
  } else {
    inner.querySelectorAll(".sidebar-cat-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        updateURL({ category: btn.dataset.cat, series: "all" });
        checkAndCollapse();
      });
    });
    inner.querySelectorAll(".sidebar-series-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        updateURL({ category: btn.dataset.cat, series: btn.dataset.series });
        checkAndCollapse();
      });
    });
  }
}

/* ================= 渲染右侧 ================= */
function renderMainContent(data) {
  const main = document.getElementById("posts-content-area");
  main.innerHTML = ""; 

  main.style.animation = 'none';
  main.offsetHeight;
  main.style.animation = 'fadeIn 0.4s ease-out';

  if (CURRENT_VIEW === "time") {
    if (ACTIVE_CAT_KEY === "all") {
      let html = `<div class="time-view-container">`;
      data.forEach(g => {
        html += `
          <div style="margin-bottom: 3rem;">
            <h2 class="posts-group-title">
              <span class="time-badge">${g.year} 年 ${g.label}</span>
              <span class="posts-group-count">${g.posts.length} 篇</span>
            </h2>
            <div class="posts-cards">
              ${g.posts.map(p => renderCard(p)).join("")}
            </div>
          </div>
        `;
      });
      html += `</div>`;
      main.innerHTML = html;
    } else {
      const currentIndex = data.findIndex(g => g.key === ACTIVE_CAT_KEY);
      if (currentIndex === -1) return;
      
      const currentGroup = data[currentIndex];
      const prevMonth = currentIndex > 0 ? data[currentIndex - 1] : null; 
      const nextMonth = currentIndex < data.length - 1 ? data[currentIndex + 1] : null;

      const prevBtn = prevMonth 
        ? `<a href="javascript:void(0)" class="button is-small is-rounded is-light nav-month-btn" onclick="updateURL({ category: '${prevMonth.key}', series: null })">
             <span class="icon is-small"><i class="fas fa-chevron-left"></i></span>
             <span>${prevMonth.year}年${prevMonth.label}</span>
           </a>`
        : `<button class="button is-small is-rounded is-light" disabled style="opacity:0.5;"><span class="icon is-small"><i class="fas fa-chevron-left"></i></span> 上一月</button>`;

      const nextBtn = nextMonth
        ? `<a href="javascript:void(0)" class="button is-small is-rounded is-light nav-month-btn" onclick="updateURL({ category: '${nextMonth.key}', series: null })">
             <span>${nextMonth.year}年${nextMonth.label}</span>
             <span class="icon is-small"><i class="fas fa-chevron-right"></i></span>
           </a>`
        : `<button class="button is-small is-rounded is-light" disabled style="opacity:0.5;">下一月 <span class="icon is-small"><i class="fas fa-chevron-right"></i></span></button>`;

      main.innerHTML = `
        <div class="time-view-container">
          <div class="time-header-bar">
            <h2 class="posts-group-title mb-0" style="flex:1;">
              <span class="time-badge">${currentGroup.year} 年 ${currentGroup.label}</span>
              <span class="posts-group-count">${currentGroup.posts.length} 篇</span>
            </h2>
            <div class="time-nav-controls">
              ${prevBtn}
              ${nextBtn}
            </div>
          </div>
          <div class="posts-cards">
            ${currentGroup.posts.map(p => renderCard(p)).join("")}
          </div>
        </div>
      `;
    }
  } else {
    let html = "";
    if (ACTIVE_CAT_KEY === "all") {
      data.forEach(cat => {
        let tagsHtml = "";
        if (cat.tags && cat.tags.length > 0) {
          tagsHtml = `<div class="category-tags">${cat.tags.map(t => `<a href="javascript:void(0)" data-tag="${encodeURIComponent(t)}" class="tag is-info is-light is-clickable" style="cursor:pointer;">${t}</a>`).join("")}</div>`;
        }

        html += `
          <div class="category-wrapper" style="margin-bottom: 2.5rem;">
            <div class="category-header">
              <h2 class="category-title">${cat.name}</h2>
              ${tagsHtml}
            </div>
            <div class="category-body">
        `;
        cat.children.forEach(sub => {
          html += `
            <section class="posts-subgroup">
              <h3 class="posts-subgroup-title">${sub.name} <span class="posts-group-count">${sub.posts.length} 篇</span></h3>
              <div class="posts-cards">${sub.posts.map(p => renderCard(p)).join("")}</div>
            </section>
          `;
        });
        html += `</div></div>`;
      });
    } else {
      const currentGroup = data.find(g => g.key === ACTIVE_CAT_KEY);
      if (!currentGroup) return;

      const isSpecificSeries = ACTIVE_SERIES_KEY !== "all";
      const isCollapsed = document.getElementById("posts-workspace").classList.contains("is-collapsed");
      
      const catTitle = isSpecificSeries ? `${currentGroup.name} (${ACTIVE_SERIES_KEY})` : currentGroup.name;
      const showAllBtnHtml = (isSpecificSeries && isCollapsed) ? `
        <a href="javascript:void(0)" onclick="updateURL({ category: '${currentGroup.key}', series: 'all' })" class="button is-small is-rounded is-light mt-2 show-all-btn">
          <span class="icon is-small"><i class="fas fa-layer-group"></i></span>
          <span>显示该分类全部</span>
        </a>
      ` : "";

      let displayTags = [];
      if (isSpecificSeries) {
        const currentSub = currentGroup.children.find(c => c.name === ACTIVE_SERIES_KEY);
        if (currentSub && currentSub.tags) displayTags = currentSub.tags;
      } else {
        displayTags = currentGroup.tags || [];
      }

      let tagsHtml = "";
      if (displayTags.length > 0) {
        tagsHtml = `<div class="category-tags">${displayTags.map(t => `<a href="javascript:void(0)" data-tag="${encodeURIComponent(t)}" class="tag is-info is-light is-clickable" style="cursor:pointer;">${t}</a>`).join("")}</div>`;
      }

      html += `
        <div class="category-wrapper">
          <div class="category-header">
            <h2 class="category-title">${catTitle}</h2>
            ${tagsHtml}
          </div>
          ${showAllBtnHtml ? `<div style="padding: 0 1.5rem 1rem;">${showAllBtnHtml}</div>` : ""}
          <div class="category-body">
      `;
      
      const subsToShow = isSpecificSeries 
        ? currentGroup.children.filter(c => c.name === ACTIVE_SERIES_KEY)
        : currentGroup.children;

      subsToShow.forEach(sub => {
        html += `
          <section class="posts-subgroup">
            <h3 class="posts-subgroup-title">${sub.name} <span class="posts-group-count">${sub.posts.length} 篇</span></h3>
            <div class="posts-cards">${sub.posts.map(p => renderCard(p)).join("")}</div>
          </section>
        `;
      });
      html += `</div></div>`;
    }
    main.innerHTML = html;
  }

  // ==========================================
  // 核心修复：动态绑定标签点击，确保能呼出浮窗
  // ==========================================
  const tagElements = main.querySelectorAll(".category-tags [data-tag]");
  tagElements.forEach(tagEl => {
    tagEl.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation(); // 阻止冒泡
      const encodedTag = tagEl.getAttribute("data-tag");
      if (window.openTagDrawer) {
        window.openTagDrawer(encodedTag);
      } else {
        console.error("找不到 openTagDrawer 函数");
      }
    });
  });
}

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

/* ================= URL 逻辑 ================= */
function updateURL(params) {
  const url = new URL(window.location);
  if (params.view) url.searchParams.set("view", params.view);
  if (params.category) url.searchParams.set("category", params.category);
  else url.searchParams.delete("category");
  if (params.series) url.searchParams.set("series", params.series);
  else url.searchParams.delete("series");

  window.history.pushState({}, "", url);
  applyStateFromURL();
  
  const heroEl = document.querySelector(".hero-sky");
  if (heroEl) {
    const yOffset = -80; 
    const y = heroEl.offsetTop + heroEl.offsetHeight + yOffset;
    window.scrollTo({ top: y > 0 ? y : 0, behavior: "smooth" });
  }
}

function applyStateFromURL() {
  const urlParams = new URLSearchParams(window.location.search);
  CURRENT_VIEW = urlParams.get("view") === "time" ? "time" : "series";
  document.getElementById("posts-main").dataset.currentView = CURRENT_VIEW;

  const tabSeries = document.getElementById("tab-series");
  const tabTime = document.getElementById("tab-time");
  if (CURRENT_VIEW === "series") {
    tabSeries.classList.add("is-active");
    tabTime.classList.remove("is-active");
  } else {
    tabTime.classList.add("is-active");
    tabSeries.classList.remove("is-active");
  }

  const data = CURRENT_VIEW === "series" ? getSeriesData() : getTimeData();
  const urlCat = urlParams.get("category");
  const urlSeries = urlParams.get("series") || "all";

  if (urlCat) {
    ACTIVE_CAT_KEY = urlCat;
    ACTIVE_SERIES_KEY = urlSeries;
  } else if (data.length > 0) {
    ACTIVE_CAT_KEY = "all";
    ACTIVE_SERIES_KEY = "all";
  }

  renderSidebar(data);
  renderMainContent(data);
}

/* ================= 标签文章列表浮窗 ================= */
window.openTagDrawer = async function(encodedTag) {
  const tag = decodeURIComponent(encodedTag);
  
  // 如果已存在则先关闭
  if (document.getElementById("tag-drawer")) {
    window.closeTagDrawer();
    await new Promise(r => setTimeout(r, 300));
  }

  try {
    const posts = await loadPostIndex();
    const allFiltered = posts.filter(p => (p.tags || []).includes(tag))
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    let listHtml = "";
    
    if (allFiltered.length === 0) {
      listHtml = `<div class="has-text-grey p-4 is-size-7">没有找到相关文章。</div>`;
    } else {
      listHtml = allFiltered.map(p => `
        <a href="post?slug=${encodeURIComponent(p.slug)}" class="drawer-item">
          <div class="drawer-item-title">${p.title}</div>
          <div class="drawer-item-date">${p.date}</div>
        </a>
      `).join("");
    }

    const drawerHtml = `
      <div id="tag-drawer" class="tag-drawer-panel">
        <div class="drawer-header">
          <span class="is-size-6 has-text-weight-bold"><i class="fas fa-tags mr-2"></i>标签：${tag}</span>
          <button class="delete" onclick="window.closeTagDrawer()"></button>
        </div>
        <div class="drawer-body">
          ${listHtml}
        </div>
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

  } catch (e) {
    console.error("加载标签文章失败", e);
  }
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

/* ================= 初始化 ================= */
async function initPosts() {
   const config = await initLayout("posts.html");

  // 核心修复：读取 config.json 中的 postsPage 配置，渲染标题和副标题
  const pp = ((config && config.pageCopy) || {}).postsPage || {};
  const titleEl = document.getElementById("posts-title-text");
  const subtitleEl = document.getElementById("page-subtitle");
  if (titleEl) titleEl.textContent = pp.title || "全部文章";
  if (subtitleEl) subtitleEl.textContent = pp.subtitle || "记录代码、思考与生活的碎片。";

  try {
    ALL_POSTS = await loadPostIndex();
  } catch (e) {
    document.getElementById("posts-status").innerHTML = `<div class="notification is-danger">读取失败：${e.message}</div>`;
    return;
  }

  document.getElementById("tab-series").addEventListener("click", (e) => {
    e.preventDefault();
    if (CURRENT_VIEW === "series") return;
    updateURL({ view: "series", category: null, series: null });
  });
  document.getElementById("tab-time").addEventListener("click", (e) => {
    e.preventDefault();
    if (CURRENT_VIEW === "time") return;
    updateURL({ view: "time", category: null, series: null });
  });

  const workspace = document.getElementById("posts-workspace");
  const btnToggle = document.getElementById("sidebar-toggle");
  const btnExpand = document.getElementById("sidebar-expand");

  if (window.innerWidth <= 900) {
    workspace.classList.add("is-collapsed");
  } else if (localStorage.getItem("postsSidebarCollapsed") === "true") {
    workspace.classList.add("is-collapsed");
  }

  btnToggle.addEventListener("click", () => {
    workspace.classList.add("is-collapsed");
    localStorage.setItem("postsSidebarCollapsed", "true");
    applyStateFromURL();
  });

  btnExpand.addEventListener("click", () => {
    workspace.classList.remove("is-collapsed");
    localStorage.setItem("postsSidebarCollapsed", "false");
    applyStateFromURL();
  });

  window.addEventListener("popstate", applyStateFromURL);
  applyStateFromURL();
}

initPosts();
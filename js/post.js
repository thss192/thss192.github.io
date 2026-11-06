// 文章详情页：支持系列独立排序、上下篇正确导航

function getSlug() {
  return new URLSearchParams(window.location.search).get("slug");
}

function parseFrontMatter(raw) {
  const m = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!m) return { meta: {}, body: raw };
  const meta = {};
  m[1].split("\n").forEach(line => {
    const idx = line.indexOf(":");
    if (idx === -1) return;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    if (/^\[.*\]$/.test(val)) {
      meta[key] = val.slice(1, -1).split(",").map(s => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
    } else {
      meta[key] = val.replace(/^["']|["']$/g, "");
    }
  });
  return { meta, body: m[2] };
}

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

function calcReadTime(text) {
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const englishWords = (text.match(/[a-zA-Z0-9_\u0392-\u03c9\u0400-\u04FF]+/g) || []).length;
  const minutes = Math.ceil((chineseChars / 400) + (englishWords / 200));
  return minutes > 0 ? minutes : 1;
}

function generateTOC() {
  const tocList = document.getElementById("toc-list");
  // 排除 Mermaid 容器里的内容
  const headings = document.querySelectorAll("#post-body h2, #post-body h3");
  
  if (!headings.length) {
    tocList.innerHTML = `<li><a class="is-size-7 has-text-grey">无小标题</a></li>`;
    return;
  }

  tocList.innerHTML = Array.from(headings).map((h, i) => {
    if (!h.id) h.id = `heading-${i}`;
    const level = h.tagName.toLowerCase();
    const cls = level === "h3" ? "toc-h3" : "toc-h2";
    return `<li><a class="${cls}" href="#${h.id}" data-target="${h.id}">${h.innerText}</a></li>`;
  }).join("");

  const links = tocList.querySelectorAll("a");
  
  links.forEach(link => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const targetId = link.dataset.target;
      const targetEl = document.getElementById(targetId);
      if (targetEl) {
        const yOffset = -80; 
        const y = targetEl.getBoundingClientRect().top + window.pageYOffset + yOffset;
        window.scrollTo({ top: y, behavior: "smooth" });
      }
    });
  });

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        links.forEach(l => l.classList.remove("is-active"));
        const activeLink = tocList.querySelector(`a[data-target="${entry.target.id}"]`);
        if (activeLink) activeLink.classList.add("is-active");
      }
    });
  }, { rootMargin: "0px 0px -80% 0px" });

  headings.forEach(h => observer.observe(h));
}

// ================= 核心升级：系列内上下篇（支持排序） =================
async function renderPostNav(currentSlug) {
  const navEl = document.getElementById("post-nav");
  if (!navEl) return;
  try {
    let posts = await loadPostIndex();
    const currentPost = posts.find(p => p.slug === currentSlug);
    if (!currentPost) { navEl.innerHTML = ""; return; }

    let seriesPosts = currentPost.series ? posts.filter(p => p.series === currentPost.series) : [...posts];
    
    const config = window.__CONFIG__ || { defaultSort: "desc" };
    const defaultSort = config.defaultSort || "desc";
    let sortMode = localStorage.getItem("globalSort") || defaultSort;

    seriesPosts.sort((a, b) => {
      if (sortMode === "order") return (a.order || 0) - (b.order || 0);
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return sortMode === "asc" ? dateA - dateB : dateB - dateA;
    });

    const idx = seriesPosts.findIndex(p => p.slug === currentSlug);
    const prev = seriesPosts[idx - 1];
    const next = seriesPosts[idx + 1];

    const seriesLabel = currentPost.series ? ` [${currentPost.series}]` : "";

    const prevText = sortMode === "desc" ? "← 上一篇 (更新)" : "← 上一篇";
    const nextText = sortMode === "desc" ? "下一篇 (更早) →" : "下一篇 →";

    const prevHtml = prev
      ? `<div class="column is-6">
           <a class="box is-block" href="post?slug=${encodeURIComponent(prev.slug)}">
             <p class="is-size-7 has-text-grey">${prevText}${seriesLabel}</p>
             <p class="has-text-weight-semibold">${prev.title}</p>
           </a>
         </div>`
      : `<div class="column is-6"></div>`;

    const nextHtml = next
      ? `<div class="column is-6">
           <a class="box is-block has-text-right" href="post?slug=${encodeURIComponent(next.slug)}">
             <p class="is-size-7 has-text-grey">${nextText}${seriesLabel}</p>
             <p class="has-text-weight-semibold">${next.title}</p>
           </a>
         </div>`
      : `<div class="column is-6"></div>`;

    navEl.innerHTML = `<div class="columns">${prevHtml}${nextHtml}</div>`;
  } catch (e) {
    navEl.innerHTML = "";
  }
}

function initLightbox() {
  const modalHtml = `
    <div id="image-modal" class="modal">
      <div class="modal-background"></div>
      <div class="modal-content" style="max-width: 90vw;">
        <p class="image"><img id="modal-image" src="" alt="预览图" style="width: 100%; max-height: 85vh; object-fit: contain;"></p>
      </div>
      <button class="modal-close is-large" aria-label="close"></button>
    </div>
  `;
  document.body.insertAdjacentHTML("beforeend", modalHtml);
  const modal = document.getElementById("image-modal");
  const modalImg = document.getElementById("modal-image");
  const closeBtn = modal.querySelector(".modal-close");
  const bg = modal.querySelector(".modal-background");

  const postImages = document.querySelectorAll("#post-body img");
  postImages.forEach(img => {
    img.style.cursor = "zoom-in";
    img.addEventListener("click", () => { modalImg.src = img.src; modal.classList.add("is-active"); });
  });
  const closeModal = () => modal.classList.remove("is-active");
  closeBtn.addEventListener("click", closeModal);
  bg.addEventListener("click", closeModal);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && modal.classList.contains("is-active")) closeModal(); });
}

function initCopyButtons() {
  const preBlocks = document.querySelectorAll("#post-body pre");
  preBlocks.forEach(pre => {
    if (pre.querySelector(".copy-code-btn")) return;

    const btn = document.createElement("button");
    btn.className = "button is-small copy-code-btn";
    btn.innerHTML = `<i class="fas fa-copy"></i> 复制`;
    
    btn.addEventListener("click", () => {
      const code = pre.querySelector("code").innerText;
      navigator.clipboard.writeText(code).then(() => {
        btn.innerHTML = `<i class="fas fa-check"></i> 已复制`;
        btn.classList.add("is-success");
        btn.style.backgroundColor = "var(--bulma-success)";
        btn.style.color = "#fff";
        
        setTimeout(() => {
          btn.innerHTML = `<i class="fas fa-copy"></i> 复制`;
          btn.classList.remove("is-success");
          btn.style.backgroundColor = "";
          btn.style.color = "";
        }, 2000);
      });
    });
    pre.appendChild(btn);
  });
}

function initReadingProgress() {
  if (document.getElementById("reading-progress")) return;
  const progressBar = document.createElement("div");
  progressBar.id = "reading-progress";
  document.body.appendChild(progressBar);
  window.addEventListener("scroll", () => {
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const scrollTop = window.scrollY;
    if (docHeight > 0) progressBar.style.width = ((scrollTop / docHeight) * 100) + "%";
  });
}

function renderPostExtras(title, date) {
  const extrasEl = document.getElementById("post-footer-extras");
  if (!extrasEl) return;
  const L = (window.__CONFIG__ && window.__CONFIG__.postLicense) || {};
  const licName = L.name || "CC BY-NC-SA 4.0";
  const licUrl = L.url || "https://creativecommons.org/licenses/by-nc-sa/4.0/";
  const licLink = `<a href="${licUrl}" target="_blank" class="has-text-weight-bold">${licName}</a>`;
  const licText = (L.text || "本文《{title}》采用 {name} 许可协议。").replace("{title}", title).replace("{name}", licLink);
  const pubText = (L.publishedText || "发布于 {date} · 作者保留所有权利，转载请注明出处。").replace("{date}", date);
  const copyLabel = L.copyLink || "复制本文链接";

  extrasEl.innerHTML = `
    <div class="has-text-centered mt-6 mb-6 pt-5 pb-5" style="border-top: 1px dashed var(--bulma-border-weak); border-bottom: 1px dashed var(--bulma-border-weak);">
      <p class="is-size-7 has-text-grey mb-3"><i class="fas fa-copyright mr-1"></i> ${licText}</p>
      <p class="is-size-7 has-text-grey mb-4">${pubText}</p>
      <button class="button is-small is-rounded is-light" onclick="navigator.clipboard.writeText(window.location.href).then(() => alert('链接已复制，快去分享吧！'))"><span class="icon is-small"><i class="fas fa-link"></i></span><span>${copyLabel}</span></button>
    </div>
  `;
}

// ================= 详情页顶部排序切换 UI =================
function renderPostSortUI(currentSlug) {
  const headerEl = document.getElementById("post-header");
  if (!headerEl) return;

  if (document.getElementById("post-sort-select")) return;

  try {
    const config = window.__CONFIG__ || { defaultSort: "desc" };
    const defaultSort = config.defaultSort || "desc";

    const navArea = document.createElement("div");
    navArea.className = "mt-4 mb-5 is-flex is-align-items-center is-justify-content-flex-end";
    navArea.innerHTML = `
      <span class="is-size-7 has-text-grey mr-2">阅读顺序：</span>
      <div class="select is-small is-rounded">
        <select id="post-sort-select" style="border-color: var(--bulma-border-weak);">
          <option value="asc">按时间正序</option>
          <option value="desc">按时间倒序</option>
          <option value="order">按自定义排序</option>
        </select>
      </div>
    `;

    const footerExtras = document.getElementById("post-footer-extras");
    if (footerExtras) {
      footerExtras.parentNode.insertBefore(navArea, footerExtras);
    }

    const savedSort = localStorage.getItem("globalSort") || defaultSort;

    const select = document.getElementById("post-sort-select");
    if (select) {
      select.value = savedSort;
      select.addEventListener("change", (e) => {
        localStorage.setItem("globalSort", e.target.value);
        renderPostNav(currentSlug);
      });
    }
  } catch (e) {
    console.warn("renderPostSortUI 失败", e);
  }
}

async function initPost() {
  await initLayout("post.html");
  const statusEl = document.getElementById("post-status");

  const slug = getSlug();
  if (!slug) {
    statusEl.innerHTML = `<div class="notification is-warning">缺少 slug 参数。</div>`;
    return;
  }

  renderPostSortUI(slug);
  renderPostNav(slug);

  let pageTitle = slug;
  try {
    const posts = await loadPostIndex();
    const p = posts.find(x => x.slug === slug);
    if (p) pageTitle = p.title;
  } catch(e) {}
  document.title = `${pageTitle} · 我的博客`;

  if (location.protocol === "file:") {
    statusEl.innerHTML = `<div class="notification is-warning mt-4"><strong>本地双击预览受限：</strong> 浏览器安全策略禁止在 <code>file://</code> 下读取 .md 文件。<br />建议使用本地服务器预览（如 <code>python -m http.server 8000</code>）。</div>`;
    if (slug === "hello-world") {
      renderContent("你好，世界", "2025-01-01", ["随笔", "开始"], `# 你好，世界\n\n欢迎来到我的博客。这是第一篇文章。\n\n## 功能特性\n\n- 支持 **Markdown**\n- 支持 \`代码\`\n\n\`\`\`js\nconsole.log("Hello, Bulma!");\n\`\`\``);
    } else {
      document.getElementById("post-body").innerHTML = "<p class='has-text-danger'>无法加载正文。</p>";
    }
    return;
  }

  try {
    const res = await fetch(`posts/${slug}.md`);
    if (!res.ok) throw new Error("HTTP " + res.status);
    const raw = await res.text();
    const { meta, body } = parseFrontMatter(raw);
    
    renderContent(meta.title || slug, meta.date || "", meta.tags || [], body, meta);
  } catch (e) {
    statusEl.innerHTML = `<div class="notification is-danger">读取文章失败：${e.message}</div>`;
  }
}

function renderContent(title, date, tags, rawBody, meta) {
  const headerEl = document.getElementById("post-header");
  const bodyEl = document.getElementById("post-body");
  
  bodyEl.innerHTML = marked.parse(rawBody);

  // ================= 新增：处理 Mermaid 流程图 =================
  const mermaidBlocks = bodyEl.querySelectorAll("pre code.language-mermaid");
  if (mermaidBlocks.length > 0) {
    // 1. 初始化 Mermaid
    if (typeof mermaid !== "undefined") {
      // 根据当前主题设置 Mermaid 的主题
      const isDark = document.documentElement.getAttribute("data-theme") === "dark";
      mermaid.initialize({
        startOnLoad: false,
        theme: isDark ? "dark" : "default",
        securityLevel: "loose"
      });
    }

    // 2. 把 marked 解析出的 <pre><code> 替换成 <div class="mermaid">
    mermaidBlocks.forEach(codeBlock => {
      const pre = codeBlock.parentNode; // 获取 <pre>
      const container = document.createElement("div");
      container.className = "mermaid-container"; // 方便自定义外框样式
      container.innerHTML = `<div class="mermaid">${codeBlock.textContent}</div>`;
      
      // 替换节点
      pre.parentNode.replaceChild(container, pre);
    });

    // 3. 触发 Mermaid 渲染
    if (typeof mermaid !== "undefined") {
      mermaid.run({
        nodes: bodyEl.querySelectorAll(".mermaid")
      }).catch(err => console.error("Mermaid 渲染失败:", err));
    }
  }
  // ==========================================================

  // 2. 精准统计代码块数量 (直接找渲染后的 <pre> 标签)
  const codeBlocks = bodyEl.querySelectorAll("pre").length;
  
  // 3. 统计图片数量
  const imageCount = bodyEl.querySelectorAll("img").length;

  // 4. 统计纯文字字数（去除代码块和 HTML 标签）
  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = bodyEl.innerHTML;
  tempDiv.querySelectorAll("pre").forEach(pre => pre.remove());
  tempDiv.querySelectorAll(".mermaid-container").forEach(el => el.remove()); // 流程图也不计入字数
  const textLength = tempDiv.textContent.replace(/\s+/g, "").length;

  const readTime = calcReadTime(rawBody);

  // ================= 计算系列进度并存入 Meta =================
  if (meta.series && window.__POSTS_FALLBACK__) {
    const seriesPosts = window.__POSTS_FALLBACK__.filter(p => p.series === meta.series)
      .sort((a, b) => (a.order || 0) - (b.order || 0) || new Date(a.date) - new Date(b.date));
    const currentIndex = seriesPosts.findIndex(p => p.slug === getSlug());
    if (currentIndex !== -1) {
      meta.seriesIndex = currentIndex + 1;
      meta.seriesTotal = seriesPosts.length;
      window.__CURRENT_POST_META__ = meta; 
      
      // 数据算好后，强制重新渲染一次导航栏
      if (typeof renderNavbar === "function" && window.__CONFIG__) {
        renderNavbar(window.__CONFIG__, "post.html");
      }
    }
  }
  // ============================================================

  const tagHtml = (tags || [])
    .map(t => `<a href="javascript:void(0)" onclick="openTagDrawer('${encodeURIComponent(t)}')" class="tag is-info is-light mr-1 is-clickable">${t}</a>`)
    .join("");
    
  // 6. 渲染头部
  headerEl.innerHTML = `
    <h1 class="title is-2">${title}</h1>
    <p class="subtitle is-6 has-text-grey mb-3">
      ${date} · 约 ${readTime} 分钟阅读 
      <span class="mx-2">|</span> ${textLength} 字 
      <span class="mx-2">|</span> ${codeBlocks} 个代码块 
      <span class="mx-2">|</span> ${imageCount} 张图片
    </p>
    <div class="tags mb-5">${tagHtml}</div>
  `;

  // ================= 下面是原有的代码块高亮与复制逻辑 =================
  bodyEl.querySelectorAll("pre").forEach((pre) => {
    const codeBlock = pre.querySelector("code");
    if (codeBlock) hljs.highlightElement(codeBlock);

    let lang = "code";
    if (codeBlock && codeBlock.className) {
      const match = codeBlock.className.match(/language-(\w+)/);
      if (match) lang = match[1].toUpperCase();
    }

    const wrapper = document.createElement("div");
    wrapper.className = "code-wrapper";

    const header = document.createElement("div");
    header.className = "code-header";
    header.innerHTML = `
      <span class="code-lang">${lang}</span>
      <button class="button is-small is-ghost copy-btn">
        <span class="icon is-small"><i class="fas fa-copy"></i></span>
        <span>复制</span>
      </button>
    `;

    pre.parentNode.insertBefore(wrapper, pre);
    wrapper.appendChild(header);
    wrapper.appendChild(pre);

    const btn = header.querySelector(".copy-btn");
    btn.addEventListener("click", () => {
      const code = codeBlock.innerText;
      navigator.clipboard.writeText(code).then(() => {
        btn.innerHTML = `<span class="icon is-small"><i class="fas fa-check"></i></span><span>已复制</span>`;
        btn.classList.add("is-success");
        btn.classList.remove("is-ghost");
        setTimeout(() => {
          btn.innerHTML = `<span class="icon is-small"><i class="fas fa-copy"></i></span><span>复制</span>`;
          btn.classList.remove("is-success");
          btn.classList.add("is-ghost");
        }, 2000);
      });
    });
  });

  generateTOC();
  initLightbox();
  initReadingProgress();
  renderPostExtras(title, date);

  const currentSlug = getSlug();
  if (currentSlug) {
    initGiscus(currentSlug);
  }
}

// ================= 动态加载 Giscus 评论区 =================
function initGiscus(slug) {
  const mount = document.getElementById("giscus-comments");
  if (!mount) return;

  if (mount.dataset.loaded === "true") return;
  mount.dataset.loaded = "true";

  const giscusScript = document.createElement("script");
  giscusScript.src = "https://giscus.app/client.js";
  giscusScript.setAttribute("data-repo", "thss192/thss192.github.io");
  giscusScript.setAttribute("data-repo-id", "R_kgDOVW1aCw");
  
  giscusScript.setAttribute("data-category", "Comments");
  giscusScript.setAttribute("data-category-id", "DIC_kwDOVW1aC84DKdgr");
  
  giscusScript.setAttribute("data-mapping", "specific");
  giscusScript.setAttribute("data-term", slug);
  
  giscusScript.setAttribute("data-strict", "0");
  giscusScript.setAttribute("data-reactions-enabled", "1");
  giscusScript.setAttribute("data-emit-metadata", "0");
  giscusScript.setAttribute("data-input-position", "bottom");
  
  giscusScript.setAttribute("data-theme", "transparent_dark");
  giscusScript.setAttribute("data-lang", "zh-CN");
  giscusScript.setAttribute("crossorigin", "anonymous");
  giscusScript.async = true;
  
  mount.appendChild(giscusScript);

  setTimeout(() => syncGiscusTheme(), 1000);

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.attributeName === "data-theme") {
        syncGiscusTheme();
      }
    });
  });
  observer.observe(document.documentElement, { attributes: true });
}

function syncGiscusTheme() {
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  const theme = isDark ? "transparent_dark" : "light";
  
  const iframe = document.querySelector('iframe.giscus-frame');
  if (iframe) {
    iframe.contentWindow.postMessage(
      { giscus: { setConfig: { theme: theme } } },
      'https://giscus.app'
    );
  }
}

// ================= 标签文章列表浮窗 =================
window.openTagDrawer = async function(encodedTag) {
  const tag = decodeURIComponent(encodedTag);
  
  if (document.getElementById("tag-drawer")) {
    closeTagDrawer();
    await new Promise(r => setTimeout(r, 300));
  }

  try {
    const posts = await loadPostIndex();
    const currentSlug = getSlug();
    
    const allFiltered = posts.filter(p => (p.tags || []).includes(tag))
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    let listHtml = "";
    
    if (allFiltered.length === 0) {
      listHtml = `<div class="has-text-grey p-4 is-size-7">没有找到相关文章。</div>`;
    } else {
      listHtml = allFiltered.map(p => {
        const isCurrent = p.slug === currentSlug;
        
        if (isCurrent) {
          return `
            <a href="javascript:void(0)" class="drawer-item is-current">
              <div class="drawer-item-title">
                <span class="icon is-small mr-1" style="color: var(--bulma-primary);"><i class="fas fa-book-open"></i></span>
                ${p.title}
              </div>
              <div class="drawer-item-date">${p.date} (正在阅读)</div>
            </a>
          `;
        }
        
        return `
          <a href="post?slug=${encodeURIComponent(p.slug)}" class="drawer-item">
            <div class="drawer-item-title">${p.title}</div>
            <div class="drawer-item-date">${p.date}</div>
          </a>
        `;
      }).join("");
    }

    const drawerHtml = `
      <div id="tag-drawer" class="tag-drawer-panel">
        <div class="drawer-header">
          <span class="is-size-6 has-text-weight-bold"><i class="fas fa-tags mr-2"></i>标签：${tag}</span>
          <button class="delete" onclick="closeTagDrawer()"></button>
        </div>
        <div class="drawer-body">
          ${listHtml}
        </div>
      </div>
      <div id="tag-drawer-backdrop" onclick="closeTagDrawer()"></div>
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

initPost();
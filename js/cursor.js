// 彗星履带 (极简版，只保留最好看的彗星样式)
(function () {
  if (document.getElementById("cursor-canvas")) return;

  const canvas = document.createElement("canvas");
  canvas.id = "cursor-canvas";
  canvas.style.cssText = "position:fixed;top:0;left:0;pointer-events:none;z-index:9999;";
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d");

  const resize = () => {
    const w = document.documentElement.clientWidth;
    const h = document.documentElement.clientHeight;
    canvas.width = w;
    canvas.height = h;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
  };
  window.addEventListener("resize", resize);
  resize();

  // 主题色动态获取
  let themeColor = "#00d1b2";
  let themeColorLight = "#00d1b2";
  
  const updateColor = () => {
    let hex = getComputedStyle(document.documentElement).getPropertyValue("--bulma-primary").trim();
    let h, s, l;
    if (!hex || !hex.startsWith("#")) {
      h = document.documentElement.style.getPropertyValue("--bulma-primary-h") || "171";
      s = document.documentElement.style.getPropertyValue("--bulma-primary-s") || "100%";
      l = document.documentElement.style.getPropertyValue("--bulma-primary-l") || "41%";
      themeColor = `hsl(${h}, ${s}, ${l})`;
    } else {
      themeColor = hex;
      const bigint = parseInt(hex.slice(1), 16);
      const r = (bigint >> 16) & 255, g = (bigint >> 8) & 255, b = bigint & 255;
      h = Math.round(Math.atan2(Math.sqrt(3) * (g - b), 2 * r - g - b) * 180 / Math.PI);
      if (h < 0) h += 360;
      s = "80%";
      l = "65%";
    }
    themeColorLight = `hsl(${h}, ${s}, 75%)`;
  };
  updateColor();
  window.__updateCursorColor = updateColor;
  new MutationObserver(updateColor).observe(document.documentElement, { attributes: true });

  // 默认开启彗星
  let currentCursorStyle = localStorage.getItem("cursorStyle") || "comet";
  let mouseX = -100, mouseY = -100;
  
  document.addEventListener("mousemove", (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  });

  const dots = [];
  const maxDots = 30;
  for (let i = 0; i < maxDots; i++) {
    dots.push({ x: -100, y: -100 });
  }
  
  const followSpeed = 0.45;

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (currentCursorStyle === "none") {
      requestAnimationFrame(draw);
      return;
    }

    // 彗星履带绘制逻辑
    dots[0].x += (mouseX - dots[0].x) * followSpeed;
    dots[0].y += (mouseY - dots[0].y) * followSpeed;

    for (let i = 1; i < maxDots; i++) {
      dots[i].x += (dots[i - 1].x - dots[i].x) * followSpeed;
      dots[i].y += (dots[i - 1].y - dots[i].y) * followSpeed;
    }

    for (let i = maxDots - 1; i >= 0; i--) {
      const dot = dots[i];
      const ratio = i / maxDots;
      const radius = Math.max(0.5, 4.5 * (1 - ratio));
      const alpha = Math.max(0.02, 1 - ratio);
      const color = ratio < 0.15 ? themeColorLight : themeColor;
      
      ctx.beginPath();
      ctx.arc(dot.x, dot.y, radius, 0, Math.PI * 2);
      
      if (ratio < 0.3) {
        ctx.shadowBlur = 10 * (1 - ratio);
        ctx.shadowColor = color;
      } else {
        ctx.shadowBlur = 0;
      }

      ctx.fillStyle = color;
      ctx.globalAlpha = alpha;
      ctx.fill();
    }
    ctx.globalAlpha = 1.0;
    ctx.shadowBlur = 0;

    requestAnimationFrame(draw);
  }

  draw();

  // 暴露全局切换接口
  window.__setCursorStyle = (style) => {
    currentCursorStyle = style;
    localStorage.setItem("cursorStyle", style);
    if (style === "none") {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      dots.forEach(d => { d.x = -100; d.y = -100; });
    }
  };

})();
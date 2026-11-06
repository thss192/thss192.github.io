// 极致性能版 Particle Effects (纯白发光矢量星星)
(function () {
  const canvas = document.createElement("canvas");
  canvas.id = "effects-canvas";
  canvas.style.cssText = "position:fixed;top:0;left:0;width:100vw;height:100vh;pointer-events:none;z-index:1;";
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d", { alpha: true });
  let particles = [];
  let animId = null;
  
  let currentEffect = localStorage.getItem("effect") || "flower";
  let currentOpacity = parseFloat(localStorage.getItem("effect_opacity") || "0.6");

  let cachedColor = { r: 0, g: 209, b: 178 }; 
  
  const updateThemeColor = () => {
    const hex = getComputedStyle(document.documentElement).getPropertyValue("--bulma-primary").trim();
    if (hex && hex.startsWith("#")) {
      const bigint = parseInt(hex.slice(1), 16);
      cachedColor = { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
    }
  };
  setTimeout(updateThemeColor, 500);
  window.__updateEffectColor = updateThemeColor;

  const resize = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  };
  window.addEventListener("resize", resize);
  resize();

  // 算法生成雪花
  function drawSnowflake(ctx, size, alpha) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3;
      const dx = Math.sin(angle);
      const dy = -Math.cos(angle);
      
      ctx.moveTo(0, 0);
      ctx.lineTo(dx * size, dy * size);
      
      const branchAngle1 = angle + Math.PI / 3;
      const branchAngle2 = angle - Math.PI / 3;
      const bx = dx * size * 0.6;
      const by = dy * size * 0.6;
      
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + Math.sin(branchAngle1) * size * 0.4, by - Math.cos(branchAngle1) * size * 0.4);
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + Math.sin(branchAngle2) * size * 0.4, by - Math.cos(branchAngle2) * size * 0.4);

      const bx2 = dx * size * 0.3;
      const by2 = dy * size * 0.3;
      ctx.moveTo(bx2, by2);
      ctx.lineTo(bx2 + Math.sin(branchAngle1) * size * 0.25, by2 - Math.cos(branchAngle1) * size * 0.25);
      ctx.moveTo(bx2, by2);
      ctx.lineTo(bx2 + Math.sin(branchAngle2) * size * 0.25, by2 - Math.cos(branchAngle2) * size * 0.25);
    }
    ctx.strokeStyle = `rgba(150, 220, 255, ${alpha})`;
    ctx.lineWidth = 1.2;
    ctx.lineCap = "round";
    ctx.stroke();
  }

  // 纯白高光矢量星星（无 blur，极低消耗）
  function drawWhiteStar(ctx, size, alpha) {
    const R = size;          
    const r = size * 0.45;   
    const points = 5;
    
    // 画外圈柔光（用半透明填充模拟，代替极耗性能的 blur）
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const radius = i % 2 === 0 ? R : r;
      const angle = (i * Math.PI) / points - Math.PI / 2;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();

    // 1. 填充半透明白底
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.3})`;
    ctx.fill();

    // 2. 实心纯白星星
    ctx.beginPath();
    const r2 = r * 0.85; // 内缩一点
    for (let i = 0; i < points * 2; i++) {
      const radius = i % 2 === 0 ? R * 0.85 : r2;
      const angle = (i * Math.PI) / points - Math.PI / 2;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.fill();

    // 3. 极细的高光描边增加锐利度
    ctx.lineWidth = Math.max(1, size * 0.05);
    ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.9})`;
    ctx.lineJoin = "round";
    ctx.stroke();
  }

  class Particle {
    constructor(type, isClick) {
      this.type = type;
      this.isClick = isClick;
      this.x = isClick ? isClick.x : Math.random() * canvas.width;
      this.y = isClick ? isClick.y : -30; 
      
      this.size = isClick ? Math.random() * 8 + 6 : Math.random() * 6 + 4;
      
      // 白色星星尺寸调大一点更有质感
      if (type === "meteor") this.size = Math.random() * 6 + 10; 
      if (type === "snow") this.size = Math.random() * 5 + 4;

      if (isClick) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 4 + 2; 
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.friction = 0.96;
        this.maxLife = 1500;
        this.birth = performance.now();
      } else {
        if (type === "meteor") {
          this.vx = (Math.random() - 0.5) * 1.2;
          this.vy = Math.random() * 1.5 + 1; 
          this.decay = 0.002;
        } else if (type === "snow") {
          this.vx = (Math.random() - 0.5) * 1.2;
          this.vy = Math.random() * 0.8 + 0.5;
          this.decay = 0.001;
        } else {
          this.vx = (Math.random() - 0.5) * 1.2;
          this.vy = Math.random() * 1.5 + 1;
          this.decay = 0.002;
        }
      }
      this.life = 1;
      this.rotation = Math.random() * Math.PI * 2;
      this.rotSpeed = (Math.random() - 0.5) * 0.04;
    }

    update(now) {
      if (this.isClick) {
        this.life = Math.max(0, 1 - (now - this.birth) / this.maxLife);
        this.vx *= this.friction;
        this.vy *= this.friction;
        this.x += this.vx;
        this.y += this.vy;
      } else {
        this.x += this.vx;
        this.y += this.vy;
        this.life -= this.decay;
        if (this.y > canvas.height + 50 || this.x < -50 || this.x > canvas.width + 50) this.life = 0;
      }
      this.rotation += this.rotSpeed;
    }

    draw() {
      let alpha = Math.max(0, this.life) * currentOpacity;
      if (alpha <= 0) return;

      const { r, g, b } = cachedColor;

      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rotation);

      if (this.type === "star") {
        // 十字星：跟随主题色
        ctx.shadowBlur = 10;
        ctx.shadowColor = `rgba(${r}, ${g}, ${b}, ${alpha * 0.8})`;
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        
        ctx.beginPath();
        const s = this.size;
        ctx.moveTo(0, -s);
        ctx.quadraticCurveTo(s * 0.15, -s * 0.15, s, 0);
        ctx.quadraticCurveTo(s * 0.15, s * 0.15, 0, s);
        ctx.quadraticCurveTo(-s * 0.15, s * 0.15, -s, 0);
        ctx.quadraticCurveTo(-s * 0.15, -s * 0.15, 0, -s);
        ctx.fill();
        
        ctx.shadowBlur = 0;

      } else if (this.type === "heart") {
        // 爱心
        ctx.fillStyle = `rgba(255, 77, 109, ${alpha})`;
        ctx.beginPath();
        ctx.moveTo(0, this.size * 0.3);
        ctx.bezierCurveTo(0, 0, -this.size, -this.size * 0.2, -this.size, -this.size * 0.8);
        ctx.bezierCurveTo(-this.size, -this.size * 1.5, 0, -this.size * 1.5, 0, -this.size * 0.6);
        ctx.bezierCurveTo(0, -this.size * 1.5, this.size, -this.size * 1.5, this.size, -this.size * 0.8);
        ctx.bezierCurveTo(this.size, -this.size * 0.2, 0, 0, 0, this.size * 0.3);
        ctx.fill();
      } else if (this.type === "flower") {
        // 花朵
        ctx.fillStyle = `rgba(255, 183, 197, ${alpha})`;
        ctx.beginPath();
        const petals = 5;
        for (let i = 0; i < petals; i++) {
          ctx.rotate(Math.PI * 2 / petals);
          ctx.moveTo(0, 0);
          ctx.quadraticCurveTo(this.size * 0.8, -this.size * 0.8, 0, -this.size);
          ctx.quadraticCurveTo(-this.size * 0.3, -this.size * 0.5, 0, 0);
        }
        ctx.fill();
      } else if (this.type === "snow") {
        // 雪花
        drawSnowflake(ctx, this.size, alpha);
      } else if (this.type === "meteor") {
        // 纯白发光星星（极速矢量绘制）
        drawWhiteStar(ctx, this.size, alpha);
      }
      ctx.restore();
    }
  }

  const loop = (now) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const bgCount = particles.filter(p => !p.isClick).length;
    
    if (currentEffect !== "none" && bgCount < 80) {
      if (currentEffect === "meteor") {
        if (Math.random() < 0.05) particles.push(new Particle(currentEffect, null));
      } else if (currentEffect === "snow") {
        if (Math.random() < 0.15) particles.push(new Particle(currentEffect, null));
      } else {
        if (Math.random() < 0.08) particles.push(new Particle(currentEffect, null));
      }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      particles[i].update(now);
      particles[i].draw();
      if (particles[i].life <= 0) {
        particles.splice(i, 1);
      }
    }
    animId = requestAnimationFrame(loop);
  };

  document.addEventListener("click", (e) => {
    if (currentEffect === "none") return;
    if (e.target.closest("button") || e.target.closest("a") || e.target.closest("input")) return;

    const clickCount = particles.filter(p => p.isClick).length;
    if (clickCount > 100) return;

    const count = 15;
    for (let i = 0; i < count; i++) {
      particles.push(new Particle(currentEffect, { x: e.clientX, y: e.clientY }));
    }
  });

  window.__setEffect = (effect) => {
    currentEffect = effect;
    localStorage.setItem("effect", effect);
    if (effect !== "none" && !animId) requestAnimationFrame(loop);
    if (effect === "none") {
      particles = [];
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (animId) { cancelAnimationFrame(animId); animId = null; }
    }
  };

  window.__setEffectOpacity = (val) => {
    currentOpacity = parseFloat(val);
    localStorage.setItem("effect_opacity", val);
  };

  setTimeout(() => {
    if (currentEffect !== "none") requestAnimationFrame(loop);
  }, 500);
})();
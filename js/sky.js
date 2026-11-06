// 原生纯 CSS 动态天空 + 真实时间显示 + 自动时段切换 + 手动切换
(function () {
  function initSky() {
    var hero = document.querySelector(".hero-sky");
    var sun = document.getElementById("sky-celestial"); 
    var moon = document.getElementById("sky-moon");      
    var stars = document.getElementById("sky-stars");
    var btn = document.getElementById("time-btn");
    var display = document.getElementById("time-display");
    var dateDisplay = document.getElementById("date-display");
    var iconText = document.getElementById("time-icon");
    
    if (!hero || !sun || !moon || !stars) return;

    var isDarkMode = document.documentElement.getAttribute("data-theme") === "dark";
    var isManualMode = false;
    var currentPresetIndex = 0;

    // 6 个时段预设
    var presets = [
      { minute: 300, name: "拂晓", icon: "🌄", bg: "linear-gradient(to bottom, #1A2980 0%, #26D0CE 100%)", isNight: false, forceWhiteText: true },
      { minute: 420, name: "清晨", icon: "🌅", bg: "linear-gradient(to bottom, #FF7B54 0%, #FFD56B 100%)", isNight: false, forceWhiteText: false },
      { minute: 720, name: "白天", icon: "☀️", bg: "linear-gradient(to bottom, #87CEEB 0%, #E0F6FF 100%)", isNight: false, forceWhiteText: false },
      { minute: 1020, name: "黄昏", icon: "🌇", bg: "linear-gradient(to bottom, #FF512F 0%, #F09819 100%)", isNight: false, forceWhiteText: true },
      { minute: 1140, name: "傍晚", icon: "🌆", bg: "linear-gradient(to bottom, #6A3093 0%, #A044FF 50%, #FF7B54 100%)", isNight: true, forceWhiteText: true }, 
      { minute: 0, name: "深夜", icon: "🌙", bg: "linear-gradient(to bottom, #0F2027 0%, #203A43 100%)", isNight: true, forceWhiteText: true }
    ];

    function getSkyData(minutes) {
      if (minutes >= 270 && minutes < 360) return presets[0]; // 4:30 - 6:00 拂晓
      if (minutes >= 360 && minutes < 480) return presets[1]; // 6:00 - 8:00 清晨
      if (minutes >= 480 && minutes < 1020) return presets[2]; // 8:00 - 17:00 白天
      if (minutes >= 1020 && minutes < 1110) return presets[3]; // 17:00 - 18:30 黄昏
      if (minutes >= 1110 && minutes < 1200) return presets[4]; // 18:30 - 20:00 傍晚
      return presets[5]; // 其余时间 深夜
    }

    function getCurrentPresetIndex(minutes) {
      if (minutes >= 270 && minutes < 360) return 0;
      if (minutes >= 360 && minutes < 480) return 1;
      if (minutes >= 480 && minutes < 1020) return 2;
      if (minutes >= 1020 && minutes < 1110) return 3;
      if (minutes >= 1110 && minutes < 1200) return 4;
      return 5;
    }

    var targetSunPos = { top: 85, left: 10 };
    var animationFrameId = null;

    function renderSky(minutes, skyData, animate = false) {
      var bgGradient = skyData.bg;

      if (isDarkMode) {
        bgGradient = bgGradient.replace(/#[0-9A-Fa-f]{6}/g, function(hex) {
          var r = Math.floor(parseInt(hex.slice(1, 3), 16) * 0.4);
          var g = Math.floor(parseInt(hex.slice(3, 5), 16) * 0.4);
          var b = Math.floor(parseInt(hex.slice(5, 7), 16) * 0.4);
          return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
        });
      }

      hero.style.setProperty("background", bgGradient, "important");
      document.body.classList.add("sky-tinted");
      if (skyData.isNight) document.body.classList.add("sky-night");
      else document.body.classList.remove("sky-night");

      if (skyData.isNight || isDarkMode || skyData.forceWhiteText) {
        hero.classList.add("is-dark-sky");
      } else {
        hero.classList.remove("is-dark-sky");
      }

      if (iconText) iconText.textContent = skyData.icon + " " + skyData.name;

      // 判定是否需要太阳
      var isDayTime = !skyData.isNight; 

      if (isDayTime) {
        sun.classList.remove("sun-hidden");
        moon.classList.remove("moon-visible");

        // 【核心修复】：如果是黄昏，太阳必须在右下角；如果白天，正常抛物线
        if (minutes === 1020) {
           // 黄昏固定坐标：右下角低垂
           targetSunPos.top = 85;
           targetSunPos.left = 90;
        } else {
           // 正常白天的抛物线计算
           var angleDeg = ((minutes - 360) / 720) * 180; 
           var angleRad = angleDeg * Math.PI / 180;
           targetSunPos.top = 85 - Math.sin(angleRad) * 70; 
           targetSunPos.left = 10 + (angleDeg / 180) * 80;
        }
        
        sun.style.background = "#FFD700"; 
        sun.style.boxShadow = "0 0 40px rgba(255, 215, 0, 0.6)";
      } else {
        sun.classList.add("sun-hidden");
        moon.classList.add("moon-visible");
      }

      stars.style.opacity = skyData.isNight ? "1" : "0";

      if (animate) {
        animateCelestial(sun, targetSunPos, isDayTime);
      } else {
        if (isDayTime) {
          sun.style.top = targetSunPos.top + "%";
          sun.style.left = targetSunPos.left + "%";
          sun.style.right = "auto";
        }
      }
    }

    // 弧线动画函数
    function animateCelestial(el, targetPos, isDayTime) {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      
      // 如果太阳正在淡出，不需要做大幅度的位移动画
      if (!isDayTime) {
        // 给一个向下掉的微动画
        el.style.top = "110%";
        return;
      }

      var startTop = parseFloat(el.style.top) || 85;
      var startLeft = parseFloat(el.style.left) || 10;
      var startTime = performance.now();
      var duration = 1200; // 动画延长到 1.2 秒，降落感更强

      function step(now) {
        var progress = Math.min((now - startTime) / duration, 1);
        // 缓动函数（越到后面越慢）
        var ease = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;

        var currentTop = startTop + (targetPos.top - startTop) * ease;
        var currentLeft = startLeft + (targetPos.left - startLeft) * ease;

        el.style.top = currentTop + "%";
        el.style.left = currentLeft + "%";

        if (progress < 1) {
          animationFrameId = requestAnimationFrame(step);
        }
      }
      animationFrameId = requestAnimationFrame(step);
    }

    function updateClock() {
      var now = new Date();
      
      var h = now.getHours().toString().padStart(2, '0');
      var m = now.getMinutes().toString().padStart(2, '0');
      var s = now.getSeconds().toString().padStart(2, '0');
      if(display) display.textContent = h + ":" + m + ":" + s;
      
      var month = (now.getMonth() + 1).toString();
      var date = now.getDate().toString();
      var days = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
      var dayStr = days[now.getDay()];
      if(dateDisplay) dateDisplay.textContent = month + "月" + date + "日 " + dayStr;

      if (!isManualMode) {
        var realMinutes = now.getHours() * 60 + now.getMinutes();
        var skyData = getSkyData(realMinutes);
        renderSky(realMinutes, skyData, false);
      }

      requestAnimationFrame(updateClock);
    }

    hero.classList.add("no-anim-sky");
    updateClock();
    
    var initNow = new Date();
    var initMinutes = initNow.getHours() * 60 + initNow.getMinutes();
    currentPresetIndex = getCurrentPresetIndex(initMinutes);

    var initialSkyData = getSkyData(initMinutes);
    renderSky(initMinutes, initialSkyData, false);

    setTimeout(function() {
      hero.classList.remove("no-anim-sky");
    }, 50);

    var observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        if (mutation.attributeName === "data-theme") {
          isDarkMode = document.documentElement.getAttribute("data-theme") === "dark";
          if (isManualMode) {
            renderSky(presets[currentPresetIndex].minute, presets[currentPresetIndex], false);
          } else {
            var now = new Date();
            renderSky(now.getHours() * 60 + now.getMinutes(), getSkyData(now.getHours() * 60 + now.getMinutes()), false);
          }
        }
      });
    });
    observer.observe(document.documentElement, { attributes: true });

    if (btn) {
      btn.addEventListener("click", function() {
        isManualMode = true;
        currentPresetIndex = (currentPresetIndex + 1) % presets.length;
        
        var p = presets[currentPresetIndex];
        
        // 【核心修复】：在切换到“傍晚”或者“深夜”时，触发太阳的淡出
        if (p.name === "傍晚" || p.name === "深夜") {
           // 强行把太阳的 top 设为一个极大的值，然后触发 class 隐藏
           sun.style.top = "110%";
           sun.style.left = "90%";
        }
        
        renderSky(p.minute, p, true);
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initSky);
  } else {
    initSky();
  }
})();
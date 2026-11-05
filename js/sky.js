// 原生纯 CSS 动态天空 + 真实时间显示 + 自动时段切换 + 手动切换
(function () {
  function initSky() {
    var hero = document.querySelector(".hero-sky");
    var body = document.body;
    var sun = document.getElementById("sky-celestial"); // 太阳
    var moon = document.getElementById("sky-moon");      // 月亮（独立元素）
    var stars = document.getElementById("sky-stars");
    var btn = document.getElementById("time-btn");
    var display = document.getElementById("time-display");
    var dateDisplay = document.getElementById("date-display");
    var iconText = document.getElementById("time-icon");
    
    if (!hero || !sun || !moon || !stars) return;

    var isDarkMode = document.documentElement.getAttribute("data-theme") === "dark";
    var isManualMode = false;
    var currentPresetIndex = 0;

    var presets = [
      { minute: 360, name: "清晨", icon: "🌅", bg: "linear-gradient(to bottom, #FF7B54 0%, #FFD56B 100%)", isNight: false, forceWhiteText: false },
      { minute: 720, name: "白天", icon: "☀️", bg: "linear-gradient(to bottom, #87CEEB 0%, #E0F6FF 100%)", isNight: false, forceWhiteText: false },
      { minute: 1080, name: "傍晚", icon: "🌇", bg: "linear-gradient(to bottom, #6A3093 0%, #A044FF 50%, #FF7B54 100%)", isNight: false, forceWhiteText: true }, 
      { minute: 0, name: "夜晚", icon: "🌙", bg: "linear-gradient(to bottom, #0F2027 0%, #203A43 100%)", isNight: true, forceWhiteText: true }
    ];

    function getSkyData(minutes) {
      if (minutes >= 300 && minutes < 420) return { name: "清晨", icon: "🌅", bg: "linear-gradient(to bottom, #FF7B54 0%, #FFD56B 100%)", isNight: false, forceWhiteText: false };
      if (minutes >= 420 && minutes < 1020) return { name: "白天", icon: "☀️", bg: "linear-gradient(to bottom, #87CEEB 0%, #E0F6FF 100%)", isNight: false, forceWhiteText: false };
      if (minutes >= 1020 && minutes < 1140) return { name: "傍晚", icon: "🌇", bg: "linear-gradient(to bottom, #6A3093 0%, #A044FF 50%, #FF7B54 100%)", isNight: false, forceWhiteText: true };
      return { name: "夜晚", icon: "🌙", bg: "linear-gradient(to bottom, #0F2027 0%, #203A43 100%)", isNight: true, forceWhiteText: true };
    }

    function renderSky(minutes, skyData) {
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
      body.classList.add("sky-tinted");
      if (skyData.isNight) body.classList.add("sky-night");
      else body.classList.remove("sky-night");

      if (skyData.isNight || isDarkMode || skyData.forceWhiteText) {
        hero.classList.add("is-dark-sky");
      } else {
        hero.classList.remove("is-dark-sky");
      }

      if (iconText) iconText.textContent = skyData.icon + " " + skyData.name;

      // === 核心动画逻辑 ===
      var isDayTime = (minutes >= 360 && minutes < 1080); // 傍晚18点也属于白天黄昏，继续走抛物线

      if (isDayTime) {
        // 【白天 & 傍晚】显示太阳
        sun.classList.remove("sun-hidden");
        moon.classList.remove("moon-visible");

        var angleDeg = ((minutes - 360) / 720) * 180; 
        var angleRad = angleDeg * Math.PI / 180;
        var topPos = 85 - Math.sin(angleRad) * 60; 
        var leftPos = 10 + (angleDeg / 180) * 80;
        
        sun.style.background = "#FFD700"; 
        sun.style.boxShadow = "0 0 40px rgba(255, 215, 0, 0.6)";
        sun.style.top = topPos + "%";
        sun.style.left = leftPos + "%";
        sun.style.right = "auto";
      } else {
        // 【夜晚】太阳落下，月亮升起
        sun.classList.add("sun-hidden");
        moon.classList.add("moon-visible");
      }

      stars.style.opacity = skyData.isNight ? "1" : "0";
    }

    function updateClock() {
      var now = new Date();
      
      var h = now.getHours().toString().padStart(2, '0');
      var m = now.getMinutes().toString().padStart(2, '0');
      var s = now.getSeconds().toString().padStart(2, '0');
      display.textContent = h + ":" + m + ":" + s;
      
      var month = (now.getMonth() + 1).toString();
      var date = now.getDate().toString();
      var days = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
      var dayStr = days[now.getDay()];
      dateDisplay.textContent = month + "月" + date + "日 " + dayStr;

      if (!isManualMode) {
        var realMinutes = now.getHours() * 60 + now.getMinutes();
        var skyData = getSkyData(realMinutes);
        renderSky(realMinutes, skyData);
      }

      requestAnimationFrame(updateClock);
    }

    updateClock();
    
    var initNow = new Date();
    var initMinutes = initNow.getHours() * 60 + initNow.getMinutes();
    if (initMinutes >= 300 && initMinutes < 420) currentPresetIndex = 0;
    else if (initMinutes >= 420 && initMinutes < 1020) currentPresetIndex = 1;
    else if (initMinutes >= 1020 && initMinutes < 1140) currentPresetIndex = 2;
    else currentPresetIndex = 3;

    var observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        if (mutation.attributeName === "data-theme") {
          isDarkMode = document.documentElement.getAttribute("data-theme") === "dark";
          if (isManualMode) {
            renderSky(presets[currentPresetIndex].minute, presets[currentPresetIndex]);
          } else {
            var now = new Date();
            renderSky(now.getHours() * 60 + now.getMinutes(), getSkyData(now.getHours() * 60 + now.getMinutes()));
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
        renderSky(p.minute, p);
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initSky);
  } else {
    initSky();
  }
})();
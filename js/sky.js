// 原生纯 CSS 动态天空 + 真实时间 + 全站通用
(function () {
  function initSky() {
    var hero = document.querySelector(".hero-sky");
    if (!hero) return; // 如果这个页面没有天空，直接退出

    var body = document.body;
    var celestial = document.getElementById("sky-celestial");
    var stars = document.getElementById("sky-stars");
    var btn = document.getElementById("time-btn");
    var display = document.getElementById("time-display");
    var dateDisplay = document.getElementById("date-display");
    var iconText = document.getElementById("time-icon");
    
    var isDarkMode = document.documentElement.getAttribute("data-theme") === "dark";

    // 预设时段
    var presets = [
      { name: "清晨", icon: "🌅", bg: "linear-gradient(to bottom, #FF7B54 0%, #FFD56B 100%)", isNight: false },
      { name: "白天", icon: "☀️", bg: "linear-gradient(to bottom, #87CEEB 0%, #E0F6FF 100%)", isNight: false },
      { name: "傍晚", icon: "🌇", bg: "linear-gradient(to bottom, #6A3093 0%, #A044FF 50%, #FF7B54 100%)", isNight: false, forceWhiteText: true }, 
      { name: "夜晚", icon: "🌙", bg: "linear-gradient(to bottom, #0F2027 0%, #203A43 100%)", isNight: true }
    ];
    
    var currentPresetIndex = 1;

    function renderSkyEffect(preset) {
      var bgGradient = preset.bg;

      // 暗色模式叠加暗化
      if (isDarkMode) {
        bgGradient = bgGradient.replace(/#[0-9A-Fa-f]{6}/g, function(hex) {
          var r = Math.floor(parseInt(hex.slice(1, 3), 16) * 0.4);
          var g = Math.floor(parseInt(hex.slice(3, 5), 16) * 0.4);
          var b = Math.floor(parseInt(hex.slice(5, 7), 16) * 0.4);
          return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
        });
      }

      // 应用背景
      hero.style.setProperty("background", bgGradient, "important");
      body.classList.add("sky-tinted");
      if (preset.isNight) body.classList.add("sky-night");
      else body.classList.remove("sky-night");

      // 太阳/月亮简单定位
      if (celestial) {
        var topPos = preset.isNight ? "20%" : "30%";
        var leftPos = preset.isNight ? "30%" : "75%";
        celestial.style.display = "block";
        if (!preset.isNight) {
          celestial.style.background = "#FFD700"; 
          celestial.style.boxShadow = "0 0 40px rgba(255, 215, 0, 0.6)";
        } else {
          celestial.style.background = "#E0E0E0"; 
          celestial.style.boxShadow = "0 0 20px rgba(224, 224, 224, 0.5)";
        }
        celestial.style.top = topPos;
        celestial.style.left = leftPos;
      }
      if (preset.isNight || isDarkMode || preset.forceWhiteText) {
        hero.classList.add("is-dark-sky");
      } else {
        hero.classList.remove("is-dark-sky");
      }
      if (stars) stars.style.opacity = preset.isNight ? "1" : "0";
      if (iconText) iconText.textContent = preset.icon + " " + preset.name;
    }

    // 时间日期刷新
    function updateClock() {
      var now = new Date();
      
      if (display) {
        var h = now.getHours().toString().padStart(2, '0');
        var m = now.getMinutes().toString().padStart(2, '0');
        var s = now.getSeconds().toString().padStart(2, '0');
        display.textContent = h + ":" + m + ":" + s;
      }
      
      if (dateDisplay) {
        var month = (now.getMonth() + 1).toString();
        var date = now.getDate().toString();
        var days = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
        var dayStr = days[now.getDay()];
        dateDisplay.textContent = month + "月" + date + "日 " + dayStr;
      }

      requestAnimationFrame(updateClock);
    }

    updateClock();
    renderSkyEffect(presets[currentPresetIndex]);

    if (btn) {
      btn.addEventListener("click", function() {
        currentPresetIndex = (currentPresetIndex + 1) % presets.length;
        renderSkyEffect(presets[currentPresetIndex]);
      });
    }

    var observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        if (mutation.attributeName === "data-theme") {
          isDarkMode = document.documentElement.getAttribute("data-theme") === "dark";
          renderSkyEffect(presets[currentPresetIndex]);
        }
      });
    });
    observer.observe(document.documentElement, { attributes: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initSky);
  } else {
    initSky();
  }
})();
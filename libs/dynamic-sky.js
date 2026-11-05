/**
 *   <script src="https://cdn.jsdelivr.net/gh/aakaashjois/dynamic-sky@main/dynamic-sky.js"></script>
 *   <script>
 *     const sky = new DynamicSky();
 *     sky.init(); // loads SunCalc (jsDelivr ESM) if missing
 *   </script>
 *
 * @version 2.1.0
 * @license Apache-2.0
 */
(function (global) {
  'use strict';

  var PI = Math.PI;
  var RAYLEIGH_SCATTER = [5.802e-6, 13.558e-6, 33.1e-6];
  var MIE_SCATTER = 3.996e-6;
  var MIE_ABSORB = 4.44e-6;
  var OZONE_ABSORB = [0.65e-6, 1.881e-6, 0.085e-6];
  var RAYLEIGH_SCALE_HEIGHT = 8e3;
  var MIE_SCALE_HEIGHT = 1.2e3;
  var GROUND_RADIUS = 6360000;
  var TOP_RADIUS = 6460000;
  var GRADIENT_SAMPLES = 32;
  var INTEGRATION_SAMPLES = 8;
  var FOV_DEG = 75;
  var EXPOSURE = 25.0;
  var GAMMA = 2.2;
  var SUNSET_BIAS_STRENGTH = 0.1;
  var LOCATION_API = 'https://ipwho.is/';
  var FALLBACK_LAT = 37.77;
  var FALLBACK_LNG = -122.41;

  function rayleighPhase(cosAngle) {
    return (3 * (1 + cosAngle * cosAngle)) / (16 * PI);
  }

  function miePhase(cosAngle) {
    var g = 0.8;
    var scale = 3 / (8 * PI);
    var num = (1 - g * g) * (1 + cosAngle * cosAngle);
    var denom = (2 + g * g) * Math.pow(1 + g * g - 2 * g * cosAngle, 1.5);
    return (scale * num) / denom;
  }

  function computeTransmittance(height, angle, out) {
    var rayOriginY = GROUND_RADIUS + height;
    var rayDirectionX = Math.sin(angle);
    var rayDirectionY = Math.cos(angle);
    var b = rayOriginY * rayDirectionY;
    var c = rayOriginY * rayOriginY - TOP_RADIUS * TOP_RADIUS;
    var discr = b * b - c;

    if (discr < 0) {
      out[0] = out[1] = out[2] = 1;
      return out;
    }

    var sqrtDiscr = Math.sqrt(discr);
    var t = -b - sqrtDiscr;
    var distance = t < 0 ? -b + sqrtDiscr : t;
    var segmentLength = distance / INTEGRATION_SAMPLES;
    var tCurrent = 0.5 * segmentLength;
    var odRayleigh = 0;
    var odMie = 0;
    var odOzone = 0;

    for (var i = 0; i < INTEGRATION_SAMPLES; i++) {
      var posX = rayDirectionX * tCurrent;
      var posY = rayOriginY + rayDirectionY * tCurrent;
      var h = Math.sqrt(posX * posX + posY * posY) - GROUND_RADIUS;
      odRayleigh += Math.exp(-h / RAYLEIGH_SCALE_HEIGHT) * segmentLength;
      odMie += Math.exp(-h / MIE_SCALE_HEIGHT) * segmentLength;
      odOzone += (1.0 - Math.min(Math.abs(h - 25e3) / 15e3, 1.0)) * segmentLength;
      tCurrent += segmentLength;
    }

    var tauM = MIE_ABSORB * odMie;
    out[0] = Math.exp(-(RAYLEIGH_SCATTER[0] * odRayleigh + tauM + OZONE_ABSORB[0] * odOzone));
    out[1] = Math.exp(-(RAYLEIGH_SCATTER[1] * odRayleigh + tauM + OZONE_ABSORB[1] * odOzone));
    out[2] = Math.exp(-(RAYLEIGH_SCATTER[2] * odRayleigh + tauM + OZONE_ABSORB[2] * odOzone));
    return out;
  }

  // ponytail: star/layer CSS only; container position set in init()
  if (typeof document !== 'undefined' && !document.getElementById('dynamic-sky-styles')) {
    var style = document.createElement('style');
    style.id = 'dynamic-sky-styles';
    style.textContent = [
      '.dynamic-sky-layer{position:absolute;inset:0;animation:dynamic-sky-breathe 10s ease-in-out infinite}',
      '.dynamic-sky-star{position:absolute;width:2px;height:2px;background:#fff;border-radius:50%}',
      '@keyframes dynamic-sky-breathe{0%,100%{transform:translateZ(0)}50%{transform:translateZ(var(--sky-zoom,1px))}}',
      '@media (max-width:768px){.dynamic-sky-star{opacity:.7}}',
      '@media (prefers-reduced-motion:reduce){.dynamic-sky-layer{animation:none}}'
    ].join('');
    document.head.appendChild(style);
  }

  // SunCalc 2.x ESM — jsDelivr's UMD (.cjs) is served as application/node and blocked by nosniff.
  var SUNCALC_ESM = './libs/suncalc.js';
  var sunCalcReadyPromise = null;
  function hasSunCalc() {
    return !!(global.SunCalc && typeof global.SunCalc.getPosition === 'function');
  }
  function ensureSunCalc() {
    if (hasSunCalc()) return Promise.resolve();
    if (sunCalcReadyPromise) return sunCalcReadyPromise;
    if (typeof document === 'undefined') {
      return Promise.reject(new Error('SunCalc missing'));
    }
    sunCalcReadyPromise = import(SUNCALC_ESM).then(function (mod) {
      global.SunCalc = mod;
      if (!hasSunCalc()) throw new Error('SunCalc export missing after load');
    });
    return sunCalcReadyPromise;
  }

  function clamp(x, min, max) {
    return Math.max(min, Math.min(max, x));
  }

  function isValidCoordinate(lat, lng) {
    return typeof lat === 'number' && isFinite(lat) && Math.abs(lat) <= 90 &&
           typeof lng === 'number' && isFinite(lng) && Math.abs(lng) <= 180;
  }

  function ensureElement(selector, fallbackId) {
    var el = document.querySelector(selector);
    if (el) return el;
    el = document.createElement('div');
    el.id = selector.charAt(0) === '#' ? selector.slice(1) : fallbackId;
    document.body.appendChild(el);
    return el;
  }

  function numOpt(v, fallback, lo, hi) {
    var n = typeof v === 'number' && isFinite(v) ? v : fallback;
    return clamp(n, lo, hi);
  }

  function DynamicSky(options) {
    options = options || {};
    this.skyContainer = typeof options.skyContainer === 'string' ? options.skyContainer : '#background-sky';
    this.starsContainer = typeof options.starsContainer === 'string' ? options.starsContainer : '#stars-container';
    this.latitude = isValidCoordinate(options.latitude, options.longitude) ? options.latitude : null;
    this.longitude = isValidCoordinate(options.latitude, options.longitude) ? options.longitude : null;
    this.autoDetectLocation = options.autoDetectLocation !== false;
    // ponytail: clamp caps DoS; drop when callers are trusted
    this.starLayers = numOpt(options.starLayers, 3, 0, 5);
    this.starDensity = numOpt(options.starDensity, 5, 0, 20);
    this.skyElement = null;
    this.starsElement = null;
    this.starsCreated = false;
    this.userLatitude = null;
    this.userLongitude = null;
    this.isInitialized = false;
    this.contained = false;
  }

  DynamicSky.prototype.init = function () {
    if (this.isInitialized) return Promise.resolve(this);

    this.skyElement = ensureElement(this.skyContainer, 'background-sky');
    this.starsElement = ensureElement(this.starsContainer, 'stars-container');

    this.contained = !!(this.skyElement.parentElement && this.skyElement.parentElement !== document.body);
    if (this.contained) {
      var parent = this.skyElement.parentElement;
      if (getComputedStyle(parent).position === 'static') parent.style.position = 'relative';
    }
    var pos = this.contained ? 'absolute' : 'fixed';
    var box = {
      position: pos,
      top: '0', left: '0',
      width: this.contained ? '100%' : '100vw',
      height: this.contained ? '100%' : '100dvh',
      pointerEvents: 'none', margin: '0', padding: '0'
    };
    Object.assign(this.skyElement.style, box, {
      zIndex: this.contained ? '0' : '-2',
      backgroundColor: '#121212'
    });
    Object.assign(this.starsElement.style, box, {
      zIndex: this.contained ? '1' : '-1',
      overflow: 'hidden',
      perspective: '100px',
      perspectiveOrigin: '50% 50%'
    });

    var self = this;
    return ensureSunCalc().then(function () {
      return (self.autoDetectLocation && self.latitude == null)
        ? self.detectLocation()
        : Promise.resolve();
    }).then(function () {
      if (self.userLatitude == null) {
        self.userLatitude = self.latitude != null ? self.latitude : FALLBACK_LAT;
        self.userLongitude = self.longitude != null ? self.longitude : FALLBACK_LNG;
      }
      self.updateSky();
      self.isInitialized = true;
      return self;
    }).catch(function (error) {
      console.error('DynamicSky: SunCalc load failed:', error.message);
      throw error;
    });
  };

  DynamicSky.prototype.detectLocation = function () {
    var self = this;
    return fetch(LOCATION_API)
      .then(function (response) {
        if (!response.ok) throw new Error('location ' + response.status);
        return response.json();
      })
      .then(function (data) {
        if (!data.success || !isValidCoordinate(data.latitude, data.longitude)) {
          throw new Error('bad location');
        }
        self.userLatitude = data.latitude;
        self.userLongitude = data.longitude;
      })
      .catch(function () {
        self.userLatitude = FALLBACK_LAT;
        self.userLongitude = FALLBACK_LNG;
      });
  };

  DynamicSky.prototype.createSky = function () {
    if (this.starsCreated || !this.starsElement) return;

    var parent = this.skyElement.parentElement;
    var contained = this.contained;
    var winW = contained ? parent.getBoundingClientRect().width : window.innerWidth;
    var winH = contained ? parent.getBoundingClientRect().height : window.innerHeight;

    if (contained && (winW === 0 || winH === 0)) {
      var self = this;
      setTimeout(function () { self.createSky(); }, 100);
      return;
    }

    var starFieldWidth = winW * 2;
    var starFieldHeight = winH * 2;

    Object.assign(this.starsElement.style, {
      width: starFieldWidth + 'px',
      height: starFieldHeight + 'px',
      position: contained ? 'absolute' : 'fixed',
      left: (winW / 2 - starFieldWidth / 2) + 'px',
      top: (winH * 1.1 - starFieldHeight / 2) + 'px',
      transform: ''
    });

    var density = window.innerWidth <= 768 ? 2 : this.starDensity;
    if (contained) density *= Math.min(1, (winW * winH) / (800 * 600));

    for (var i = 0; i < this.starLayers; i++) {
      var layer = document.createElement('div');
      var starsCount = Math.floor(density * (200 * (0.5 / (i + 1))));
      layer.className = 'dynamic-sky-layer';
      layer.style.zIndex = i;
      layer.style.opacity = (i + 1) / this.starLayers + 0.1;
      layer.style.setProperty('--sky-zoom', (1 + 2 * Math.pow(1.5, i)) + 'px');

      var fragment = document.createDocumentFragment();
      for (var s = 0; s < starsCount; s++) {
        var star = document.createElement('div');
        star.className = 'dynamic-sky-star';
        star.style.left = Math.random() * starFieldWidth + 'px';
        star.style.top = Math.random() * starFieldHeight + 'px';
        star.style.backgroundColor = s % 2 === 0
          ? 'rgb(255,' + (255 - Math.ceil(10 * Math.random())) + ',' + (255 - Math.ceil(20 * Math.random())) + ')'
          : 'rgb(' + (255 - Math.ceil(20 * Math.random())) + ',255,255)';
        fragment.appendChild(star);
      }
      layer.appendChild(fragment);
      this.starsElement.appendChild(layer);
    }

    this.starsCreated = true;
  };

  DynamicSky.prototype.renderGradient = function (altitude) {
    var cameraPositionY = GROUND_RADIUS;
    var sunDirectionY = Math.sin(altitude);
    var focalZ = 1.0 / Math.tan((FOV_DEG * 0.5 * PI) / 180.0);
    var transmittanceCameraToSpace = [0, 0, 0];
    var transmittanceToSpace = [0, 0, 0];
    var transmittanceLight = [0, 0, 0];
    var colorStops = '';
    var invGamma = 1.0 / GAMMA;

    for (var i = GRADIENT_SAMPLES - 1; i >= 0; i--) {
      var s = i / (GRADIENT_SAMPLES - 1);
      var vdY = s;
      var vdZ = focalZ;
      var vdLen = Math.sqrt(vdY * vdY + vdZ * vdZ) || 1;
      vdY /= vdLen;
      vdZ /= vdLen;

      var inscatteredX = 0;
      var inscatteredY = 0;
      var inscatteredZ = 0;

      var b = cameraPositionY * vdY;
      var c = cameraPositionY * cameraPositionY - TOP_RADIUS * TOP_RADIUS;
      var discr = b * b - c;
      var tExitTop = null;
      if (discr >= 0) {
        var sqrtDiscr = Math.sqrt(discr);
        var tHit = -b - sqrtDiscr;
        tExitTop = tHit < 0 ? -b + sqrtDiscr : tHit;
      }

      if (tExitTop !== null && tExitTop > 0) {
        var segmentLength = tExitTop / INTEGRATION_SAMPLES;
        var tRay = segmentLength * 0.5;
        var isRayPointingDownwardAtStart = vdY < 0.0;
        var startHeight = cameraPositionY - GROUND_RADIUS;
        computeTransmittance(startHeight, Math.acos(Math.abs(clamp(vdY, -1, 1))), transmittanceCameraToSpace);

        var sunViewCos = clamp(sunDirectionY * vdY, -1, 1);
        var phaseR = rayleighPhase(sunViewCos);
        var phaseM = miePhase(sunViewCos);

        for (var j = 0; j < INTEGRATION_SAMPLES; j++) {
          var samplePosY = cameraPositionY + vdY * tRay;
          var samplePosZ = vdZ * tRay;
          var sampleRadius = Math.sqrt(samplePosY * samplePosY + samplePosZ * samplePosZ);
          var upUnitY = samplePosY / sampleRadius;
          var upUnitZ = samplePosZ / sampleRadius;
          var sampleHeight = sampleRadius - GROUND_RADIUS;

          var viewCos = clamp(upUnitY * vdY + upUnitZ * vdZ, -1, 1);
          var sunCos = clamp(upUnitY * sunDirectionY, -1, 1);
          computeTransmittance(sampleHeight, Math.acos(Math.abs(viewCos)), transmittanceToSpace);

          var tc0, tc1, tc2;
          if (isRayPointingDownwardAtStart) {
            tc0 = transmittanceToSpace[0] / transmittanceCameraToSpace[0];
            tc1 = transmittanceToSpace[1] / transmittanceCameraToSpace[1];
            tc2 = transmittanceToSpace[2] / transmittanceCameraToSpace[2];
          } else {
            tc0 = transmittanceCameraToSpace[0] / transmittanceToSpace[0];
            tc1 = transmittanceCameraToSpace[1] / transmittanceToSpace[1];
            tc2 = transmittanceCameraToSpace[2] / transmittanceToSpace[2];
          }

          computeTransmittance(sampleHeight, Math.acos(sunCos), transmittanceLight);
          var opticalDensityRay = Math.exp(-sampleHeight / RAYLEIGH_SCALE_HEIGHT);
          var mieTerm = MIE_SCATTER * Math.exp(-sampleHeight / MIE_SCALE_HEIGHT) * phaseM;

          inscatteredX += tc0 * transmittanceLight[0] * (RAYLEIGH_SCATTER[0] * opticalDensityRay * phaseR + mieTerm) * segmentLength;
          inscatteredY += tc1 * transmittanceLight[1] * (RAYLEIGH_SCATTER[1] * opticalDensityRay * phaseR + mieTerm) * segmentLength;
          inscatteredZ += tc2 * transmittanceLight[2] * (RAYLEIGH_SCATTER[2] * opticalDensityRay * phaseR + mieTerm) * segmentLength;
          tRay += segmentLength;
        }
      }

      var c0 = inscatteredX * EXPOSURE;
      var c1 = inscatteredY * EXPOSURE;
      var c2 = inscatteredZ * EXPOSURE;
      var lum = 0.2126 * c0 + 0.7152 * c1 + 0.0722 * c2;
      var w = 1.0 / (1.0 + 2.0 * lum);
      var k = SUNSET_BIAS_STRENGTH;
      c0 = Math.max(0, c0 * (1.0 + 0.5 * k * w));
      c1 = Math.max(0, c1 * (1.0 - 0.5 * k * w));
      c2 = Math.max(0, c2 * (1.0 + 1.0 * k * w));

      c0 = clamp((c0 * (2.51 * c0 + 0.03)) / (c0 * (2.43 * c0 + 0.59) + 0.14), 0, 1);
      c1 = clamp((c1 * (2.51 * c1 + 0.03)) / (c1 * (2.43 * c1 + 0.59) + 0.14), 0, 1);
      c2 = clamp((c2 * (2.51 * c2 + 0.03)) / (c2 * (2.43 * c2 + 0.59) + 0.14), 0, 1);
      c0 = Math.pow(c0, invGamma);
      c1 = Math.pow(c1, invGamma);
      c2 = Math.pow(c2, invGamma);

      var r = Math.round(clamp(c0, 0, 1) * 255);
      var g = Math.round(clamp(c1, 0, 1) * 255);
      var bChan = Math.round(clamp(c2, 0, 1) * 255);
      var percent = Math.round((1 - s) * 10000) / 100;
      if (colorStops) colorStops += ', ';
      colorStops += 'rgb(' + r + ', ' + g + ', ' + bChan + ') ' + percent + '%';
    }

    return 'linear-gradient(to bottom, ' + colorStops + ')';
  };

  DynamicSky.prototype.updateSky = function (date) {
    if (this.userLatitude == null || this.userLongitude == null) {
      console.warn('DynamicSky: Location not set. Call init() first.');
      return;
    }
    if (typeof global.SunCalc === 'undefined') {
      console.error('DynamicSky: SunCalc is not available.');
      return;
    }

    this.createSky();

    var now = date || new Date();
    var times = SunCalc.getTimes(now, this.userLatitude, this.userLongitude);
    var sunPos = SunCalc.getPosition(now, this.userLatitude, this.userLongitude);
    // SunCalc 2.x: altitude in degrees
    var altDeg = sunPos.altitude;
    var renderAltDeg = altDeg;
    var sunsetDeg = -0.833;
    var twilightVisDeg = -3;

    if (times.sunset && times.dusk && now > times.sunset && now < times.dusk) {
      var p = (now - times.sunset) / (times.dusk - times.sunset);
      renderAltDeg = sunsetDeg + p * (twilightVisDeg - sunsetDeg);
    }
    if (times.dawn && times.sunrise && now > times.dawn && now < times.sunrise) {
      var p2 = (now - times.dawn) / (times.sunrise - times.dawn);
      renderAltDeg = twilightVisDeg + p2 * (sunsetDeg - twilightVisDeg);
    }

    if (this.skyElement) {
      this.skyElement.style.backgroundImage = this.renderGradient(renderAltDeg * PI / 180);
    }

    if (this.starsElement) {
      this.starsElement.style.opacity = altDeg < 0 ? clamp(altDeg / -6, 0, 1) : 0;
      this.starsElement.style.transformOrigin = '50% 50%';
      var msInDay = 86400000;
      var currentMs = now.getHours() * 3600000 + now.getMinutes() * 60000 +
        now.getSeconds() * 1000 + now.getMilliseconds();
      this.starsElement.style.transform = 'rotate(' + (currentMs / msInDay) * 360 + 'deg)';
    }
  };

  DynamicSky.prototype.setLocation = function (latitude, longitude) {
    if (!isValidCoordinate(latitude, longitude)) {
      console.error('DynamicSky: Invalid coordinates', latitude, longitude);
      return;
    }
    this.userLatitude = latitude;
    this.userLongitude = longitude;
  };

  DynamicSky.prototype.minutesToDate = function (minutes) {
    var now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, minutes);
  };

  DynamicSky.prototype.dateToMinutes = function (date) {
    date = date || new Date();
    var startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    return Math.round((date - startOfDay) / 60000);
  };

  // ponytail: one check for the scattering core; open ?skycheck=1
  DynamicSky._selfCheck = function () {
    var out = [0, 0, 0];
    computeTransmittance(0, 0, out);
    if (!(out[0] > 0 && out[0] <= 1 && out[2] < out[0])) {
      throw new Error('transmittance failed: ' + out);
    }
    var sky = new DynamicSky({ latitude: 37.77, longitude: -122.41, autoDetectLocation: false });
    var grad = sky.renderGradient(0.5);
    if (typeof grad !== 'string' || grad.indexOf('linear-gradient') !== 0) {
      throw new Error('gradient failed');
    }
    return 'ok';
  };

  if (typeof location !== 'undefined' && /[?&]skycheck=1/.test(location.search)) {
    console.log('DynamicSky._selfCheck:', DynamicSky._selfCheck());
  }

  global.DynamicSky = DynamicSky;
})(typeof window !== 'undefined' ? window : this);

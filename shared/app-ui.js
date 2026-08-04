/* ============================================================
   小学校外国語アプリ 共通デザインキット — app-ui.js
   小学校3〜6年生向け外国語学習アプリ集(English App Portal)

   依存ゼロ・ビルド不要のプレーンJS(ES2018程度)。
   読み込むと window.AppUI が使えるようになります。

   使い方(各アプリの <head> 末尾 or <body> 内で):
     <script src="../shared/app-ui.js"></script>
     <script>
       AppUI.sfx.correct();
       AppUI.speak("Hello!");
       const img = AppUI.cardImg("cat.jpg", "🐱");
     </script>

   注意: このファイルは効果音・紙吹雪・読み上げ・カード画像・モーダル・
   保存・乱数ユーティリティを提供しますが、"自動再生"は一切しません。
   呼ばれたときだけ音・演出が発生する設計です(自動読み上げ禁止)。
   ============================================================ */
(function (global) {
  'use strict';

  /* ============================================================
     0. 読み上げの声をそろえる(共通ロジックを自動で内蔵)
     ------------------------------------------------------------
     声を指定しないと端末既定の聞き取りにくい声になることがあるため、
     speechSynthesis.speak をラップし、聞き取りやすい声を優先して選ぶ。
     ・すでに voice が指定された発話はそのまま通す
     ・synth.__appUIVoicePatched フラグで多重ラップを防止
     ・仮に他コードが同種のラップを重ねても "!u.voice" の判定により
       二重に声を割り当てることはなく安全
     ============================================================ */
  (function patchVoice() {
    if (!('speechSynthesis' in global)) return;
    var synth = global.speechSynthesis;
    if (synth.__appUIVoicePatched) return;

    var voices = [];
    function load() {
      try { voices = synth.getVoices() || []; } catch (e) { voices = []; }
    }
    load();
    try { synth.addEventListener('voiceschanged', load); } catch (e) {}

    function pickVoice(lang) {
      if (!voices.length) load();
      var base = String(lang || 'en-US').split('-')[0].toLowerCase();
      var cand = voices.filter(function (v) {
        return v.lang && v.lang.replace('_', '-').toLowerCase().indexOf(base) === 0;
      });
      if (!cand.length) return null;
      function byName(re) {
        for (var i = 0; i < cand.length; i++) { if (re.test(cand[i].name)) return cand[i]; }
        return null;
      }
      if (base === 'en') {
        return byName(/Google US English/i)
          || byName(/Google UK English Female/i)
          || byName(/Samantha/i)
          || byName(/Ava|Allison|Kate/i)
          || cand.filter(function (v) { return v.lang.replace('_', '-') === 'en-US'; })[0]
          || cand[0];
      }
      return byName(/Google/i) || cand[0];
    }

    var orig = synth.speak.bind(synth);
    synth.speak = function (u) {
      try { if (u && !u.voice) { var v = pickVoice(u.lang); if (v) u.voice = v; } } catch (e) {}
      return orig(u);
    };
    synth.__appUIVoicePatched = true;
    global.__appUIPickVoice = pickVoice; // 内部利用/デバッグ用
  })();

  function speak(text, opts) {
    opts = opts || {};
    try {
      if (!('speechSynthesis' in global) || !text) return;
      var u = new SpeechSynthesisUtterance(String(text));
      u.lang = opts.lang || 'en-US';
      u.rate = (typeof opts.rate === 'number') ? opts.rate : 0.85;
      if (typeof opts.pitch === 'number') u.pitch = opts.pitch;
      global.speechSynthesis.cancel();
      global.speechSynthesis.speak(u);
    } catch (e) {}
  }
  function speakSlow(text, opts) {
    opts = opts || {};
    var merged = {};
    for (var k in opts) merged[k] = opts[k];
    merged.rate = (typeof opts.rate === 'number') ? opts.rate : 0.6;
    speak(text, merged);
  }

  /* ============================================================
     1. 効果音(WebAudio 合成 / 音声ファイル不要)
     ============================================================ */
  var _actx = null;
  function actx() {
    if (_actx) return _actx;
    try { _actx = new (global.AudioContext || global.webkitAudioContext)(); }
    catch (e) { _actx = null; }
    return _actx;
  }
  function unlockAudio() {
    var c = actx();
    if (c && c.state === 'suspended') { c.resume().catch(function () {}); }
  }
  ['pointerdown', 'touchstart', 'keydown'].forEach(function (evt) {
    try { document.addEventListener(evt, unlockAudio, { passive: true }); } catch (e) {}
  });

  function tone(c, o) {
    if (!c) return;
    o = o || {};
    var t0 = c.currentTime + (o.start || 0);
    var dur = o.dur || 0.15;
    var attack = (o.attack != null) ? o.attack : 0.006;
    var release = (o.release != null) ? o.release : 0.06;
    var osc = c.createOscillator();
    var gain = c.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.freq || 440, t0);
    if (o.glide) { osc.frequency.exponentialRampToValueAtTime(o.glide, t0 + dur); }
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(Math.max(o.peak || 0.2, 0.001), t0 + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + release);
    osc.connect(gain).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + release + 0.03);
  }

  var _noiseBuf = null;
  function noiseBuffer(c) {
    if (_noiseBuf) return _noiseBuf;
    var len = Math.floor(c.sampleRate * 0.3);
    var buf = c.createBuffer(1, len, c.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) { data[i] = (Math.random() * 2 - 1) * (1 - i / len); }
    _noiseBuf = buf;
    return buf;
  }
  function noiseHit(c, t0, dur, peak, freq) {
    var src = c.createBufferSource();
    src.buffer = noiseBuffer(c);
    var filt = c.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.value = freq || 1400;
    filt.Q.value = 0.9;
    var gain = c.createGain();
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.001), t0 + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filt).connect(gain).connect(c.destination);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  var sfx = {
    tap: function () {
      var c = actx(); if (!c) return; unlockAudio();
      tone(c, { freq: 820, dur: 0.05, type: 'sine', peak: 0.16, release: 0.03 });
    },
    pop: function () {
      var c = actx(); if (!c) return; unlockAudio();
      tone(c, { freq: 320, glide: 720, dur: 0.11, type: 'sine', peak: 0.22, release: 0.04 });
    },
    tick: function () {
      var c = actx(); if (!c) return; unlockAudio();
      tone(c, { freq: 1000, dur: 0.035, type: 'square', peak: 0.1, release: 0.02 });
    },
    correct: function () {
      // ピンポン(クイズ正解音): 上がる2音のチャイム
      var c = actx(); if (!c) return; unlockAudio();
      tone(c, { freq: 784, dur: 0.15, type: 'triangle', peak: 0.22, start: 0 });
      tone(c, { freq: 1046.5, dur: 0.26, type: 'triangle', peak: 0.24, start: 0.13 });
    },
    wrong: function () {
      // ブブー(控えめな不正解音): 低めのやわらかいブザー2発
      var c = actx(); if (!c) return; unlockAudio();
      var filt = c.createBiquadFilter();
      filt.type = 'lowpass'; filt.frequency.value = 900;
      var mkBuzz = function (start) {
        var t0 = c.currentTime + start;
        var osc = c.createOscillator();
        var gain = c.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(190, t0);
        osc.frequency.linearRampToValueAtTime(150, t0 + 0.16);
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(0.14, t0 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
        osc.connect(filt).connect(gain).connect(c.destination);
        osc.start(t0); osc.stop(t0 + 0.2);
      };
      filt.connect(c.destination);
      mkBuzz(0);
      mkBuzz(0.19);
    },
    fanfare: function () {
      var c = actx(); if (!c) return; unlockAudio();
      var notes = [523.25, 659.25, 784.0, 1046.5]; // C5 E5 G5 C6
      notes.forEach(function (f, i) {
        tone(c, { freq: f, dur: 0.14, type: 'triangle', peak: 0.2, start: i * 0.11 });
      });
      tone(c, { freq: 1046.5, dur: 0.5, type: 'sine', peak: 0.22, start: notes.length * 0.11, release: 0.25 });
      tone(c, { freq: 1318.5, dur: 0.5, type: 'sine', peak: 0.16, start: notes.length * 0.11, release: 0.25 });
    },
    drumroll: function (durationMs) {
      var c = actx(); if (!c) return; unlockAudio();
      var dur = Math.max(200, durationMs || 1200);
      var step = 0.055;
      var t0 = c.currentTime;
      for (var t = 0; t < dur / 1000; t += step) {
        noiseHit(c, t0 + t, 0.09, 0.14, 1500);
      }
      tone(c, { freq: 1200, dur: 0.05, type: 'square', peak: 0.22, start: dur / 1000 });
      tone(c, { freq: 1800, dur: 0.35, type: 'triangle', peak: 0.2, start: dur / 1000 + 0.02, release: 0.3 });
    }
  };

  /* ============================================================
     2. 紙吹雪 / 星エフェクト
     ============================================================ */
  function confetti(opts) {
    opts = opts || {};
    var durationMs = opts.durationMs || 2200;
    var count = opts.count || 140;
    var canvas = document.createElement('canvas');
    canvas.className = 'app-confetti-canvas';
    canvas.style.position = 'fixed';
    canvas.style.left = '0';
    canvas.style.top = '0';
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '9999';
    document.body.appendChild(canvas);
    var dpr = global.devicePixelRatio || 1;
    function resize() {
      canvas.width = Math.floor(global.innerWidth * dpr);
      canvas.height = Math.floor(global.innerHeight * dpr);
    }
    resize();
    global.addEventListener('resize', resize);
    var ctx2d = canvas.getContext('2d');
    var colors = ['#00cec9', '#ff7675', '#74b9ff', '#fdcb6e', '#a29bfe', '#55efc4', '#ffa502', '#2ed573', '#ff4757', '#2e86de'];
    var pieces = [];
    for (var i = 0; i < count; i++) {
      pieces.push({
        x: Math.random() * global.innerWidth,
        y: -20 - Math.random() * global.innerHeight * 0.6,
        w: 6 + Math.random() * 6,
        h: 8 + Math.random() * 10,
        color: colors[(Math.random() * colors.length) | 0],
        rot: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 0.26,
        vy: 2 + Math.random() * 3,
        vx: (Math.random() - 0.5) * 2,
        shape: Math.random() < 0.5 ? 'rect' : 'circle'
      });
    }
    var start = null;
    var raf = null;
    function frame(now) {
      if (start === null) start = now;
      var elapsed = now - start;
      ctx2d.clearRect(0, 0, canvas.width, canvas.height);
      ctx2d.save();
      ctx2d.scale(dpr, dpr);
      for (var j = 0; j < pieces.length; j++) {
        var p = pieces[j];
        p.x += p.vx; p.y += p.vy; p.rot += p.vRot;
        ctx2d.save();
        ctx2d.translate(p.x, p.y);
        ctx2d.rotate(p.rot);
        ctx2d.fillStyle = p.color;
        if (p.shape === 'rect') { ctx2d.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); }
        else { ctx2d.beginPath(); ctx2d.arc(0, 0, p.w / 2, 0, Math.PI * 2); ctx2d.fill(); }
        ctx2d.restore();
      }
      ctx2d.restore();
      if (elapsed < durationMs) { raf = global.requestAnimationFrame(frame); }
      else { cleanup(); }
    }
    function cleanup() {
      if (raf) global.cancelAnimationFrame(raf);
      global.removeEventListener('resize', resize);
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    }
    raf = global.requestAnimationFrame(frame);
    return { stop: cleanup };
  }

  function stars(x, y, opts) {
    opts = opts || {};
    var n = opts.count || 8;
    try {
      for (var i = 0; i < n; i++) {
        (function (i) {
          var el = document.createElement('span');
          el.textContent = Math.random() < 0.5 ? '⭐' : '✨';
          el.style.position = 'fixed';
          el.style.left = x + 'px';
          el.style.top = y + 'px';
          el.style.fontSize = (14 + Math.random() * 14) + 'px';
          el.style.pointerEvents = 'none';
          el.style.zIndex = '9999';
          el.style.transform = 'translate(-50%,-50%)';
          document.body.appendChild(el);
          var angle = (Math.PI * 2 * i / n) + Math.random() * 0.6;
          var dist = 40 + Math.random() * 50;
          var dx = Math.cos(angle) * dist, dy = Math.sin(angle) * dist;
          var rot = (Math.random() * 180 - 90) | 0;
          if (el.animate) {
            var anim = el.animate([
              { transform: 'translate(-50%,-50%) translate(0,0) scale(0.4) rotate(0deg)', opacity: 1 },
              { transform: 'translate(-50%,-50%) translate(' + dx + 'px,' + dy + 'px) scale(1.1) rotate(' + rot + 'deg)', opacity: 0 }
            ], { duration: 650 + Math.random() * 250, easing: 'cubic-bezier(.22,.61,.36,1)' });
            anim.onfinish = function () { if (el.parentNode) el.parentNode.removeChild(el); };
          } else {
            setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 700);
          }
        })(i);
      }
    } catch (e) {}
  }

  /* ============================================================
     3. 絵カード画像(Picture Dictionary 画像 + 絵文字フォールバック)
     ============================================================ */
  var IMG_BASE = 'https://edupower07.github.io/PictureDictionary/images/';
  function cardImg(imgFileName, emojiFallback) {
    if (!imgFileName) {
      var s0 = document.createElement('span');
      s0.className = 'app-card-emoji';
      s0.textContent = emojiFallback || '❓';
      return s0;
    }
    var img = document.createElement('img');
    img.src = IMG_BASE + encodeURIComponent(imgFileName);
    img.alt = imgFileName;
    img.loading = 'lazy';
    img.onerror = function () {
      var span = document.createElement('span');
      span.className = 'app-card-emoji';
      span.textContent = emojiFallback || '❓';
      try {
        if (img.parentNode) img.parentNode.replaceChild(span, img);
      } catch (e) {}
    };
    return img;
  }

  /* ============================================================
     4. モーダル: 使い方 / 正解・クリア演出
     ============================================================ */
  var _helpModal = null;
  function ensureHelpModal() {
    if (_helpModal) return _helpModal;
    var modal = document.createElement('div');
    modal.className = 'app-help-modal';
    modal.innerHTML =
      '<div class="app-help-panel" role="dialog" aria-modal="true" aria-label="つかいかた">' +
      '<button type="button" class="app-help-close" aria-label="閉じる">&times;</button>' +
      '<div class="app-help-title"><span aria-hidden="true">📖</span><span class="app-help-title-text">つかいかた</span></div>' +
      '<div class="app-help-body"></div>' +
      '</div>';
    document.body.appendChild(modal);
    modal.addEventListener('click', function (e) { if (e.target === modal) hideHelp(); });
    modal.querySelector('.app-help-close').addEventListener('click', hideHelp);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modal.classList.contains('show')) hideHelp();
    });
    _helpModal = modal;
    return modal;
  }
  function showHelp(htmlString, opts) {
    opts = opts || {};
    var modal = ensureHelpModal();
    modal.querySelector('.app-help-title-text').textContent = opts.title || 'つかいかた';
    modal.querySelector('.app-help-body').innerHTML = htmlString || '';
    modal.classList.add('show');
  }
  function hideHelp() {
    if (_helpModal) _helpModal.classList.remove('show');
  }

  var _overlay = null;
  var _celebrateTimer = null;
  function ensureOverlay() {
    if (_overlay) return _overlay;
    var overlay = document.createElement('div');
    overlay.className = 'app-overlay';
    overlay.innerHTML =
      '<div class="app-overlay-card">' +
      '<div class="app-overlay-icon">🎉</div>' +
      '<div class="app-overlay-title"></div>' +
      '<div class="app-overlay-sub"></div>' +
      '</div>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) hideCelebrate();
    });
    _overlay = overlay;
    return overlay;
  }
  function celebrate(opts) {
    opts = opts || {};
    var overlay = ensureOverlay();
    var card = overlay.querySelector('.app-overlay-card');
    overlay.querySelector('.app-overlay-icon').textContent = opts.icon || '🎉';
    overlay.querySelector('.app-overlay-title').textContent = opts.title || 'よくできました!';
    var subEl = overlay.querySelector('.app-overlay-sub');
    if (opts.sub) { subEl.textContent = opts.sub; subEl.style.display = ''; }
    else { subEl.textContent = ''; subEl.style.display = 'none'; }
    overlay.classList.add('show');
    card.classList.remove('app-anim-pop');
    void card.offsetWidth; // reflow でアニメーションを再スタート
    card.classList.add('app-anim-pop');
    if (opts.sfx !== false) { try { sfx.fanfare(); } catch (e) {} }
    if (opts.confetti !== false) { try { confetti({ durationMs: opts.confettiMs || 2200 }); } catch (e) {} }
    clearTimeout(_celebrateTimer);
    var autoHide = (typeof opts.autoHideMs === 'number') ? opts.autoHideMs : 2800;
    if (autoHide > 0) { _celebrateTimer = setTimeout(hideCelebrate, autoHide); }
    return { close: hideCelebrate };
  }
  function hideCelebrate() {
    if (_overlay) _overlay.classList.remove('show');
    clearTimeout(_celebrateTimer);
  }

  /* ============================================================
     5. 保存(localStorage ラッパー)
     ============================================================ */
  function store(key) {
    return {
      get: function (def) {
        try {
          var raw = global.localStorage.getItem(key);
          if (raw === null || raw === undefined) return def;
          return JSON.parse(raw);
        } catch (e) { return def; }
      },
      set: function (v) {
        try { global.localStorage.setItem(key, JSON.stringify(v)); return true; }
        catch (e) { return false; }
      },
      remove: function () {
        try { global.localStorage.removeItem(key); return true; }
        catch (e) { return false; }
      }
    };
  }

  /* ============================================================
     6. 乱数ユーティリティ / カウントダウン
     ============================================================ */
  function shuffle(arr) {
    var a = Array.prototype.slice.call(arr || []);
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function pick(arr) {
    if (!arr || !arr.length) return undefined;
    return arr[Math.floor(Math.random() * arr.length)];
  }
  function countdown(el, sec, onEnd, opts) {
    opts = opts || {};
    var remaining = Math.max(0, sec | 0);
    var format = opts.format || function (n) { return String(n); };
    if (el) el.textContent = format(remaining);
    if (remaining <= 0) {
      if (typeof onEnd === 'function') { try { onEnd(); } catch (e) {} }
      return { stop: function () {} };
    }
    var id = setInterval(function () {
      remaining--;
      if (el) el.textContent = format(remaining);
      if (remaining > 0 && opts.sound !== false) { try { sfx.tick(); } catch (e) {} }
      if (remaining <= 0) {
        clearInterval(id);
        if (typeof onEnd === 'function') { try { onEnd(); } catch (e) {} }
      }
    }, 1000);
    return { stop: function () { clearInterval(id); } };
  }

  /* ============================================================
     公開API
     ============================================================ */
  var AppUI = {
    IMG_BASE: IMG_BASE,
    sfx: sfx,
    confetti: confetti,
    stars: stars,
    speak: speak,
    speakSlow: speakSlow,
    cardImg: cardImg,
    help: showHelp,
    hideHelp: hideHelp,
    celebrate: celebrate,
    hideCelebrate: hideCelebrate,
    store: store,
    shuffle: shuffle,
    pick: pick,
    countdown: countdown
  };

  global.AppUI = AppUI;
})(typeof window !== 'undefined' ? window : this);

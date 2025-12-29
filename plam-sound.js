// plam-sound.js?v=5
console.info('[sound] init v5');

if (window.__PLAM_SOUND_INIT__) {
  console.warn('[sound] already initialized');
} else {
  window.__PLAM_SOUND_INIT__ = true;

  const KEY_ENABLED = 'plam_ambient_enabled_v1';
  const KEY_VOLUME  = 'plam_ambient_volume_v1';
  const KEY_POS     = 'plam_ambient_pos_v1';   // для бесшовного продолжения
  const SRC = 'bgicons/forest-at-night-after-sunset.mp3';

  let audio = null;
  let unlocked = false;
  let saveTimer = null;

  function isEnabled() {
    // по умолчанию ВЫКЛ
    return (localStorage.getItem(KEY_ENABLED) ?? '0') === '1';
  }

  function getVolume() {
    const v = Number(localStorage.getItem(KEY_VOLUME));
    return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.35;
  }

  function savePosOnce() {
    if (!audio) return;
    try {
      const t = Number(audio.currentTime);
      if (Number.isFinite(t) && t >= 0) localStorage.setItem(KEY_POS, String(t));
    } catch (_) {}
  }

  function startSavingPos() {
    if (saveTimer) return;
    saveTimer = setInterval(savePosOnce, 1000);
  }

  function stopSavingPos() {
    if (!saveTimer) return;
    clearInterval(saveTimer);
    saveTimer = null;
  }

  function restorePosWhenReady() {
    if (!audio) return;
    const raw = localStorage.getItem(KEY_POS);
    const pos = Number(raw);
    if (!Number.isFinite(pos) || pos < 0) return;

    const apply = () => {
      try {
        const d = Number(audio.duration);
        if (Number.isFinite(d) && d > 0) {
          audio.currentTime = pos % d; // бесшовно по кругу
        }
      } catch (_) {}
    };

    if (audio.readyState >= 1) apply();
    else audio.addEventListener('loadedmetadata', apply, { once: true });
  }

  function ensureAudio() {
    if (audio) return audio;

    audio = new Audio(SRC);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = getVolume();

    // Telegram/Android/iOS friendly
    try { audio.playsInline = true; } catch(_) {}
    try { audio.setAttribute('playsinline', ''); } catch(_) {}
    try { audio.setAttribute('webkit-playsinline', ''); } catch(_) {}

    audio.addEventListener('error', () => {
      console.warn('[sound] audio error', audio?.error, 'src=', SRC);
      try { window.__plamSoundLastError = 'audio error: ' + String(audio?.error?.code || 'unknown'); } catch(_) {}
    });

    restorePosWhenReady();

    // иногда помогает на Android/WebView
    try { audio.load(); } catch(_) {}

    return audio;
  }

  async function play() {
    if (!unlocked) return;
    if (!isEnabled()) return;

    const a = ensureAudio();
    try {
      await a.play();
      startSavingPos();
      console.info('[sound] playing');
    } catch (e) {
      console.warn('[sound] play blocked', e);
      try { window.__plamSoundLastError = String(e && (e.name || e.message) || e); } catch(_) {}
    }
  }

  function stop() {
    if (!audio) return;
    savePosOnce();
    stopSavingPos();
    try { audio.pause(); } catch (_) {}
    // currentTime НЕ сбрасываем, чтобы продолжать бесшовно
  }

  function setEnabled(on) {
    localStorage.setItem(KEY_ENABLED, on ? '1' : '0');
    updateAllToggles();
    if (!on) stop();
    else play();
    try { console.info('[sound] enabled=', on, 'unlocked=', unlocked); } catch(_) {}
  }

  // UI (тумблер в профиле)
  function updateToggleByWrap(wrap) {
    if (!wrap) return;
    const btnOn  = wrap.querySelector('[data-sound-target="on"]');
    const btnOff = wrap.querySelector('[data-sound-target="off"]');
    if (!btnOn || !btnOff) return;

    const on = isEnabled();
    btnOn.classList.toggle('is-active', on);
    btnOff.classList.toggle('is-active', !on);

    btnOn.setAttribute('aria-selected', on ? 'true' : 'false');
    btnOff.setAttribute('aria-selected', !on ? 'true' : 'false');
  }

  function bindWrap(wrap) {
    if (!wrap) return;
    if (wrap.dataset.bound === '1') {
      updateToggleByWrap(wrap);
      return;
    }
    wrap.dataset.bound = '1';

    wrap.addEventListener('click', (e) => {
      const btn = e.target && e.target.closest ? e.target.closest('[data-sound-target]') : null;
      if (!btn) return;

      // клик по тумблеру = жест → разлочка
      unlocked = true;
      ensureAudio();

      const val = btn.getAttribute('data-sound-target');
      setEnabled(val === 'on');

      // пробуем стартануть прямо внутри клика
      play();
    });

    updateToggleByWrap(wrap);
  }

  function updateAllToggles() {
    document.querySelectorAll('[data-sound-switch]').forEach(bindWrap);
  }

  // Разлочка по первому жесту на странице
  // (важно для fortune.html, где тумблера может не быть)
  function unlockOnce() {
    const onFirstGesture = () => {
      unlocked = true;
      ensureAudio();
      play();
      cleanup();
    };

    const cleanup = () => {
      document.removeEventListener('pointerdown', onFirstGesture, true);
      document.removeEventListener('touchstart', onFirstGesture, true);
      document.removeEventListener('keydown', onFirstGesture, true);
      document.removeEventListener('click', onFirstGesture, true);
    };

    document.addEventListener('pointerdown', onFirstGesture, true);
    document.addEventListener('touchstart', onFirstGesture, true);
    document.addEventListener('keydown', onFirstGesture, true);
    // ✅ Android/WebView часто надёжнее всего ловит именно click
    document.addEventListener('click', onFirstGesture, true);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      savePosOnce();
      stop();
    } else {
      play();
    }
  });

  // Автопривязка тумблера когда вставится модалка
  const mo = new MutationObserver(() => updateAllToggles());
  try { mo.observe(document.documentElement, { childList: true, subtree: true }); } catch (_) {}

  unlockOnce();
  updateAllToggles();

  window.PlamSound = {
    isEnabled,
    setEnabled,
    play,
    stop,
    ensureAudio,
    updateAllToggles,
  };
}

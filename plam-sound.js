// plam-sound.js?v=3
console.info('[sound] init v3');

if (window.__PLAM_SOUND_INIT__) {
  console.warn('[sound] already initialized');
} else {
  window.__PLAM_SOUND_INIT__ = true;

  const KEY_ENABLED = 'plam_ambient_enabled_v1';
  const KEY_VOLUME  = 'plam_ambient_volume_v1';
  const SRC = 'bgicons/forest-at-night-after-sunset.mp3';

  let audio = null;
  let unlocked = false;

  function isEnabled() {
  // по умолчанию ВЫКЛ, если ключа ещё нет
  return (localStorage.getItem(KEY_ENABLED) ?? '0') === '1';
  }

  function getVolume() {
    const v = Number(localStorage.getItem(KEY_VOLUME));
    return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.35;
  }

  function ensureAudio() {
    if (audio) return audio;

    audio = new Audio(SRC);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = getVolume();

    audio.addEventListener('error', () => {
      console.warn('[sound] audio error', audio?.error, 'src=', SRC);
    });

    return audio;
  }

  async function play() {
    if (!unlocked) return;
    if (!isEnabled()) return;

    const a = ensureAudio();
    try {
      await a.play();
      console.info('[sound] playing');
    } catch (e) {
      console.warn('[sound] play blocked', e);
    }
  }

  function stop() {
    if (!audio) return;
    try { audio.pause(); } catch (_) {}
    try { audio.currentTime = 0; } catch (_) {}
  }

  function setEnabled(on) {
    localStorage.setItem(KEY_ENABLED, on ? '1' : '0');
    updateAllToggles();
    if (!on) stop();
    else play();
  }

  // UI
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

      // ВАЖНО: клик по тумблеру = “жест”, разлочиваем тут же
      unlocked = true;
      ensureAudio();

      const val = btn.getAttribute('data-sound-target');
      setEnabled(val === 'on');

      // попробуем стартануть прямо внутри клика (самый надёжный способ)
      play();
    });

    updateToggleByWrap(wrap);
  }

  function updateAllToggles() {
    document.querySelectorAll('[data-sound-switch]').forEach(bindWrap);
  }

  // fallback unlock (на всякий)
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
    };
    document.addEventListener('pointerdown', onFirstGesture, true);
    document.addEventListener('touchstart', onFirstGesture, true);
    document.addEventListener('keydown', onFirstGesture, true);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else play();
  });

  // Автопривязка при появлении модалки
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

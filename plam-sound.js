// plam-sound.js?v=2
console.info('[sound] init v2');

if (window.__PLAM_SOUND_INIT__) {
  console.warn('[sound] already initialized');
} else {
  window.__PLAM_SOUND_INIT__ = true;

  const KEY_ENABLED = 'plam_ambient_enabled_v1';
  const KEY_VOLUME  = 'plam_ambient_volume_v1';
  const SRC = '/assets/sounds/nature.mp3';

  let audio = null;
  let unlocked = false;

  function isEnabled() {
    return (localStorage.getItem(KEY_ENABLED) ?? '1') === '1';
  }

  function ensureAudio() {
    if (audio) return audio;
    audio = new Audio(SRC);
    audio.loop = true;
    audio.preload = 'auto';
    const v = Number(localStorage.getItem(KEY_VOLUME));
    audio.volume = Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.35;
    return audio;
  }

  async function play() {
    if (!unlocked) return;
    if (!isEnabled()) return;
    const a = ensureAudio();
    try { await a.play(); } catch (_) {}
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
      const val = btn.getAttribute('data-sound-target');
      setEnabled(val === 'on');
    });

    updateToggleByWrap(wrap);
  }

  function updateAllToggles() {
    document.querySelectorAll('[data-sound-switch]').forEach(bindWrap);
  }

  // Разлочка аудио только после жеста пользователя
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

  // Автопривязка, когда модалка профиля вставится в DOM
  const mo = new MutationObserver(() => {
    // дешево и надежно: просто обновляем/привязываем все найденные
    updateAllToggles();
  });

  try {
    mo.observe(document.documentElement, { childList: true, subtree: true });
  } catch (_) {}

  unlockOnce();
  // на всякий случай сразу синкнем (если уже есть в DOM)
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

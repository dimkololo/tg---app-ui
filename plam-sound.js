// plam-sound.js?v=1
console.info('[sound] init v1');

if (window.__PLAM_SOUND_INIT__) console.warn('[sound] already initialized');
else {
  window.__PLAM_SOUND_INIT__ = true;

  const KEY_ENABLED = 'plam_ambient_enabled_v1';
  const KEY_VOLUME  = 'plam_ambient_volume_v1';

  // Положи файл сюда (см. ниже в конце ответа):
  const SRC = 'bgicons/forest-at-night-after-sunset.mp3';

  let audio = null;
  let unlocked = false;

  function isEnabled() {
    // по умолчанию ВКЛ
    return (localStorage.getItem(KEY_ENABLED) ?? '1') === '1';
  }

  function ensureAudio() {
    if (audio) return audio;
    audio = new Audio(SRC);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = Number(localStorage.getItem(KEY_VOLUME) ?? 0.35);
    return audio;
  }

  async function play() {
    if (!unlocked) return;
    if (!isEnabled()) return;
    const a = ensureAudio();
    try { await a.play(); } catch (e) { /* iOS/Telegram может заблокировать до жеста */ }
  }

  function stop() {
    if (!audio) return;
    try { audio.pause(); } catch(_) {}
    try { audio.currentTime = 0; } catch(_) {}
  }

  function setEnabled(on) {
    localStorage.setItem(KEY_ENABLED, on ? '1' : '0');
    updateAllToggles();
    if (!on) stop();
    else play();
  }

  function setVolume(v) {
    v = Math.max(0, Math.min(1, Number(v)));
    localStorage.setItem(KEY_VOLUME, String(v));
    ensureAudio().volume = v;
  }

  // UI: делаем активную кнопку как у RU/ENG
  function updateToggle(root) {
    root = root || document;
    const wrap = root.querySelector('[data-sound-switch]');
    if (!wrap) return;

    const btnOn  = wrap.querySelector('[data-sound="on"]');
    const btnOff = wrap.querySelector('[data-sound="off"]');
    if (!btnOn || !btnOff) return;

    const on = isEnabled();
    btnOn.classList.toggle('is-active', on);
    btnOff.classList.toggle('is-active', !on);
  }

  function updateAllToggles() {
    document.querySelectorAll('[data-sound-switch]').forEach(wrap => updateToggle(wrap.parentElement || document));
  }

  function bindProfile(root) {
    root = root || document;
    const wrap = root.querySelector('[data-sound-switch]');
    if (!wrap) return;

    if (wrap.dataset.bound === '1') {
      updateToggle(root);
      return;
    }
    wrap.dataset.bound = '1';

    wrap.addEventListener('click', (e) => {
      const btn = e.target && e.target.closest ? e.target.closest('[data-sound]') : null;
      if (!btn) return;
      const val = btn.getAttribute('data-sound');
      setEnabled(val === 'on');
    });

    updateToggle(root);
  }

  // Разлочка аудио только после жеста пользователя
  function unlockOnce() {
    const onFirstGesture = () => {
      unlocked = true;
      // пробуем прогреть audio, чтобы быстрее стартовало
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

  // Пауза при сворачивании
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else play();
  });

  unlockOnce();

  // Экспорт
  window.PlamSound = {
    isEnabled,
    setEnabled,
    setVolume,
    bindProfile,
    updateToggle,
    play,
    stop,
    ensureAudio,
  };
}

// plam-sound.js?v=1
console.info('[sound] init v1');

if (window.__PLAM_SOUND_INIT__) {
  console.warn('[sound] already initialized');
} else {
  window.__PLAM_SOUND_INIT__ = true;

  // === настройки/ключи ===
  const KEY_ENABLED = 'plam_ambient_enabled_v1';
  const KEY_VOLUME  = 'plam_ambient_volume_v1';

  // Путь к файлу фонового звука
  // Положи файл сюда: /assets/sounds/nature.mp3
  const SRC = '/bgicons/forest-at-night-after-sunset.mp3';

  let audio = null;
  let unlocked = false;

  // === state ===
  function isEnabled() {
    // по умолчанию включено
    return (localStorage.getItem(KEY_ENABLED) ?? '1') === '1';
  }

  function setEnabled(on) {
    localStorage.setItem(KEY_ENABLED, on ? '1' : '0');
    updateAllToggles();
    if (!on) stop();
    else play();
  }

  function getVolume() {
    const v = Number(localStorage.getItem(KEY_VOLUME));
    if (Number.isFinite(v)) return Math.max(0, Math.min(1, v));
    return 0.35;
  }

  function setVolume(v) {
    v = Math.max(0, Math.min(1, Number(v)));
    localStorage.setItem(KEY_VOLUME, String(v));
    ensureAudio().volume = v;
  }

  // === audio ===
  function ensureAudio() {
    if (audio) return audio;
    audio = new Audio(SRC);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = getVolume();
    return audio;
  }

  async function play() {
    if (!unlocked) return;
    if (!isEnabled()) return;

    const a = ensureAudio();
    try {
      await a.play();
    } catch (_) {
      // На iOS/Telegram иногда нужно ещё одно действие пользователя — игнорируем
    }
  }

  function stop() {
    if (!audio) return;
    try { audio.pause(); } catch (_) {}
    try { audio.currentTime = 0; } catch (_) {}
  }

  // === UI ===
  // Делаем активную кнопку как у RU/ENG: is-active + aria-selected
  function updateToggle(root) {
    root = root || document;
    const wrap = root.querySelector('[data-sound-switch]');
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

  function updateAllToggles() {
    document.querySelectorAll('[data-sound-switch]').forEach((wrap) => {
      // можно обновлять от родителя (или document) — главное, чтобы wrap был внутри
      updateToggle(wrap.parentElement || document);
    });
  }

  function bindProfile(root) {
    root = root || document;
    const wrap = root.querySelector('[data-sound-switch]');
    if (!wrap) return;

    // не вешаем обработчик повторно
    if (wrap.dataset.bound === '1') {
      updateToggle(root);
      return;
    }
    wrap.dataset.bound = '1';

    wrap.addEventListener('click', (e) => {
      const btn = e.target && e.target.closest ? e.target.closest('[data-sound-target]') : null;
      if (!btn) return;

      const val = btn.getAttribute('data-sound-target');
      setEnabled(val === 'on');
    });

    updateToggle(root);
  }

  // === unlock (автовоспроизведение запрещено — нужно действие пользователя) ===
  function unlockOnce() {
    const onFirstGesture = () => {
      unlocked = true;
      // прогреваем и пытаемся стартануть (если включено)
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

  // пауза при сворачивании
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else play();
  });

  // старт
  unlockOnce();

  // экспорт наружу
  window.PlamSound = {
    isEnabled,
    setEnabled,
    getVolume,
    setVolume,
    bindProfile,
    updateToggle,
    updateAllToggles,
    play,
    stop,
    ensureAudio,
  };
}

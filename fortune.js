// ========== fortune.js — TEST no-cooldown build (fortune-build-2025-11-14T23:59Z-noCD-v4-haptics) ==========
console.info('[fortune] BUILD', 'fortune-build-2025-11-14T23:59Z-noCD-v4-haptics');

if (window.__PLAM_FORTUNE_INIT__) { console.warn('fortune.js already initialized'); }
else { window.__PLAM_FORTUNE_INIT__ = true;
// проверка на повторный запуск скрипта
}

// fortune.js (или внутри скрипта на fortune.html)
function i18nApplyLocal(){
  try { window.i18n && window.i18n.apply && i18n.apply(document); } catch(_) {}
}

// локальный T-хелпер
function Tlocal(key, fallback, vars){
  try {
    if (window.i18n && typeof window.i18n.t === 'function') {
      const s = i18n.t(key, vars);
      if (s) return s;
    }
  } catch(_) {}
  if (!fallback) return '';
  if (!vars) return fallback;
  return String(fallback).replace(/\{\{(\w+)\}\}/g, (_, k) => (k in vars ? String(vars[k]) : ''));
}

document.addEventListener('DOMContentLoaded', () => {
  try { window.Telegram?.WebApp?.ready(); } catch(_) {}
  i18nApplyLocal();
});

window.addEventListener('storage', (e) => {
  if (e.key === 'plam_lang') {
    try { i18n.setLang(e.newValue); } catch(_) {}
    i18nApplyLocal();
  }
});

(function(){
  // --- LS helper ---
  const LS = {
    get(k, d = null) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
    remove(k) { try { localStorage.removeItem(k); } catch {} },
    getJSON(k, d = null) { const s = LS.get(k, null); if (s === null) return d; try { return JSON.parse(s); } catch { return d; } },
    setJSON(k, obj) { LS.set(k, JSON.stringify(obj)); },
    getNum(k, d = 0) { const n = parseInt(LS.get(k, ''), 10); return Number.isFinite(n) ? n : d; },
    setNum(k, n) { LS.set(k, String(n)); },
  };

  // --- Ключи (v2) ---
  const K = {
    BALANCE:           'plam_balance_v2',
    WHEEL_CD_UNTIL:    'fortune_cd_until_v2',
    WHEEL_ORDER:       'fortune_wheel_order_v2',
  };

  // --- КОНСТАНТЫ КОЛЕСА ---
  const VALUES    = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20];
  const SECTORS   = VALUES.length;
  const STEP      = 360 / SECTORS;    // 36°
  const SPIN_MS   = 7000;             // 7 секунд
  const ANGLE_OFFSET = 0;
  const TEST_MODE = true; // принудительный тест-режим
  const COOLDOWN_MS  = 0;

  // --- Миграция порядка ---
  try {
    const sess = sessionStorage.getItem('fortune_wheel_order_session');
    if (sess && !localStorage.getItem(K.WHEEL_ORDER)) localStorage.setItem(K.WHEEL_ORDER, sess);
  } catch {}

  // --- Полный сброс кулдауна на старте (и на всякий случай) ---
  try { localStorage.removeItem('fortune_cd_until'); } catch(_){}
  try { localStorage.removeItem(K.WHEEL_CD_UNTIL); } catch(_){}

  // --- Состояние/утилиты ---
  function getBalance(){ return LS.getNum(K.BALANCE, 0); }
  function setBalance(v){ LS.setNum(K.BALANCE, v); }
  function addToBalance(delta){ const next = getBalance() + delta; setBalance(next); return next; }

  function getCooldownUntil(){ return 0; } // тест: никогда нет кулдауна
  function setCooldownUntil(ts){ /* тест: игнор */ }
  function clearCooldown(){ try { localStorage.removeItem(K.WHEEL_CD_UNTIL); } catch(_) {} }

  function fmtLeft(ms){
    const s = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    return String(h).padStart(2,'0')+'ч. '+String(m).padStart(2,'0')+'мин. '+String(ss).padStart(2,'0')+'сек.';
  }

  // --- ЭЛЕМЕНТЫ ---
  const rotor =
    document.getElementById('wheelRotor') ||
    document.querySelector('.wheel-rotor') ||
    document.getElementById('wheelImg') ||
    document.querySelector('.wheel__img, .wheel-img');

  const numbersBox =
    document.getElementById('wheelNumbers') ||
    document.querySelector('.wheel__numbers');

  const btnSpin  = document.getElementById('btnSpin') || document.querySelector('.btn-spin');
  const btnBack  = document.getElementById('btnBack') || document.querySelector('.btn-back');
  const pointer  = document.querySelector('.wheel-pointer');
  const timerEl  = document.getElementById('fortuneTimer');

  if (!rotor || !btnSpin) {
    console.error('[fortune] Не найдено колесо или кнопка вращения.');
    return;
  }

  // --- Оверлей ориентации ---
  (function setupOrientationOverlay(){
    const lock = document.getElementById('orientationLock');
    if (!lock) return;
    const mq = window.matchMedia('(orientation: portrait)');
    const update = () => {
      const isPortrait = mq.matches || window.innerHeight >= window.innerWidth;
      lock.classList.toggle('is-active', !isPortrait);
      document.documentElement.style.overflow = !isPortrait ? 'hidden' : '';
    };
    update();
    try { mq.addEventListener('change', update); } catch(_){}
    window.addEventListener('orientationchange', update);
    window.addEventListener('resize', update);
  })();

  // --- Порядок чисел (LS) ---
  function shuffle(arr){
    const a = arr.slice();
    for (let i=a.length-1;i>0;i--){
      const j = Math.floor(Math.random()*(i+1));
      [a[i],a[j]] = [a[j],a[i]];
    }
    return a;
  }
  let order = LS.getJSON(K.WHEEL_ORDER);
  if (!order || order.length !== SECTORS) {
    order = shuffle(VALUES);
    LS.setJSON(K.WHEEL_ORDER, order);
  }

  // --- Рендер цифр ---
  if (numbersBox) {
    numbersBox.innerHTML = '';
    for (let i = 0; i < SECTORS; i++) {
      const span = document.createElement('span');
      span.className = 'wheel__label';
      span.textContent = order[i];
      const angle = ANGLE_OFFSET + i * STEP;
      span.style.setProperty('--a', angle + 'deg');
      numbersBox.appendChild(span);
    }
  }

  // --- Состояние кнопки/таймера ---
  let cdTimerId = null;
  function stopCooldownUI(){ if (cdTimerId){ clearInterval(cdTimerId); cdTimerId = null; } }
  function startCooldownUI(){
    // тест: таймер не показываем
    stopCooldownUI();
    if (timerEl) timerEl.hidden = true;
  }
  function isSpun(){ return false; } // тест: никогда не "крутили"
  function markSpun(){ /* тест: не ставим кулдаун */ }

  function updateUI(){
    btnSpin.removeAttribute('disabled');
    stopCooldownUI();
    if (timerEl) timerEl.hidden = true;
  }
  updateUI();

  // ====== ХАПТИКИ (усиленный драйвер) ======
  const HAPTICS = {
    provider: 'none',
    init() {
      const H = window.Telegram?.WebApp?.HapticFeedback;
      if (H && typeof H.impactOccurred === 'function') this.provider = 'tg';
      else if ('vibrate' in navigator) this.provider = 'vibrate';
      console.info('[haptics] provider=', this.provider, 'platform=', window.Telegram?.WebApp?.platform, 'version=', window.Telegram?.WebApp?.version);
    },
    impact(style='medium') {
      if (this.provider === 'tg') { try { window.Telegram.WebApp.HapticFeedback.impactOccurred(style); } catch(_) {} }
      else if (this.provider === 'vibrate') { try { navigator.vibrate(20); } catch(_) {} }
    },
    selection() {
      if (this.provider === 'tg') { try { window.Telegram.WebApp.HapticFeedback.selectionChanged(); } catch(_) {} }
      else if (this.provider === 'vibrate') { try { navigator.vibrate(10); } catch(_) {} }
    },
    notify(type='success') {
      if (this.provider === 'tg') { try { window.Telegram.WebApp.HapticFeedback.notificationOccurred(type); } catch(_) {} }
      else if (this.provider === 'vibrate') { try { navigator.vibrate([30, 30, 30]); } catch(_) {} }
    },
    warmup() { // несколько ударов, чтобы явно почувствовать
      this.impact('heavy');
      setTimeout(()=>this.selection(), 60);
      setTimeout(()=>this.impact('rigid'), 120);
    }
  };
  // инициализируем хаптики только когда Telegram готов
document.addEventListener('DOMContentLoaded', () => {
  try { window.Telegram?.WebApp?.ready(); } catch(_) {}
  // чуть отложим, чтобы iOS точно подцепил WebApp API
  setTimeout(() => HAPTICS.init(), 0);
});

// iOS: на первое касание тоже пробуем инициализировать
window.addEventListener('touchstart', () => {
  if (HAPTICS.provider === 'none') HAPTICS.init();
}, { once: true });

  // ====== Секторные тики (с прогресс-зависимой силой) ======
  const MIN_TICK_GAP_MS = 60;
  let __hTimers = [];
  function cancelSectorHaptics(){ __hTimers.forEach(clearTimeout); __hTimers.length = 0; }

  function bezierCubic(t, p0, p1, p2, p3){ const u=1-t; return u*u*u*p0 + 3*u*u*t*p1 + 3*u*t*t*p2 + t*t*t*p3; }
  function cubicBezierMap(p, x1, y1, x2, y2){ let lo=0,hi=1; for(let i=0;i<20;i++){ const t=(lo+hi)/2; const x=bezierCubic(t,0,x1,x2,1); if(x<p) lo=t; else hi=t; } const t=(lo+hi)/2; return bezierCubic(t,0,y1,y2,1); }
  function invCubicBezier(yTarget, x1, y1, x2, y2){ let lo=0,hi=1; for(let i=0;i<20;i++){ const mid=(lo+hi)/2; const y=cubicBezierMap(mid,x1,y1,x2,y2); if(y<yTarget) lo=mid; else hi=mid; } return (lo+hi)/2; }

  function scheduleSectorHaptics(startDeg, endDeg, durationMs, easing={x1:0.12,y1:0.65,x2:0.06,y2:1}) {
    cancelSectorHaptics();
    if (endDeg <= startDeg) return;
    const delta = endDeg - startDeg;
    let nextBoundary = Math.ceil((startDeg - ANGLE_OFFSET)/STEP)*STEP + ANGLE_OFFSET;
    const entries = [];
    while (nextBoundary < endDeg - 0.001) {
      const y = (nextBoundary - startDeg) / delta;
      const p = invCubicBezier(y, easing.x1, easing.y1, easing.x2, easing.y2);
      const t = Math.max(0, Math.min(durationMs, p * durationMs));
      entries.push({ t, p });
      nextBoundary += STEP;
    }
    let last = -1e9;

    // === iOS-режим тиков: чаще selection(), в конце — rigid ===
    const isIOS = (window.Telegram?.WebApp?.platform === 'ios');

    for (const e of entries) {
      if (e.t - last < MIN_TICK_GAP_MS) continue;
      last = e.t;
      const h = setTimeout(() => {
  // если в момент тика провайдер не готов — попробуем доинициализировать
  if (HAPTICS.provider === 'none') HAPTICS.init();

  if (isIOS && window.Telegram?.WebApp?.HapticFeedback) {
    // iOS: усиливаем — чаще selection, иногда notification, финиш — rigid
    try {
      const HF = window.Telegram.WebApp.HapticFeedback;
      if (e.p < 0.15) {
        HF.selectionChanged();
      } else if (e.p < 0.8) {
        // через один тик даём impact, через два — notification, чтобы было заметно
        if (Math.round(e.t / 120) % 3 === 0) HF.notificationOccurred('success');
        else HF.impactOccurred('medium');
      } else {
        HF.impactOccurred('rigid');
      }
    } catch(_) {}
  } else {
    // Android/Web как было
    if (e.p < 0.2) HAPTICS.selection();
    else if (e.p < 0.85) HAPTICS.impact('medium');
    else HAPTICS.impact('heavy');
  }
}, Math.round(e.t));
      __hTimers.push(h);
    }
    const hFinal = setTimeout(() => HAPTICS.notify('success'), durationMs + 10);
    __hTimers.push(hFinal);
  }

  document.addEventListener('visibilitychange', () => { if (document.hidden) cancelSectorHaptics(); });

  // --- Логика вращения ---
  let spinning = false;
  let currentTurns = 0;

  function showToast(text){ const el=document.createElement('div'); el.className='toast'; el.textContent=text; document.body.appendChild(el); setTimeout(()=>el.remove(), 3200); }

  const spinOnce = () => {
    if (spinning) return;

    // >>> iOS safety: форсируем инициализацию и даём явные сигналы в рамках жеста
const __isIOS = (window.Telegram?.WebApp?.platform === 'ios');
if (HAPTICS.provider === 'none') HAPTICS.init();


if (__isIOS && window.Telegram?.WebApp?.HapticFeedback) {
  try {
    const HF = window.Telegram.WebApp.HapticFeedback;
    HF.selectionChanged();          // лёгкий тик
    HF.impactOccurred('heavy');     // сильный удар
    HF.notificationOccurred('success'); // заметный «бзз» уведомления
  } catch(_) {}
}
// <<<

    // На случай старого мусора — чистим кулдауны прямо при клике
    try { localStorage.removeItem('fortune_cd_until'); localStorage.removeItem(K.WHEEL_CD_UNTIL); } catch(_){}

    // блокируем сразу
    spinning = true;
    btnSpin.setAttribute('disabled','true');

    // анимация стрелки
    if (pointer) { pointer.classList.remove('wiggle'); void pointer.offsetWidth; pointer.classList.add('wiggle'); }

    // стартовые хаптики (явно почувствовать)
    HAPTICS.warmup();

    const targetIndex = Math.floor(Math.random() * SECTORS);
    const prizePLAMc = order[targetIndex];

    const sectorCenterAngle = ANGLE_OFFSET + targetIndex * STEP;
    const baseRotations = 6;

    const startDeg = currentTurns;
    const deltaDeg = baseRotations * 360 + (360 - (sectorCenterAngle % 360));
    const endDeg   = startDeg + deltaDeg;

    scheduleSectorHaptics(startDeg, endDeg, SPIN_MS, {x1:0.12,y1:0.65,x2:0.06,y2:1});

    rotor.style.transition = `transform ${SPIN_MS}ms cubic-bezier(0.12, 0.65, 0.06, 1)`;
    rotor.style.transform  = `rotate(${endDeg}deg)`;
    currentTurns = endDeg;

    const onDone = () => {
      rotor.removeEventListener('transitionend', onDone);
      clearTimeout(safety);

      const newBalance = addToBalance(prizePLAMc);
      spinning = false;
      updateUI();
      showToast(`+${prizePLAMc} PLAMc`);
      try { sessionStorage.setItem('fortune_last_win', String(prizePLAMc)); } catch(_){}
      try { localStorage.setItem(K.BALANCE, String(newBalance)); } catch(_){}
    };

    rotor.addEventListener('transitionend', onDone, { once: true });
    const safety = setTimeout(onDone, SPIN_MS + 200);
  };

  btnSpin.addEventListener('click', spinOnce);

  // --- Tabs: wheel / tasks ---
  document.addEventListener('DOMContentLoaded', () => {
    const tabBtns = document.querySelectorAll('[data-tab]');
    const panels   = document.querySelectorAll('[data-panel]');
    if (!tabBtns.length || !panels.length) return;
    function activate(name){ tabBtns.forEach(b => b.classList.toggle('is-active', b.dataset.tab === name)); panels.forEach(p => p.hidden = p.dataset.panel !== name); }
    const q = new URLSearchParams(location.search);
    activate(q.get('tab') || 'wheel');
    tabBtns.forEach(b => b.addEventListener('click', (e) => {
      e.preventDefault();
      const name = b.dataset.tab;
      activate(name);
      const qs = new URLSearchParams(location.search); qs.set('tab', name);
      history.replaceState(null, '', location.pathname + '?' + qs.toString());
    }));
  });

  // 2.1 Флаг при любых уходах со страницы (назад/переход/закрытие)
window.addEventListener('pagehide', () => {
  try { sessionStorage.setItem('plam_skip_splash_once', '1'); } catch(_) {}
});

// 2.2 Если у тебя есть своя кнопка "Назад" — проставим флаг перед действием
document.addEventListener('DOMContentLoaded', () => {
  const back = document.getElementById('btnBack');
  if (!back) return;
  back.addEventListener('click', () => {
    try { sessionStorage.setItem('plam_skip_splash_once', '1'); } catch(_) {}
  }, { capture: true }); // с захватом — чтобы флаг встал до изменения location/history
});


  // --- «Назад» ---
  if (btnBack) {
    btnBack.addEventListener('click', () => {
      if (history.length > 1) history.back();
      else location.href = './index.html';
    });
  }

  document.addEventListener('plam:langChanged', () => {
    try { i18nApplyLocal(); } catch(_) {}
    try { updateUI(); } catch(_) {}
  });

  

})();

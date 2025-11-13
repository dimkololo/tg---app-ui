// ========== fortune.js — LS-единообразие, миграции, тот же UX ==========

// fortune.js (или внутри скрипта на fortune.html)
function i18nApplyLocal(){
  try { window.i18n && window.i18n.apply && i18n.apply(document); } catch(_) {}
}

// локальный T-хелпер: использует i18n.t, а если перевода нет — подставляет vars в fallback
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


// начальная инициализация
document.addEventListener('DOMContentLoaded', () => {
  i18nApplyLocal();
});

// слушаем изменения языка, сделанные в других вкладках
window.addEventListener('storage', (e) => {
  if (e.key === 'plam_lang') {
    try { i18n.setLang(e.newValue); } catch(_) {}
    i18nApplyLocal();
    // обновляем динамику, если нужно (например, вызвать функцию, которая пересчитывает
    // подписки/таймеры/тексты)
    // refreshDynamicUI?.();
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
    WHEEL_CD_UNTIL:    'fortune_cd_until_v2',       // 24h кулдаун колеса
    WHEEL_ORDER:       'fortune_wheel_order_v2',    // порядок чисел
  };

  // --- Миграция из v1 ---
  (function migrate(){
    if (localStorage.getItem('plam_balance') && !localStorage.getItem(K.BALANCE)) {
      LS.set(K.BALANCE, localStorage.getItem('plam_balance'));
    }
    if (localStorage.getItem('fortune_cd_until') && !localStorage.getItem(K.WHEEL_CD_UNTIL)) {
      LS.set(K.WHEEL_CD_UNTIL, localStorage.getItem('fortune_cd_until'));
    }
    // порядок ранее был в sessionStorage — теперь стабилен меж перезагрузок
    // если есть прежний session ключ — перенесём как стартовую инициализацию
    try {
      const sess = sessionStorage.getItem('fortune_wheel_order_session');
      if (sess && !localStorage.getItem(K.WHEEL_ORDER)) localStorage.setItem(K.WHEEL_ORDER, sess);
    } catch {}
  })();

  // --- Состояние/утилиты ---
  function getBalance(){ return LS.getNum(K.BALANCE, 0); }
  function setBalance(v){ LS.setNum(K.BALANCE, v); }
  function addToBalance(delta){ const next = getBalance() + delta; setBalance(next); return next; }

  function getCooldownUntil(){ return LS.getNum(K.WHEEL_CD_UNTIL, 0); }
  function setCooldownUntil(ts){ LS.setNum(K.WHEEL_CD_UNTIL, ts); }
  function clearCooldown(){ LS.remove(K.WHEEL_CD_UNTIL); }

  function fmtLeft(ms){
    const s = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    const hh = String(h).padStart(2,'0');
    const mm = String(m).padStart(2,'0');
    const ss2 = String(ss).padStart(2,'0');
    return `${hh}ч. ${mm}мин. ${ss2}сек.`;
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

  // --- КОНСТАНТЫ КОЛЕСА ---
  const VALUES    = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20];
  const SECTORS   = VALUES.length;
  const STEP      = 360 / SECTORS;    // 36°
  const SPIN_MS   = 7000;             // 7 секунд
  const ANGLE_OFFSET = 0;             // стрелка справа (3 часа)
  const TEST_MODE = true; // <-- set to false for production
  const COOLDOWN_MS  = TEST_MODE ? 0 : 24 * 60 * 60 * 1000;   // 0ms in test, 24h in prod   // 24 часа

  // --- Порядок чисел (теперь в LS, переживает reload) ---
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
    if (!timerEl) return;
    timerEl.hidden = false;
    stopCooldownUI();
    const tick = () => {
      const left = getCooldownUntil() - Date.now();
      if (left <= 0) {
        stopCooldownUI();
        timerEl.hidden = true;
        clearCooldown();
        updateUI();
        return;
      }
      timerEl.textContent = Tlocal('fortune.return_in', 'Возвращайся через: {{time}}', { time: fmtLeft(left) });

    };
    tick();
    cdTimerId = setInterval(tick, 1000);
  }
  function isSpun(){
    const until = getCooldownUntil();
    if (!until) return false;
    if (Date.now() >= until) { clearCooldown(); return false; }
    return true;
  }
  function markSpun(){ setCooldownUntil(Date.now() + COOLDOWN_MS); }

  function updateUI(){
    if (isSpun()) {
      btnSpin.setAttribute('disabled','true');
      startCooldownUI();
    } else {
      btnSpin.removeAttribute('disabled');
      stopCooldownUI();
      if (timerEl) timerEl.hidden = true;
    }
  }
  updateUI();

  // --- Логика вращения ---
  let spinning = false;
  let currentTurns = 0;

  function showToast(text){
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = text;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3200); // показываем чуть дольше
  }

  const spinOnce = () => {
    if (spinning) return;

    const left = getCooldownUntil() - Date.now();
    if (left > 0) {
      startCooldownUI();
      btnSpin.setAttribute('disabled','true');
      return;
    }

    // блокируем сразу
    spinning = true;
    btnSpin.setAttribute('disabled','true');

    // анимация стрелки
    if (pointer) {
      pointer.classList.remove('wiggle'); void pointer.offsetWidth; pointer.classList.add('wiggle');
    }

    // ставим кулдаун сразу и показываем таймер
    markSpun(); updateUI();

    const targetIndex = Math.floor(Math.random() * SECTORS);
    const prizePLAMc = order[targetIndex];

    const sectorCenterAngle = ANGLE_OFFSET + targetIndex * STEP;
    const baseRotations = 6;
    currentTurns += baseRotations * 360 + (360 - (sectorCenterAngle % 360));

    rotor.style.transition = `transform ${SPIN_MS}ms cubic-bezier(0.12, 0.65, 0.06, 1)`;
    rotor.style.transform  = `rotate(${currentTurns}deg)`;

    const onDone = () => {
      rotor.removeEventListener('transitionend', onDone);
      clearTimeout(safety);

      const newBalance = addToBalance(prizePLAMc);
      spinning = false;
      updateUI();

      showToast(`+${prizePLAMc} PLAMc`);

      try { sessionStorage.setItem('fortune_last_win', String(prizePLAMc)); } catch(_){}
      // синхронизируем плюс на главной через storage
      try { localStorage.setItem(K.BALANCE, String(newBalance)); } catch(_){}
    };

    rotor.addEventListener('transitionend', onDone, { once: true });
    const safety = setTimeout(onDone, SPIN_MS + 120);
  };

  btnSpin.addEventListener('click', spinOnce);

  // --- Tabs: wheel / tasks ---
document.addEventListener('DOMContentLoaded', () => {
  const tabBtns = document.querySelectorAll('[data-tab]');
  const panels   = document.querySelectorAll('[data-panel]');
  if (!tabBtns.length || !panels.length) return;

  function activate(name){
    tabBtns.forEach(b => b.classList.toggle('is-active', b.dataset.tab === name));
    panels.forEach(p => p.hidden = p.dataset.panel !== name);
  }

  // Инициализация из URL (?tab=wheel|tasks)
  const q = new URLSearchParams(location.search);
  activate(q.get('tab') || 'wheel');

  // Переключение по клику
  tabBtns.forEach(b => b.addEventListener('click', (e) => {
    e.preventDefault();
    const name = b.dataset.tab;
    activate(name);
    const qs = new URLSearchParams(location.search); qs.set('tab', name);
    history.replaceState(null, '', location.pathname + '?' + qs.toString());
  }));
});


  // --- «Назад» ---
  if (btnBack) {
    btnBack.addEventListener('click', () => {
      if (history.length > 1) history.back();
      else location.href = './index.html';
    });
  }

  // при смене языка обновляем динамические тексты
document.addEventListener('plam:langChanged', () => {
  try { i18nApplyLocal(); } catch(_) {}
  try { updateUI(); } catch(_) {}
});


})();

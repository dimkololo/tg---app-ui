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
  const COOLDOWN_MS  = 24 * 60 * 60 * 1000;   // 24 часа

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

  // ====== ХАПТИКИ: обёртка (Telegram + vibrate fallback) ======
  function hapticTick(intensity = 'light') {
    const H = window.Telegram?.WebApp?.HapticFeedback;
    if (H && typeof H.impactOccurred === 'function') {
      H.impactOccurred(intensity);
    } else if (navigator.vibrate) {
      navigator.vibrate(8);
    }
  }
  function hapticFinal(ok = true) {
    const H = window.Telegram?.WebApp?.HapticFeedback;
    if (H && typeof H.notificationOccurred === 'function') {
      H.notificationOccurred(ok ? 'success' : 'warning');
    } else if (navigator.vibrate) {
      navigator.vibrate([22, 28, 22]);
    }
  }

  // ====== ХАПТИКИ: тики ровно на границах секторов (36°), с той же easing ======
  const MIN_TICK_GAP_MS = 45;  // реже чем ~45мс
  let __hTimers = [];
  function cancelSectorHaptics(){ __hTimers.forEach(clearTimeout); __hTimers.length = 0; }

  // кубические Безье как в CSS timing-function
  function bezierCubic(t, p0, p1, p2, p3){
    const u = 1 - t;
    return u*u*u*p0 + 3*u*u*t*p1 + 3*u*t*t*p2 + t*t*t*p3;
  }
  // y = f(p) для CSS cubic-bezier(x1,y1,x2,y2)
  function cubicBezierMap(p, x1, y1, x2, y2){
    // находим t, при котором x(t) = p
    let lo = 0, hi = 1;
    for (let i=0;i<20;i++){
      const t = (lo+hi)/2;
      const x = bezierCubic(t, 0, x1, x2, 1);
      if (x < p) lo = t; else hi = t;
    }
    const t = (lo+hi)/2;
    return bezierCubic(t, 0, y1, y2, 1);
  }
  // обратная: дано y -> найти p, чтобы f(p)=y
  function invCubicBezier(yTarget, x1, y1, x2, y2){
    let lo = 0, hi = 1;
    for (let i=0;i<20;i++){
      const mid = (lo+hi)/2;
      const y = cubicBezierMap(mid, x1, y1, x2, y2);
      if (y < yTarget) lo = mid; else hi = mid;
    }
    return (lo+hi)/2;
  }

  function scheduleSectorHaptics(startDeg, endDeg, durationMs, intensity='light', easing={x1:0.12,y1:0.65,x2:0.06,y2:1}) {
    cancelSectorHaptics();
    if (endDeg <= startDeg) return;

    const delta = endDeg - startDeg;

    // границы, привязанные к ANGLE_OFFSET (для аккуратной синхронизации с секторами)
    let nextBoundary = Math.ceil( (startDeg - ANGLE_OFFSET) / STEP ) * STEP + ANGLE_OFFSET;

    const rawTimes = [];
    while (nextBoundary < endDeg - 0.001) {
      const y = (nextBoundary - startDeg) / delta;              // доля пути по углу (0..1)
      const p = invCubicBezier(y, easing.x1, easing.y1, easing.x2, easing.y2); // доля времени (0..1)
      const t = Math.max(0, Math.min(durationMs, p * durationMs));
      rawTimes.push(t);
      nextBoundary += STEP;
    }

    // прореживаем слишком частые тики
    const times = [];
    let last = -1e9;
    for (const t of rawTimes) {
      if (t - last >= MIN_TICK_GAP_MS) { times.push(t); last = t; }
    }

    for (const t of times) {
      const h = setTimeout(() => hapticTick(intensity), Math.round(t));
      __hTimers.push(h);
    }
    const hFinal = setTimeout(() => hapticFinal(true), durationMs + 10);
    __hTimers.push(hFinal);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) cancelSectorHaptics();
  });

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

    // --- СИНХРОНИЗАЦИЯ УГЛОВ ДЛЯ ХАПТИКОВ ---
    const startDeg = currentTurns; // где сейчас находимся
    const deltaDeg = baseRotations * 360 + (360 - (sectorCenterAngle % 360));
    const endDeg   = startDeg + deltaDeg;

    // Планируем хаптики ещё до старта визуальной анимации
    scheduleSectorHaptics(startDeg, endDeg, SPIN_MS, 'light', {x1:0.12,y1:0.65,x2:0.06,y2:1});

    // --- Запускаем саму анимацию колеса ---
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

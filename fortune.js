// ========== fortune.js — backend cooldown + backend credit (fortune-build-2026-01-20-v5) ==========
console.info('[fortune] BUILD', 'fortune-build-2026-01-20-v5');

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

  // Кулдаун и начисление — через БЭКЕНД:
  //   GET  /api/v1/fortune/status/:userKey
  //   POST /api/v1/fortune/credit { userId, amount }
  // На сервере за это отвечает FORTUNE_COOLDOWN_SEC (по умолчанию 24 часа).
  const COOLDOWN_FALLBACK_MS = 24 * 60 * 60 * 1000; // запасной локальный кэш

  // --- Миграция порядка ---
  try {
    const sess = sessionStorage.getItem('fortune_wheel_order_session');
    if (sess && !localStorage.getItem(K.WHEEL_ORDER)) localStorage.setItem(K.WHEEL_ORDER, sess);
  } catch {}
  // (не сбрасываем кулдаун на старте — теперь это 1 раз в сутки)

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
  // --- Состояние кнопки/таймера (кулдаун берём с сервера) ---
  let spinning = false;
  let cdTimerId = null;

  const fortuneState = {
    loading: true,
    canSpin: false,
    remainingSec: 0,
    nextAvailableAtMs: 0,
  };

  function stopCooldownUI(){
    if (cdTimerId){
      clearInterval(cdTimerId);
      cdTimerId = null;
    }
  }

  function startCooldownUI(){
    stopCooldownUI();
    if (!timerEl) return;

    timerEl.hidden = false;

    const tick = () => {
      const msLeft = Math.max(0, (fortuneState.nextAvailableAtMs || 0) - Date.now());
      timerEl.textContent = fmtLeft(msLeft);

      if (msLeft <= 0){
        // кулдаун закончился
        stopCooldownUI();
        timerEl.hidden = true;
        fortuneState.canSpin = true;
        fortuneState.remainingSec = 0;
        fortuneState.nextAvailableAtMs = 0;
        clearCooldown();
        updateUI();
      }
    };

    tick();
    cdTimerId = setInterval(tick, 1000);
  }

  function isSpun(){
    return !fortuneState.loading && !fortuneState.canSpin;
  }

  function markSpun(nextAtMs){
    const ts = Number(nextAtMs) || 0;
    fortuneState.canSpin = false;
    fortuneState.nextAvailableAtMs = ts;
    fortuneState.remainingSec = ts ? Math.max(0, Math.floor((ts - Date.now()) / 1000)) : 0;
    if (ts) setCooldownUntil(ts);
  }

  function getUserKey(){
    // 1) наш внутренний id (plam_auth.id)
    try {
      const raw = localStorage.getItem('plam_auth');
      if (raw){
        const a = JSON.parse(raw);
        if (a && a.id != null) return String(a.id);
      }
    } catch(_) {}

    // 2) запасной вариант — tg user id (если бэк умеет искать по tgId)
    const tgId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
    if (tgId != null) return String(tgId);

    return null;
  }

  async function fetchFortuneStatus(){
    const key = getUserKey();

    fortuneState.loading = true;
    updateUI();

    // если есть локальный кэш nextAvailableAt — сразу покажем (а потом уточним у бэка)
    const cached = getCooldownUntil();
    if (cached && Date.now() < cached){
      markSpun(cached);
      fortuneState.loading = false;
      startCooldownUI();
      updateUI();
    }

    if (!key){
      // без userId мы не сможем начислить на бэке; но хотя бы не блокируем колесо
      fortuneState.loading = false;
      fortuneState.canSpin = true;
      updateUI();
      return;
    }

    try {
      const res = await fetch(`/api/v1/fortune/status/${encodeURIComponent(key)}`, {
        cache: 'no-store',
        credentials: 'same-origin',
      });
      const js = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error('HTTP ' + res.status);

      fortuneState.loading = false;

      if (js && js.canSpin === true){
        fortuneState.canSpin = true;
        fortuneState.remainingSec = 0;
        fortuneState.nextAvailableAtMs = 0;
        clearCooldown();
        stopCooldownUI();
        if (timerEl) timerEl.hidden = true;
      } else {
        const nextMs = js?.nextAvailableAt ? Date.parse(js.nextAvailableAt) : (Date.now() + (Number(js?.remainingSec)||0) * 1000);
        markSpun(nextMs);
        startCooldownUI();
      }

      updateUI();
    } catch(e) {
      console.warn('[fortune] status failed', e);
      fortuneState.loading = false;

      // если кулдаун был в кэше — оставим его, иначе разрешим крутить (начисление всё равно проверит бэк)
      const cd = getCooldownUntil();
      if (cd && Date.now() < cd){
        markSpun(cd);
        startCooldownUI();
        fortuneState.canSpin = false;
      } else {
        fortuneState.canSpin = true;
      }

      updateUI();
    }
  }

  async function creditPrize(amount){
    const key = getUserKey();
    if (!key) throw new Error('NO_USER');

    const res = await fetch('/api/v1/fortune/credit', {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ userId: key, amount }),
    });

    const js = await res.json().catch(() => ({}));

    if (!res.ok || js?.ok !== true){
      // 409 — уже крутили, вернём состояние и покажем таймер
      if (res.status === 409 && js){
        const nextMs = js?.nextAvailableAt ? Date.parse(js.nextAvailableAt) : (Date.now() + (Number(js?.remainingSec)||0) * 1000);
        if (nextMs) {
          markSpun(nextMs);
          startCooldownUI();
        }
        updateUI();
      }
      throw new Error(js?.error || ('HTTP ' + res.status));
    }

    // 1) приводим локальный баланс к тому, что вернул бэк
    const fresh = Number(js.balance);
    if (Number.isFinite(fresh)) setBalance(fresh);

    // 2) выставляем кулдаун
    const nextMs = js?.nextAvailableAt ? Date.parse(js.nextAvailableAt) : (Date.now() + COOLDOWN_FALLBACK_MS);
    if (nextMs) {
      markSpun(nextMs);
      startCooldownUI();
    }

    updateUI();
    return js;
  }

  function updateUI(){
    // пока грузим статус — кнопка недоступна
    if (fortuneState.loading){
      btnSpin.setAttribute('disabled','true');
      stopCooldownUI();
      if (timerEl) timerEl.hidden = true;
      return;
    }

    // во время анимации — тоже блокируем
    if (spinning){
      btnSpin.setAttribute('disabled','true');
      return;
    }

    if (!fortuneState.canSpin){
      btnSpin.setAttribute('disabled','true');
      startCooldownUI();
      return;
    }

    btnSpin.removeAttribute('disabled');
    stopCooldownUI();
    if (timerEl) timerEl.hidden = true;
  }

  // старт: подтянем статус с бэка
  fetchFortuneStatus();

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
  let currentTurns = 0;

  function showToast(text){ const el=document.createElement('div'); el.className='toast'; el.textContent=text; document.body.appendChild(el); setTimeout(()=>el.remove(), 3200); }
  const spinOnce = () => {
    if (spinning) return;

    // если ещё не получили статус — не начинаем вращение
    if (fortuneState && fortuneState.loading){
      showToast(Tlocal('fortune.loading','Подождите…'));
      return;
    }

    // если кулдаун активен — не крутим
    if (fortuneState && fortuneState.canSpin === false){
      const msLeft = Math.max(0, (fortuneState.nextAvailableAtMs || 0) - Date.now());
      if (msLeft > 0) showToast(fmtLeft(msLeft));
      return;
    }

    try { window.PlamSound && PlamSound.play && PlamSound.play(); } catch(_) {}

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
    // кулдаун не чистим — теперь он 1 раз в сутки и контролируется бэком

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
    let __doneOnce = false;
    const onDone = () => {
      if (__doneOnce) return;
      __doneOnce = true;

      rotor.removeEventListener('transitionend', onDone);
      clearTimeout(safety);

      // начисление и кулдаун — через бэкенд
      (async () => {
        try {
          await creditPrize(prizePLAMc);
          showToast(`+${prizePLAMc} PLAMc`);
          try { sessionStorage.setItem('fortune_last_win', String(prizePLAMc)); } catch(_) {}
        } catch (e) {
          console.error('[fortune] credit error', e);
          showToast(Tlocal('fortune.credit_fail','Не удалось начислить. Попробуйте ещё раз.'));

          // если начисление не прошло — разрешаем повторить (кулдаун на сервере не выставился)
          if (fortuneState) {
            fortuneState.canSpin = true;
            fortuneState.nextAvailableAtMs = 0;
            fortuneState.remainingSec = 0;
          }
          clearCooldown();
        } finally {
          spinning = false;
          updateUI();
        }
      })();
    };

    rotor.addEventListener('transitionend', onDone, { once: true });
    const safety = setTimeout(onDone, SPIN_MS + 200);
  };

  btnSpin.addEventListener('click', spinOnce);

   // --- AdsGram TASK (вкладка "Задания") — 1 плашка (test) ---
  const ADSGRAM_TASK_BLOCK_ID = 'task-22246';
  const ADSGRAM_DEBUG = true; // true = тестовое задание, потом поставишь false

  let __adsgramTaskInited = false;

  function initAdsgramTaskOnce(){
    if (__adsgramTaskInited) return;
    __adsgramTaskInited = true;

    const panel = document.querySelector('[data-panel="tasks"]');
    if (!panel) return;

    // если уже смонтировано — ничего не делаем
    if (panel.querySelector('adsgram-task')) return;

    // ждём, пока SDK зарегистрирует web component
    (async () => {
      const deadline = Date.now() + 4000;
      while (!customElements.get('adsgram-task') && Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 100));
      }

      if (!customElements.get('adsgram-task')) {
        console.warn('[adsgram] <adsgram-task> not available (SDK not loaded?)');
        return;
      }

      // прячем заглушку "пусто", если она есть
      const empty = panel.querySelector('.tasks-empty');
      if (empty) empty.hidden = true;

      const task = document.createElement('adsgram-task');
      task.className = 'ads-task';
      task.setAttribute('data-block-id', ADSGRAM_TASK_BLOCK_ID);
      task.setAttribute('data-debug', ADSGRAM_DEBUG ? 'true' : 'false');
      task.setAttribute('data-debug-console', 'false');

      // слоты
      const reward = document.createElement('span');
      reward.slot = 'reward';
      reward.className = 'ads-task__reward';
      reward.textContent = 'Задание';

      const btn = document.createElement('div');
      btn.slot = 'button';
      btn.className = 'ads-task__btn';
      btn.textContent = 'Открыть';

      const claim = document.createElement('div');
      claim.slot = 'claim';
      claim.className = 'ads-task__btn ads-task__btn_claim';
      claim.textContent = 'Получить';

      const done = document.createElement('div');
      done.slot = 'done';
      done.className = 'ads-task__btn ads-task__btn_done';
      done.textContent = 'Готово';

      task.append(reward, btn, claim, done);

      // события AdsGram
      task.addEventListener('reward', () => {
        try { showToast('Задание выполнено ✅'); } catch(_){}
      });

      task.addEventListener('onBannerNotFound', () => {
  console.warn('[adsgram] no tasks for block', ADSGRAM_TASK_BLOCK_ID);

  // НЕ удаляем плашку — оставляем, чтобы не "пропадало"
  // просто показываем пустую заглушку/сообщение
  if (empty) empty.hidden = false;

  // Разрешим повторную попытку инициализации позже (если задания появятся)
  __adsgramTaskInited = false;
});

     task.addEventListener('onError', (event) => {
  console.warn('[adsgram] onError', event?.detail);
  if (empty) empty.hidden = false;

  // чтобы можно было повторить попытку (например после перезагрузки/кэша)
  __adsgramTaskInited = false;
});


      task.addEventListener('onTooLongSession', () => {
        try { window.Telegram?.WebApp?.showAlert?.('Сессия слишком долгая. Перезапусти мини-апп, чтобы снова видеть задания.'); } catch(_){}
      });

      // вставляем в панель
      panel.prepend(task);
    })();
  }


  // --- Tabs: wheel / tasks ---
document.addEventListener('DOMContentLoaded', () => {
  const tabBtns = document.querySelectorAll('[data-tab]');
  const panels  = document.querySelectorAll('[data-panel]');
  if (!tabBtns.length || !panels.length) return;

  const ADSGRAM_BLOCK_ID = 'task-22246';
  const ADSGRAM_DEBUG = true; // для теста true, потом выключишь

  let tasksInited = false;

  function ensureDemoTask(host){
    if (host.querySelector('.demo-task')) return;

    const card = document.createElement('div');
    card.className = 'demo-task';
    card.innerHTML = `
      <div class="ads-task__reward">DEMO • Задание</div>
      <p class="demo-task__title">Демо-плашка для дизайна</p>
      <p class="demo-task__sub">Нужна, чтобы править размеры/скругления даже когда AdsGram задач нет.</p>
      <div class="demo-task__btn">Открыть</div>
    `;

    const btn = card.querySelector('.demo-task__btn');
    let state = 0; // 0=open, 1=claim, 2=done
    btn.addEventListener('click', () => {
      if (state === 0){
        try { window.Telegram?.WebApp?.openTelegramLink?.('https://t.me/'); } catch(_){}
        btn.textContent = 'Получить';
        state = 1;
        return;
      }
      if (state === 1){
        btn.textContent = 'Готово';
        btn.classList.add('is-done');
        state = 2;
        return;
      }
    });

    host.appendChild(card);
  }

  function mountAdsgramTask(host){
    // уже есть — не плодим
    if (host.querySelector('adsgram-task.ads-task')) return;

    const tpl = document.getElementById('tpl-adsgram-task');
    if (!tpl) return;

    const node = tpl.content.firstElementChild.cloneNode(true);
    node.setAttribute('data-block-id', ADSGRAM_BLOCK_ID);
    node.setAttribute('data-debug', ADSGRAM_DEBUG ? 'true' : 'false');
    node.setAttribute('data-debug-console', 'false');

    // НИЧЕГО НЕ УДАЛЯЕМ — пусть не "исчезает"
    node.addEventListener('reward', () => {
      try { showToast('Задание выполнено ✅'); } catch(_){}
    });

    node.addEventListener('onBannerNotFound', () => {
      // задач нет — оставляем DEMO, а AdsGram можно просто скрыть
      node.style.display = 'none';
    });

    node.addEventListener('onError', () => {
      node.style.display = 'none';
    });

    host.prepend(node);
  }

  function initTasks(){
    if (tasksInited) return;
    tasksInited = true;

    const host  = document.getElementById('adsgramTasks');
    const empty = document.getElementById('adsgramEmpty');
    if (!host) return;

    // Текст "Раздел скоро..." больше не показываем (у нас DEMO вместо него)
    if (empty) empty.hidden = true;

    ensureDemoTask(host);

    // ждём SDK до 4с и монтируем AdsGram
    const deadline = Date.now() + 4000;
    const t = setInterval(() => {
      const ready = !!(window.customElements && customElements.get('adsgram-task'));
      if (ready || Date.now() > deadline){
        clearInterval(t);
        if (ready) mountAdsgramTask(host);
      }
    }, 120);
  }

  function activate(name){
    tabBtns.forEach(b => b.classList.toggle('is-active', b.dataset.tab === name));
    panels.forEach(p => p.hidden = p.dataset.panel !== name);

    if (name === 'tasks') initTasks();
  }

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


  document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-open-game]');
  if (!btn) return;
  e.preventDefault();
  const url = './game.html';
  const win = window.open(url, '_blank', 'noopener,noreferrer');
  if (!win) location.href = url;
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

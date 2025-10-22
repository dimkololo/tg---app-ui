// fortune.js v3.1 — статическая подсказка в HTML, JS её не трогает
(function () {
  // --- ЭЛЕМЕНТЫ ---
  const rotor =
    document.getElementById('wheelRotor') ||
    document.querySelector('.wheel-rotor') ||
    document.getElementById('wheelImg') ||
    document.querySelector('.wheel__img, .wheel-img');

  const numbersBox =
    document.getElementById('wheelNumbers') ||
    document.querySelector('.wheel__numbers');

  const timerEl = 
    document.getElementById('fortuneTimer');

  

  const btnSpin = document.getElementById('btnSpin') || document.querySelector('.btn-spin');
  const btnBack = document.getElementById('btnBack') || document.querySelector('.btn-back');
  const note = document.getElementById('spinNote');
  const pointer = document.querySelector('.wheel-pointer');
  

  if (!rotor || !btnSpin) {
    console.error('[fortune] Не найдено колесо или кнопка вращения.');
    return;
  }

  // --- Блокировка горизонтальной ориентации (оверлей) ---
(function setupOrientationOverlay(){
  const lock = document.getElementById('orientationLock');
  if (!lock) return;

  const mq = window.matchMedia('(orientation: portrait)');

  const update = () => {
    const isPortrait = mq.matches || window.innerHeight >= window.innerWidth;
    // показываем оверлей в горизонтали
    lock.classList.toggle('is-active', !isPortrait);
    // отключаем прокрутку под оверлеем
    document.documentElement.style.overflow = !isPortrait ? 'hidden' : '';
  };

  // начальная проверка
  update();

  // реагируем на смену ориентации и ресайз (фолбэк для старых WebView)
  try { mq.addEventListener('change', update); } catch(_) { /* iOS < 13 */ }
  window.addEventListener('orientationchange', update);
  window.addEventListener('resize', update);
})();


  // --- КОНСТАНТЫ ---
  const VALUES = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20]; // 10 секторов
  const SECTORS = VALUES.length; // 10
  const STEP = 360 / SECTORS;    // 36°
  const SPIN_MS = 7000;          // 7 секунд
  const STORAGE_SPUN = 'fortune_spun_session';         // тестовый режим: сброс при reload
  const STORAGE_ORDER = 'fortune_wheel_order_session'; // порядок чисел в текущей сессии
  const BALANCE_KEY = 'plam_balance';
  const ANGLE_OFFSET = 0; // сектор, на который указывает стрелка справа (3 часа)
  //РАСКОМЕНТИРОВАТЬ В ПРОДЕ const STORAGE_CD_UNTIL = 'fortune_cd_until';      // дедлайн кулдауна (ms, localStorage)
  const COOLDOWN_MS = 24 * 60 * 60 * 1000;          // 24 часа

  // --- ТЕСТОВЫЙ СБРОС ПРИ ОБНОВЛЕНИИ СТРАНИЦЫ ---
  (() => {
    try {
      const nav = performance.getEntriesByType?.('navigation')?.[0];
      const isReload = nav ? nav.type === 'reload'
                           : (performance.navigation && performance.navigation.type === 1);
      if (isReload) {
        sessionStorage.removeItem(STORAGE_SPUN);
        sessionStorage.removeItem(STORAGE_ORDER);
      }
    } catch {}
  })();

  // --- УТИЛИТЫ ---
  const shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const getSessionJSON = (k, fallback = null) => {
    try {
      const raw = sessionStorage.getItem(k);
      return raw ? JSON.parse(raw) : fallback;
    } catch { return fallback; }
  };
  const setSessionJSON = (k, v) => sessionStorage.setItem(k, JSON.stringify(v));

  const getBalance = () => parseInt(localStorage.getItem(BALANCE_KEY) || '0', 10);
  const addToBalance = (delta) => {
    const next = getBalance() + delta;
    localStorage.setItem(BALANCE_KEY, String(next));
    return next;
  };

  const getCooldownUntil = () => parseInt(localStorage.getItem(STORAGE_CD_UNTIL) || '0', 10) || 0;
const setCooldownUntil = (ts) => localStorage.setItem(STORAGE_CD_UNTIL, String(ts));
const clearCooldown = () => localStorage.removeItem(STORAGE_CD_UNTIL);

const fmtLeft = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const hh = String(h).padStart(2,'0');
  const mm = String(m).padStart(2,'0');
  const ss2 = String(ss).padStart(2,'0');
  return `${hh}ч. ${mm}мин. ${ss2}сек.`;
};

  // --- ПОРЯДОК ЧИСЕЛ НА КОЛЕСЕ (стабилен в рамках сессии) ---
  let order = getSessionJSON(STORAGE_ORDER);
  if (!order || order.length !== SECTORS) {
    order = shuffle(VALUES);
    setSessionJSON(STORAGE_ORDER, order);
  }

  // --- РЕНДЕР ЦИФР ---
  if (numbersBox) {
    numbersBox.innerHTML = '';
    for (let i = 0; i < SECTORS; i++) {
      const span = document.createElement('span');
      span.className = 'wheel__label';
      span.textContent = order[i];
      // стало — в центр сектора
      const angle = ANGLE_OFFSET + i * STEP;
      span.style.setProperty('--a', angle + 'deg');
      numbersBox.appendChild(span);
    }
  }

  // --- СОСТОЯНИЕ КНОПКИ ---
  const markSpun = () => setCooldownUntil(Date.now() + COOLDOWN_MS);
  const isSpun = () => Date.now() < getCooldownUntil();

  const updateUI = () => {
    if (isSpun()) {
      btnSpin.setAttribute('disabled', 'true');
      startCooldownUI();
    } else {
      btnSpin.removeAttribute('disabled');
      stopCooldownUI();
       if (timerEl) timerEl.hidden = true; // таймер не виден, пока не крутили/когда не активен
    }
  };
  updateUI();

  let cdTimerId = null;

function stopCooldownUI(){
  if (cdTimerId){ clearInterval(cdTimerId); cdTimerId = null; }
}

function startCooldownUI(){
  if (!timerEl) return;
  timerEl.hidden = false;
  stopCooldownUI();
  const tick = () => {
    const left = getCooldownUntil() - Date.now();
    if (left <= 0) {
      // время истекло: скрываем таймер, включаем кнопку
      stopCooldownUI();
      timerEl.hidden = true;
      clearCooldown();
      updateUI();
      return;
    }
    timerEl.textContent = fmtLeft(left);
  };
  tick();
  cdTimerId = setInterval(tick, 1000);
}


  // --- ЛОГИКА ВРАЩЕНИЯ ---
  let spinning = false;
  let currentTurns = 0;

  const spinOnce = () => {
    if (spinning || isSpun()) return;

    // блокируем сразу, чтобы не спамили кликами
    spinning = true;
    btnSpin.setAttribute('disabled', 'true');

    // 👉 Стрелка "wiggle" в НАЧАЛЕ
  if (pointer) {
    pointer.classList.remove('wiggle'); // сброс, если класс уже был
    void pointer.offsetWidth;           // рефлоу для перезапуска анимации
    pointer.classList.add('wiggle');    // поехали
  }
    // СРАЗУ выставляем дедлайн и показываем таймер
  markSpun();
  updateUI();

    const targetIndex = Math.floor(Math.random() * SECTORS);
    const prizePLAMc = order[targetIndex];

    const sectorCenterAngle = ANGLE_OFFSET + targetIndex * STEP;
    const baseRotations = 6; // 5–8 на вкус
    currentTurns += baseRotations * 360 + (360 - (sectorCenterAngle % 360));

    rotor.style.transition = `transform ${SPIN_MS}ms cubic-bezier(0.12, 0.65, 0.06, 1)`;
    rotor.style.transform = `rotate(${currentTurns}deg)`;

    function showToast(text){
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = text;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2400);
}

    const onDone = () => {
      rotor.removeEventListener('transitionend', onDone);
      clearTimeout(safety);

       // начисляем монеты
      const newBalance = addToBalance(prizePLAMc);

      // помечаем, что крутилось в этой сессии
      markSpun();

      spinning = false;
      updateUI();
       // показать результат
       // if (note) {
         // note.hidden = false;
          //note.textContent = `Вы выиграли +${prizePLAMc} PLAMc. Баланс: ${newBalance} PLAMc.`;
       // }
      // тост
      showToast(`+${prizePLAMc} PLAMc`);
    
      // перед выходом из onDone():
    sessionStorage.setItem('fortune_last_win', String(prizePLAMc)); // << для главной
    };
    

    rotor.addEventListener('transitionend', onDone, { once: true });
    const safety = setTimeout(onDone, SPIN_MS + 100); // страховка
  };

  btnSpin.addEventListener('click', spinOnce);

  // --- «Назад» ---
  if (btnBack) {
    btnBack.addEventListener('click', () => {
      if (history.length > 1) history.back();
      else location.href = './index.html';
    });
  }
})();

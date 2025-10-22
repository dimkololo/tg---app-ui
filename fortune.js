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
  const markSpun = () => sessionStorage.setItem(STORAGE_SPUN, '1');
  const isSpun = () => sessionStorage.getItem(STORAGE_SPUN) === '1';

  const updateUI = () => {
    if (isSpun()) {
      btnSpin.setAttribute('disabled', 'true');
    } else {
      btnSpin.removeAttribute('disabled');
    }
  };
  updateUI();

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

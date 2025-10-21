// fortune.js v3 — устойчив к изменениям классов/ID

(function () {
  // --- ЭЛЕМЕНТЫ (находим по ID и с запасными селекторами) ---
  const rotor =
    document.getElementById('wheelRotor') ||
    document.querySelector('.wheel-rotor') ||
    document.getElementById('wheelImg') ||
    document.querySelector('.wheel__img, .wheel-img');

  const numbersBox =
    document.getElementById('wheelNumbers') ||
    document.querySelector('.wheel__numbers');

  const btnSpin = document.getElementById('btnSpin') || document.querySelector('.btn-spin');
  const note = document.getElementById('spinNote') || document.querySelector('.fortune__note');
  const btnBack = document.getElementById('btnBack') || document.querySelector('.btn-back');

  if (!rotor || !btnSpin) {
    console.error('[fortune] Не найдено колесо или кнопка вращения.');
    return;
  }

  // --- КОНСТАНТЫ ---
  const VALUES = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20]; // 10 секторов
  const SECTORS = VALUES.length; // 10
  const STEP = 360 / SECTORS;    // 36°
  const SPIN_MS = 7000;          // 7 секунд
  const STORAGE_SPUN = 'fortune_spun_session';   // для тестов — сбрасывается после reload
  const STORAGE_ORDER = 'fortune_wheel_order_session'; // порядок чисел в текущей сессии
  const BALANCE_KEY = 'plam_balance';

  // DEV: сбрасывать запрет на кручение при reload страницы
(() => {
  try {
    const nav = performance.getEntriesByType?.('navigation')?.[0];
    const isReload = nav ? nav.type === 'reload'
                         : (performance.navigation && performance.navigation.type === 1); // старые браузеры
    if (isReload) {
      sessionStorage.removeItem('fortune_spun_session');      // снова разрешаем крутить
      sessionStorage.removeItem('fortune_wheel_order_session'); // опционально: перемешать сектора заново
    }
  } catch {}
})();


  // Если центр сектора на 3 часа (стрелка справа), обычно оффсет = 0.
  // Если увидишь систематический промах на половину сектора — подстрой на ±18.
  const ANGLE_OFFSET = 0; // градусов

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
    // Раскладываем 10 меток по кругу, начиная со «стрелки» на 3 часа.
    for (let i = 0; i < SECTORS; i++) {
      const span = document.createElement('span');
      span.className = 'wheel__label';
      span.textContent = order[i];
      // угол от оси X (вправо), по часовой стрелке
      const angle = ANGLE_OFFSET + i * STEP;
      span.style.setProperty('--a', angle + 'deg');
      numbersBox.appendChild(span);
    }
  }

  // --- СОСТОЯНИЕ КНОПКИ (тестовый режим: сбрасывается после reload) ---
  const markSpun = () => sessionStorage.setItem(STORAGE_SPUN, '1');
  const isSpun = () => sessionStorage.getItem(STORAGE_SPUN) === '1';

  const updateUI = () => {
    if (!note) return;
    if (isSpun()) {
      btnSpin.setAttribute('disabled', 'true');
      note.hidden = false;
      note.textContent = 'Можно крутить один раз (сбрасывается при обновлении страницы для теста).';
    } else {
      btnSpin.removeAttribute('disabled');
      note.hidden = true;
      note.textContent = '';
    }
  };

  updateUI();

  // --- ЛОГИКА ВРАЩЕНИЯ ---
  let spinning = false;
  let currentTurns = 0; // накопленный угол (для последовательных запусков — тут один раз)

  const spinOnce = () => {
    if (spinning || isSpun()) return;

    // 🔒 сразу блокируем, чтобы не спамили
    spinning = true;
    btnSpin.setAttribute('disabled', 'true');

    // Случайный сектор
    const targetIndex = Math.floor(Math.random() * SECTORS);
    const prizePLAMc = order[targetIndex];

    // Чтобы выбранный сектор оказался под стрелкой справа (0°),
    // нужно провернуть колесо на (360 - угол центра сектора) + N*360
    const sectorCenterAngle = ANGLE_OFFSET + targetIndex * STEP; // где сейчас центр выбранного сектора
    const baseRotations = 6; // полных оборотов (можешь 5–8 сделать)
    currentTurns += baseRotations * 360 + (360 - (sectorCenterAngle % 360));

    // Плавное вращение
    rotor.style.transition = `transform ${SPIN_MS}ms cubic-bezier(0.12, 0.65, 0.06, 1)`;
    rotor.style.transform = `rotate(${currentTurns}deg)`;

    // После завершения: зачисление + пометки
    const onDone = () => {
      rotor.removeEventListener('transitionend', onDone);
      // safety таймер на случай, если transitionend не сработает
      clearTimeout(safety);
      // Зачисляем монеты
      const newBalance = addToBalance(prizePLAMc);

      // Помечаем «крутили» (на сессию)
      markSpun();

      // Сообщение
      if (note) {
        note.hidden = false;
        note.textContent = `+${prizePLAMc} PLAMc! Ваш баланс: ${newBalance} PLAMc.`;
      }

      spinning = false;
      updateUI();
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

// ===== НАСТРОЙКИ =====
const SECTORS = [2,4,6,8,10,12,14,16,18,20]; // 10 значений, начиная с сектора на "3 часа"
const SECTOR_DEG = 360 / SECTORS.length;     // 36°
const WHEEL_SPINS = 10;                      // лишние обороты
const DURATION_SEC = 7;                      // длительность анимации
const STORAGE_KEY_NEXT = 'fortuneNextTs';
const STORAGE_KEY_BAL  = 'plamBalance';

// >>> ВРЕМЕННО ДЛЯ ТЕСТА: сбрасывать лок максимум при каждом перезагрузе
const DEV_RESET_ON_RELOAD = true;

// ===== DOM =====
const wheel   = document.getElementById('wheel');
const btnSpin = document.getElementById('btnSpin');
const note    = document.getElementById('spinNote');
const numsBox = document.getElementById('wheelNumbers');
const btnBack = document.getElementById('btnBack');

// ===== ИНИЦ =====
// 0) временный сброс локапа (удали перед продом!)
if (DEV_RESET_ON_RELOAD) {
  localStorage.removeItem(STORAGE_KEY_NEXT);
}

// 1) нарисовать цифры по окружности
SECTORS.forEach((value, i) => {
  const span = document.createElement('span');
  span.className = 'wheel__label';
  span.style.setProperty('--a', `${i * SECTOR_DEG}deg`); // 0°, 36°, 72°...
  span.textContent = value;
  numsBox.appendChild(span);
});

// 2) проверить доступность
const now = Date.now();
const nextTs = +localStorage.getItem(STORAGE_KEY_NEXT) || 0;
if (now < nextTs) {
  btnSpin.disabled = true;
  showNote(nextTs);
}

// 3) кнопка «Назад»
btnBack.addEventListener('click', () => {
  if (window.history.length > 1) {
    history.back();
  } else {
    // если нет истории (например, открыто напрямую) — вернём на главную
    location.href = './index.html';  // при необходимости поменяй путь
  }
});

// 4) вращение
let isSpinning = false; // флаг на время анимации

btnSpin.addEventListener('click', () => {
  // если уже крутим или дневной лок стоит — выходим
  if (btnSpin.disabled || isSpinning) return;

  // моментально блокируем
  isSpinning = true;
  btnSpin.disabled = true;
  btnSpin.setAttribute('aria-busy', 'true');

  // для теста: случайный сектор (на проде — спросить у сервера)
  const index = Math.floor(Math.random() * SECTORS.length);

  spinToIndex(index).then(() => {
    const prize = SECTORS[index];

    // обновляем локальный баланс
    const bal = +(localStorage.getItem(STORAGE_KEY_BAL) || 0) + prize;
    localStorage.setItem(STORAGE_KEY_BAL, bal);

    // ставим суточный лок
    const next = Date.now() + 24*60*60*1000;
    localStorage.setItem(STORAGE_KEY_NEXT, next);
    showNote(next);

    // уведомление (замени на свой UI)
    alert(`+${prize} PLAMc`);

    // КНОПКУ НЕ РАЗБЛОКИРУЕМ — пусть остаётся disabled до завтра
    // (в тестовом режиме всё сбросится после перезагрузки страницы)
    isSpinning = false;
    btnSpin.setAttribute('aria-busy', 'false');
  });
});


// ===== ФУНКЦИИ =====
function spinToIndex(index){
  return new Promise(resolve => {
    const target = WHEEL_SPINS * 360 - index * SECTOR_DEG; // сектор 0 уже "на 3 часа"
    wheel.style.transition = `transform ${DURATION_SEC}s cubic-bezier(.17,.89,.12,1)`;
    wheel.style.transform  = `rotate(${target}deg)`;
    wheel.addEventListener('transitionend', () => resolve(), { once: true });
  });
}

function showNote(nextTs){
  const diff = Math.max(0, nextTs - Date.now());
  const hrs = Math.floor(diff/3600000);
  const mins = Math.floor((diff%3600000)/60000);
  note.hidden = false;
  note.textContent = `Следующее вращение через ${hrs}ч ${mins}м. (в тесте сбросится при обновлении)`;
}

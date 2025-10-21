// Номиналы по секторам — начиная с сектора на "3 часа", далее ПО ЧАСОВОЙ
const SECTORS = [2,4,6,8,10,12,14,16,18,20];   // 10 штук
const SECTOR_DEG = 360 / SECTORS.length;       // 36°
const WHEEL_SPINS = 10;                         // лишние обороты
const DURATION_SEC = 7;                         // длительность анимации
const STORAGE_KEY_NEXT = 'fortuneNextTs';
const STORAGE_KEY_BAL = 'plamBalance';         // локальный баланс (если нужен)

// Инициализация
const wheel   = document.getElementById('wheel');
const btnSpin = document.getElementById('btnSpin');
const note    = document.getElementById('spinNote');
const numsBox = document.getElementById('wheelNumbers');

// 1) Рисуем цифры по окружности
SECTORS.forEach((value, i) => {
  const span = document.createElement('span');
  span.className = 'wheel__label';
  // угол для i-го сектора: 0°, 36°, 72° ... (центр сектора)
  span.style.setProperty('--a', `${i * SECTOR_DEG}deg`);
  span.textContent = value;
  numsBox.appendChild(span);
});

// 2) Блокируем кнопку, если ещё не прошли сутки
const now = Date.now();
const nextTs = +localStorage.getItem(STORAGE_KEY_NEXT) || 0;
if (now < nextTs) {
  btnSpin.disabled = true;
  showNote(nextTs);
}

// 3) Вращение
btnSpin.addEventListener('click', async () => {
  if (btnSpin.disabled) return;

  // Для античитинга это должно приходить с бэка:
  // const { index, nextAllowedAt } = await fetch(...);
  const index = Math.floor(Math.random() * SECTORS.length);

  spinToIndex(index).then(() => {
    // Начисляем монеты (на реальном проекте делай это на сервере)
    const prize = SECTORS[index];
    const bal = +(localStorage.getItem(STORAGE_KEY_BAL) || 0) + prize;
    localStorage.setItem(STORAGE_KEY_BAL, bal);

    // Ставим дневной лок
    const day = 24*60*60*1000;
    const next = Date.now() + day;
    localStorage.setItem(STORAGE_KEY_NEXT, next);

    btnSpin.disabled = true;
    showNote(next);

    // Если на главной странице читаешь баланс из localStorage — он уже обновлён.
    // Если облако «плюс» рисуется отдельно, просто обнови его при заходе.
    alert(`+${prize} PLAMc`);
  });
});

// Функция анимации к нужному сектору
function spinToIndex(index){
  return new Promise(resolve => {
    // Вращаем КОЛЕСО. Угол считаем так:
    // сектор #0 изначально смотрит на "3 часа" ⇒ его центр = 0°
    // чтобы привести сектор i под стрелку, крутим на -i*36°
    const target = WHEEL_SPINS*360 - index*SECTOR_DEG;

    // плавная анимация
    wheel.style.transition = `transform ${DURATION_SEC}s cubic-bezier(.17,.89,.12,1)`;
    wheel.style.transform = `rotate(${target}deg)`;

    const onEnd = () => { 
      wheel.removeEventListener('transitionend', onEnd);
      resolve();
    };
    wheel.addEventListener('transitionend', onEnd, { once:true });
  });
}

function showNote(nextTs){
  const diff = Math.max(0, nextTs - Date.now());
  const hrs = Math.floor(diff/3600000);
  const mins = Math.floor((diff%3600000)/60000);
  note.hidden = false;
  note.textContent = `Следующее вращение через ${hrs}ч ${mins}м.`;
}

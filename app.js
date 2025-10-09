// --- Telegram WebApp ---
if (window.Telegram && window.Telegram.WebApp) {
  try { window.Telegram.WebApp.expand(); } catch(e) {}
}

// --- Глобальный state (храним баланс/премиум/счётчики) ---
window.PLAM = window.PLAM || { balance: 0, premium: false, photoCount: 0 };

// --- Модалка ---
const modalRoot = document.querySelector('[data-modal-root]');
const modalContent = document.querySelector('[data-modal-content]');

function openModal(id){
  const tpl = document.getElementById(`tpl-${id}`);
  if (!tpl) return;
  modalContent.innerHTML = '';
  modalContent.appendChild(tpl.content.cloneNode(true));
  modalRoot.hidden = false;
  modalRoot.setAttribute('aria-hidden','false');
  document.documentElement.style.overflow = 'hidden';

  if (id === 'upload-popup') initUploadPopup();
  if (id === 'buy-stars')    initBuyStars();
  if (id === 'prizes')       initPrizes();
  if (id === 'profile')      initProfile();
  if (id === 'confirm-premium') initConfirmPremium();
}

function closeModal(){
  modalRoot.hidden = true;
  modalRoot.setAttribute('aria-hidden','true');
  modalContent.innerHTML = '';
  document.documentElement.style.overflow = '';
}

document.addEventListener('click', (e) => {
  const opener = e.target.closest('[data-open-modal]');
  if (opener) { openModal(opener.getAttribute('data-open-modal')); return; }
  if (e.target.matches('[data-dismiss]') || e.target.closest('[data-dismiss]')) closeModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !modalRoot.hidden) closeModal();
});

// --- Индикатор на плюс-облаке ---
function updatePlusBalanceUI(){
  const el = document.getElementById('plusValue');
  if (el) el.textContent = String(window.PLAM.balance || 0); // без "+"
  // ...обновляешь aria-label при желании
}
updatePlusBalanceUI();

// --- Попап 1: загрузка фото ---
function initUploadPopup(){
  const root = modalRoot.querySelector('.upload-popup');
  if (!root) return;

  // файл
  const fileInput = root.querySelector('#file-input');
  root.querySelector('.btn-pick')?.addEventListener('click', ()=>fileInput?.click());

  // 2) Слайдер
const range   = root.querySelector('.range');
const starsEl = root.querySelector('[data-stars]');
const secsEl  = root.querySelector('[data-secs]');

if (range && starsEl && secsEl) {
  const update = () => {
    const v = Number(range.value);          // 0..20
    starsEl.textContent = `${v} PLAMc`;     // слева — просто число PLAMc
    // справа — 0 sec для 0, и +N sec начиная с 1
    secsEl.textContent  = (v === 0) ? '0 sec' : `+${v} sec`;
  };
  range.addEventListener('input', update);
  update(); // выставить начальное состояние
}


  // отправка
  root.querySelector('[data-upload-form]')?.addEventListener('submit', (e)=>{
    e.preventDefault();
    const need = parseInt(range.value || '0', 10) || 0;

    if (need > 0 && (window.PLAM.balance||0) <= 0) {
      alert('Недостаточно PLAMc');
      return;
    }
    if (need > (window.PLAM.balance||0)) {
      alert('Недостаточно PLAMc');
      return;
    }

    // списываем и обновляем индикатор
    window.PLAM.balance -= need;
    updatePlusBalanceUI();

    // TODO: отправка на сервер/TG
    closeModal();
  });
}

// --- Попап 2: магазин (покупка PLAMc) ---
function initBuyStars(){
  const root = modalRoot.querySelector('.shop-popup');
  if (!root) return;

  root.querySelectorAll('.shop-item').forEach(btn=>{
    btn.addEventListener('click', (e)=>{
      e.preventDefault();

      const amount = Number(btn.dataset.amount || 0);
      // локально увеличиваем баланс
      window.PLAM.balance = (window.PLAM.balance || 0) + amount;
      updatePlusBalanceUI();

      // НИКАКОГО sendData здесь — Android закроет WebApp.
      // Можно показать хаптик/алерт, чтобы было видно действие:
      try { window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light'); } catch(_) {}
      try { window.Telegram?.WebApp?.showAlert?.(`+${amount} PLAMc`); } catch(_) {}

      // остаёмся внутри WebApp; модалку закрывать не обязательно
      // closeModal();
    }, { passive:false });
  });
}


// --- Попап 3: призы ---
function initPrizes(){
  const root = modalRoot.querySelector('.prizes-popup');
  if (!root) return;

  const payBtn = root.querySelector('.btn-pay');
  const sync = () => payBtn.disabled = !root.querySelector('.check-input:checked');
  root.addEventListener('change', (e)=>{ if (e.target.matches('.check-input')) sync(); });
  sync();

  payBtn.addEventListener('click', ()=>{
    // TODO: логика выплаты
    closeModal();
  });
}

// --- Попап 4: профиль ---
function initProfile(){
  const root = document.querySelector('[data-modal-root] .profile-popup');
  if (!root) return;

  // Источники данных
  const tg = window.Telegram?.WebApp;
  const plam = (window.PLAM ||= {});
  plam.user ||= {};
  plam.user.username ||= tg?.initDataUnsafe?.user?.username || '';
  plam.user.photoUrl ||= tg?.initDataUnsafe?.user?.photo_url || '';
  plam.photosCount ??= 0;
  plam.balance ??= 0;
  plam.isPremium ??= false; // если уже активирован — true
  // если активирован, желательно хранить премиум до:
  // plam.premiumUntil = Date.now() + 30*24*60*60*1000;

  // Узлы
  const avatarEl   = root.querySelector('[data-avatar]');
  const unameEl    = root.querySelector('[data-username]');
  const countEl    = root.querySelector('[data-photos-count]');
  const timeEl     = root.querySelector('[data-photo-time]');
  const crownEl    = root.querySelector('[data-crown]');
  const rowEl      = root.querySelector('[data-premium-row]');
  const chipEl     = root.querySelector('[data-premium-chip]');
  const timerEl    = root.querySelector('[data-premium-timer]');
  const btnPrem    = root.querySelector('[data-premium-btn]');
  const helpBtn    = root.querySelector('[data-help]');
  const helpSheet  = root.querySelector('[data-help-sheet]');
  const helpClose  = root.querySelector('[data-help-close]');

  // Аватар/ник
  if (plam.user.photoUrl) {
    avatarEl.style.backgroundImage = `url("${plam.user.photoUrl}")`;
  }
  unameEl.textContent = plam.user.username ? `@${plam.user.username}` : '@tg profile';

  // Показываем нужный вид «премиума»
  function renderPremiumView() {
    if (plam.isPremium) {
      rowEl.hidden  = true;
      chipEl.hidden = false;
      crownEl.hidden = false;

      // Запуск таймера если есть premiumUntil
      if (!plam.premiumUntil) {
        // если по какой-то причине нет — считаем от 30 дней с текущего момента
        plam.premiumUntil = Date.now() + 30*24*60*60*1000;
      }
      startPremiumTimer(plam.premiumUntil, timerEl);
    } else {
      rowEl.hidden  = false;
      chipEl.hidden = true;
      crownEl.hidden = true;
      stopPremiumTimer(timerEl);
    }
  }

  // Время показа: базовое 20/40 + за каждые 100 фото
  function renderPhotoTime() {
    const base = plam.isPremium ? 40 : 20;
    const extra = Math.floor((plam.photosCount || 0) / 100);
    timeEl.textContent = `${base + extra} сек`;
  }

  // Кол-во фото
  countEl.textContent = (plam.photosCount || 0);

  renderPremiumView();
  renderPhotoTime();

  // Кнопка «Получить премиум» — оставляю твой флоу (покупка/проверки)
  if (btnPrem) {
    btnPrem.addEventListener('click', () => {
      // здесь твоя существующая логика:
      // 1) если недостаточно PLAMc -> открыть попап покупки монет (buy-stars)
      // 2) иначе открыть подтверждение покупки премиума
      if (typeof openPremiumConfirm === 'function') {
        openPremiumConfirm(); // если у тебя есть такая функция
      } else {
        // запасной вариант: простое подтверждение
        const ok = confirm('Вы хотите получить премиум на 30 дней за 1500 PLAMc?');
        if (ok) {
          // Эмулируем покупку: списать 1500 (если хватает) и активировать
          const price = 1500;
          if ((plam.balance || 0) >= price) {
            plam.balance -= price;
            plam.isPremium = true;
            plam.premiumUntil = Date.now() + 30*24*60*60*1000;
            renderPremiumView();
            renderPhotoTime();
          } else {
            // если не хватает — открыть магазин
            if (typeof openModal === 'function') openModal('buy-stars');
          }
        }
      }
    });
  }

  // Хелп-оверлей
  if (helpBtn && helpSheet) {
    helpBtn.addEventListener('click', () => { helpSheet.hidden = false; });
  }
  if (helpClose && helpSheet) {
    helpClose.addEventListener('click', () => { helpSheet.hidden = true; });
  }
}

/* ===== таймер 30 дней ===== */
let _premiumTimerId = null;
function startPremiumTimer(untilTs, targetEl){
  stopPremiumTimer(targetEl);
  const tick = () => {
    const ms = Math.max(0, untilTs - Date.now());
    const days = Math.floor(ms / (24*60*60*1000));
    const hours = Math.floor((ms % (24*60*60*1000)) / (60*60*1000));
    const minutes = Math.floor((ms % (60*60*1000)) / (60*1000));
    if (targetEl) targetEl.textContent = `${days} д ${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}`;
    if (ms <= 0) {
      const plam = (window.PLAM ||= {});
      plam.isPremium = false;
      plam.premiumUntil = undefined;
      // Перерисовать профиль, если открыт
      const opened = document.querySelector('[data-modal-root] .profile-popup');
      if (opened) initProfilePopup();
      stopPremiumTimer(targetEl);
    }
  };
  _premiumTimerId = setInterval(tick, 30*1000); // раз в 30 сек достаточно
  tick();
}
function stopPremiumTimer(){
  if (_premiumTimerId) { clearInterval(_premiumTimerId); _premiumTimerId = null; }
}


// --- Подтверждение покупки премиума ---
function initConfirmPremium(){
  const root = modalRoot.querySelector('.confirm-popup');
  if (!root) return;

  root.querySelector('[data-confirm-yes]')?.addEventListener('click', ()=>{
    const price = 1500; // заглушка цены
    if ((window.PLAM.balance||0) < price){
      closeModal(); openModal('buy-stars'); return;
    }
    window.PLAM.balance -= price;
    window.PLAM.premium  = true;
    updatePlusBalanceUI();
    closeModal();
    openModal('profile');
  });
}

// --- DEBUG хот-спотов: ?debug=1 в URL или Shift+D ---
(function debugHotspots(){
  const on = /[?&]debug=1/.test(location.search);
  if (on) document.body.classList.add('__debug');
  window.addEventListener('keydown', (e)=>{
    if ((e.key === 'D' || e.key === 'd') && e.shiftKey){
      document.body.classList.toggle('__debug');
    }
  });

  // Быстрый самотест: пишем размеры и наличие пенька в консоль
  window.setTimeout(()=>{
    ['stump','plus','gift','notebook'].forEach(name=>{
      const el = document.querySelector(`.hotspot--${name}`);
      if (!el) { console.warn('нет хот-спота:', name); return; }
      const r = el.getBoundingClientRect();
      console.log(`hotspot:${name}`, r.width.toFixed(1), '×', r.height.toFixed(1), 'at', r.left.toFixed(1), r.top.toFixed(1));
    });
  }, 0);
})();

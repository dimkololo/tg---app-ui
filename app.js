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
  const root = modalRoot.querySelector('.profile-popup');
  if (!root) return;

  const avatarEl   = root.querySelector('[data-avatar]');
  const usernameEl = root.querySelector('[data-username]');
  const btnPremium = root.querySelector('[data-btn-premium]');

  // данные TG (если доступны)
  const tg  = window.Telegram?.WebApp;
  const usr = tg?.initDataUnsafe?.user || null;
  const firstLast = usr ? [usr.first_name, usr.last_name].filter(Boolean).join(' ') : '';
  const handle    = usr?.username ? '@' + usr.username : (firstLast || '@tg profile');

  usernameEl.textContent = handle;
  if (usr?.photo_url) avatarEl.style.backgroundImage = `url("${usr.photo_url}")`;

  // заполняем статистику
  const photos = Number(window.PLAM.photoCount || 0);
  root.querySelector('[data-photo-count]').textContent = String(photos);

  // базовое время: 40 сек при премиуме, 20 сек иначе
  const baseSecs = window.PLAM.premium ? 40 : 20;
  const secs = baseSecs + Math.floor(photos / 100);
  root.querySelector('[data-show-seconds]').textContent = `${secs} сек`;

  // кнопка премиума
   const setBtn = ()=>{
    if (window.PLAM.premium){
      btnPremium.textContent = 'Премиум';
      btnPremium.classList.add('is-owned');
      btnPremium.disabled = true;
    } else {
      btnPremium.textContent = 'Получить премиум';
      btnPremium.classList.remove('is-owned');
      btnPremium.disabled = false;
    }
  };
  setBtn();

  btnPremium.addEventListener('click', ()=>{
    if (window.PLAM.premium) return;
    openModal('confirm-premium');
  });
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

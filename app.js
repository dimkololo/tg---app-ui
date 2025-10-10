// --- Telegram WebApp ---
if (window.Telegram && window.Telegram.WebApp) {
  try { window.Telegram.WebApp.expand(); } catch(e) {}
}

// --- Глобальный state ---
window.PLAM = window.PLAM || { balance: 0, premium: false, photoCount: 0, premiumUntil: null };


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
  if (id === 'premium-timer') initPremiumTimer();
}

// второй слой модалки (стек)
const stackRoot    = document.querySelector('[data-modal-stack]');
const stackContent = document.querySelector('[data-stack-content]');

function openStack(id){
  const tpl = document.getElementById(`tpl-${id}`);
  if (!tpl) return;
  stackContent.innerHTML = '';
  stackContent.appendChild(tpl.content.cloneNode(true));
  stackRoot.hidden = false;
  stackRoot.setAttribute('aria-hidden','false');

  // инициализаторы для шаблонов стека
  if (id === 'premium-timer') initPremiumTimer();
}

function closeStack(){
  stackRoot.hidden = true;
  stackRoot.setAttribute('aria-hidden','true');
  stackContent.innerHTML = '';
}


// --- Попап: таймер премиума ---
function initPremiumTimer(){
  const root = stackRoot.querySelector('.timer-popup'); // ← в стеке
  if (!root) return;

  const box = root.querySelector('[data-remaining]');
  if (!window.PLAM.premiumUntil) {
    window.PLAM.premiumUntil = Date.now() + 30*24*60*60*1000;
  }

  const tick = ()=>{
    const now = Date.now();
    let ms = Math.max(0, window.PLAM.premiumUntil - now);

    const totalMinutes = Math.floor(ms / 60000);
    const days    = Math.floor(totalMinutes / (24*60));
    const hours   = Math.floor((totalMinutes - days*24*60) / 60);
    const minutes = totalMinutes - days*24*60 - hours*60;

    box.textContent = `${days}д. ${hours}ч. ${minutes}мин.`;

    if (ms <= 0){
      clearInterval(timer);
      window.PLAM.premium = false;
      window.PLAM.premiumUntil = null;
      try { window.Telegram?.WebApp?.showAlert?.('Премиум истёк'); } catch(_) {}
      closeStack();                     // закрываем только верхний слой
      // при желании можно обновить профиль:
      // closeModal(); openModal('profile');
    }
  };

  tick();
  const timer = setInterval(tick, 1000);

  // стопаем таймер при закрытии именно стека
  root.addEventListener('click', (e)=>{
    if (e.target.matches('[data-dismiss-stack]') || e.target.closest('[data-dismiss-stack]')){
      clearInterval(timer);
    }
  });
  document.addEventListener('keydown', function escOnce(ev){
    if (ev.key === 'Escape' && !modalRoot.hidden){
      clearInterval(timer);
      document.removeEventListener('keydown', escOnce);
    }
  });
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

  if (e.target.matches('[data-dismiss-stack]') || e.target.closest('[data-dismiss-stack]')) {
    closeStack(); return;
  }
  if (e.target.matches('[data-dismiss]') || e.target.closest('[data-dismiss]')) {
    closeModal(); return;
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (!stackRoot.hidden) { closeStack(); return; }
    if (!modalRoot.hidden) { closeModal(); }
  }
});


// --- Индикатор на плюс-облаке ---
function updatePlusBalanceUI(){
  const el = document.getElementById('plusValue');
  if (el) el.textContent = String(window.PLAM.balance || 0);
}
updatePlusBalanceUI();

// --- Попап 1: загрузка фото ---
function initUploadPopup(){
  const root = modalRoot.querySelector('.upload-popup');
  if (!root) return;

  // файл
  const fileInput = root.querySelector('#file-input');
  root.querySelector('.btn-pick')?.addEventListener('click', ()=>fileInput?.click());

  // слайдер
  const range   = root.querySelector('.range');
  const starsEl = root.querySelector('[data-stars]');
  const secsEl  = root.querySelector('[data-secs]');
  if (range && starsEl && secsEl) {
    const update = () => {
      const v = Number(range.value);          // 0..20
      starsEl.textContent = `${v} PLAMc`;
      secsEl.textContent  = (v === 0) ? '0 sec' : `+${v} sec`;
    };
    range.addEventListener('input', update);
    update();
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

    window.PLAM.balance -= need;
    updatePlusBalanceUI();

    // TODO: отправка на сервер/TG
    closeModal();
  });
}

// --- Попап 2: магазин ---
function initBuyStars(){
  const root = modalRoot.querySelector('.shop-popup');
  if (!root) return;

  root.querySelectorAll('.shop-item').forEach(btn=>{
    btn.addEventListener('click', (e)=>{
      e.preventDefault();

      const amount = Number(btn.dataset.amount || 0);
      window.PLAM.balance = (window.PLAM.balance || 0) + amount;
      updatePlusBalanceUI();

      try { window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light'); } catch(_) {}
      try { window.Telegram?.WebApp?.showAlert?.(`+${amount} PLAMc`); } catch(_) {}
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

  // статистика
  const photos = Number(window.PLAM.photoCount || 0);
  root.querySelector('[data-photo-count]').textContent = String(photos);

  // базовое время: 40 сек при премиуме, 20 сек иначе + 1 сек за каждые 100 фото
  const baseSecs = window.PLAM.premium ? 40 : 20;
  const secs = baseSecs + Math.floor(photos / 100);
  root.querySelector('[data-show-seconds]').textContent = `${secs} сек`;

  // Кнопка/плашка премиума + корона
  const setBtn = ()=>{
  if (window.PLAM.premium){
    btnPremium.textContent = 'Премиум активен';
    btnPremium.classList.add('is-owned');   // ← активный премиум
    btnPremium.disabled = false;            // ← НЕ отключаем
    avatarEl.classList.add('has-crown');
  } else {
    btnPremium.textContent = 'Получить премиум';
    btnPremium.classList.remove('is-owned');
    btnPremium.disabled = false;
    avatarEl.classList.remove('has-crown');
  }
};
setBtn();

btnPremium.addEventListener('click', ()=>{
  if (window.PLAM.premium){
    openStack('premium-timer');   // ← поверх профиля
  } else {
    openModal('confirm-premium');
  }
});
}  


// --- Подтверждение покупки премиума ---
function initConfirmPremium(){
  const root = modalRoot.querySelector('.confirm-popup');
  if (!root) return;

  root.querySelector('[data-confirm-yes]')?.addEventListener('click', ()=>{
  const price = 1500;
  if ((window.PLAM.balance||0) < price){
    closeModal(); openModal('buy-stars'); return;
  }
  window.PLAM.balance -= price;
  window.PLAM.premium  = true;

  // 30 дней вперёд от текущего момента (сбрасывается при перезагрузке)
  const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
  window.PLAM.premiumUntil = Date.now() + THIRTY_DAYS;

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

// --- Telegram WebApp ---
if (window.Telegram && window.Telegram.WebApp) {
  try { window.Telegram.WebApp.expand(); } catch(e) {}
}

// --- Глобальный state ---
window.PLAM = window.PLAM || { balance: 0, premium: false, photoCount: 0, premiumUntil: null, subsOk: false };

// --- Автозакрытие через 15 минут (анти-автозагрузка/макросы) ---
(function setupAutoClose(){
  const AUTO_CLOSE_MS = 15 * 60 * 1000;  // 15 минут
  const WARN_MS       = 30 * 1000;       // предупредим за 30 сек
  const deadline      = Date.now() + AUTO_CLOSE_MS;

  let warned = false;
  const tick = () => {
    const left = deadline - Date.now();

    // разовое предупреждение
    if (!warned && left <= WARN_MS && left > 0) {
      warned = true;
      try {
        window.Telegram?.WebApp?.showAlert?.('Сессия будет закрыта через 30 секунд для безопасности.');
      } catch(_) {}
    }

    // закрываем
    if (left <= 0) {
      // корректное закрытие WebApp
      try { window.Telegram?.WebApp?.close?.(); } catch(_) {}

      // фолбек на случай запуска вне Telegram
      try { window.close(); } catch(_) {}
      try { location.replace('about:blank'); } catch(_) {}

      clearInterval(timer);
    }
  };

  tick();
  const timer = setInterval(tick, 1000);
})();



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

  if (id === 'premium-timer')   initPremiumTimer();
  if (id === 'confirm-premium') initConfirmPremium();   // ← добавь это
  if (id === 'subs-required')  initSubsRequired();

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

  // стопаем таймер при закрытии именно стека (клик по кресту/бэкдропу)
  root.addEventListener('click', (e)=>{
    if (e.target.matches('[data-dismiss-stack]') || e.target.closest('[data-dismiss-stack]')){
      clearInterval(timer);
    }
  });

  // и по Esc — если открыт стек
  document.addEventListener('keydown', function escOnce(ev){
    if (ev.key === 'Escape' && !stackRoot.hidden){
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

  // элементы
  const fileInput  = root.querySelector('#file-input');
  const submitBtn  = root.querySelector('[data-submit]');
  const form       = root.querySelector('[data-upload-form]');
  const range      = root.querySelector('.range');
  const starsEl    = root.querySelector('[data-stars]');
  const secsEl     = root.querySelector('[data-secs]');
  const urlInput   = root.querySelector('input[name="social"]');

  // кнопка выбора файла
  root.querySelector('.btn-pick')?.addEventListener('click', ()=>fileInput?.click());

  // слайдер
  if (range && starsEl && secsEl) {
    const update = () => {
      const v = Number(range.value);
      starsEl.textContent = `${v} PLAMc`;
      secsEl.textContent  = (v === 0) ? '0 sec' : `+${v} sec`;
    };
    range.addEventListener('input', update);
    update();
  }

  // счётчики символов (если ты добавляла data-counter в HTML)
  const bindCounter = (el)=>{
    if (!el) return;
    const id  = el.getAttribute('data-counter');
    const box = root.querySelector(`[data-counter-for="${id}"]`);
    const max = Number(el.getAttribute('maxlength')) || 0;
    const upd = ()=>{ box && (box.textContent = `${el.value.length} / ${max}`); };
    el.addEventListener('input', upd); upd();
  };
  bindCounter(root.querySelector('[data-counter="link"]'));
  bindCounter(root.querySelector('[data-counter="desc"]'));

  // валидация URL (мягкая)
  function isValidUrlLike(v){
    if (!v) return true;
    const tme  = /^https?:\/\/t\.me\/.+/i;
    const http = /^https?:\/\/.+/i;
    return tme.test(v) || http.test(v);
  }

  // активность кнопки "Отправить" — файлы + подписка
  const updateSubmitState = ()=>{
    const hasFiles = fileInput?.files && fileInput.files.length > 0;
    submitBtn.disabled = !(hasFiles && window.PLAM.subsOk === true);
  };
  fileInput?.addEventListener('change', updateSubmitState);
  updateSubmitState();

  // отправка
  form?.addEventListener('submit', (e)=>{
    e.preventDefault();

    // 1) должны быть выбраны файлы
    const filesCount = fileInput?.files?.length || 0;
    if (filesCount === 0){ updateSubmitState(); return; }

    // 2) если подписка не подтверждена — открываем попап в стеке
    if (!window.PLAM.subsOk){ openStack('subs-required'); return; }

    // 3) проверка баланса по слайдеру
    const need = parseInt(range?.value || '0', 10) || 0;
    if (need > 0 && (window.PLAM.balance||0) <= 0) { alert('Недостаточно PLAMc'); return; }
    if (need > (window.PLAM.balance||0))          { alert('Недостаточно PLAMc'); return; }

    // 4) проверка url
    const link = urlInput?.value.trim();
    if (link && !isValidUrlLike(link)){
      alert('Ссылка должна начинаться с http:// или https:// (поддерживается и https://t.me/...)');
      urlInput.focus();
      return;
    }

    // 5) списываем валюту
    window.PLAM.balance -= need;
    updatePlusBalanceUI();

    // 6) увеличиваем счётчик фото
    window.PLAM.photoCount = (window.PLAM.photoCount || 0) + filesCount;

    // 7) если профиль открыт — обновим плашки
    if (!modalRoot.hidden && modalRoot.querySelector('.profile-popup')){
      refreshProfileUI?.();
    }

    // 8) TODO: реальная отправка
    closeModal();
  });
}


function initSubsRequired(){
  const root = stackRoot.querySelector('.subs-popup');
  if (!root) return;

  let clickedYT = false;
  let clickedTG = false;

  // считаем «кликнутым», если пользователь открыл ссылку
  root.querySelector('[data-sub-yt]')?.addEventListener('click', ()=>{ clickedYT = true; });
  root.querySelector('[data-sub-tg]')?.addEventListener('click', ()=>{ clickedTG = true; });

  const btnCheck = root.querySelector('[data-check-subs]');

  btnCheck?.addEventListener('click', async ()=>{
    // В реале: вызвать бэкенд, который проверит подписку через бота (getChatMember).
    // Здесь — фронтенд-демо: считаем ок, если обе ссылки открывали.
    if (!clickedYT || !clickedTG){
      try { window.Telegram?.WebApp?.showAlert?.('Откройте обе ссылки и подпишитесь.'); } catch(_) {}
      return;
    }

    // Условие выполнено
    window.PLAM.subsOk = true;
    btnCheck.textContent = 'Спасибо';
    btnCheck.classList.add('is-ok');
    btnCheck.disabled = true;

    // Обновим состояние кнопки "Отправить" в открытом попапе загрузки
    const uploadRoot = modalRoot.querySelector('.upload-popup');
    if (uploadRoot){
      const fileInput = uploadRoot.querySelector('#file-input');
      const submitBtn = uploadRoot.querySelector('[data-submit]');
      const hasFiles = fileInput?.files && fileInput.files.length > 0;
      if (submitBtn) submitBtn.disabled = !(hasFiles && window.PLAM.subsOk === true);
    }
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
    openStack('premium-timer');     // поверх профиля
  } else {
    openStack('confirm-premium');   // ← вместо openModal(...)
  }
});

}  

function refreshProfileUI(){
  const root = modalRoot.querySelector('.profile-popup');
  if (!root) return;

  // число фото и секунды
  const photos = Number(window.PLAM.photoCount || 0);
  root.querySelector('[data-photo-count]').textContent = String(photos);
  const baseSecs = window.PLAM.premium ? 40 : 20;
  const secs = baseSecs + Math.floor(photos / 100);
  root.querySelector('[data-show-seconds]').textContent = `${secs} сек`;

  // кнопка + корона
  const avatarEl   = root.querySelector('[data-avatar]');
  const btnPremium = root.querySelector('[data-btn-premium]');
  if (window.PLAM.premium){
    btnPremium.textContent = 'Премиум активен';
    btnPremium.classList.add('is-owned');
    avatarEl?.classList.add('has-crown');
  } else {
    btnPremium.textContent = 'Получить премиум';
    btnPremium.classList.remove('is-owned');
    avatarEl?.classList.remove('has-crown');
  }
}



// --- Подтверждение покупки премиума ---
function initConfirmPremium(){
  const root = stackRoot.querySelector('.confirm-popup'); // ← ищем в стеке
  if (!root) return;

  root.querySelector('[data-confirm-yes]')?.addEventListener('click', ()=>{
    const price = 1500;

    // НЕ хватает средств → закрываем подтверждение + профиль, открываем магазин
    if ((window.PLAM.balance || 0) < price){
      closeStack();        // закрыли верхний слой
      closeModal();        // закрыли профиль
      openModal('buy-stars');
      return;
    }

    // Достаточно средств → списываем и активируем
    window.PLAM.balance -= price;
    window.PLAM.premium  = true;
    const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
    window.PLAM.premiumUntil = Date.now() + THIRTY_DAYS;

    updatePlusBalanceUI();

    // закрываем только подтверждение и обновляем открытый профиль
    closeStack();
    refreshProfileUI();
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

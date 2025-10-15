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
  if (id === 'faq') initFAQ();
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
  if (id === 'premium-help')  initPremiumHelp();

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
  const fileInput   = root.querySelector('#file-input');
  const btnPick     = root.querySelector('.btn-pick');
  const submitBtn   = root.querySelector('[data-submit]');
  const form        = root.querySelector('[data-upload-form]');
  const range       = root.querySelector('.range');
  const starsEl     = root.querySelector('[data-stars]');
  const secsEl      = root.querySelector('[data-secs]');
  const urlInput    = root.querySelector('input[name="social"]');

  // --- управление клавиатурой ---
const descEl = root.querySelector('textarea[name="desc"]');


// --- фикс "смещения кликов" после закрытия клавиатуры ---
function normalizeAfterKeyboard() {
  // даём WebView отпустить клаву
  setTimeout(() => {
    // 1) возвращаем скролл к нулю (у некоторых webview остаётся смещение)
    window.scrollTo(0, 0);

    // 2) форсируем reflow/перерисовку диалога
    const dlg = modalRoot.querySelector('.modal__dialog');
    if (dlg) {
      dlg.style.transform = 'translateZ(0)'; // включили слой
      void dlg.offsetHeight;                 // форс-рефлоу
      dlg.style.transform = '';              // выключили
    }
  }, 80);
}

// Enter на ссылке -> фокус в описание (как раньше)
if (urlInput) {
  urlInput.setAttribute('enterkeyhint', 'next');
  urlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); descEl?.focus(); }
  });
}

// На описании: Enter/Готово -> скрыть клавиатуру и поправить хит-тест
if (descEl) {
  descEl.setAttribute('enterkeyhint', 'done');
  const hideKb = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      descEl.blur();              // закрыли клавиатуру
      normalizeAfterKeyboard();   // починили смещение кликов
    }
  };
  descEl.addEventListener('keydown', hideKb);
  descEl.addEventListener('keypress', hideKb); // iOS подстраховка
  descEl.addEventListener('blur', normalizeAfterKeyboard);
}

// Доп. страховка: когда визуальный вьюпорт меняется (клава прячется) — тоже нормализуем
if (window.visualViewport) {
  const onVV = () => normalizeAfterKeyboard();
  window.visualViewport.addEventListener('resize', onVV);
  // слушатель можно не снимать — попапов немного, нагрузка нулевая
}



  
  // === счётчики символов ===
function bindCounter(el){
  if (!el) return;
  const id  = el.getAttribute('data-counter');
  const box = root.querySelector(`[data-counter-for="${id}"]`);
  const max = Number(el.getAttribute('maxlength')) || 0;

  const update = () => {
    const len = el.value.length;
    if (box) box.textContent = `${len} / ${max}`;
  };

  el.addEventListener('input', update);
  update(); // первичная отрисовка
}

// привязываем к полям
bindCounter(root.querySelector('[data-counter="link"]'));
bindCounter(root.querySelector('[data-counter="desc"]'));


  // предпросмотр
  const pickedEmpty = root.querySelector('.picked-empty');
  const pickedItem  = root.querySelector('.picked-item');
  const pickedImg   = root.querySelector('[data-picked-img]');
  const removeBtn   = root.querySelector('[data-remove-photo]');

  // === состояние «есть ли файл» управляет кнопкой «Отправить»
  let objectUrl = null;
  let hasFile = false;

  const updateSubmitState = ()=>{ submitBtn.disabled = !hasFile; };

  function showPreview(file){
    if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = null; }
    if (!file){
      hasFile = false;
      pickedItem.hidden = true;
      pickedEmpty.style.display = 'block';
      pickedImg.src = '';
      updateSubmitState();
      return;
    }
    hasFile = true;
    objectUrl = URL.createObjectURL(file);
    pickedImg.src = objectUrl;
    pickedEmpty.style.display = 'none';
    pickedItem.hidden = false;
    updateSubmitState();
  }

  
  fileInput?.addEventListener('change', ()=>{
    const f = fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;
    showPreview(f);
  });
  removeBtn?.addEventListener('click', ()=>{
    fileInput.value = '';
    showPreview(null);
  });
  showPreview(null); // старт

  // слайдер
  if (range && starsEl && secsEl) {
    const update = () => {
      const v = Number(range.value);
      starsEl.textContent = `${v} PLAMc`;
      secsEl.textContent  = (v === 0) ? '0 сек' : `+${v} сек`;
    };
    range.addEventListener('input', update);
    update();
  }

  // мягкая валидация URL
  function isValidUrlLike(v){
    if (!v) return true;
    const tme = /^https?:\/\/t\.me\/.+/i;
    const http = /^https?:\/\/.+/i;
    return tme.test(v) || http.test(v);
  }

  // отправка
  form?.addEventListener('submit', (e)=>{
    e.preventDefault();

    // без файла сюда обычно не попадём (кнопка disabled), но на всякий случай:
    if (!hasFile){
      try { window.Telegram?.WebApp?.showAlert?.('Прикрепите фото'); } catch(_) {}
      return;
    }

    // если подписка ещё не подтверждена — показываем попап и выходим.
    // НИЧЕГО не сбрасываем: фото остаётся, кнопка активна.
    if (!window.PLAM.subsOk){
      openStack('subs-required');
      return;
    }

    // проверка URL
    const link = urlInput?.value.trim();
    if (link && !isValidUrlLike(link)){
      alert('Ссылка должна начинаться с http:// или https:// (поддерживается и https://t.me/...)');
      urlInput.focus();
      return;
    }

    // проверка баланса
    const need = parseInt(range?.value || '0', 10) || 0;
    if (need > 0 && (window.PLAM.balance||0) <= 0) { alert('Недостаточно PLAMc'); return; }
    if (need > (window.PLAM.balance||0))          { alert('Недостаточно PLAMc'); return; }

    // списание
    window.PLAM.balance -= need;
    updatePlusBalanceUI();

    // учтём одно фото
    window.PLAM.photoCount = (window.PLAM.photoCount || 0) + 1;

    // обновим профиль, если он открыт
    if (!modalRoot.hidden && modalRoot.querySelector('.profile-popup')){
      refreshProfileUI?.();
    }

    // TODO: отправка на сервер/TG

    // очистка и закрытие
    showPreview(null);
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

  btnCheck?.addEventListener('click', ()=>{
  // здесь в бою должна быть реальная проверка
  // фронтенд-демо: считаем ок, если ссылки открывали (можно оставить как есть)

  // считаем проверку успешной:
  window.PLAM.subsOk = true;
  btnCheck.textContent = 'Спасибо';
  btnCheck.classList.add('is-ok');
  btnCheck.disabled = true;

  // Ничего не блокируем в форме загрузки — просто
  // если там прикреплено фото, кнопка уже активна.
  const uploadRoot = modalRoot.querySelector('.upload-popup');
  if (uploadRoot){
    const fileInput = uploadRoot.querySelector('#file-input');
    const submitBtn = uploadRoot.querySelector('[data-submit]');
    const hasFiles = !!(fileInput?.files && fileInput.files.length > 0);
    if (submitBtn) submitBtn.disabled = !hasFiles;  // ТОЛЬКО от наличия файла
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

  // Клик по зоне "вопросика" справа от кнопки премиума (псевдо-элемент ::after)
root.addEventListener('click', (ev) => {
  const btnRect = btnPremium.getBoundingClientRect();
  const x = ev.clientX;
  const y = ev.clientY;

  // геометрия пузыря "?": ширина/высота 50px, отстоит на 8px правее кнопки, по центру по вертикали
  const BUBBLE = 50;
  const GAP = 8;
  const left = btnRect.right + GAP;
  const top  = btnRect.top + (btnRect.height - BUBBLE) / 2;
  const hit = (x >= left && x <= left + BUBBLE && y >= top && y <= top + BUBBLE);

  if (hit) {
    ev.preventDefault();
    ev.stopPropagation();
    openStack('premium-help');
  }
});


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

function initPremiumHelp(){
  // тут пока ничего не нужно: закрытие по [data-dismiss-stack] уже работает
}

function initFAQ(){
  // Ничего особенного не нужно — закрытие по [data-dismiss] работает.
  // Оставлено для расширений (подгрузка картинок/контента).
}

// Таблица лидеров — открытие/закрытие попапа
document.addEventListener('DOMContentLoaded', () => {
  const modal   = document.getElementById('leadersModal');
  const openBtn = document.querySelector('.hotspot--wintable');
  if (!modal || !openBtn) return;

  const content = modal.querySelector('.modal__content');

  function open() {
    modal.hidden = false;
    document.body.style.overflow = 'hidden';   // блокируем скрол страницы
    content && content.classList.add('is-scrollable'); // у тебя этот класс уже есть в CSS
  }

  function close() {
    modal.hidden = true;
    document.body.style.overflow = '';         // возвращаем скрол
  }

  // открыть по клику на «листочек»
  openBtn.addEventListener('click', open);

  // закрыть по клику на подложку или на любую кнопку/элемент с data-close="leadersModal"
  modal.addEventListener('click', (e) => {
    const isBackdrop = e.target.classList.contains('modal__backdrop');
    const isCloseBtn = e.target.closest('[data-close="leadersModal"]');
    if (isBackdrop || isCloseBtn) close();
  });

  // закрыть по Esc
  window.addEventListener('keydown', (e) => {
    if (!modal.hidden && e.key === 'Escape') close();
  });
});

// Попап «Действия»
document.addEventListener('DOMContentLoaded', () => {
  const modal   = document.getElementById('actionsModal');
  const opener  = document.querySelector('.hotspot--actions');
  if (!modal || !opener) return;

  const content = modal.querySelector('.modal__content');

  const open = () => {
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    content && content.classList.add('is-scrollable');
  };
  const close = () => {
    modal.hidden = true;
    document.body.style.overflow = '';
  };

  opener.addEventListener('click', open);
  modal.addEventListener('click', (e) => {
    const isBackdrop = e.target.classList.contains('modal__backdrop');
    const isCloseBtn = e.target.closest('[data-close="actionsModal"]');
    if (isBackdrop || isCloseBtn) close();
  });
  window.addEventListener('keydown', (e) => {
    if (!modal.hidden && e.key === 'Escape') close();
  });
});




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

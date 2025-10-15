// --- Telegram WebApp ---
if (window.Telegram && window.Telegram.WebApp) {
  try { window.Telegram.WebApp.expand(); } catch(e) {}
}

// --- Глобальный state ---
window.PLAM = window.PLAM || {
  balance: 0,
  premium: false,
  photoCount: 0,
  premiumUntil: null,
  subsOk: false,
  cooldownUntil: null,          // ← когда можно снова отправлять
};


// восстановим кулдаун из localStorage (если был)
const savedCd = Number(localStorage.getItem('plam.cooldownUntil') || 0);
if (savedCd && savedCd > Date.now()) {
  window.PLAM.cooldownUntil = savedCd;
}

// признак, что была хотя бы одна успешная отправка
window.PLAM.hasUploaded = localStorage.getItem('plam.hasUploaded') === '1';


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

function getCooldownMinutes(){ return window.PLAM.premium ? 20 : 30; }
function isCooldownActive(){
  return typeof window.PLAM.cooldownUntil === 'number' && Date.now() < window.PLAM.cooldownUntil;
}
function setCooldownUntil(ts){
  window.PLAM.cooldownUntil = ts;
  if (!ts) localStorage.removeItem('plam.cooldownUntil');
  else     localStorage.setItem('plam.cooldownUntil', String(ts));
}

// Глобальный тикер: раз в 250мс шлём событие с остатком времени
(function setupCooldownTicker(){
  let timer = null;
  const tick = ()=>{
    const left = Math.max(0, (window.PLAM.cooldownUntil||0) - Date.now());
    document.dispatchEvent(new CustomEvent('plam:cooldown-tick', { detail: { leftMs: left } }));
    if (left <= 0) {
      if (window.PLAM.cooldownUntil) {
        setCooldownUntil(null);
        document.dispatchEvent(new CustomEvent('plam:cooldown-ended'));
      }
      stop();
    }
  };
  function start(){
    if (timer) return;
    timer = setInterval(tick, 250);
    tick();
  }
  function stop(){
    if (timer){ clearInterval(timer); timer = null; }
  }
  // запускаем, если при старте уже есть кулдаун
  if (isCooldownActive()) start();

  // публичный запуск
  window.PLAM_startCooldown = function(){
    const ms = getCooldownMinutes()*60*1000;
    setCooldownUntil(Date.now()+ms);
    start();
  };
  // публичный сброс
  window.PLAM_clearCooldown = function(){
    setCooldownUntil(null);
    stop();
    document.dispatchEvent(new CustomEvent('plam:cooldown-ended'));
  };
})();



// --- Попап: таймер премиума ---
function initPremiumTimer(){
  const root = stackRoot.querySelector('.timer-popup'); // ← в стеке
  if (!root) return;
  if (!window.PLAM.premium || !window.PLAM.premiumUntil){
  closeStack();
  return;
}

  const box = root.querySelector('[data-remaining]');

  const tick = ()=>{
    const now = Date.now();
    let ms = Math.max(0, window.PLAM.premiumUntil - now);

    const totalMinutes = Math.floor(ms / 60000);
    const days    = Math.floor(totalMinutes / (24*60));
    const hours   = Math.floor((totalMinutes - days*24*60) / 60);
    const minutes = totalMinutes - days*24*60 - hours*60;

    const hh = String(hours).padStart(2, '0');
    const mm = String(minutes).padStart(2, '0');
    box.textContent = `${days}д. ${hh}ч. ${mm}мин.`;

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

  
  // сохраним ссылку, чтобы снять позже
  const escOnce = (ev)=>{
    if (ev.key === 'Escape' && !stackRoot.hidden){
      clearInterval(timer);
      document.removeEventListener('keydown', escOnce);
    }
  };
  document.addEventListener('keydown', escOnce);

  // стопаем таймер при закрытии именно стека (клик по кресту/бэкдропу)
  root.addEventListener('click', (e)=>{
    if (e.target.matches('[data-dismiss-stack]') || e.target.closest('[data-dismiss-stack]')){
      clearInterval(timer);
      document.removeEventListener('keydown', escOnce); // ← ДОБАВЬ
    }
  });
}


function closeModal(){
  // Смотрим, был ли открыт попап загрузки (важно для очистки таймера)
  const wasUpload = !!modalRoot.querySelector('.upload-popup');

  modalRoot.hidden = true;
  modalRoot.setAttribute('aria-hidden','true');
  modalContent.innerHTML = '';
  document.documentElement.style.overflow = '';

  // Сообщим подписчикам (например, попап загрузки) что модалка закрылась
  document.dispatchEvent(new CustomEvent('plam:modal-closed', { detail: { wasUpload } }));
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
  const submitBtn   = root.querySelector('[data-submit]');
  const form        = root.querySelector('[data-upload-form]');
  const range       = root.querySelector('.range');
  const starsEl     = root.querySelector('[data-stars]');
  const secsEl      = root.querySelector('[data-secs]');
  const urlInput    = root.querySelector('input[name="social"]');

  // состояние предпросмотра
  let objectUrl = null;
  let hasFile = false;

  // --- helpers ---
  const fmtMMSS = (ms)=>{
    const total = Math.max(0, Math.floor(ms/1000));
    const mm = String(Math.floor(total/60)).padStart(2,'0');
    const ss = String(total%60).padStart(2,'0');
    return `${mm}мин. ${ss}сек.`;
  };

  // блок «Сбросить таймер»
  const submitRow = submitBtn?.closest('.u-center');
  let resetRow = root.querySelector('[data-reset-row]');
  if (!resetRow) {
    resetRow = document.createElement('div');
    resetRow.className = 'u-center';
    resetRow.setAttribute('data-reset-row', '');
    resetRow.innerHTML = '<button class="btn-reset" type="button" data-open-reset>Сбросить таймер</button>';
    submitRow?.insertAdjacentElement('afterend', resetRow);
  }
  // гарантированно скрываем при открытии попапа
  resetRow.hidden = true;
  const showReset = (show)=>{ resetRow.hidden = !show; };

  // склонение и текст кнопки «В эфир на …»
  function plural(n, one, few, many){
    const n10 = n % 10, n100 = n % 100;
    if (n10 === 1 && n100 !== 11) return one;
    if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return few;
    return many;
  }
  function updateBroadcastSeconds(){
    const base  = window.PLAM.premium ? 40 : 20;
    const extra = Number(range?.value || 0);
    const total = base + extra;
    const word  = plural(total, 'секунду', 'секунды', 'секунд');
    if (submitBtn) submitBtn.textContent = `В эфир на ${total} ${word}`;
  }

  // доступность основной кнопки
  function updateSubmitState(){
    submitBtn.disabled = !hasFile || isCooldownActive();
  }

  // синхронизация UI с кулдауном
  function syncCooldownUI(leftMs){
    if (!submitBtn) return;
    const cdActive = isCooldownActive();

    if (cdActive){
      const left = (typeof leftMs === 'number')
        ? leftMs
        : Math.max(0, (window.PLAM.cooldownUntil||0) - Date.now());
      submitBtn.disabled = true;
      submitBtn.textContent = fmtMMSS(left);      // таймер в кнопке
      showReset(!!window.PLAM.hasUploaded);       // зелёная — только после 1-й успешной отправки
    } else {
      updateBroadcastSeconds();                   // текст «В эфир на …»
      updateSubmitState();                        // доступность = файл && !кулдаун
      showReset(false);                           // таймера нет → кнопку скрываем
    }
  }

  // предпросмотр
  const pickedEmpty = root.querySelector('.picked-empty');
  const pickedItem  = root.querySelector('.picked-item');
  const pickedImg   = root.querySelector('[data-picked-img]');
  const removeBtn   = root.querySelector('[data-remove-photo]');

  function showPreview(file){
    if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = null; }
    if (!file){
      hasFile = false;
      if (pickedItem) pickedItem.hidden = true;
      if (pickedEmpty) pickedEmpty.style.display = 'block';
      if (pickedImg) pickedImg.src = '';
      updateSubmitState();
      syncCooldownUI();     // пересчёт состояния после снятия файла
      return;
    }
    hasFile = true;
    objectUrl = URL.createObjectURL(file);
    if (pickedImg)   pickedImg.src = objectUrl;
    if (pickedEmpty) pickedEmpty.style.display = 'none';
    if (pickedItem)  pickedItem.hidden = false;
    updateSubmitState();
    syncCooldownUI();       // пересчёт состояния после добавления файла
  }

  fileInput?.addEventListener('change', ()=>{
    const f = fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;
    showPreview(f);
  });
  removeBtn?.addEventListener('click', ()=>{
    fileInput.value = '';
    showPreview(null);
  });

  // слайдер (+секунды и стоимость)
  if (range && starsEl && secsEl) {
    const onRange = () => {
      const v = Number(range.value);
      starsEl.textContent = `${v} PLAMc`;
      secsEl.textContent  = (v === 0) ? '0 сек' : `+${v} сек`;
      updateBroadcastSeconds();
    };
    range.addEventListener('input', onRange);
    onRange();
  } else {
    updateBroadcastSeconds();
  }

  // мягкая валидация URL
  function isValidUrlLike(v){
    if (!v) return true;
    const tme  = /^https?:\/\/t\.me\/.+/i;
    const http = /^https?:\/\/.+/i;
    return tme.test(v) || http.test(v);
  }

  // подписки на глобальные события кулдауна
  const onTick = (e)=> syncCooldownUI(e.detail?.leftMs);
  const onEnd  = ()=> syncCooldownUI(0);
  document.addEventListener('plam:cooldown-tick', onTick);
  document.addEventListener('plam:cooldown-ended', onEnd);

  // очистка подписок при закрытии именно этого попапа
  document.addEventListener('plam:modal-closed', function once(ev){
    if (ev.detail?.wasUpload){
      document.removeEventListener('plam:cooldown-tick', onTick);
      document.removeEventListener('plam:cooldown-ended', onEnd);
      document.removeEventListener('plam:modal-closed', once);
    }
  });

  // обработчик «Сбросить таймер»
 // делегируем на весь попап, чтобы клик ловился и для уже существующих/пересозданных кнопок
root.addEventListener('click', (e)=>{
  const btn = e.target.closest('[data-open-reset]');
  // нет клика по нашей кнопке или кнопка скрыта
  if (!btn || (root.querySelector('[data-reset-row]')?.hidden)) return;

  const leftMs  = Math.max(0, (window.PLAM.cooldownUntil||0) - Date.now());
  const leftMin = Math.floor(leftMs / 60000);
  if (leftMin <= 0){ window.PLAM_clearCooldown(); syncCooldownUI(); return; }

  // если шаблон попапа сброса не подключён — fallback через confirm
  if (!document.getElementById('tpl-reset-cooldown')) {
    const ok = confirm(`Сбросить ${leftMin} минут за ${leftMin} PLAMc?`);
    if (ok) {
      if ((window.PLAM.balance||0) < leftMin) { alert('Недостаточно PLAMc'); return; }
      window.PLAM.balance -= leftMin;
      updatePlusBalanceUI();
      window.PLAM_clearCooldown();
      syncCooldownUI(); // сразу обновим UI
      try { window.Telegram?.WebApp?.showAlert?.('Удачно! Скорее отправляй еще фото'); } catch(_) {}
    }
    return;
  }

  // обычный сценарий со стек-попапом
  openStack('reset-cooldown');

  const backdrop = stackRoot.querySelector('.modal__backdrop');
  const prevBg = backdrop ? backdrop.style.background : '';
  if (backdrop) backdrop.style.background = 'rgba(0,0,0,.5)';

  const box = stackRoot.querySelector('.reset-popup');
  box?.querySelector('[data-mins]')?.replaceChildren(String(leftMin));
  box?.querySelector('[data-coins]')?.replaceChildren(String(leftMin));

  box?.querySelector('[data-reset-now]')?.addEventListener('click', ()=>{
    const need = leftMin;
    const bal = Number(window.PLAM.balance||0);
    if (bal < need){ alert('Недостаточно PLAMc'); return; }
    window.PLAM.balance = bal - need;
    updatePlusBalanceUI();
    window.PLAM_clearCooldown();
    syncCooldownUI(); // сразу спрячем кнопку/вернём текст
    try { window.Telegram?.WebApp?.showAlert?.('Удачно! Скорее отправляй еще фото'); } catch(_) { alert('Удачно! Скорее отправляй еще фото'); }
    if (backdrop) backdrop.style.background = prevBg;
    closeStack();
  });

  stackRoot.addEventListener('click', function once2(ev2){
    const isBackdrop = ev2.target.classList.contains('modal__backdrop');
    const isClose = ev2.target.closest('[data-dismiss-stack]');
    if (isBackdrop || isClose){
      if (backdrop) backdrop.style.background = prevBg;
      stackRoot.removeEventListener('click', once2);
    }
  }, { once:true });
});

  // после блока создания/нахождения resetRow
root.querySelectorAll('.btn-reset').forEach(b=>{
  if (!b.hasAttribute('data-open-reset')) b.setAttribute('data-open-reset','');
});


  // начальный рендер
  showPreview(null);   // приведём UI к «файла нет»
  syncCooldownUI();    // и синхронизируемся с текущим кулдауном

  // отправка
  form?.addEventListener('submit', (e)=>{
    e.preventDefault();

    if (!hasFile){
      try { window.Telegram?.WebApp?.showAlert?.('Прикрепите фото'); } catch(_) {}
      return;
    }

    if (!window.PLAM.subsOk){
      openStack('subs-required');
      return;
    }

    const link = urlInput?.value.trim();
    if (link && !isValidUrlLike(link)){
      alert('Ссылка должна начинаться с http:// или https:// (поддерживается и https://t.me/...)');
      urlInput.focus();
      return;
    }

    const need = parseInt(range?.value || '0', 10) || 0;
    if (need > (window.PLAM.balance||0)) { alert('Недостаточно PLAMc'); return; }

    window.PLAM.balance -= need;
    updatePlusBalanceUI();

    window.PLAM.photoCount = (window.PLAM.photoCount || 0) + 1;
    if (!modalRoot.hidden && modalRoot.querySelector('.profile-popup')){
      refreshProfileUI?.();
    }

    // TODO: реальная отправка

    // отметим первую удачную отправку
    window.PLAM.hasUploaded = true;
    localStorage.setItem('plam.hasUploaded', '1');

    // запускаем кулдаун → сбрасываем форму → сразу показываем таймер в кнопке
    window.PLAM_startCooldown();
    showPreview(null);
    syncCooldownUI();
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
  const hasFiles  = !!(fileInput?.files && fileInput.files.length > 0);
  if (submitBtn) submitBtn.disabled = !hasFiles || isCooldownActive();
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
    const price = 350;

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
    const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
    window.PLAM.premiumUntil = Date.now() + SEVEN_DAYS;

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
    document.documentElement.style.overflow = 'hidden';   // блокируем скрол страницы
    content && content.classList.add('is-scrollable'); // у тебя этот класс уже есть в CSS
  }

  function close() {
    modal.hidden = true;
    document.documentElement.style.overflow = '';         // возвращаем скрол
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
    document.documentElement.style.overflow = 'hidden';
    content && content.classList.add('is-scrollable');
  };
  const close = () => {
    modal.hidden = true;
    document.documentElement.style.overflow = '';
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

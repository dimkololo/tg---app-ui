// --- Telegram WebApp ---
if (window.Telegram && window.Telegram.WebApp) {
  try { window.Telegram.WebApp.expand(); } catch(e) {}
}

// --- Глобальный state ---
window.PLAM = window.PLAM || { 
  balance: 0, premium: false, photoCount: 0, premiumUntil: null, subsOk: false,
  cooldownUntil: null // ← когда закончится кулдаун (ms), null если нет кулдауна
};


// --- Призы пользователя ---
const PRIZES_KEY = 'plam_prizes';

function loadPrizes(){
  try { return JSON.parse(localStorage.getItem(PRIZES_KEY) || '[]'); }
  catch(_) { return []; }
}
function savePrizes(list){
  try { localStorage.setItem(PRIZES_KEY, JSON.stringify(list)); } catch(_) {}
}

// Добавить приз (coins/image/etc.)
function addPrize(prize){
  // prize: { id, kind:'coins', amount, img, title, claimed? }
  const list = loadPrizes();
  list.push(prize); // монет может быть много отдельных призов, не мержим
  savePrizes(list);
  window.PLAM.prizes = list;
}

window.PLAM.prizes = loadPrizes();

// Выдать приветственные 50 PLAMc один раз
(function ensureWelcomeCoins(){
  const FLAG = 'plam_welcome_coins_given_v1';
  if (!localStorage.getItem(FLAG)) {
    addPrize({
      id: 'welcome-coins-50',
      kind: 'coins',
      amount: 50,
      img: './bgicons/plam-50.png', // ← твоя PNG (замени путь/имя при необходимости)
      title: 'Приветственный приз: 50 PLAMc'
    });
    localStorage.setItem(FLAG, '1');
  }
})();



// --- Баланс: общий кошелёк между страницами ---
const BALANCE_KEY = 'plam_balance';

function getBalanceLS(){
  return parseInt(localStorage.getItem(BALANCE_KEY) || '0', 10);
}
function setBalanceLS(v){
  localStorage.setItem(BALANCE_KEY, String(v));
}
function persistBalance(){
  setBalanceLS(window.PLAM.balance || 0);
}
function syncBalanceFromLS(){
  window.PLAM.balance = getBalanceLS();
  updatePlusBalanceUI();
}

// при первом старте и при возврате со страницы колеса подтягиваем свежие данные
window.addEventListener('DOMContentLoaded', syncBalanceFromLS);
window.addEventListener('pageshow', syncBalanceFromLS);

// если баланс изменился в другой вкладке/странице — обновим облако плюс
window.addEventListener('storage', (e) => {
  if (e.key === BALANCE_KEY) syncBalanceFromLS();
});



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
  if (id === 'actions-tasks') initTasksPopup();

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
  if (!window.PLAM.premium || !window.PLAM.premiumUntil){
    closeStack(); // нет активного премиума — нечего показывать
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
  modalRoot.hidden = true;
  modalRoot.setAttribute('aria-hidden','true');
  modalContent.innerHTML = '';
  document.documentElement.style.overflow = '';
}



// Стало (подменяем целиком этот блок):
document.addEventListener('click', (e) => {
  const opener = e.target.closest('[data-open-modal]');
  if (!opener) return;

  const id = opener.getAttribute('data-open-modal');

  // Если пытаемся открыть загрузку — сначала «Правила»
  if (id === 'upload-popup') {
    e.preventDefault();
    ensurePolicyAccepted(() => openModal('upload-popup'));
    return;
  }

  // Иначе работаем как раньше
  openModal(id);
  return;
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
syncBalanceFromLS();

// --- Попап 1: загрузка фото ---
// Одноразовое согласие с правилами
const POLICY_FLAG = 'policy_accept_v1';

function ensurePolicyAccepted(next){
  if (localStorage.getItem(POLICY_FLAG) === '1') { next?.(); return; }

  openModal('policy'); // откроет template id="tpl-policy"
  const root = modalRoot.querySelector('.policy-popup');
  const chk  = root.querySelector('#policyAgree');
  const ok   = root.querySelector('#policyAccept');

  const sync = () => { ok.disabled = !chk.checked; };
  chk.addEventListener('change', sync); sync();

  ok.addEventListener('click', () => {
    localStorage.setItem(POLICY_FLAG, '1');
    closeModal();
    next?.();
  }, { once: true });
}

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

  // локальный state
  let objectUrl = null;
  let hasFile   = false;
  let cdTimerId = null; // интервал большого таймера

  // строка с большим таймером над кнопкой (создаём один раз)
  const submitRow = submitBtn?.closest('.u-center');
  const timerRow  = document.createElement('div');
  timerRow.className = 'u-center';
  timerRow.hidden = true;
  timerRow.innerHTML = '<div data-cd-text style="font-weight:800;font-size:22px;line-height:1.2;text-align:center"></div>';
  submitRow?.insertAdjacentElement('beforebegin', timerRow);
  const cdText = timerRow.querySelector('[data-cd-text]');

  // хелперы кулдауна
  function isCooldownActive(){
    return typeof window.PLAM.cooldownUntil === 'number' && Date.now() < window.PLAM.cooldownUntil;
  }
  function cdLeftMs(){
    return Math.max(0, (window.PLAM.cooldownUntil || 0) - Date.now());
  }
  function fmtMMSS(ms){
    const total = Math.max(0, Math.floor(ms/1000));
    const mm = String(Math.floor(total/60)).padStart(2,'0');
    const ss = String(total%60).padStart(2,'0');
    return `${mm}мин. ${ss}сек.`;
  }

  // доступность кнопки
  function updateSubmitState(){
    submitBtn.disabled = isCooldownActive() ? false : !hasFile;
  }

  function stopCdTicker(){ if (cdTimerId){ clearInterval(cdTimerId); cdTimerId = null; } }
  function startCdTicker(){
    stopCdTicker();
    const tick = ()=>{
      const left = cdLeftMs();
      cdText.textContent = fmtMMSS(left);
      if (left <= 0) renderUploadUI(); // сам выйдет из режима
    };
    tick();
    cdTimerId = setInterval(tick, 1000);
  }

  // склонение + «В эфир на …» (в кулдауне НЕ меняем надпись)
  function plural(n, one, few, many){
    const n10 = n % 10, n100 = n % 100;
    if (n10 === 1 && n100 !== 11) return one;
    if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return few;
    return many;
  }
  function updateBroadcastSeconds(){
    if (isCooldownActive()) return;
    const base  = window.PLAM.premium ? 40 : 20;
    const extra = Number(range?.value || 0);
    const total = base + extra;
    const word  = plural(total, 'секунду', 'секунды', 'секунд');
    submitBtn.textContent = `В эфир на ${total} ${word}`;
  }

  // единая перерисовка UI
  function renderUploadUI(){
    const showCd = isCooldownActive() && (window.PLAM.photoCount||0) >= 1;
    if (showCd){
      submitBtn.textContent = 'Сбросить таймер';
      submitBtn.style.backgroundColor = '#14ae5c';
      submitBtn.style.color = '#fff';
      timerRow.hidden = false;
      startCdTicker();
    } else {
      stopCdTicker();
      timerRow.hidden = true;
      cdText.textContent = '';
      submitBtn.style.backgroundColor = '';
      submitBtn.style.color = '';
      updateBroadcastSeconds(); // вернём «В эфир на …»
    }
    updateSubmitState();
  }

  // ===== UX мелочи (как было) =====
  const descEl = root.querySelector('textarea[name="desc"]');
  function normalizeAfterKeyboard(){ setTimeout(()=>{ window.scrollTo(0,0); const dlg=modalRoot.querySelector('.modal__dialog'); if(dlg){ dlg.style.transform='translateZ(0)'; void dlg.offsetHeight; dlg.style.transform=''; }},80); }
  if (urlInput) {
    urlInput.setAttribute('enterkeyhint','next');
    urlInput.addEventListener('keydown',(e)=>{ if(e.key==='Enter'){ e.preventDefault(); descEl?.focus(); } });
  }
  if (descEl) {
    descEl.setAttribute('enterkeyhint','done');
    const hideKb = (e)=>{ if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); descEl.blur(); normalizeAfterKeyboard(); } };
    descEl.addEventListener('keydown', hideKb);
    descEl.addEventListener('keypress', hideKb);
    descEl.addEventListener('blur', normalizeAfterKeyboard);
  }
  if (window.visualViewport) window.visualViewport.addEventListener('resize', normalizeAfterKeyboard);

  // счётчики
  function bindCounter(el){
    if (!el) return;
    const id  = el.getAttribute('data-counter');
    const box = root.querySelector(`[data-counter-for="${id}"]`);
    const max = Number(el.getAttribute('maxlength')) || 0;
    const update = ()=>{ const len = el.value.length; if (box) box.textContent = `${len} / ${max}`; };
    el.addEventListener('input', update); update();
  }
  bindCounter(root.querySelector('[data-counter="link"]'));
  bindCounter(root.querySelector('[data-counter="desc"]'));

  // предпросмотр
  const pickedEmpty = root.querySelector('.picked-empty');
  const pickedItem  = root.querySelector('.picked-item');
  const pickedImg   = root.querySelector('[data-picked-img]');
  const removeBtn   = root.querySelector('[data-remove-photo]');

  function showPreview(file){
    if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = null; }
    if (!file){
      hasFile = false;
      pickedItem.hidden = true;
      pickedEmpty.style.display = 'block';
      pickedImg.src = '';
      updateSubmitState();
      updateBroadcastSeconds();
      return;
    }
    hasFile = true;
    objectUrl = URL.createObjectURL(file);
    pickedImg.src = objectUrl;
    pickedEmpty.style.display = 'none';
    pickedItem.hidden = false;
    updateSubmitState();
    updateBroadcastSeconds();
  }

  fileInput?.addEventListener('change', ()=>{
    const f = fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;
    showPreview(f);
  });
  removeBtn?.addEventListener('click', ()=>{
    fileInput.value = '';
    showPreview(null);
  });
  showPreview(null); // стартовый рендер

  // слайдер
  if (range && starsEl && secsEl) {
    const update = () => {
      const v = Number(range.value);
      starsEl.textContent = `${v} PLAMc`;
      secsEl.textContent  = (v === 0) ? '0 сек' : `+${v} сек`;
      if (!isCooldownActive()) updateBroadcastSeconds();
    };
    range.addEventListener('input', update);
    update();
  } else {
    updateBroadcastSeconds();
  }

  // при открытии попапа — просто отрендерим в соответствии с состоянием
  renderUploadUI();

  // валидация URL
  function isValidUrlLike(v){
    if (!v) return true;
    const tme  = /^https?:\/\/t\.me\/.+/i;
    const http = /^https?:\/\/.+/i;
    return tme.test(v) || http.test(v);
  }

  // отправка / сброс таймера
  form?.addEventListener('submit', (e)=>{
    e.preventDefault();

    // если идёт кулдаун — это «Сбросить таймер»
    if (isCooldownActive()){
      const leftMin = Math.floor(cdLeftMs()/60000);
      if (leftMin <= 0){ window.PLAM.cooldownUntil = null; renderUploadUI(); return; }

      openStack('reset-cooldown');

      const backdrop = stackRoot.querySelector('.modal__backdrop');
      const prevBg   = backdrop ? backdrop.style.background : '';
      if (backdrop) backdrop.style.background = 'rgba(0,0,0,.5)';

      const box = stackRoot.querySelector('.reset-popup');
      box?.querySelector('[data-mins]')?.replaceChildren(String(leftMin));
      box?.querySelector('[data-coins]')?.replaceChildren(String(leftMin));

      box?.querySelector('[data-reset-now]')?.addEventListener('click', ()=>{
        if ((window.PLAM.balance||0) < leftMin){ alert('Недостаточно PLAMc'); return; }
        window.PLAM.balance -= leftMin;
        updatePlusBalanceUI();
        persistBalance(); // ← ДОБАВИТЬ

        window.PLAM.cooldownUntil = null; // выходим из кулдауна
        renderUploadUI();

        try { window.Telegram?.WebApp?.showAlert?.('Удачно! Скорее отправляй еще фото'); } catch(_) { alert('Удачно! Скорее отправляй еще фото'); }
        if (backdrop) backdrop.style.background = prevBg;
        closeStack();
      }, { once:true });

      stackRoot.addEventListener('click', function once2(ev2){
        const isBackdrop = ev2.target.classList.contains('modal__backdrop');
        const isClose    = ev2.target.closest('[data-dismiss-stack]');
        if (isBackdrop || isClose){
          if (backdrop) backdrop.style.background = prevBg;
          stackRoot.removeEventListener('click', once2);
        }
      }, { once:true });

      return; // реальной отправки не делаем
    }

    // обычная отправка
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
    persistBalance(); // ← ДОБАВИТЬ

    // TODO: отправка на сервер/TG

    // успешная отправка
    window.PLAM.photoCount = (window.PLAM.photoCount || 0) + 1;

    
// сообщаем пользователю
try { 
  window.Telegram?.WebApp?.showAlert?.('Ваше фото в очереди'); 
} catch(_) { 
  alert('Ваше фото в очереди'); 
}


    // 1) запускаем кулдаун (10 мин обычный / 5 мин премиум)
    const COOLDOWN_MIN = window.PLAM.premium ? 5 : 10;
    window.PLAM.cooldownUntil = Date.now() + COOLDOWN_MIN*60*1000;

    // 2) очищаем форму (попап НЕ закрываем)
    showPreview(null);
    if (urlInput) urlInput.value = '';

    // 3) переключаем UI
    renderUploadUI();
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
      persistBalance(); // ← ДОБАВИТЬ

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
  const grid   = root.querySelector('[data-prize-grid]');

  function render(){
    const list = (window.PLAM.prizes = loadPrizes());
    if (!grid) return;

    if (!list.length){
      grid.innerHTML = '<div style="opacity:.7;text-align:center;font-weight:800">Пока нет призов</div>';
      payBtn && (payBtn.disabled = true);
      return;
    }

    grid.innerHTML = list.map(p => `
      <div class="prize-item" data-id="${p.id}" role="button" tabindex="0" title="${p.title||''}">
        <span class="prize-card" style="background-image:url('${p.img}')"></span>
      </div>
    `).join('');

    syncPayBtn();
  }

  function selectedIds(){
    return [...root.querySelectorAll('.prize-item.is-selected')].map(el => el.dataset.id);
  }

  function syncPayBtn(){
    if (!payBtn) return;
    payBtn.disabled = selectedIds().length === 0;
  }

  // Выделение карточек кликом/клавой
  grid.addEventListener('click', (e)=>{
    const item = e.target.closest('.prize-item');
    if (!item) return;
    item.classList.toggle('is-selected');
    syncPayBtn();
  });
  grid.addEventListener('keydown', (e)=>{
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const item = e.target.closest('.prize-item');
    if (!item) return;
    e.preventDefault();
    item.classList.toggle('is-selected');
    syncPayBtn();
  });

  // Выплата: зачисляем монеты и удаляем выбранные призы
  payBtn?.addEventListener('click', ()=>{
    const list = loadPrizes();
    const ids = selectedIds();

    // считаем сумму монет по выбранным «coins»-призам
    const sum = ids.reduce((acc, id)=>{
      const p = list.find(x => x.id === id);
      if (p && p.kind === 'coins') acc += (Number(p.amount) || 0);
      return acc;
    }, 0);

    if (sum > 0){
      // + монеты в общий баланс
      window.PLAM.balance = (window.PLAM.balance || 0) + sum;
      // синхронизируем локально, чтобы колесо и главная видели одно и то же хранилище
      try { localStorage.setItem('plam_balance', String(window.PLAM.balance)); } catch(_) {}
      // перерисуем «облако плюс»
      try { updatePlusBalanceUI(); } catch(_) {}

      // показать уведомление
      try { window.Telegram?.WebApp?.showAlert?.(`+${sum} PLAMc`); } catch(_) {}
    }

    // удалить выданные призы
    const next = list.filter(p => !ids.includes(p.id));
    savePrizes(next);
    window.PLAM.prizes = next;

    // обновить UI
    render();
    closeModal();
  }, { once: true });

  render();
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
    persistBalance(); // ← ДОБАВИТЬ
    
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

// Таблица лидеров — открытие/закрытие попапа + заполнение «моей» строки
document.addEventListener('DOMContentLoaded', () => {
  const modal   = document.getElementById('leadersModal');
  const openBtn = document.querySelector('.hotspot--wintable');
  if (!modal || !openBtn) return;

  const content = modal.querySelector('.modal__content');

  // подставляем ник/аватар/кол-во фото и (временно) место
  function fillMyRow(){
    const tg = window.Telegram?.WebApp;
    const u  = tg?.initDataUnsafe?.user || null;

    const handle = u?.username
      ? '@' + u.username
      : ([u?.first_name, u?.last_name].filter(Boolean).join(' ') || '@tg profile');

    // пока берём общий счетчик как «за неделю», позже заменишь на weekly
    const weekPhotos = Number(window.PLAM?.photoCount ?? 0);
    const rank = 1; // сейчас единственный пользователь

    const root = document.querySelector('#leadersModal .leaderboard-popup');
    if (!root) return;

    root.querySelector('[data-lb-me-nick]')   ?.replaceChildren(handle);
    root.querySelector('[data-lb-me-photos]') ?.replaceChildren(String(weekPhotos));
    root.querySelector('[data-lb-me-rank]')   ?.replaceChildren(String(rank));

    const ava = root.querySelector('[data-lb-me-ava]');
    if (ava) {
      if (u?.photo_url) {
        ava.style.backgroundImage = `url("${u.photo_url}")`;
        ava.style.backgroundSize  = 'cover';
        ava.style.backgroundPosition = 'center';
      } else {
        ava.style.backgroundImage = '';
      }
    }
  }

  function open() {
    modal.hidden = false;
    document.documentElement.style.overflow = 'hidden';   // блокируем скрол страницы
    content && content.classList.add('is-scrollable');    // включаем скролл внутри попапа
    fillMyRow();                                          // ← заполняем зелёную строку
  }

  function close() {
    modal.hidden = true;
    document.documentElement.style.overflow = '';         // возвращаем скрол
  }

  // открыть по клику на «листочек»
  openBtn.addEventListener('click', open);

  // закрыть по клику на подложку или на элемент с data-close="leadersModal"
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

// «Действия» → сразу на страницу колеса (вкладка 'wheel')
document.addEventListener('DOMContentLoaded', () => {
  const opener = document.querySelector('.hotspot--actions');
  if (!opener) return;
  opener.addEventListener('click', (e) => {
    e.preventDefault();
    location.href = './fortune.html?tab=wheel';
  });
});



// ===== Pixel-perfect hit по альфе PNG =====
// Используем вектор события pointer (работает и на мыши, и на тач)

function enableAlphaHit(el, imgURL, { threshold = 10 } = {}) {
  if (!el) return;

  // Готовим offscreen canvas один раз
  const img = new Image();
  img.src = imgURL; // ВАЖНО: тот же origin (локальные файлы ок)
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  let ready = false, iw = 0, ih = 0;

  img.onload = () => {
    iw = img.naturalWidth;
    ih = img.naturalHeight;
    canvas.width = iw;
    canvas.height = ih;
    ctx.clearRect(0, 0, iw, ih);
    ctx.drawImage(img, 0, 0);      // рисуем 1 раз
    ready = true;
  };

  // проверяем альфу пикселя под курсором/пальцем
  function isOpaque(ev) {
    if (!ready) return true; // пока грузится — не блокируем клики

    const r = el.getBoundingClientRect();
    const ex = ev.clientX - r.left;
    const ey = ev.clientY - r.top;

    // У нас фон на ::before со стилем background: center / contain no-repeat.
    // Посчитаем, где реально нарисовалась картинка внутри прямоугольника кнопки:
    const scale = Math.min(r.width / iw, r.height / ih);
    const drawnW = iw * scale;
    const drawnH = ih * scale;
    const offX = (r.width  - drawnW) / 2;
    const offY = (r.height - drawnH) / 2;

    // Если попали мимо области, где лежит картинка — считаем прозрачным
    if (ex < offX || ey < offY || ex > offX + drawnW || ey > offY + drawnH) return false;

    // Переводим координату в пиксели исходной картинки и читаем альфу
    const ix = Math.floor((ex - offX) / scale);
    const iy = Math.floor((ey - offY) / scale);
    if (ix < 0 || iy < 0 || ix >= iw || iy >= ih) return false;

    const a = ctx.getImageData(ix, iy, 1, 1).data[3]; // 0..255
    return a > threshold; // чуть выше нуля, чтобы не цеплять полу-пустые края
  }

  // Рубим «сквозняк» на фазе захвата, до твоих обработчиков
  const guard = (ev) => {
    if (!isOpaque(ev)) {
      ev.stopImmediatePropagation();
      ev.preventDefault();
      // по желанию можно на прозрачных местах «пробрасывать» клик под иконку,
      // но это сложнее; сейчас просто игнорим.
    }
  };

  // pointerdown — основной, click — страховка
  el.addEventListener('pointerdown', guard, { capture: true, passive: false });
  el.addEventListener('click',       guard, { capture: true, passive: false });
}

// ===== Примеры подключения (вызывай после DOMContentLoaded) =====
document.addEventListener('DOMContentLoaded', () => {
  enableAlphaHit(document.querySelector('.hotspot--actions'),  './bgicons/plam.png');
  enableAlphaHit(document.querySelector('.hotspot--wintable'), './bgicons/wintable.png');
  enableAlphaHit(document.querySelector('.hotspot--stump'),    './bgicons/stump.png');
  enableAlphaHit(document.querySelector('.hotspot--gift'),     './bgicons/gift.png');
  enableAlphaHit(document.querySelector('.hotspot--faq'),      './bgicons/faq.png');      // если есть
  enableAlphaHit(document.querySelector('.hotspot--notebook'), './bgicons/notebook.png'); // если есть
  enableAlphaHit(document.querySelector('.hotspot--plus'), './bgicons/cloud-plus.png'); // если есть
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

})();



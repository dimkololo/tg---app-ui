// ========== app.js (главная) — LS-единообразие, миграции v1→v2 ==========

// --- Telegram WebApp ---
if (window.Telegram && window.Telegram.WebApp) {
  try { window.Telegram.WebApp.expand(); } catch (e) {}
}

// --- Для чистого теста без данных, потом удалить ---
(function resetByQuery(){
  if (/[?&]reset=(1|true)/.test(location.search)) {
    try { localStorage.clear(); sessionStorage.clear(); } catch(_) {}
    // возвращаем чистый URL без параметров
    location.replace(location.pathname);
  }
})();


// --- LS helper Весь Local Storage перевести на сервер ---
const LS = {
  get(k, d = null) {
    try { const v = localStorage.getItem(k); return v === null ? d : v; } catch { return d; }
  },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  remove(k) { try { localStorage.removeItem(k); } catch {} },
  getJSON(k, d = null) {
    const s = LS.get(k, null); if (s === null) return d;
    try { return JSON.parse(s); } catch { return d; }
  },
  setJSON(k, obj) { LS.set(k, JSON.stringify(obj)); },
  getNum(k, d = 0) { const n = parseInt(LS.get(k, ''), 10); return Number.isFinite(n) ? n : d; },
  setNum(k, n) { LS.set(k, String(n)); },
};

// --- Ключи (v2) ---
const K = {
  BALANCE:              'plam_balance_v2',
  PRIZES:               'plam_prizes_v2',
  POLICY_OK:            'plam_policy_accepted_v2',
  PREMIUM_UNTIL:        'plam_premium_until_v2',
  PHOTO_COUNT:          'plam_photo_count_v2',
  UPLOAD_CD_UNTIL:      'plam_upload_cd_until_v2',
  WELCOME_FLAG:         'plam_welcome_coins_given_v2',
};

// --- Миграция старых ключей в v2 (без потери данных) ---
(function migrateToV2(){
  // balance
  if (localStorage.getItem('plam_balance') && !localStorage.getItem(K.BALANCE)) {
    LS.set(K.BALANCE, localStorage.getItem('plam_balance'));
  }
  // prizes
  if (localStorage.getItem('plam_prizes') && !localStorage.getItem(K.PRIZES)) {
    LS.set(K.PRIZES, localStorage.getItem('plam_prizes'));
  }
  // policy accepted
  if (!localStorage.getItem(K.POLICY_OK)) {
    if (localStorage.getItem('plam_policy_accepted_v1') === '1' || localStorage.getItem('policy_accept_v1') === '1') {
      LS.set(K.POLICY_OK, '1');
    }
  }
  // premium until
  if (localStorage.getItem('plam_premium_until') && !localStorage.getItem(K.PREMIUM_UNTIL)) {
    LS.set(K.PREMIUM_UNTIL, localStorage.getItem('plam_premium_until'));
  }
  // photo count
  if (localStorage.getItem('plam_photo_count') && !localStorage.getItem(K.PHOTO_COUNT)) {
    LS.set(K.PHOTO_COUNT, localStorage.getItem('plam_photo_count'));
  }
  // upload cooldown (раньше не сохраняли — мигрировать нечего)
  // welcome flag
  if (localStorage.getItem('plam_welcome_coins_given_v1') && !localStorage.getItem(K.WELCOME_FLAG)) {
    LS.set(K.WELCOME_FLAG, '1');
  }
})();

// --- API состояния (всё через LS) ---
function getBalance(){ return LS.getNum(K.BALANCE, 0); }
function setBalance(v){ LS.setNum(K.BALANCE, v); }
function addBalance(delta){ setBalance(getBalance() + delta); }

function getPrizes(){ return LS.getJSON(K.PRIZES, []) || []; }
function setPrizes(list){ LS.setJSON(K.PRIZES, list || []); }
function addPrize(prize){
  const list = getPrizes();
  list.push(prize);
  setPrizes(list);
}

function getPolicyAccepted(){ return LS.get(K.POLICY_OK) === '1'; }
function setPolicyAccepted(){ LS.set(K.POLICY_OK, '1'); }

function getPremiumUntil(){ return LS.getNum(K.PREMIUM_UNTIL, 0); }
function setPremiumUntil(ts){ LS.setNum(K.PREMIUM_UNTIL, ts); }
function isPremium(){ const u = getPremiumUntil(); return u && Date.now() < u; }

function getPhotoCount(){ return LS.getNum(K.PHOTO_COUNT, 0); }
function incPhotoCount(){ LS.setNum(K.PHOTO_COUNT, getPhotoCount() + 1); }

function getUploadCooldownUntil(){ return LS.getNum(K.UPLOAD_CD_UNTIL, 0); }
function setUploadCooldownUntil(ts){ LS.setNum(K.UPLOAD_CD_UNTIL, ts); }
function clearUploadCooldown(){ LS.remove(K.UPLOAD_CD_UNTIL); }

// --- Глобальный объект (только для удобного доступа из UI) ---
window.PLAM = {
  get balance(){ return getBalance(); },
  set balance(v){ setBalance(v); },
  get prizes(){ return getPrizes(); },
  set prizes(list){ setPrizes(list); },
  get premium(){ return isPremium(); },
  set premium(on){ if (!on) setPremiumUntil(0); }, // включение идёт через setPremiumUntil
  get premiumUntil(){ return getPremiumUntil(); },
  set premiumUntil(ts){ setPremiumUntil(ts); },
  get photoCount(){ return getPhotoCount(); },
  set photoCount(v){ LS.setNum(K.PHOTO_COUNT, v|0); },
  get cooldownUntil(){ return getUploadCooldownUntil(); },
  set cooldownUntil(ts){ setUploadCooldownUntil(ts); },
  subsOk: false
};

// --- Выдать приветственные монеты один раз (через приз «coins») ---
(function ensureWelcomeCoins(){
  if (!localStorage.getItem(K.WELCOME_FLAG)) {
    addPrize({
      id: 'welcome-coins-50',
      kind: 'coins',
      amount: 50,
      img: './bgicons/plam-50.png',
      title: 'Приветственный приз: 50 PLAMc'
    });
    LS.set(K.WELCOME_FLAG, '1');
  }
})();

// --- Индикатор на плюс-облаке ---
function updatePlusBalanceUI(){
  const el = document.getElementById('plusValue');
  if (el) el.textContent = String(getBalance());
}

// при старте и при возврате со страницы колеса подтягиваем свежие данные
window.addEventListener('DOMContentLoaded', updatePlusBalanceUI);
window.addEventListener('pageshow', updatePlusBalanceUI);
window.addEventListener('DOMContentLoaded', syncPhotoCountFromLS);
window.addEventListener('pageshow',      syncPhotoCountFromLS);

// если баланс изменился в другой вкладке/странице — обновим облако плюс
window.addEventListener('storage', (e) => {
  if (e.key === K.BALANCE) updatePlusBalanceUI();
});

// --- Подписки: сохраняем "пройдено" в LS ---
const SUBS_OK_KEY = 'plam_subs_ok_v1';
function isSubsOk(){ return localStorage.getItem(SUBS_OK_KEY) === '1'; }
function setSubsOk(v){ if (v) localStorage.setItem(SUBS_OK_KEY, '1'); else localStorage.removeItem(SUBS_OK_KEY); }

// --- Фото: общий счётчик в LS (для условия "первая отправка") ---
const PHOTO_COUNT_KEY = 'plam_photo_count_v1';
function getPhotoCount(){ return parseInt(localStorage.getItem(PHOTO_COUNT_KEY) || '0', 10); }
function setPhotoCount(n){
  n = Math.max(0, parseInt(n||0,10));
  localStorage.setItem(PHOTO_COUNT_KEY, String(n));
  window.PLAM.photoCount = n;
}
function syncPhotoCountFromLS(){
  window.PLAM.photoCount = getPhotoCount();
}


// --- Автозакрытие через 15 минут ---
(function setupAutoClose(){
  const AUTO_CLOSE_MS = 15 * 60 * 1000;
  const WARN_MS       = 30 * 1000;
  const deadline      = Date.now() + AUTO_CLOSE_MS;

  let warned = false;
  const tick = () => {
    const left = deadline - Date.now();
    if (!warned && left <= WARN_MS && left > 0) {
      warned = true;
      try { window.Telegram?.WebApp?.showAlert?.('Сессия будет закрыта через 30 секунд для безопасности.'); } catch(_){}
    }
    if (left <= 0) {
      try { window.Telegram?.WebApp?.close?.(); } catch(_){}
      try { window.close(); } catch(_){}
      try { location.replace('about:blank'); } catch(_){}
      clearInterval(timer);
    }
  };
  tick();
  const timer = setInterval(tick, 1000);
})();

// --- Модалки (универсальная + стек) ---
const modalRoot    = document.querySelector('[data-modal-root]');
const modalContent = document.querySelector('[data-modal-content]');
const stackRoot    = document.querySelector('[data-modal-stack]');
const stackContent = document.querySelector('[data-stack-content]');

// --- i18n safe apply (безопасно, если i18n.js не подключён) ---
function i18nApply(scope){
  try { if (window.i18n && typeof window.i18n.apply === 'function') window.i18n.apply(scope || document); } catch(_){}
}

function openModal(id){
  const tpl = document.getElementById(`tpl-${id}`);
  if (!tpl) return;
  modalContent.innerHTML = '';
  modalContent.appendChild(tpl.content.cloneNode(true));
  modalRoot.hidden = false;
  modalRoot.setAttribute('aria-hidden', 'false');
  document.documentElement.style.overflow = 'hidden';

  // применим i18n к только что вставленному содержимому
  i18nApply(modalRoot);

  if (id === 'upload-popup') initUploadPopup();
  if (id === 'buy-stars')    initBuyStars();
  if (id === 'prizes')       initPrizes();
  if (id === 'profile')      { initProfile(); document.dispatchEvent(new CustomEvent('plam:profilePopup:open')); }
  if (id === 'premium-timer') initPremiumTimer();
  if (id === 'faq') initFAQ();
  if (id === 'policy' || id === 'policy-required' || id === 'policy-info') initPolicyModal();
}
function closeModal(){
  modalRoot.hidden = true;
  modalRoot.setAttribute('aria-hidden','true');
  modalContent.innerHTML = '';
  document.documentElement.style.overflow = '';
}
function openStack(id){
  const tpl = document.getElementById(`tpl-${id}`);
  if (!tpl) return;
  stackContent.innerHTML = '';
  stackContent.appendChild(tpl.content.cloneNode(true));
  stackRoot.hidden = false;
  stackRoot.setAttribute('aria-hidden','false');

  // применим i18n к только что вставленному содержимому стека
  i18nApply(stackRoot);

  if (id === 'premium-timer')   initPremiumTimer();
  if (id === 'confirm-premium') initConfirmPremium();
  if (id === 'subs-required')   initSubsRequired();
  if (id === 'premium-help')    initPremiumHelp();
  if (id === 'actions-tasks')   initTasksPopup?.();
}
function closeStack(){
  stackRoot.hidden = true;
  stackRoot.setAttribute('aria-hidden','true');
  stackContent.innerHTML = '';
}

// --- Политика: required/info (с фолбэками на единый tpl-policy) ---
const POLICY_FLAG = K.POLICY_OK;

function openPolicyRequired(onAccepted){
  const tplReq = document.getElementById('tpl-policy-required') || document.getElementById('tpl-policy');
  if (!tplReq) return;
  openModal(tplReq.id.replace('tpl-',''));
  const root = modalRoot.querySelector('.policy-popup');
  if (!root) return;

  const agree  = root.querySelector('#policyAgree');
  const accept = root.querySelector('#policyAccept');

  if (agree && accept) {
    accept.disabled = true;
    agree.addEventListener('change', ()=>{ accept.disabled = !agree.checked; });
    accept.addEventListener('click', ()=>{
      LS.set(POLICY_FLAG, '1');
      closeModal();
      onAccepted?.();
    }, { once:true });
  } else {
    // если шаблон без чекбокса — просто считаем принятым
    LS.set(POLICY_FLAG, '1');
    closeModal();
    onAccepted?.();
  }
}
function openPolicyInfo(){
  const tplInfo = document.getElementById('tpl-policy-info') || document.getElementById('tpl-policy');
  if (!tplInfo) return;
  openModal(tplInfo.id.replace('tpl-',''));
  // если попали в общий шаблон — дизейблим/прячем чекбокс-часть
  const root = modalRoot.querySelector('.policy-popup');
  if (root) {
    const agree = root.querySelector('#policyAgree');
    const acc   = root.querySelector('#policyAccept');
    if (agree) agree.closest('label')?.setAttribute('hidden','');
    if (acc) { acc.textContent = 'Закрыть'; acc.disabled = false; acc.addEventListener('click', closeModal, { once:true }); }
  }
}
function ensurePolicyAccepted(next){
  if (LS.get(POLICY_FLAG) === '1') { next?.(); return; }
  try { closeStack(); } catch(_){}
  openPolicyRequired(next);
}
function initPolicyModal(){
  // Нужна только логика блокировки кнопки в required-варианте,
  // она уже настраивается в openPolicyRequired/openPolicyInfo.
}

// --- Делегатор кликов (открыть/закрыть модалки + инфо-кнопка) ---
document.addEventListener('click', (e) => {
  // перехват открытия загрузки: сначала политика
  const openUploadBtn = e.target.closest('[data-open-modal="upload-popup"]');
  if (openUploadBtn) {
    e.preventDefault();
    e.stopPropagation();
    ensurePolicyAccepted(() => openModal('upload-popup'));
    return;
  }

  // обычное открытие по data-open-modal
  const opener = e.target.closest('[data-open-modal]');
  if (opener) { openModal(opener.getAttribute('data-open-modal')); return; }

  // инфо по правилам (кнопка "!")
  if (e.target.closest('[data-open-policy]')) { openPolicyInfo(); return; }

  // закрыть стек
  if (e.target.matches('[data-dismiss-stack]') || e.target.closest('[data-dismiss-stack]')) { closeStack(); return; }

  // закрыть модалку
  if (e.target.matches('[data-dismiss]') || e.target.closest('[data-dismiss]')) { closeModal(); return; }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (!stackRoot.hidden) { closeStack(); return; }
    if (!modalRoot.hidden) { closeModal(); }
  }
});

// --- Оверлей ориентации ---
(function setupOrientationOverlay(){
  const lock = document.getElementById('orientationLock');
  if (!lock) return;
  const mq = window.matchMedia('(orientation: portrait)');
  const update = () => {
    const isPortrait = mq.matches || window.innerHeight >= window.innerWidth;
    lock.classList.toggle('is-active', !isPortrait);
    document.documentElement.style.overflow = !isPortrait ? 'hidden' : '';
  };
  update();
  try { mq.addEventListener('change', update); } catch(_) {}
  window.addEventListener('orientationchange', update);
  window.addEventListener('resize', update);
})();

// --- Попап 1: загрузка фото ---
function initUploadPopup(){
  const root = modalRoot.querySelector('.upload-popup');
  if (!root) return;

  const fileInput = root.querySelector('#file-input');
  const submitBtn = root.querySelector('[data-submit]');
  const form      = root.querySelector('[data-upload-form]');
  const range     = root.querySelector('.range');
  const starsEl   = root.querySelector('[data-stars]');
  const secsEl    = root.querySelector('[data-secs]');
  const urlInput  = root.querySelector('input[name="social"]');
  const infoBtn   = root.querySelector('.btn-info'); // «!» в ряду с кнопкой

  // "!" — просто инфо
  infoBtn?.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); openPolicyInfo(); });

  // защита: без принятия правил не даём открыть файловый диалог
  fileInput?.addEventListener('click', (e) => {
    if (!getPolicyAccepted()) {
      e.preventDefault();
      e.stopImmediatePropagation();
      openPolicyRequired(() => fileInput.click());
    }
  });

  let objectUrl = null;
  let hasFile   = false;
  let cdTimerId = null;

  // большой таймер над кнопкой
  const submitRow = submitBtn?.closest('.u-center');
  const timerRow  = document.createElement('div');
  timerRow.className = 'u-center';
  timerRow.hidden = true;
  timerRow.innerHTML = '<div data-cd-text style="font-weight:800;font-size:22px;line-height:1.2;text-align:center"></div>';
  submitRow?.insertAdjacentElement('beforebegin', timerRow);
  const cdText = timerRow.querySelector('[data-cd-text]');

  function isCooldownActive(){ return Date.now() < getUploadCooldownUntil(); }
  function cdLeftMs(){ return Math.max(0, getUploadCooldownUntil() - Date.now()); }
  function fmtMMSS(ms){
    const total = Math.max(0, Math.floor(ms/1000));
    const mm = String(Math.floor(total/60)).padStart(2,'0');
    const ss = String(total%60).padStart(2,'0');
    return `${mm}мин. ${ss}сек.`;
  }

  function updateSubmitState(){ submitBtn.disabled = isCooldownActive() ? false : !hasFile; }
  function stopCdTicker(){ if (cdTimerId){ clearInterval(cdTimerId); cdTimerId = null; } }
  function startCdTicker(){
    stopCdTicker();
    const tick = ()=>{
      const left = cdLeftMs();
      cdText.textContent = fmtMMSS(left);
      if (left <= 0) renderUploadUI();
    };
    tick();
    cdTimerId = setInterval(tick, 1000);
  }

  function plural(n, one, few, many){
    const n10 = n % 10, n100 = n % 100;
    if (n10 === 1 && n100 !== 11) return one;
    if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return few;
    return many;
  }
  function updateBroadcastSeconds(){
    if (isCooldownActive()) return;
    const base  = isPremium() ? 40 : 20;
    const extra = Number(range?.value || 0);
    const total = base + extra;
    const word  = plural(total, 'секунду', 'секунды', 'секунд');
    submitBtn.textContent = `В эфир на ${total} ${word}`;
  }

  function renderUploadUI(){
    const showCd = isCooldownActive() && getPhotoCount() >= 1;
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
      updateBroadcastSeconds();
    }
    updateSubmitState();
  }

  // UX-штрихи (счётчики, preview)
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
  showPreview(null);

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

  renderUploadUI();

  function isValidUrlLike(v){
    if (!v) return true;
    const tme  = /^https?:\/\/t\.me\/.+/i;
    const http = /^https?:\/\/.+/i;
    return tme.test(v) || http.test(v);
  }

  form?.addEventListener('submit', (e)=>{
    e.preventDefault();

    // режим "Сбросить таймер"
    if (isCooldownActive()){
      const leftMin = Math.floor(cdLeftMs()/60000);
      if (leftMin <= 0){ clearUploadCooldown(); renderUploadUI(); return; }

      openStack('reset-cooldown');

      const backdrop = stackRoot.querySelector('.modal__backdrop');
      const prevBg   = backdrop ? backdrop.style.background : '';
      if (backdrop) backdrop.style.background = 'rgba(0,0,0,.5)';

      const box = stackRoot.querySelector('.reset-popup');
      box?.querySelector('[data-mins]') ?.replaceChildren(String(leftMin));
      box?.querySelector('[data-coins]').replaceChildren(String(leftMin));

      box?.querySelector('[data-reset-now]')?.addEventListener('click', ()=>{
        if (getBalance() < leftMin){ alert('Недостаточно PLAMc'); return; }
        addBalance(-leftMin); updatePlusBalanceUI();

        clearUploadCooldown();
        renderUploadUI();

        try { window.Telegram?.WebApp?.showAlert?.('Удачно! Скорее отправляй еще фото'); } catch(_) {}
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

      return;
    }

    // обычная отправка
    if (!hasFile){ try { window.Telegram?.WebApp?.showAlert?.('Прикрепите фото'); } catch(_) {} return; }
    // Показываем попап подписки ТОЛЬКО перед самой первой отправкой
      if (getPhotoCount() < 1 && !isSubsOk()){
        openStack('subs-required');
        return;
      }

    const link = urlInput?.value.trim();
    if (link && !isValidUrlLike(link)){
      alert('Ссылка должна начинаться с http:// или https:// (поддерживается и https://t.me/...)');
      urlInput.focus(); return;
    }

    const need = parseInt(range?.value || '0', 10) || 0;
    if (need > getBalance()){ alert('Недостаточно PLAMc'); return; }

    addBalance(-need); updatePlusBalanceUI();

    // TODO: отправка на сервер/TG

    // успешная отправка
    setPhotoCount(getPhotoCount() + 1);

    try {
      window.Telegram?.WebApp?.showAlert?.('Ваше фото в очереди');
    } catch(_) { alert('Ваше фото в очереди'); }

    // 1) Кулдаун: 30 мин обычный / 20 мин премиум
    const COOLDOWN_MIN = isPremium() ? 20 : 30;
    setUploadCooldownUntil(Date.now() + COOLDOWN_MIN*60*1000);

    // 2) очищаем форму (попап НЕ закрываем)
    showPreview(null);
    if (urlInput) urlInput.value = '';

    // 3) переключаем UI
    renderUploadUI();
  });
}

// --- Подписки обязательны (демо) ---
function initSubsRequired(){
  const root = stackRoot.querySelector('.subs-popup');
  if (!root) return;

  let clickedYT = false;
  let clickedTG = false;
  root.querySelector('[data-sub-yt]')?.addEventListener('click', ()=>{ clickedYT = true; });
  root.querySelector('[data-sub-tg]')?.addEventListener('click', ()=>{ clickedTG = true; });

  const btnCheck = root.querySelector('[data-check-subs]');
  btnCheck?.addEventListener('click', ()=>{
    setSubsOk(true);
    btnCheck.textContent = 'Спасибо';
    btnCheck.classList.add('is-ok');
    btnCheck.disabled = true;

    const uploadRoot = modalRoot.querySelector('.upload-popup');
    if (uploadRoot){
      const fileInput = uploadRoot.querySelector('#file-input');
      const submitBtn = uploadRoot.querySelector('[data-submit]');
      const hasFiles = !!(fileInput?.files && fileInput.files.length > 0);
      if (submitBtn) submitBtn.disabled = !hasFiles;
    }
  });
}

// --- Магазин ---
function initBuyStars(){
  const root = modalRoot.querySelector('.shop-popup');
  if (!root) return;
  root.querySelectorAll('.shop-item').forEach(btn=>{
    btn.addEventListener('click', (e)=>{
      e.preventDefault();
      const amount = Number(btn.dataset.amount || 0);
      addBalance(amount); updatePlusBalanceUI();
      try { window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light'); } catch(_) {}
      try { window.Telegram?.WebApp?.showAlert?.(`+${amount} PLAMc`); } catch(_) {}
    }, { passive:false });
  });
}

// --- Призы ---
function initPrizes(){
  const root = modalRoot.querySelector('.prizes-popup');
  if (!root) return;
  const payBtn = root.querySelector('.btn-pay');
  const grid   = root.querySelector('[data-prize-grid]');

  function render(){
    const list = getPrizes();
    if (!grid) return;

    if (!list.length){
      grid.innerHTML = '<div style="opacity:.7;text-align:center;font-weight:800">Пока нет призов</div>';
      if (payBtn) payBtn.disabled = true;
      return;
    }

    grid.innerHTML = list.map(p => `
      <div class="prize-item" data-id="${p.id}" role="button" tabindex="0" title="${p.title||''}">
        <span class="prize-card" style="background-image:url('${p.img}')"></span>
      </div>
    `).join('');
    syncPayBtn();
  }
  function selectedIds(){ return [...root.querySelectorAll('.prize-item.is-selected')].map(el => el.dataset.id); }
  function syncPayBtn(){ if (payBtn) payBtn.disabled = selectedIds().length === 0; }

  grid.addEventListener('click', (e)=>{
    const item = e.target.closest('.prize-item'); if (!item) return;
    item.classList.toggle('is-selected'); syncPayBtn();
  });
  grid.addEventListener('keydown', (e)=>{
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const item = e.target.closest('.prize-item'); if (!item) return;
    e.preventDefault(); item.classList.toggle('is-selected'); syncPayBtn();
  });

  payBtn?.addEventListener('click', ()=>{
    const list = getPrizes();
    const ids  = selectedIds();
    const sum = ids.reduce((acc, id)=>{
      const p = list.find(x => x.id === id);
      if (p && p.kind === 'coins') acc += (Number(p.amount) || 0);
      return acc;
    }, 0);

    if (sum > 0){
      addBalance(sum); updatePlusBalanceUI();
      try { window.Telegram?.WebApp?.showAlert?.(`+${sum} PLAMc`); } catch(_) {}
    }

    const next = list.filter(p => !ids.includes(p.id));
    setPrizes(next);

    render();
    closeModal();
  }, { once:true });

  render();
}

// --- Профиль ---
function initProfile(){
  const root = modalRoot.querySelector('.profile-popup'); if (!root) return;

  const avatarEl   = root.querySelector('[data-avatar]');
  const usernameEl = root.querySelector('[data-username]');
  const btnPremium = root.querySelector('[data-btn-premium]');

  const tg  = window.Telegram?.WebApp;
  const usr = tg?.initDataUnsafe?.user || null;
  const firstLast = usr ? [usr.first_name, usr.last_name].filter(Boolean).join(' ') : '';
  const handle    = usr?.username ? '@' + usr.username : (firstLast || '@tg profile');

  usernameEl.textContent = handle;
  if (usr?.photo_url) avatarEl.style.backgroundImage = `url("${usr.photo_url}")`;

  const photos = getPhotoCount();
  root.querySelector('[data-photo-count]').textContent = String(photos);

  const baseSecs = isPremium() ? 40 : 20;
  const secs = baseSecs + Math.floor(photos / 100);
  root.querySelector('[data-show-seconds]').textContent = `${secs} сек`;

  const setBtn = ()=>{
    if (isPremium()){
      btnPremium.textContent = 'Премиум активен';
      btnPremium.classList.add('is-owned');
      btnPremium.disabled = false;
      avatarEl.classList.add('has-crown');
    } else {
      btnPremium.textContent = 'Получить премиум';
      btnPremium.classList.remove('is-owned');
      btnPremium.disabled = false;
      avatarEl.classList.remove('has-crown');
    }
  };
  setBtn();

  // «?» справа от кнопки (клик по «пузырю»)
  root.addEventListener('click', (ev) => {
    const btnRect = btnPremium.getBoundingClientRect();
    const BUBBLE = 50, GAP = 8;
    const left = btnRect.right + GAP;
    const top  = btnRect.top + (btnRect.height - BUBBLE) / 2;
    const x = ev.clientX, y = ev.clientY;
    const hit = (x >= left && x <= left + BUBBLE && y >= top && y <= top + BUBBLE);
    if (hit) { ev.preventDefault(); ev.stopPropagation(); openStack('premium-help'); }
  });

  btnPremium.addEventListener('click', ()=>{
    if (isPremium()){
      openStack('premium-timer');
    } else {
      openStack('confirm-premium');
    }
  });
}
function refreshProfileUI(){
  const root = modalRoot.querySelector('.profile-popup'); if (!root) return;

  const photos = getPhotoCount();
  root.querySelector('[data-photo-count]').textContent = String(photos);
  const baseSecs = isPremium() ? 40 : 20;
  const secs = baseSecs + Math.floor(photos / 100);
  root.querySelector('[data-show-seconds]').textContent = `${secs} сек`;

  const avatarEl   = root.querySelector('[data-avatar]');
  const btnPremium = root.querySelector('[data-btn-premium]');
  if (isPremium()){
    btnPremium.textContent = 'Премиум активен';
    btnPremium.classList.add('is-owned');
    avatarEl?.classList.add('has-crown');
  } else {
    btnPremium.textContent = 'Получить премиум';
    btnPremium.classList.remove('is-owned');
    avatarEl?.classList.remove('has-crown');
  }
}

function initPremiumTimer(){
  const root = stackRoot.querySelector('.timer-popup'); if (!root) return;
  if (!isPremium()){ closeStack(); return; }

  const box = root.querySelector('[data-remaining]');
  const tick = ()=>{
    const now = Date.now();
    let ms = Math.max(0, getPremiumUntil() - now);
    const totalMinutes = Math.floor(ms / 60000);
    const days    = Math.floor(totalMinutes / (24*60));
    const hours   = Math.floor((totalMinutes - days*24*60) / 60);
    const minutes = totalMinutes - days*24*60 - hours*60;
    const hh = String(hours).padStart(2, '0');
    const mm = String(minutes).padStart(2, '0');
    box.textContent = `${days}д. ${hh}ч. ${mm}мин.`;

    if (ms <= 0){
      clearInterval(timer);
      setPremiumUntil(0);
      try { window.Telegram?.WebApp?.showAlert?.('Премиум истёк'); } catch(_) {}
      closeStack();
    }
  };
  tick();
  const timer = setInterval(tick, 1000);

  const escOnce = (ev)=>{
    if (ev.key === 'Escape' && !stackRoot.hidden){
      clearInterval(timer);
      document.removeEventListener('keydown', escOnce);
    }
  };
  document.addEventListener('keydown', escOnce);

  root.addEventListener('click', (e)=>{
    if (e.target.matches('[data-dismiss-stack]') || e.target.closest('[data-dismiss-stack]')){
      clearInterval(timer);
      document.removeEventListener('keydown', escOnce);
    }
  });
}

function initConfirmPremium(){
  const root = stackRoot.querySelector('.confirm-popup'); if (!root) return;
  root.querySelector('[data-confirm-yes]')?.addEventListener('click', ()=>{
    const price = 350;
    if (getBalance() < price){
      closeStack();
      closeModal();
      openModal('buy-stars');
      return;
    }
    addBalance(-price); updatePlusBalanceUI();
    const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
    setPremiumUntil(Date.now() + SEVEN_DAYS);
    closeStack();
    refreshProfileUI();
  });
}

function initPremiumHelp(){ /* закрытие уже есть по [data-dismiss-stack] */ }
function initFAQ(){ /* оставить как есть */ }

// Таблица лидеров
document.addEventListener('DOMContentLoaded', () => {
  const modal   = document.getElementById('leadersModal');
  const openBtn = document.querySelector('.hotspot--wintable');
  if (!modal || !openBtn) return;

  const content = modal.querySelector('.modal__content');

  function open() {
    modal.hidden = false;
    modal.setAttribute('aria-hidden','false');
    document.documentElement.style.overflow = 'hidden';
    content && content.classList.add('is-scrollable');
    fillMyRow?.();
  }

  function close() {
    modal.hidden = true;
    modal.setAttribute('aria-hidden','true');
    document.documentElement.style.overflow = '';
    content && content.classList.remove('is-scrollable');
  }

  // Открываем с захватом (обходит любые другие делегаторы)
  openBtn.addEventListener('click', (e) => { e.preventDefault(); open(); }, { capture: true });

  // Закрытие по бэкдропу/крестику
  modal.addEventListener('click', (e) => {
    const isBackdrop = e.target.classList.contains('modal__backdrop');
    const isCloseBtn = e.target.closest('[data-close="leadersModal"]');
    if (isBackdrop || isCloseBtn) close();
  });

  // Esc
  window.addEventListener('keydown', (e) => { if (!modal.hidden && e.key === 'Escape') close(); });

  // Страховка: если вдруг «что-то» перекрыло клики — закрыть при клике мимо диалога
  document.addEventListener('click', (e) => {
    if (modal.hidden) return;
    const dlg = modal.querySelector('.modal__dialog');
    if (dlg && !dlg.contains(e.target)) close();
  }, true);
});


// «Действия» → сразу на страницу колеса
document.addEventListener('DOMContentLoaded', () => {
  const opener = document.querySelector('.hotspot--actions');
  if (!opener) return;
  opener.addEventListener('click', (e) => {
    e.preventDefault();
    location.href = './fortune.html?tab=wheel';
  });
});

// Pixel-perfect hit по альфе PNG
function enableAlphaHit(el, imgURL, { threshold = 10 } = {}) {
  if (!el) return;
  const img = new Image(); img.src = imgURL;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  let ready = false, iw = 0, ih = 0;

  img.onload = () => {
    iw = img.naturalWidth; ih = img.naturalHeight;
    canvas.width = iw; canvas.height = ih;
    ctx.clearRect(0, 0, iw, ih);
    ctx.drawImage(img, 0, 0); ready = true;
  };

  function isOpaque(ev) {
    if (!ready) return true;
    const r = el.getBoundingClientRect();
    const ex = ev.clientX - r.left, ey = ev.clientY - r.top;
    const scale = Math.min(r.width / iw, r.height / ih);
    const drawnW = iw * scale, drawnH = ih * scale;
    const offX = (r.width  - drawnW) / 2, offY = (r.height - drawnH) / 2;
    if (ex < offX || ey < offY || ex > offX + drawnW || ey > offY + drawnH) return false;
    const ix = Math.floor((ex - offX) / scale), iy = Math.floor((ey - offY) / scale);
    if (ix < 0 || iy < 0 || ix >= iw || iy >= ih) return false;
    const a = ctx.getImageData(ix, iy, 1, 1).data[3];
    return a > threshold;
  }
  const guard = (ev) => {
    if (!isOpaque(ev)) { ev.stopImmediatePropagation(); ev.preventDefault(); }
  };
  el.addEventListener('pointerdown', guard, { capture: true, passive: false });
  el.addEventListener('click',       guard, { capture: true, passive: false });
}
document.addEventListener('DOMContentLoaded', () => {
  enableAlphaHit(document.querySelector('.hotspot--actions'),  './bgicons/plam.png');
  //enableAlphaHit(document.querySelector('.hotspot--wintable'), './bgicons/wintable.png');
  enableAlphaHit(document.querySelector('.hotspot--stump'),    './bgicons/stump.png');
  enableAlphaHit(document.querySelector('.hotspot--gift'),     './bgicons/gift.png');
  enableAlphaHit(document.querySelector('.hotspot--faq'),      './bgicons/faq.png');
  enableAlphaHit(document.querySelector('.hotspot--notebook'), './bgicons/notebook.png');
  enableAlphaHit(document.querySelector('.hotspot--plus'),     './bgicons/cloud-plus.png');
});

// --- RU|ENG переключатель (минимальный безопасный слой) ---
(function(){
  const LS_KEY = 'plam_lang';
  const DEFAULT_LANG = 'ru';

  function applyLangAttr(code){
    document.documentElement.setAttribute('data-lang', code);
  }

  function reflectUI(code){
    const root = document.querySelector('.lang-switch');
    if (!root) return;
    const buttons = root.querySelectorAll('.lang-switch__btn');
    buttons.forEach(btn => {
      const on = btn.getAttribute('data-lang-target') === code;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-selected', String(on));
    });
  }

  function setLang(code){
    localStorage.setItem(LS_KEY, code);
    applyLangAttr(code);
    reflectUI(code);
    // Если присутствует i18n.js — задействуем его без ошибок при отсутствии
    if (window.i18n && typeof window.i18n.setLang === 'function') {
      try { window.i18n.setLang(code); } catch(e) {}
    }
    if (window.i18n && typeof window.i18n.apply === 'function') {
      try { window.i18n.apply(); } catch(e) {}
    }
  }

  function initLangSwitcher(){
    // 1) Восстановим язык
    const saved = localStorage.getItem(LS_KEY) || DEFAULT_LANG;
    applyLangAttr(saved);
    reflectUI(saved);

    // 2) Делегирование кликов (на случай пересоздания попапа)
    document.addEventListener('click', (e)=>{
      const btn = e.target.closest && e.target.closest('.lang-switch__btn');
      if (!btn) return;
      const code = btn.getAttribute('data-lang-target');
      if (!code) return;
      setLang(code);
    });

    // 3) Когда попап профиля открывается заново, сверим UI с актуальным языком
    document.addEventListener('plam:profilePopup:open', ()=>{
      const current = localStorage.getItem(LS_KEY) || DEFAULT_LANG;
      reflectUI(current);
    });
  }

  // DOM готов — инициализируем
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLangSwitcher);
  } else {
    initLangSwitcher();
  }

  // Экспорт на глобал при необходимости
  window.plamLang = { set: setLang };
})();

// Debug хот-спотов
(function debugHotspots(){
  const on = /[?&]debug=1/.test(location.search);
  if (on) document.body.classList.add('__debug');
  window.addEventListener('keydown', (e)=>{
    if ((e.key === 'D' || e.key === 'd') && e.shiftKey){
      document.body.classList.toggle('__debug');
    }
  });
})();

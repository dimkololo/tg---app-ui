// === i18n helpers (ожидаем глобальный window.i18n из i18n.js) ===
const LANG_KEY = 'plam_lang';
function getLang(){ return localStorage.getItem(LANG_KEY) || 'ru'; }
function setLang(l){
  try { localStorage.setItem(LANG_KEY, l); } catch(_) {}
  try { document.documentElement.lang = l; } catch(_) {}
  try { window.i18n?.setLang?.(l); window.i18n?.apply?.(document); } catch(_) {}
}
function applyI18n(root=document){ try { window.i18n?.apply?.(root); } catch(_) {} }

// === Telegram WebApp bootstrap ===
if (window.Telegram && window.Telegram.WebApp) {
  try { window.Telegram.WebApp.expand(); } catch(e) {}
}

// === Глобальный state (как был) ===
window.PLAM = window.PLAM || { 
  balance: 0, premium: false, photoCount: 0, premiumUntil: null, subsOk: false,
  cooldownUntil: null
};

// === Призы пользователя (как было) ===
const PRIZES_KEY = 'plam_prizes';
function loadPrizes(){ try { return JSON.parse(localStorage.getItem(PRIZES_KEY) || '[]'); } catch(_) { return []; } }
function savePrizes(list){ try { localStorage.setItem(PRIZES_KEY, JSON.stringify(list)); } catch(_) {} }
function addPrize(prize){ const list = loadPrizes(); list.push(prize); savePrizes(list); window.PLAM.prizes = list; }
window.PLAM.prizes = loadPrizes();

// Выдать приветственные 50 PLAMc один раз (как было)
(function ensureWelcomeCoins(){
  const FLAG = 'plam_welcome_coins_given_v1';
  if (!localStorage.getItem(FLAG)) {
    addPrize({ id:'welcome-coins-50', kind:'coins', amount:50, img:'./bgicons/plam-50.png', title:'Приветственный приз: 50 PLAMc' });
    localStorage.setItem(FLAG, '1');
  }
})();

// === Баланс (как было) ===
const BALANCE_KEY = 'plam_balance';
function getBalanceLS(){ return parseInt(localStorage.getItem(BALANCE_KEY) || '0', 10); }
function setBalanceLS(v){ localStorage.setItem(BALANCE_KEY, String(v)); }
function persistBalance(){ setBalanceLS(window.PLAM.balance || 0); }
function syncBalanceFromLS(){ window.PLAM.balance = getBalanceLS(); updatePlusBalanceUI(); }
window.addEventListener('DOMContentLoaded', syncBalanceFromLS);
window.addEventListener('pageshow',        syncBalanceFromLS);
window.addEventListener('storage', (e) => { if (e.key === BALANCE_KEY) syncBalanceFromLS(); });

// === Автозакрытие (как было) ===
(function setupAutoClose(){
  const AUTO_CLOSE_MS = 15 * 60 * 1000, WARN_MS = 30 * 1000;  
  const deadline = Date.now() + AUTO_CLOSE_MS;
  let warned = false;
  const tick = () => {
    const left = deadline - Date.now();
    if (!warned && left <= WARN_MS && left > 0) {
      warned = true;
      try { window.Telegram?.WebApp?.showAlert?.('Сессия будет закрыта через 30 секунд для безопасности.'); } catch(_) {}
    }
    if (left <= 0) {
      try { window.Telegram?.WebApp?.close?.(); } catch(_) {}
      try { window.close(); } catch(_) {}
      try { location.replace('about:blank'); } catch(_) {}
      clearInterval(timer);
    }
  };
  tick(); const timer = setInterval(tick, 1000);
})();

// === Модалка (как было) ===
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

  // применим i18n к вставленному фрагменту
  applyI18n(modalRoot);

  if (id === 'upload-popup') initUploadPopup();
  if (id === 'buy-stars')    initBuyStars();
  if (id === 'prizes')       initPrizes();
  if (id === 'profile')      initProfile();
  if (id === 'premium-timer') initPremiumTimer();
  if (id === 'faq') initFAQ();
  if (id === 'policy-required') initPolicyModal();
}
const stackRoot    = document.querySelector('[data-modal-stack]');
const stackContent = document.querySelector('[data-stack-content]');
function openStack(id){
  const tpl = document.getElementById(`tpl-${id}`);
  if (!tpl) return;
  stackContent.innerHTML = '';
  stackContent.appendChild(tpl.content.cloneNode(true));
  stackRoot.hidden = false;
  stackRoot.setAttribute('aria-hidden','false');

  applyI18n(stackRoot);

  if (id === 'premium-timer')   initPremiumTimer();
  if (id === 'confirm-premium') initConfirmPremium();
  if (id === 'subs-required')   initSubsRequired();
  if (id === 'premium-help')    initPremiumHelp();
}
function closeStack(){ stackRoot.hidden = true; stackRoot.setAttribute('aria-hidden','true'); stackContent.innerHTML = ''; }
function closeModal(){ modalRoot.hidden = true; modalRoot.setAttribute('aria-hidden','true'); modalContent.innerHTML = ''; document.documentElement.style.overflow = ''; }

// === Политика (одноразово + инфо) ===
const POLICY_FLAG = 'plam_policy_accepted_v1';
function openPolicyRequired(onAccepted){
  openModal('policy-required');
  const root = modalRoot.querySelector('.policy-popup'); if (!root) return;
  const agree = root.querySelector('#policyAgree');
  const accept = root.querySelector('#policyAccept');
  accept.disabled = true;
  agree?.addEventListener('change', () => { accept.disabled = !agree.checked; });
  accept?.addEventListener('click', () => { localStorage.setItem(POLICY_FLAG, '1'); closeModal(); onAccepted?.(); }, { once:true });
}
function openPolicyInfo(){ openModal('policy-info'); }

// Перехват первой загрузки — сначала правила
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-open-modal="upload-popup"]');
  if (!btn) return;
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();
  if (localStorage.getItem(POLICY_FLAG) === '1') { openModal('upload-popup'); }
  else { openPolicyRequired(() => openModal('upload-popup')); }
}, true);

// Делегатор модалок (как было) + кнопка «!»
document.addEventListener('click', (e) => {
  const opener = e.target.closest('[data-open-modal]'); if (opener){ openModal(opener.getAttribute('data-open-modal')); return; }
  if (e.target.closest('[data-open-policy]')) { openPolicyInfo(); return; }
  if (e.target.matches('[data-dismiss-stack]') || e.target.closest('[data-dismiss-stack]')) { closeStack(); return; }
  if (e.target.matches('[data-dismiss]') || e.target.closest('[data-dismiss]')) { closeModal(); return; }
});

// Переключение языка (RU/EN) — общий делегатор
document.addEventListener('click', (e)=>{
  const langBtn = e.target.closest('[data-set-lang]');
  if (!langBtn) return;
  const lang = langBtn.getAttribute('data-set-lang');
  setLang(lang);
  // Активное состояние в группе (если нужно)
  document.querySelectorAll('[data-set-lang]').forEach(b => b.classList.toggle('is-active', b.getAttribute('data-set-lang')===lang));
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (!stackRoot.hidden) { closeStack(); return; }
    if (!modalRoot.hidden) { closeModal(); }
  }
});

// === Плюс-облако ===
function updatePlusBalanceUI(){ const el = document.getElementById('plusValue'); if (el) el.textContent = String(window.PLAM.balance || 0); }
updatePlusBalanceUI();
syncBalanceFromLS();

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

  // Инициализация i18n при загрузке
document.addEventListener('DOMContentLoaded', ()=>{
  try { window.i18n?.init?.({ lang: getLang() }); } catch(_) {}
  applyI18n(document);
  document.documentElement.lang = getLang();
});
  
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


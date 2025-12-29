
// ========== app.js (главная) — LS-единообразие, миграции v1→v2 ==========
(() => {
  if (window.__PLAM_APP_INIT__) {
    console.warn('app.js already initialized');
    return;
  }
  window.__PLAM_APP_INIT__ = true;

  // ↓↓↓ весь остальной код файла остаётся как есть


// === TEMP: reset LocalStorage on every page load (for testing) УДАЛИТЬ!!!!!!!!!!!!!===
// ВКЛ/ВЫКЛ: поменяй FORCE_RESET на false, либо добавь ?keep=1 в адресную строку.
(function autoResetLocalStorage() {
  const FORCE_RESET = false ;                       // ← поставь false, чтобы быстро отключить
  const keep = /[?&](keep|persist)=(1|true)/i.test(location.search);
  if (!FORCE_RESET || keep) return;

  try {
    // ОЧИСТИТЬ ВСЁ (только LocalStorage)
    localStorage.clear();

    // Если хочешь сохранить язык даже при сбросе — раскомментируй:
    // localStorage.setItem('plam_lang', 'ru'); // или 'en'
  } catch (_) {}
})();
  

// === Common finisher to unfreeze UI ===
function __plamFinishSplash() {
  try {
    // 1) показать сцену
    document.documentElement.classList.remove('plam-preload');
    // 2) сказать Telegram, что всё готово
    window.Telegram?.WebApp?.ready?.();
  } catch (_) {}
}

// ==== SPLASH v2.4 — гарантированное скрытие заставки и безошибочные клики ====
(function setupSplash() {
  const splash = document.getElementById('appLoading') 
              || document.querySelector('.splash,[data-splash]');
  if (!splash) { __plamFinishSplash(); return; }

  const MIN_SHOW_MS = 4000;
  const HARD_TIMEOUT_MS = 12000;
  const t0 = performance.now();

 // ---- SKIP SPLASH ON SOFT RETURN FROM FORTUNE ----
try {
  if (sessionStorage.getItem('plam_skip_splash_once') === '1') {
    sessionStorage.removeItem('plam_skip_splash_once'); // одноразовый флаг

    // СНИМАЕМ plam-preload и дергаем Telegram.ready
    __plamFinishSplash();

    splash.classList.add('is-hidden');
    splash.setAttribute('aria-busy', 'false');

    requestAnimationFrame(() => {
      try { splash.remove(); } catch(_) { splash.style.display = 'none'; }
    });
    return;
  }
} catch(_) {}


  // --- Картинки, которые «прогреваем». НЕ включаем сюда саму loading.png! ---
  const criticalImages = [
    './bgicons/bg-master.png',
    './bgicons/photohereru.png',
    './bgicons/tv.png',
    './bgicons/wintable.png',
    './bgicons/plane.gif',
    './bgicons/earth-item.png',
    './bgicons/earth-item@2x.png',
    './bgicons/star-header.png',
    './bgicons/star-item.png',
    './bgicons/plam.png',
    './bgicons/stump.png',
    './bgicons/gift.png',
    './bgicons/faq.png',
    './bgicons/notebook.png',
    './bgicons/cloud-plus.png',
    './bgicons/cloud-plus@2x.png'
  ];

  // --- Утилиты ожидания ---
  const onDOMReady = new Promise((resolve) => {
    if (document.readyState === 'interactive' || document.readyState === 'complete') resolve();
    else document.addEventListener('DOMContentLoaded', resolve, { once: true });
  });

  function preloadOne(src) {
    return new Promise((resolve) => {
      const img = new Image();
      const done = () => resolve();
      img.onload = done;
      img.onerror = done;
      img.src = src;
    });
  }

  const preloadAll = Promise.allSettled(criticalImages.map(preloadOne));
 function hideSplashSoft() {
    const elapsed = performance.now() - t0;
    const delay = Math.max(0, MIN_SHOW_MS - elapsed);

    setTimeout(() => {
      splash.classList.add('is-hidden');
      splash.setAttribute('aria-busy', 'false');

      // снять preloader-класс сразу, а удаление ноды — по окончанию анимации
      __plamFinishSplash();

      splash.addEventListener('transitionend', () => {
        try { splash.remove(); } catch (_) { splash.style.display = 'none'; }
      }, { once: true });

      // страховка, если transitionend не придёт
      setTimeout(() => { try { splash.remove(); } catch(_) {} }, 400);
    }, delay);
  }

  // (необязательно, но полезно)
const fontsReady = (document.fonts && document.fonts.ready) ? document.fonts.ready.catch(()=>{}) : Promise.resolve();

Promise.race([
  Promise.all([
    onDOMReady,
    fontsReady,
    preloadAll,   // <-- ИСПОЛЬЗУЕМ реальный прелоад картинок с бюджетом
  ]),
  new Promise(r => setTimeout(r, HARD_TIMEOUT_MS)) // рубильник
]).then(hideSplashSoft);

  // Глобальный ручной рубильник (используется и fallback-скриптом в index.html)
  window.__plamHideSplash = function() {
    splash.classList.add('is-hidden');
    splash.setAttribute('aria-busy', 'false');
    __plamFinishSplash();
    try { splash.remove(); } catch(_) { splash.style.display = 'none'; }
  };
})();




// --- Telegram WebApp ---
if (window.Telegram && window.Telegram.WebApp) {
  try { window.Telegram.WebApp.expand(); } catch (e) {}
}

// === FIX v2: сцена НЕ сжимается от клавиатуры (iOS visualViewport) ===
// Заменить целиком твой (function lockSceneHeight(){ ... })();
(function lockSceneHeight(){
  const root = document.documentElement;

  // "Стабильная" высота сцены (без клавиатуры).
  let stableH = 0;
  let lastOrientation = null;

  function isTextInput(el){
    if (!el) return false;
    const tag = el.tagName;
    if (tag === 'TEXTAREA') return true;
    if (tag === 'INPUT') {
      const type = (el.getAttribute('type') || 'text').toLowerCase();
      // текстовые типы (чтобы range/file не считались "клавиатурой")
      return !['checkbox','radio','range','color','file','button','submit','reset'].includes(type);
    }
    return !!el.isContentEditable;
  }

  function getOrientation(){
    return (window.innerWidth > window.innerHeight) ? 'landscape' : 'portrait';
  }

  function getVV(){
    const vv = window.visualViewport;
    if (!vv) return null;
    return {
      h: vv.height || 0,
      top: vv.offsetTop || 0
    };
  }

  function applyAppH(h){
    root.style.setProperty('--app-h', `${Math.round(h)}px`);
  }

  // полезно, если когда-нибудь захочешь делать паддинг модалки под клаву
  function applyKb(px){
    root.style.setProperty('--kb', `${Math.max(0, Math.round(px))}px`);
  }

  function initStable(){
    const vv = getVV();
    const base = window.innerHeight || 0;
    const vvFull = vv ? (vv.h + vv.top) : 0;
    stableH = Math.max(base, vvFull) || base || 0;
    applyAppH(stableH);
    applyKb(0);
    lastOrientation = getOrientation();
  }

  function update(){
    const ori = getOrientation();
    const vv = getVV();
    const typing = isTextInput(document.activeElement);

    // при смене ориентации — переснимаем базу
    if (ori !== lastOrientation) {
      lastOrientation = ori;
      initStable();
      return;
    }

    // keyboard px (по vv) — считаем относительно стабильной высоты
    if (vv) {
      const vvFull = vv.h + vv.top;
      const kb = Math.max(0, stableH - vvFull);
      // kb показываем только когда реально вводим
      applyKb(typing ? kb : 0);
    } else {
      applyKb(0);
    }

    // ключевой момент:
    // - когда НЕ печатаем: разрешаем stableH только РАСТИ (адресная строка спряталась и т.п.)
    // - когда печатаем: НИКОГДА не уменьшаем stableH (чтобы сцена не "дышала")
    const nowH = window.innerHeight || 0;

    if (!typing) {
      if (nowH > stableH) {
        stableH = nowH;
        applyAppH(stableH);
      } else {
        // оставляем как есть (не уменьшаем — меньше визуальных скачков на iOS)
        applyAppH(stableH);
      }
      return;
    }

    // typing = true → фиксируем высоту сцены
    applyAppH(stableH);
  }

  initStable();

  window.addEventListener('resize', update, { passive:true });
  window.addEventListener('orientationchange', () => setTimeout(update, 250), { passive:true });
  window.addEventListener('pageshow', () => setTimeout(update, 0), { passive:true });

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', update, { passive:true });
    window.visualViewport.addEventListener('scroll', update, { passive:true });
  }

  // iOS иногда даёт события не через resize — страхуемся фокусом
  document.addEventListener('focusin',  () => setTimeout(update, 0), true);
  document.addEventListener('focusout', () => setTimeout(update, 0), true);
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

// --- Backend auth helper (общий id пользователя для всех запросов) ---
function getBackendAuth(){
  // plam-auth.js обычно кладёт сюда user-объект
  if (window.plamAuth && typeof window.plamAuth.user === 'object') {
    return window.plamAuth.user;
  }
  // запасной вариант — берём из localStorage
  try {
    return JSON.parse(localStorage.getItem('plam_auth') || 'null');
  } catch (_) {
    return null;
  }
}

function getBackendUserId(){
  const auth = getBackendAuth();
  return auth && auth.id ? auth.id : null;
}


// --- Premium timestamp normalization & compatibility ---
(function normalizePremiumKey(){
  // читаем v2 и старый v1-ключ
  const v2 = LS.getNum(K.PREMIUM_UNTIL, 0);
  const v1 = parseInt(localStorage.getItem('plam_premium_until') || '0', 10) || 0;

  // берём самое «свежее» значение
  let best = Math.max(v2 || 0, v1 || 0);

  // если это секунды (10 знаков) — переведём в миллисекунды
  if (best > 0 && best < 1e12) best = best * 1000;

  // записываем обратно в v2, если отличается
  if (best && best !== v2) LS.setNum(K.PREMIUM_UNTIL, best);
})();


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

// --- API состояния (LS + синхронизация с бэком) ---
function getBalance() {
  return LS.getNum(K.BALANCE, 0);
}

function setBalance(v) {
  LS.setNum(K.BALANCE, v);
}

// отправляем изменение баланса на бэкенд
async function sendBalanceDeltaToBackend(delta) {
  try {
    const raw = localStorage.getItem('plam_auth');
    if (!raw) return;

    const auth = JSON.parse(raw);
    const userId = auth && auth.id;
    if (userId == null) return;

    const res = await fetch(`/api/v1/balance/${encodeURIComponent(userId)}/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: delta }),
    });

    if (!res.ok) {
      throw new Error('HTTP ' + res.status);
    }

    const data = await res.json();
    const fresh = Number(data.balance) || 0;

    // приводим локальный стейт к тому, что вернул бэкенд
    setBalance(fresh);

    if (typeof updatePlusBalanceUI === 'function') {
      try { updatePlusBalanceUI(); } catch (_) {}
    }
  } catch (e) {
    console.warn('[balance] backend delta failed', e);
  }
}

// общий helper — и локально, и на бэке
function addBalance(delta) {
  // сразу обновляем локально, чтобы UI не лагал
  const next = getBalance() + delta;
  setBalance(next);

  if (!delta) return;

  // а асинхронно дотягиваем до бэка
  try {
    sendBalanceDeltaToBackend(delta);
  } catch (e) {
    console.warn('[balance] sendBalanceDeltaToBackend error', e);
  }
}

// Подтянуть актуальный баланс из БД по plam_auth.id
async function syncBalanceFromBackend() {
  try {
    const raw = localStorage.getItem('plam_auth');
    if (!raw) return;

    const auth = JSON.parse(raw);
    const userId = auth && auth.id;
    if (userId == null) return;

    const res = await fetch(`/api/v1/balance/${encodeURIComponent(userId)}`);
    if (!res.ok) return;

    const data = await res.json();
    const fresh = Number(data.balance) || 0;

    setBalance(fresh);
    if (typeof updatePlusBalanceUI === 'function') {
      try { updatePlusBalanceUI(); } catch (_) {}
    }
  } catch (e) {
    console.warn('[balance] sync from backend failed', e);
  }
}


function getPrizes(){ return LS.getJSON(K.PRIZES, []) || []; }
function setPrizes(list){ LS.setJSON(K.PRIZES, list || []); }
function addPrize(prize){
  const list = getPrizes();
  list.push(prize);
  setPrizes(list);
}

function getPolicyAccepted(){ return LS.get(K.POLICY_OK) === '1'; }
function setPolicyAccepted(){ LS.set(K.POLICY_OK, '1'); }

function getPremiumUntil(){
  const ts = LS.getNum(K.PREMIUM_UNTIL, 0);
  return (ts > 0 && ts < 1e12) ? ts * 1000 : ts; // сек → мс (страховка)
}
function setPremiumUntil(ts){ LS.setNum(K.PREMIUM_UNTIL, ts); }
function isPremium(){ const u = getPremiumUntil(); return u > Date.now(); }

// --- Премиум: синхронизация локального кеша с бэкендом ---
let premiumSyncAttempts = 0;

async function syncPremiumFromBackend(){
  const backendId = getBackendUserId();

  // Если авторизация ещё не успела сохраниться в plam_auth — подождём и попробуем ещё.
  if (!backendId) {
    if (premiumSyncAttempts < 10) {          // максимум ~10 попыток
      premiumSyncAttempts++;
      setTimeout(syncPremiumFromBackend, 500); // повтор через 0.5 сек
    }
    return;
  }

  // Как только userId появился — сбрасываем счётчик.
  premiumSyncAttempts = 0;

  try {
    const res = await fetch(`/api/v1/premium/${encodeURIComponent(backendId)}`, {
      cache: 'no-store',
    });
    if (!res.ok) {
      console.warn('[premium] backend returned HTTP', res.status);
      return;
    }

    const data = await res.json();

    if (data && data.active && data.expiresAt) {
      const ts = new Date(data.expiresAt).getTime();
      if (Number.isFinite(ts)) {
        setPremiumUntil(ts);
      } else {
        setPremiumUntil(0);
      }
    } else {
      // Премиума нет в БД — жёстко обнуляем локальный флаг
      setPremiumUntil(0);
    }

    // Если профиль сейчас открыт — перерисуем кнопку, корону и т.д.
    try { refreshProfileUI(); } catch(_) {}
  } catch (e) {
    console.warn('[premium] failed to sync from backend', e);
  }
}



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

// При каждом открытии миниаппа подтягиваем актуальный премиум с бэка
window.addEventListener('DOMContentLoaded', () => { syncPremiumFromBackend(); });
window.addEventListener('pageshow', () => { syncPremiumFromBackend(); });


// если баланс изменился в другой вкладке/странице — обновим облако плюс
window.addEventListener('storage', (e) => {
  if (e.key === K.BALANCE) updatePlusBalanceUI();
});

// --- Подписки: сохраняем "пройдено" в LS ---
const SUBS_OK_KEY = 'plam_subs_ok_v1';
function isSubsOk(){ return localStorage.getItem(SUBS_OK_KEY) === '1'; }
function setSubsOk(v){ if (v) localStorage.setItem(SUBS_OK_KEY, '1'); else localStorage.removeItem(SUBS_OK_KEY); }

// --- Фото: общий счётчик в LS (для условия "первая отправка") ---
function getPhotoCount(){
  return LS.getNum(K.PHOTO_COUNT, 0);
}
function setPhotoCount(n){
  const safe = n | 0;
  LS.setNum(K.PHOTO_COUNT, safe);
  if (window.PLAM) window.PLAM.photoCount = safe;
}
function syncPhotoCountFromLS(){
  if (window.PLAM) window.PLAM.photoCount = getPhotoCount();
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

// --- i18n helpers ---
function i18nApply(scope){
  try { if (window.i18n && typeof window.i18n.apply === 'function') window.i18n.apply(scope || document); } catch(_){}
}
function i18nLang(){
  try { return (window.i18n && typeof window.i18n.getLang === 'function' && window.i18n.getLang()) || document.documentElement.getAttribute('data-lang') || 'ru'; }
  catch(_) { return 'ru'; }
}
function T(key, fallback, vars){
  try {
    if (window.i18n && typeof window.i18n.t === 'function') {
      const s = window.i18n.t(key, vars);
      if (s) return s; // словарь нашёлся → уже с подстановками
    }
  } catch(_) {}
  // словарь не дал строку → подставляем vars во fallback сами
  if (!fallback) return '';
  if (!vars) return String(fallback);
  return String(fallback).replace(/\{\{(\w+)\}\}/g, (_, k) => (k in vars ? String(vars[k]) : ''));
}
  function setModalFreezeForKeyboard(on){
  if (!modalRoot) return;

  if (on){
    // фиксируем оверлей по "замороженной" высоте сцены
    modalRoot.style.top = '0';
    modalRoot.style.left = '0';
    modalRoot.style.right = '0';
    modalRoot.style.bottom = 'auto';
    modalRoot.style.height = 'var(--app-h, 100vh)';
  } else {
    modalRoot.style.height = '';
    modalRoot.style.bottom = '';
    modalRoot.style.top = '';
    modalRoot.style.left = '';
    modalRoot.style.right = '';
  }
}


function openModal(id){
  const tpl = document.getElementById(`tpl-${id}`);
  if (!tpl) return;
  modalContent.innerHTML = '';
  modalContent.appendChild(tpl.content.cloneNode(true));
  modalRoot.hidden = false;
  setModalFreezeForKeyboard(id === 'prizes');
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
  setModalFreezeForKeyboard(false);
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

   // >>> добавить эту строку: включаем/выключаем флаг скрытия крестика
  stackRoot.classList.toggle('stack--no-close', id === 'confirm-premium' || id === 'premium-timer');


  // применим i18n к только что вставленному содержимому стека
  i18nApply(stackRoot);

  if (id === 'premium-timer')   initPremiumTimer();
  if (id === 'confirm-premium') initConfirmPremium();
  if (id === 'subs-required')   initSubsRequired();
  if (id === 'premium-help')    initPremiumHelp();
  if (id === 'actions-tasks')   initTasksPopup?.();
}
function closeStack(){
  stackRoot.classList.remove('stack--policy');
  stackRoot.classList.remove('stack--no-close'); // ← ВОТ ТУТ
  stackRoot.hidden = true;
  stackRoot.setAttribute('aria-hidden','true');
  stackContent.innerHTML = '';
}

// --- Политика: required/info (с фолбэками на единый tpl-policy) ---
const POLICY_FLAG = K.POLICY_OK;

// --- Политика: required/info в СТЕКЕ поверх текущего попапа ---
function openPolicyRequired(onAccepted){
  const tplReq = document.getElementById('tpl-policy-required') || document.getElementById('tpl-policy');
  if (!tplReq) return;

  openStack(tplReq.id.replace('tpl-',''));
  // помечаем стек как "policy"
  stackRoot.classList.add('stack--policy');

  const root = stackRoot.querySelector('.policy-popup');
  if (!root) return;

  // Любые data-dismiss превращаем в закрытие стека
  root.querySelectorAll('[data-dismiss]').forEach(btn => btn.setAttribute('data-dismiss-stack',''));

  const agree  = root.querySelector('#policyAgree');
  const accept = root.querySelector('#policyAccept');

  if (agree && accept) {
    accept.disabled = true;
    agree.addEventListener('change', ()=>{ accept.disabled = !agree.checked; });
    accept.addEventListener('click', ()=>{
      LS.set(POLICY_FLAG, '1');
      closeStack();
      onAccepted?.();
    }, { once:true });
  } else {
    // Если шаблон без чекбокса — просто считаем принятым
    LS.set(POLICY_FLAG, '1');
    closeStack();
    onAccepted?.();
  }
}

function openPolicyInfo(){
  const tplInfo = document.getElementById('tpl-policy-info') || document.getElementById('tpl-policy');
  if (!tplInfo) return;

  openStack(tplInfo.id.replace('tpl-',''));
  // помечаем стек как "policy"
  stackRoot.classList.add('stack--policy');

  const root = stackRoot.querySelector('.policy-popup');
  if (root) {
    // Любые data-dismiss превращаем в закрытие стека
    root.querySelectorAll('[data-dismiss]').forEach(btn => btn.setAttribute('data-dismiss-stack',''));

    // Если общий шаблон — скрываем чекбокс и делаем кнопку "Понятно"/Close
    const agree = root.querySelector('#policyAgree');
    const acc   = root.querySelector('#policyAccept');
    if (agree) agree.closest('label')?.setAttribute('hidden','');
    if (acc) {
      acc.textContent = T('common.close','Закрыть');
      acc.disabled = false;
      acc.addEventListener('click', closeStack, { once:true });
    }
  }
}


function ensurePolicyAccepted(next){
  if (LS.get(POLICY_FLAG) === '1') { next?.(); return; }
  try { closeStack(); } catch(_){}
  openPolicyRequired(next);
}
function initPolicyModal(){ /* настройки внутри openPolicyRequired/openPolicyInfo */ }

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

  // ===== Счётчик длины ДЛЯ ПОЛЯ ССЫЛКИ (прямая привязка) =====
const linkEl  = urlInput; // то же поле
const linkBox = root.querySelector('[data-counter-for="link"]');

function syncLinkCounter(){
  if (!linkEl || !linkBox) return;
  const max = Number(linkEl.getAttribute('maxlength')) || 255;
  const len = (linkEl.value || '').length;
  linkBox.textContent = `${len} / ${max}`;
}

// События, которые точно поймают ввод/вставку/автозамены/IME
['input','keyup','change','paste','compositionend','beforeinput'].forEach(ev=>{
  linkEl?.addEventListener(ev, syncLinkCounter);
});

// Первичное заполнение — если значение уже подставлено автозаполнением/кешем
syncLinkCounter();


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
    return `${mm}${T('units.min_short','мин.')} ${ss}${T('units.sec_short','сек')}`;
  }

  function pluralRu(n, one, few, many){
    const n10 = n % 10, n100 = n % 100;
    if (n10 === 1 && n100 !== 11) return one;
    if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return few;
    return many;
  }
  function unitSecond(n){
    return i18nLang() === 'en' ? (n === 1 ? 'second' : 'seconds') : pluralRu(n, 'секунду', 'секунды', 'секунд');
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

  function updateBroadcastSeconds(){
  // Если кулдаун активен — всегда держим надпись "Сбросить таймер"
  if (isCooldownActive()){
    submitBtn.textContent = T('upload.reset_timer','Сбросить таймер');
    return;
  }

  const base  = isPremium() ? 40 : 20;
  const extra = Number(range?.value || 0);
  const total = base + extra;
  const u = unitSecond(total);

  const fallback = i18nLang() === 'en'
    ? `Go live for ${total} ${u}`
    : `В эфир на ${total} ${u}`;

  submitBtn.textContent = T('upload.broadcast_btn', fallback, { total, unit: u });
}


  function renderUploadUI(){
    const showCd = isCooldownActive();
    if (showCd){
      submitBtn.textContent = T('upload.reset_timer','Сбросить таймер');
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
  //if (window.visualViewport) window.visualViewport.addEventListener('resize', normalizeAfterKeyboard);

  // ===== Live-счётчики для всех полей с [data-counter] через делегирование =====
function updateCounter(el){
  if (!el) return;
  const id  = el.getAttribute('data-counter');
  if (!id) return;
  const box = root.querySelector(`[data-counter-for="${id}"]`);
  const max = Number(el.getAttribute('maxlength')) || 0;
  const len = (el.value || '').length;
  if (box) box.textContent = `${len} / ${max}`;
}

// первичная инициализация — заполнить значения сразу
root.querySelectorAll('[data-counter]').forEach(updateCounter);

// делегированный обработчик: ловим ввод и обновляем соответствующий счётчик
const counterHandler = (ev) => {
  const el = ev.target && ev.target.closest && ev.target.closest('[data-counter]');
  if (!el || !root.contains(el)) return;
  updateCounter(el);
};

// разные типы событий — чтобы накрыть автозамены, IME и т.д.
['input','keyup','change','paste','compositionend','beforeinput'].forEach(type=>{
  root.addEventListener(type, counterHandler);
});


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
      const secShort = T('units.sec_short','сек');
      secsEl.textContent  = (v === 0) ? `0 ${secShort}` : `+${v} ${secShort}`;
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
if (isCooldownActive()) {
  const msLeft = cdLeftMs();
  if (msLeft <= 0){ clearUploadCooldown(); renderUploadUI(); return; }

  const mins = Math.max(1, Math.ceil(msLeft / 60000)); // ← не 0 минут

  openStack('reset-cooldown');

  const backdrop = stackRoot.querySelector('.modal__backdrop');
  const prevBg   = backdrop ? backdrop.style.background : '';
  if (backdrop) backdrop.style.background = 'rgba(0,0,0,.5)';

  const box = stackRoot.querySelector('.reset-popup');
  if (!box) return;

  // Цифры в плейсхолдеры (если есть)
  box.querySelector('[data-mins]')?.replaceChildren(String(mins));
  box.querySelector('[data-coins]')?.replaceChildren(String(mins));

  // Кнопка «Сбросить ... за ... PLAMc»
  const btnReset = box.querySelector('[data-reset-now]');
  if (btnReset) {
    btnReset.removeAttribute('data-i18n'); // чтобы i18n не перезатёр
    btnReset.textContent = T('reset.button','Сбросить {{mins}} минут за {{coins}} PLAMc',{ mins, coins: mins });

    btnReset.addEventListener('click', () => {
      if (getBalance() < mins){ alert(T('errors.not_enough','Недостаточно PLAMc')); return; }
      addBalance(-mins); updatePlusBalanceUI();
      clearUploadCooldown();
      renderUploadUI();
      try { window.Telegram?.WebApp?.showAlert?.(T('upload.reset_ok','Удачно! Скорее отправляй еще фото')); } catch(_) {}
      if (backdrop) backdrop.style.background = prevBg;
      closeStack();
    }, { once:true });
  }
  
 // --- «Поделиться» с подтверждением через бот inline ---
const shareBtn  = box?.querySelector('[data-reset-share],[data-share-once]');
const shareWrap = box?.querySelector('[data-share-wrap]') || shareBtn?.closest('[data-share-wrap]');
if (shareBtn) {
  const FLAG = 'plam_reset_share_used_v1';

  // уже использовано когда-то — отключаем насовсем
  if (localStorage.getItem(FLAG) === '1') {
    shareBtn.disabled = true;
    shareBtn.classList.add('is-disabled');
    shareBtn.textContent = T('reset.shared_used','Уже использовано');
  } else {
    // создаём (или берём) токен этой попытки шаринга
    const TOKEN_KEY = 'plam_share_token_v1';
    function genToken(){ return Math.random().toString(36).slice(2) + Date.now().toString(36); }
    let token = localStorage.getItem(TOKEN_KEY);
    if (!token) { token = genToken(); localStorage.setItem(TOKEN_KEY, token); }

    // универсальный “открыть шаринг”
    function openInlineShare(token){
      const q = `plamshare:${token}`; // ваш префикс
      try {
        // откроет выбор чата с включённым inline вашего бота
        window.Telegram?.WebApp?.switchInlineQuery?.(q, ['users','groups','channels']);
      } catch (_) {
        // fallback: обычная “поделяшка” (без верификации)
        const url  = 'https://t.me/TESTPLAMBOT/PLAM';
        const text = T('share.text','Заходи в PLAM — отправляй фото и выигрывай!');
        const u = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
        window.Telegram?.WebApp?.openTelegramLink?.(u) || window.open(u, '_blank','noopener,noreferrer');
      }
    }

    // опрос бэкенда: подтвержден ли share токена
    async function checkSharedOnce(token){
      try {
        const r = await fetch(`/api/v1/share/status?token=${encodeURIComponent(token)}`, { cache:'no-store' });
        const js = await r.json();
        return !!js?.ok;
      } catch { return false; }
    }

    // запускаем процесс
    shareBtn.addEventListener('click', async (e) => {
      e.preventDefault(); e.stopPropagation();
      openInlineShare(token);

      // показываем мягкий “ожидатель” (по желанию)
      shareBtn.disabled = true;
      shareBtn.textContent = T('reset.share_wait','Ожидаем отправку…');

      // до 2 минут ждём chosen_inline_result от бота
      const DEADLINE = Date.now() + 2*60*1000;
      let ok = false;
      while (!ok && Date.now() < DEADLINE) {
        /* опрашиваем раз в 2 сек */
        /* eslint-disable no-await-in-loop */
        await new Promise(r => setTimeout(r, 2000));
        ok = await checkSharedOnce(token);
      }

      if (ok) {
        // фиксируем “один бесплатный раз” и закрываем окно
        localStorage.setItem(FLAG, '1');
        localStorage.removeItem(TOKEN_KEY);

        clearUploadCooldown();
        renderUploadUI();

        try { window.Telegram?.WebApp?.showAlert?.(T('reset.shared_ok','Спасибо! Таймер сброшен.')); } catch(_) {}
        if (backdrop) backdrop.style.background = prevBg;
        closeStack();
      } else {
        // не подтвердилось — возвращаем кнопку
        shareBtn.disabled = false;
        shareBtn.textContent = T('reset.share','Поделиться');
        try { window.Telegram?.WebApp?.showAlert?.(T('reset.share_fail','Не увидели отправку. Попробуйте ещё раз')); } catch(_) {}
      }
    }, { once:true });
  }
}



  // вернуть фон при закрытии
  const onOutsideClose = (ev) => {
    const isBackdrop = ev.target.classList?.contains('modal__backdrop');
    const isClose    = ev.target.closest?.('[data-dismiss-stack]');
    if (isBackdrop || isClose) {
      if (backdrop) backdrop.style.background = prevBg;
      stackRoot.removeEventListener('click', onOutsideClose);
    }
  };
  stackRoot.addEventListener('click', onOutsideClose);

  return;
}




    // обычная отправка
    if (!hasFile){
      try { window.Telegram?.WebApp?.showAlert?.(T('upload.attach_photo','Прикрепите фото')); } catch(_){ alert(T('upload.attach_photo','Прикрепите фото')); }
      return;
    }
    // Показываем попап подписки ТОЛЬКО перед самой первой отправкой
    if (getPhotoCount() < 1 && !isSubsOk()){
      openStack('subs-required');
      return;
    }

    const link = urlInput?.value.trim();
    if (link && !isValidUrlLike(link)){
      alert(T('upload.link_invalid','Ссылка должна начинаться с http:// или https:// (поддерживается и https://t.me/...)'));
      urlInput.focus(); return;
    }

    const need = parseInt(range?.value || '0', 10) || 0;
    if (need > getBalance()){ alert(T('errors.not_enough','Недостаточно PLAMc')); return; }

    addBalance(-need); updatePlusBalanceUI();

    // TODO: отправка на сервер/TG

// если мы сюда дошли — всё разрешено, можно отправлять фото на бэкенд
  window.plamUpload?.send(form);

    // успешная отправка
    setPhotoCount(getPhotoCount() + 1);

    // 1) Кулдаун: 30 мин обычный / 20 мин премиум
    const COOLDOWN_MIN = isPremium() ? 20 : 30;
    setUploadCooldownUntil(Date.now() + COOLDOWN_MIN*60*1000);

    // 2) очищаем форму (попап НЕ закрываем)
    showPreview(null);
    if (urlInput) urlInput.value = '';

    // 3) переключаем UI
    renderUploadUI();

    try {
      window.Telegram?.WebApp?.showAlert?.(T('upload.in_queue','Ваше фото в очереди'));
    } catch(_) { alert(T('upload.in_queue','Ваше фото в очереди')); }

  });

  // Обновление текста при смене языка
  document.addEventListener('plam:langChanged', () => {
    if (!document.contains(root)) return;
    // кнопка
    updateBroadcastSeconds();
    // подпись к секундам
    if (range && starsEl && secsEl) {
      const v = Number(range.value);
      const secShort = T('units.sec_short','сек');
      secsEl.textContent  = (v === 0) ? `0 ${secShort}` : `+${v} ${secShort}`;
    }
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
    btnCheck.textContent = T('common.thanks','Спасибо');
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

  function syncShopUnits(){
    root.querySelectorAll('.shop-item').forEach(btn=>{
      const amount = Number(btn.dataset.amount || 0);
      const label = i18nLang()==='en' ? `${amount} stars` : `${amount} звезд`;
      const textSpan = btn.querySelector('.shop-item__left span:last-child');
      if (textSpan) textSpan.textContent = label;
    });
  }

  root.querySelectorAll('.shop-item').forEach(btn=>{
    btn.addEventListener('click', (e)=>{
      e.preventDefault();
      const amount = Number(btn.dataset.amount || 0);
      addBalance(amount); updatePlusBalanceUI();
      try { window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light'); } catch(_) {}
      try { window.Telegram?.WebApp?.showAlert?.(`+${amount} PLAMc`); } catch(_) {}
    }, { passive:false });
  });

  // начальная синхронизация и при смене языка
  syncShopUnits();
  const langHandler = () => { if (document.contains(root)) syncShopUnits(); };
  document.addEventListener('plam:langChanged', langHandler, { passive:true });

  // при закрытии модалки слушатель нам больше не нужен — удалим его автоматически вместе с DOM (без утечек)
}

// --- Призы ---
function initPrizes(){
  const root = modalRoot.querySelector('.prizes-popup');
  if (!root) return;

  const grid   = root.querySelector('[data-prize-grid]');
  const payBtn = root.querySelector('.btn-pay');

  // --- мини-тост
  function toast(key, fallback, vars){
    const msg = T(key, fallback, vars);
    try { window.Telegram?.WebApp?.showAlert?.(msg); } catch(_) { alert(msg); }
  }

  // --- Промокод: конфиг для теста 3PUKAIZ3NA (+30 PLAMc) ---
  const PROMO = {
    code:  '3PUKAIZ3NA',
    id:    'promo-3PUKAIZ3NA-30',
    amount: 30,
    img:   './bgicons/plam-30.png',
    flag:  'plam_promo_3PUKAIZ3NA_used_v1'
  };

  // селекторы промо-формы
  const promoForm  = root.querySelector('[data-promo-form]');
  const promoInput = root.querySelector('[data-promo-input]');
  const promoBtn   = root.querySelector('[data-promo-apply]');

  function normalizeCode(v){
    return String(v || '')
      .trim()
      .replace(/[\s\-]+/g, '') // убираем пробелы/дефисы
      .toUpperCase();
  }

  function alreadyHasPromo(){
    try { if (localStorage.getItem(PROMO.flag) === '1') return true; } catch(_) {}
    return getPrizes().some(p => p.id === PROMO.id);
  }

  function applyPromo(){
    const raw = normalizeCode(promoInput?.value);
    if (!raw || raw !== PROMO.code){
      toast('promo.invalid', 'Неверный промокод');
      return;
    }
    if (alreadyHasPromo()){
      toast('promo.already', 'Этот промокод вы уже активировали');
      return;
    }
    // добавляем приз в список
    addPrize({
      id: PROMO.id,
      kind: 'coins',
      amount: PROMO.amount,
      img: PROMO.img,
      title: T('promo.title','Промокод: +{{amount}} PLAMc', { amount: PROMO.amount })
    });
    try { localStorage.setItem(PROMO.flag, '1'); } catch(_) {}
    if (promoInput) promoInput.value = '';
    render(); // перерисовать сетку с новым подарком
  }

  // запрет перезагрузки при submit
  if (promoForm && !promoForm.dataset.bound){
    promoForm.dataset.bound = '1';
    promoForm.addEventListener('submit', (e) => {
      e.preventDefault(); e.stopPropagation();
      applyPromo();
    });
  }
  if (promoBtn && !promoBtn.dataset.bound){
    promoBtn.dataset.bound = '1';
    promoBtn.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      applyPromo();
    }, { passive:false });
  }

  // --- РЕНДЕР ПРИЗОВ ---
  function render(){
    const list = getPrizes();
    if (!grid) return;

    if (!list.length){
      grid.innerHTML = `<div style="opacity:.7;text-align:center;font-weight:800">${T('prizes.none','Пока нет призов')}</div>`;
      if (payBtn) payBtn.disabled = true;
      return;
    }

    // карточки призов
    grid.innerHTML = list.map(p => `
      <div class="prize-item" data-id="${p.id}" role="button" tabindex="0" title="${p.title||''}">
        <span class="prize-card" style="background-image:url('${p.img}')"></span>
      </div>
    `).join('');

    syncPayBtn();
  }

  // --- «Радио»-выбор: только один элемент может быть выбран ---
  function selectedId(){
    const sel = root.querySelector('.prize-item.is-selected');
    return sel ? sel.dataset.id : null;
  }
  function selectOnly(el){
    root.querySelectorAll('.prize-item.is-selected').forEach(x => x.classList.remove('is-selected'));
    if (el) el.classList.add('is-selected');
    syncPayBtn();
  }
  function toggleRadio(el){
    if (!el) return;
    if (el.classList.contains('is-selected')) {
      // повторный клик — снимаем выбор (можно и оставить, на твой вкус)
      el.classList.remove('is-selected');
    } else {
      selectOnly(el);
      return; // уже синхронизировали
    }
    syncPayBtn();
  }

  function syncPayBtn(){
    if (!payBtn) return;
    payBtn.disabled = !selectedId();
    // (опционально) локализовать подпись кнопки «Забрать»
    // payBtn.textContent = T('prizes.take','Забрать');
  }

  grid.addEventListener('click', (e)=>{
    const item = e.target.closest('.prize-item'); if (!item) return;
    toggleRadio(item);
  });
  grid.addEventListener('keydown', (e)=>{
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const item = e.target.closest('.prize-item'); if (!item) return;
    e.preventDefault(); toggleRadio(item);
  });

  // --- КНОПКА «ЗАБРАТЬ» (выдаём только один выбранный приз) ---
  if (payBtn && !payBtn.dataset.bound){
    payBtn.dataset.bound = '1';
    payBtn.addEventListener('click', () => {
      const list = getPrizes();
      const id   = selectedId();
      if (!id) return;

      const prize = list.find(x => x.id === id);
      if (!prize) return;

      // поддерживаем тип coins (PLAMc). Если будут звезды/другие типы — расширим.
      if (prize.kind === 'coins') {
        const amount = Number(prize.amount) || 0;
        if (amount > 0){
          addBalance(amount);
          updatePlusBalanceUI();
          try { window.Telegram?.WebApp?.showAlert?.(`+${amount} PLAMc`); } catch(_) {}
        }
      }

      // удаляем выданный приз из списка и перерисовываем
      const next = list.filter(p => p.id !== id);
      setPrizes(next);
      render();

      // можно НЕ закрывать модалку, чтобы забирать по одному; если хочешь закрывать — раскомментируй:
      // closeModal();
    });
  }

  render();
}


// --- Профиль ---
function initProfile(){
  try { window.PlamSound && PlamSound.bindProfile(document); } catch(_) {}
  const root = modalRoot.querySelector('.profile-popup'); 
  if (!root) return;

  // при каждом открытии профиля ещё раз подтягиваем премиум с сервера
  try { syncPremiumFromBackend(); } catch(_) {}


  const avatarEl   = root.querySelector('[data-avatar]');
  const usernameEl = root.querySelector('[data-username]');
  const btnPremium = root.querySelector('[data-btn-premium]');

  const tg  = window.Telegram?.WebApp;
  const usr = tg?.initDataUnsafe?.user || null;
  const firstLast = usr ? [usr.first_name, usr.last_name].filter(Boolean).join(' ') : '';
  const handle    = usr?.username ? '@' + usr.username : (firstLast || '@tg profile');

  usernameEl.textContent = handle;
  if (usr?.photo_url) {
    avatarEl.style.backgroundImage = `url("${usr.photo_url}")`;
  }

  // 1) Быстрый локальный рендер (как было)
  let photosLocal = 0;
  try {
    photosLocal = getPhotoCount();
  } catch (_) {}

  const photosEl = root.querySelector('[data-photo-count]');
  const secsEl   = root.querySelector('[data-show-seconds]');

  if (photosEl) photosEl.textContent = String(photosLocal);

  const baseSecsLocal = isPremium() ? 40 : 20;
  const secsLocal = baseSecsLocal + Math.floor(photosLocal / 100);
  if (secsEl) {
    secsEl.textContent = `${secsLocal} ${T('units.sec_short','сек')}`;
  }

  // 2) Асинхронно подтягиваем реальное количество фото из БД
  (async () => {
    try {
      // auth из plam-auth
      let auth = null;
      if (window.plamAuth && typeof window.plamAuth.user === 'object') {
        auth = window.plamAuth.user;
      }
      if (!auth) {
        try {
          auth = JSON.parse(localStorage.getItem('plam_auth') || 'null');
        } catch (_) {}
      }

      const backendId = auth && auth.id;
      if (!backendId) return;

      const res = await fetch(`/api/v1/photos?userId=${encodeURIComponent(backendId)}`);
      if (!res.ok) return;

      const list = await res.json();
      const total = Array.isArray(list) ? list.length : 0;
      if (!Number.isFinite(total)) return;

      // обновляем локальный счётчик и UI
      try { 
        if (typeof setPhotoCount === 'function') setPhotoCount(total); 
      } catch (_) {}

      if (photosEl) photosEl.textContent = String(total);

      const baseSecs = isPremium() ? 40 : 20;
      const secs = baseSecs + Math.floor(total / 100);
      if (secsEl) {
        secsEl.textContent = `${secs} ${T('units.sec_short','сек')}`;
      }
    } catch (e) {
      console.warn('[profile] failed to sync photo count from backend', e);
    }
  })();

  // --- кнопка премиума (старое поведение; его позже можно будет полностью передать plam-premium.js) ---
  const setBtn = ()=>{
    if (isPremium()){
      btnPremium.textContent = T('premium.active','Премиум активен');
      btnPremium.classList.add('is-owned');
      btnPremium.disabled = false;
      avatarEl.classList.add('has-crown');
    } else {
      btnPremium.textContent = T('profile.get_premium','Получить премиум');
      btnPremium.classList.remove('is-owned');
      btnPremium.disabled = false;
      avatarEl.classList.remove('has-crown');
    }
  };

  setBtn();
  setTimeout(setBtn, 0);

  // «?» справа от кнопки (клик по пузырю)
  root.addEventListener('click', (ev) => {
    const btnRect = btnPremium.getBoundingClientRect();
    const BUBBLE = 50, GAP = 8;
    const left = btnRect.right + GAP;
    const top  = btnRect.top + (btnRect.height - BUBBLE) / 2;
    const x = ev.clientX, y = ev.clientY;
    const hit = (x >= left && x <= left + BUBBLE && y >= top && y <= top + BUBBLE);
    if (hit) { 
      ev.preventDefault(); 
      ev.stopPropagation(); 
      openStack('premium-help'); 
    }
  });

  // этот обработчик можно будет убрать, когда полностью перейдёшь на plam-premium.js
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
  root.querySelector('[data-show-seconds]').textContent = `${secs} ${T('units.sec_short','сек')}`;

  const avatarEl   = root.querySelector('[data-avatar]');
  const btnPremium = root.querySelector('[data-btn-premium]');
  if (isPremium()){
    btnPremium.textContent = T('premium.active','Премиум активен');
    btnPremium.classList.add('is-owned');
    avatarEl?.classList.add('has-crown');
  } else {
    btnPremium.textContent = T('profile.get_premium','Получить премиум');
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
    box.textContent = `${days}${T('units.day_short','д. ')} ${hh}${T('units.hour_short','ч. ')} ${mm}${T('units.min_short','мин.')}`;

    if (ms <= 0){
      clearInterval(timer);
      setPremiumUntil(0);
      try { window.Telegram?.WebApp?.showAlert?.(T('premium.expired','Премиум истёк')); } catch(_) {}
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
  const root = stackRoot.querySelector('.confirm-popup'); 
  if (!root) return;

  const btnYes = root.querySelector('[data-confirm-yes]');
  if (!btnYes) return;

  btnYes.addEventListener('click', async () => {
    const backendId = getBackendUserId();
    if (!backendId) {
      try {
        window.Telegram?.WebApp?.showAlert?.(
          T('errors.generic','Не удалось определить пользователя. Попробуйте ещё раз.')
        );
      } catch(_) {}
      return;
    }

    try {
      const res = await fetch('/api/v1/premium/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: backendId }),
      });

      let data = {};
      try {
        data = await res.json();
      } catch (_) {
        data = {};
      }

      // ===== 1) Не хватает PLAMc =====
      if (res.status === 409) {
        // если бэк прислал актуальный баланс — синхронизируем
        if (typeof data.balance === 'number') {
          setBalance(Number(data.balance) || 0);
          updatePlusBalanceUI();
        }

        // ведём в попап покупки PLAMc
        closeStack();
        closeModal();
        try {
          window.Telegram?.WebApp?.showAlert?.(
            T('errors.not_enough','Недостаточно PLAMc')
          );
        } catch(_) {}
        openModal('buy-stars');
        return;
      }

      // ===== 2) Любая другая ошибка =====
      if (!res.ok || !data || data.active !== true) {
        console.warn('[premium] unexpected response', res.status, data);
        try {
          window.Telegram?.WebApp?.showAlert?.(
            T('premium.buy_failed','Не удалось подключить премиум. Попробуйте ещё раз.')
          );
        } catch(_) {}
        return;
      }

      // ===== 3) Успешная покупка / уже активен =====
      if (typeof data.balance === 'number') {
        setBalance(Number(data.balance) || 0);
        updatePlusBalanceUI();
      }

      if (data.expiresAt) {
        const ts = new Date(data.expiresAt).getTime();
        if (Number.isFinite(ts)) {
          setPremiumUntil(ts);
        }
      }

      closeStack();
      refreshProfileUI();
    } catch (e) {
      console.warn('[premium] buy failed', e);
      try {
        window.Telegram?.WebApp?.showAlert?.(
          T('premium.buy_failed','Не удалось подключить премиум. Попробуйте ещё раз.')
        );
      } catch(_) {}
    }
  });
}



function initPremiumHelp(){ /* закрытие уже есть по [data-dismiss-stack] */ }
function initFAQ(){ /* оставить как есть */ }



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
    const root = document.querySelector('[data-lang-switch]');
    if (!root) return;

    root.querySelectorAll('.lang-switch__btn').forEach(btn => {
      const on = btn.getAttribute('data-lang-target') === code;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-selected', String(on));
    });
  }

  function setLang(code){
    localStorage.setItem(LS_KEY, code);
    applyLangAttr(code);
    reflectUI(code);

    try {
      if (window.i18n && typeof window.i18n.setLang === 'function') window.i18n.setLang(code);
      if (window.i18n && typeof window.i18n.apply === 'function') window.i18n.apply();
    } catch(_) {}

    try { document.dispatchEvent(new CustomEvent('plam:langChanged', { detail: { lang: code } })); } catch(_) {}
  }

  function init(){
    const saved = localStorage.getItem(LS_KEY) || DEFAULT_LANG;
    applyLangAttr(saved);
    reflectUI(saved);

    document.addEventListener('click', (e)=>{
      const btn = e.target.closest && e.target.closest('.lang-switch__btn');
      if (!btn) return;

      // только RU/ENG
      if (!btn.closest('[data-lang-switch]')) return;

      const code = btn.getAttribute('data-lang-target');
      if (!code) return;
      setLang(code);
    });

    document.addEventListener('plam:profilePopup:open', ()=>{
  const current = localStorage.getItem(LS_KEY) || DEFAULT_LANG;
  reflectUI(current);

  // применяем переводы к только что вставленному HTML профиля
  try { i18nApply(modalRoot); } catch(_) {}
  try { i18nApply(stackRoot); } catch(_) {}

  // и синхроним подсветку тумблера звуков
  try { window.PlamSound?.updateAllToggles?.(); } catch(_) {}
});
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.plamLang = { set: setLang };
})();

// Обновления при смене языка — привязываем единый обработчик
document.addEventListener('plam:langChanged', () => {
  try { i18nApply(document); } catch(_) {}
  try { i18nApply(modalRoot); } catch(_) {}
  try { i18nApply(stackRoot); } catch(_) {}

  try { refreshProfileUI(); } catch(_) {}

  try {
    const uploadRoot =
      (typeof modalRoot !== 'undefined' && modalRoot && modalRoot.querySelector)
        ? modalRoot.querySelector('.upload-popup')
        : null;

    if (uploadRoot) {
      document.dispatchEvent(new CustomEvent('plam:langChanged:upload'));
    }
  } catch(_) {}
});

})(); // END app.js wrapper

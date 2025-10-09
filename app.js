if (window.Telegram?.WebApp?.initDataUnsafe?.user?.id) {
  // временно сбрасываем всё при каждом открытии в Telegram
  localStorage.removeItem('plam_state_v2');
}


// === Глобальный стейт ========================================================
const STORAGE_KEY = 'plam_state_v2';
const defaults = {
  balance: 0,            // PLAMc
  photosCount: 0,        // всего загружено фото
  isPremium: false,
  premiumUntil: null,    // ISO строка даты, если премиум активен
  user: {}               // tg user (username, photo_url)
};

function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return { ...defaults };
    const data = JSON.parse(raw);
    return { ...defaults, ...data };
  }catch(e){ return { ...defaults }; }
}
function saveState(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(PLAM)); }

window.PLAM = loadState();
// --- Нормализация состояния премиума (миграция/страховка) ---
// --- Нормализация / миграция состояния премиума ---
(function normalizePremium() {
  const s = (window.PLAM ||= {});
  // считаем активным ТОЛЬКО если premiumUntil в будущем
  const ts = s.premiumUntil ? Date.parse(s.premiumUntil) : NaN;
  const active = !Number.isNaN(ts) && ts > Date.now();
  s.isPremium = !!active;
  if (!active) s.premiumUntil = null;
  saveState();
})();



// helper: есть ли сейчас активный премиум
function isPremiumActive(){
  if(!PLAM.isPremium || !PLAM.premiumUntil) return false;
  const now = Date.now();
  return now < new Date(PLAM.premiumUntil).getTime();
}

// === Telegram: аккуратно достаём пользователя =================================
(function initTelegramUser(){
  const t = window.Telegram?.WebApp;
  if (!t || !t.initDataUnsafe?.user) return;
  const u = t.initDataUnsafe.user;
  PLAM.user = {
    id: u.id,
    username: u.username || '',
    photo_url: u.photo_url || ''
  };
  try { t.expand(); } catch(_) {}
  saveState();
})();

// === Модалка ==================================================================
const modalRoot = document.querySelector('[data-modal-root]');
const modalContent = document.querySelector('[data-modal-content]');
const Scroll = {
  lock(){ document.documentElement.style.overflow = 'hidden'; },
  unlock(){ document.documentElement.style.overflow = ''; }
};

function openModal(id){
  const tpl = document.getElementById(`tpl-${id}`);
  if(!tpl) return;
  modalContent.innerHTML = '';
  modalContent.appendChild(tpl.content.cloneNode(true));
  modalRoot.hidden = false;
  modalRoot.setAttribute('aria-hidden','false');
  Scroll.lock();

  // инициализация по id
  const map = {
    'upload-popup': initUploadPopup,
    'buy-stars':    initBuyStars,
    'prizes':       initPrizes,
    'profile':      initProfile,
    'confirm-premium': initConfirmPremium
  };
  map[id]?.();
}

function closeModal(){
  modalRoot.hidden = true;
  modalRoot.setAttribute('aria-hidden','true');
  modalContent.innerHTML = '';
  Scroll.unlock();
}

// делегирование кликов
document.addEventListener('click', (e) => {
  const opener = e.target.closest('[data-open-modal]');
  if (opener) {
    openModal(opener.getAttribute('data-open-modal'));
    return;
  }
  if (e.target.matches('[data-dismiss]') || e.target.closest('[data-dismiss]')) {
    closeModal();
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !modalRoot.hidden) closeModal();
});

// === Обновление облака «плюс» =================================================
function updatePlus(){
  const el = document.getElementById('plusValue');
  if (el) el.textContent = String(PLAM.balance);
}
updatePlus();

// === Попап №1: загрузка фото ==================================================
function initUploadPopup(){
  const root = modalRoot.querySelector('.upload-popup');
  if(!root) return;

  // выбрать фото
  const fileInput = root.querySelector('#file-input');
  root.querySelector('.btn-pick')?.addEventListener('click', () => fileInput?.click());

  // слайдер 0..20 PLAMc
  const rng = root.querySelector('.range');
  const starsEl = root.querySelector('[data-stars]');
  const secsEl  = root.querySelector('[data-secs]');

  const update = () => {
    const v = parseInt(rng.value,10);
    starsEl.textContent = `${v} PLAMc`;
    secsEl.textContent  = v === 0 ? `0 sec` : `+${v} sec`;
  };
  rng.addEventListener('input', update);
  update();

  // отправка
  root.querySelector('[data-upload-form]')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const cost = parseInt(rng.value,10);
    if (cost > PLAM.balance) {
      alert('Недостаточно PLAMc');
      return;
    }
    // списываем и меняем стейт
    PLAM.balance -= cost;
    PLAM.photosCount += 1;
    saveState();
    updatePlus();
    closeModal();
  });
}

// === Попап №2: магазин / обмен ===============================================
function initBuyStars(){
  const root = modalRoot.querySelector('.shop-popup');
  if(!root) return;

  root.querySelectorAll('.shop-item').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const amount = parseInt(btn.dataset.amount,10) || 0;
      PLAM.balance += amount;   // 1:1
      saveState();
      updatePlus();
      closeModal();
    });
  });
}

// === Попап №3: призы ==========================================================
function initPrizes(){
  const root = modalRoot.querySelector('.prizes-popup');
  if(!root) return;

  const list = root.querySelector('[data-prizes]');
  const pay  = root.querySelector('.btn-pay');

  const sync = () => {
    const any = list.querySelectorAll('.check-input:checked').length > 0;
    pay.disabled = !any;
  };
  list.addEventListener('change', sync);
  sync();

  pay.addEventListener('click', ()=>{ alert('Заявка на выплату отправлена'); closeModal(); });
}

// === Попап №4: профиль ========================================================
let premiumTimerInt = null;

function formatCountdown(ms){
  if (ms < 0) ms = 0;
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000)/3600000).toString().padStart(2,'0');
  const m = Math.floor((ms % 3600000)/60000).toString().padStart(2,'0');
  return `${d} д ${h}:${m}`;
}

function startPremiumTimer(outEl){
  if (premiumTimerInt) clearInterval(premiumTimerInt);
  const until = new Date(PLAM.premiumUntil).getTime();
  const tick = ()=>{
    const left = until - Date.now();
    outEl.textContent = formatCountdown(left);
    if (left <= 0) {
      clearInterval(premiumTimerInt);
      PLAM.isPremium = false;
      PLAM.premiumUntil = null;
      saveState();
      // перестроим попап
      initProfile(true);
    }
  };
  tick();
  premiumTimerInt = setInterval(tick, 1000 * 30); // раз в 30 сек достаточно
}

function computePhotoTime(){
  const base = isPremiumActive() ? 40 : 20;
  const bonus = Math.floor((PLAM.photosCount || 0) / 100);
  return base + bonus;
}

function initProfile(reuseDOM=false){
  const root = modalRoot.querySelector('.profile-popup');
  if(!root) return;

  const avatar = root.querySelector('[data-avatar]');
  const uname  = root.querySelector('[data-username]');
  const row    = root.querySelector('[data-premium-row]');
  const chip   = root.querySelector('[data-premium-chip]');
  const timer  = root.querySelector('[data-premium-timer]');
  const crown  = root.querySelector('[data-crown]');
  const photos = root.querySelector('[data-photos-count]');
  const timeEl = root.querySelector('[data-photo-time]');

  // заполняем ник/аватар если есть
  if (PLAM.user?.username) uname.textContent = '@' + PLAM.user.username;
  if (PLAM.user?.photo_url) avatar.style.backgroundImage = `url("${PLAM.user.photo_url}")`;

  // количество фото и время показа
  photos.textContent = String(PLAM.photosCount || 0);
  timeEl.textContent = `${computePhotoTime()} сек`;

  const premiumActive = isPremiumActive();

  // вью состояния
  crown.hidden = !premiumActive;
  chip.hidden  = !premiumActive;
  row.hidden   =  premiumActive;

  if (premiumActive) startPremiumTimer(timer);

  // «Получить премиум»
  root.querySelector('[data-premium-btn]')?.addEventListener('click', ()=>{
    openModal('confirm-premium');
  });

  // «?»
  const helpSheet = root.querySelector('[data-help-sheet]');
  root.querySelector('[data-help]')?.addEventListener('click', ()=> helpSheet.hidden = false);
  root.querySelector('[data-help-close]')?.addEventListener('click', ()=> helpSheet.hidden = true);
}

// попап подтверждения премиума
function initConfirmPremium(){
  const root = modalRoot.querySelector('.confirm-popup');
  if(!root) return;
  root.querySelector('[data-confirm-yes]')?.addEventListener('click', ()=>{
    const price = 1500;
    if (PLAM.balance < price) {
      // не хватает — открываем магазин
      closeModal();
      openModal('buy-stars');
      return;
    }
    PLAM.balance -= price;
    PLAM.isPremium = true;
    const until = new Date();
    until.setDate(until.getDate() + 30);
    PLAM.premiumUntil = until.toISOString();
    saveState();
    updatePlus();
    closeModal();
    openModal('profile'); // показать активированный
  });
}

// === DEBUG (включи строку ниже, чтобы видеть зоны клика) ======================
// document.body.classList.add('__debug');

// подстраховка выбора фона (если picture вдруг не сработал)
(function ensureCorrectBackground() {
  const img = document.querySelector('.stage__img');
  if (!img) return;
  const w = window.innerWidth, h = window.innerHeight;
  if (h >= 1024 || w >= 768) {
    img.src = './bgicons/bg-large.png';
    img.srcset = './bgicons/bg-large.png 1x, ./bgicons/bg-large@2x.png 2x';
  } else if (w <= 360 || h <= 640) {
    img.src = './bgicons/bg-small.png';
    img.srcset = './bgicons/bg-small.png 1x, ./bgicons/bg-small@2x.png 2x';
  } else {
    img.src = './bgicons/bg-medium.png';
    img.srcset = './bgicons/bg-medium.png 1x, ./bgicons/bg-medium@2x.png 2x';
  }
})();

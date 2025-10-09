253
254
255
256
257
258
259
260
261
262
263
264
265
266
267
268
269
270
271
272
273
274
275
276
277
278
279
280
281
282
283
284
285
286
287
288
289
290
291
292
293
294
295
296
297
298
299
300
301
302
303
304
305
306
307
308
309
310
311
312
313
314
315
316
317
318
319
  const avatarEl   = root.querySelector('[data-avatar]');
/* ===== таймер 30 дней ===== */
let _premiumTimerId = null;
function startPremiumTimer(untilTs, targetEl){
  stopPremiumTimer(targetEl);
  const tick = () => {
    const ms = Math.max(0, untilTs - Date.now());
    const days = Math.floor(ms / (24*60*60*1000));
    const hours = Math.floor((ms % (24*60*60*1000)) / (60*60*1000));
    const minutes = Math.floor((ms % (60*60*1000)) / (60*1000));
    if (targetEl) targetEl.textContent = `${days} д ${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}`;
    if (ms <= 0) {
      const plam = (window.PLAM ||= {});
      plam.isPremium = false;
      plam.premiumUntil = undefined;
      // Перерисовать профиль, если открыт
      const opened = document.querySelector('[data-modal-root] .profile-popup');
      if (opened) initProfilePopup();
      stopPremiumTimer(targetEl);
    }
  };
  _premiumTimerId = setInterval(tick, 30*1000); // раз в 30 сек достаточно
  tick();
}
function stopPremiumTimer(){
  if (_premiumTimerId) { clearInterval(_premiumTimerId); _premiumTimerId = null; }
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


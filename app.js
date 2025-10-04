/* Basic modal + Telegram WebApp integration */
(function(){
  const TWA = window.Telegram?.WebApp;
  if (TWA) {
    TWA.ready();
    // Optional theme sync
    document.documentElement.style.colorScheme = TWA.colorScheme || 'light';
  }

  const $ = (sel)=>document.querySelector(sel);
  const modal = $('#modal');
  const modalImg = $('#modalImg');

  const open = (src)=>{
    modalImg.src = src;
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }
  const close = ()=>{
    modal.classList.add('hidden');
    modalImg.src = '';
    document.body.style.overflow = '';
  }

  // Close on backdrop click or Escape
  modal.addEventListener('click', (e)=>{
    if (e.target.dataset.close === 'true') close();
  });
  window.addEventListener('keydown', (e)=>{
    if (e.key === 'Escape' && !modal.classList.contains('hidden')) close();
  });

  // Bind hotspots -> images
  $('#btnPlus') .addEventListener('click', ()=>open('./assets/popup-stars.png'));
  $('#btnGift') .addEventListener('click', ()=>open('./assets/popup-prizes.png'));
  $('#btnDiary').addEventListener('click', ()=>open('./assets/popup-profile.png'));
  $('#btnBoard').addEventListener('click', ()=>open('./assets/popup-photo.png'));

  // Expose for debug in console
  window.__miniapp = { open, close };
})();


/* Dev helper: press 'h' to toggle hitbox visibility */
(function(){
  let on=false;
  window.addEventListener('keydown', (e)=>{
    if(e.key.toLowerCase()==='h'){
      on=!on;
      document.body.classList.toggle('show-hitboxes', on);
    }
  });
})();

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
  const tg = window.Telegram.WebApp;
tg.expand(); // разворачивает окно на весь экран

// Получаем данные пользователя
const user = tg.initDataUnsafe.user;

console.log(user);

// Пример: отображаем имя и аватар
document.getElementById('name').innerText = user.first_name + ' ' + (user.last_name || '');
document.getElementById('username').innerText = '@' + (user.username || '—');

// Загрузка аватара (через Bot API)
fetch(`https://api.telegram.org/bot<8469653359:AAF1iggmErf8xposwoUDU8i1bQdAjNgFV2I>/getUserProfilePhotos?user_id=${user.id}`)
  .then(res => res.json())
  .then(data => {
    if (data.ok && data.result.photos.length > 0) {
      const fileId = data.result.photos[0][0].file_id;
      fetch(`https://api.telegram.org/bot<8469653359:AAF1iggmErf8xposwoUDU8i1bQdAjNgFV2I>/getFile?file_id=${fileId}`)
        .then(r => r.json())
        .then(fileData => {
          const filePath = fileData.result.file_path;
          const photoUrl = `https://api.telegram.org/file/bot<8469653359:AAF1iggmErf8xposwoUDU8i1bQdAjNgFV2I>/${filePath}`;
          document.getElementById('avatar').src = photoUrl;
        });
    }
  });

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

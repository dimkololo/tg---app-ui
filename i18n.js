/*! i18n.js — минималистичная локализация для Plam (RU/EN)
   Поддержка:
   - data-i18n="key"            → innerText/innerHTML (авто: HTML если есть теги)
   - data-i18n-placeholder="k"  → placeholder
   - data-i18n-title="k"        → title
   - data-i18n-aria-label="k"   → aria-label
   - Небезопасного ввода от пользователя нет: словари локальные → innerHTML безопасен.
   - Сохранение языка в localStorage (plam_lang)
   - Деликатное сохранение динамических значений в некоторых узлах (data-mins, data-coins)
*/

(function(){
  const STORAGE_KEY = 'plam_lang';
  const DEFAULT_LANG = 'ru';

  const DICT = {
    ru: {
      // Общие
      'common.cancel': 'Отмена',
      'common.accept': 'Принять',
      'common.ok': 'Ок',
      'common.close': 'Закрыть',
      'common.yes': 'Да',
      'common.no': 'Нет',
      'common.confirm': 'Подтвердить',

      // Загрузка
      'upload.pick': 'Выбрать фото',
      'upload.empty': 'Фото не выбрано',
      'upload.boost_title': 'Увеличить эфирное время',
      'upload.link_ph': '...ссылка на соц.сеть или сайт',
      'upload.desc_ph': '...описание',
      'upload.submit_20s': 'В эфир на 20 секунд',
      'upload.reset_title': 'Сбросить <span data-mins>0</span> минут за <span data-coins>0</span> PLAMc',

      // Политика
      'policy.title': 'Правила отправки фото',
      'policy.ban':
        'Запрещено: обнажёнка/эротика; алкоголь/табак/наркотики; насилие и опасные действия; дискриминация/экстремизм; реклама, QR-коды, ссылки и контакты; личные/конфиденциальные данные; чужие фото без согласия; попытки обхода модерации.',
      'policy.req':
        'Требования: безопасный сюжет, без водяных знаков и крупных надписей, приличное качество.',
      'policy.note':
        'Отправляя фото, вы подтверждаете, что вам 13+ и у вас есть права на изображение. Мы можем удалять материалы и ограничивать доступ при нарушениях.',
      'policy.checkbox': 'Мне 13+ и я согласен с правилами',

      // Магазин
      'shop.title': 'Обменять',
      'shop.sub': 'Выберите количество звезд',
      'shop.item_25': '25 звезд',
      'shop.item_75': '75 звезд',
      'shop.item_100': '100 звезд',
      'shop.item_350': '350 звезд',
      'shop.item_750': '750 звезд',
      'shop.item_1500': '1500 звезд',

      // FAQ
      'faq.title': 'FAQ',

      // Призы
      'prizes.pay': 'Выплатить',
      'prizes.note': 'Нажимая кнопку «Выплатить» вы подтверждаете, что ознакомлены с правилами и публичной офертой.',

      // Профиль
      'profile.get_premium': 'Получить премиум',
      'profile.photos_count': 'Количество фото:',
      'profile.photos_hint': 'Количество фото влияет на время их отображения. 100 фото = +1 секунда',
      'profile.show_time': 'Время показа фото:',

      // Премиум
      'premium.active': 'Премиум активен',
      'premium.countdown': 'Обратный отсчёт до окончания подписки',
      'premium.about_title': 'Что такое премиум?',
      'premium.confirm_text': 'Вы хотите получить премиум на 7 дней за 350 PLAMc?',

      // Подписки
      'subs.title': 'Подписка обязательна',
      'subs.sub': 'Подпишитесь на наши каналы, чтобы отправлять фото.',
      'subs.yt': 'Youtube канал',
      'subs.tg': 'Telegram канал',
      'subs.check': 'Проверить подписки',
      'subs.note': 'После успешной проверки можно закрыть окно и отправить фото.',

      // Колесо/Задания
      'fortune.wheel': 'Колесо фортуны',
      'fortune.tasks': 'Задания',
      'fortune.spin': 'Вращать',
      'fortune.tasks_empty': 'Скоро тут появятся задания.',
    },

    en: {
      // Common
      'common.cancel': 'Cancel',
      'common.accept': 'Accept',
      'common.ok': 'OK',
      'common.close': 'Close',
      'common.yes': 'Yes',
      'common.no': 'No',
      'common.confirm': 'Confirm',

      // Upload
      'upload.pick': 'Choose a photo',
      'upload.empty': 'No photo selected',
      'upload.boost_title': 'Boost on-air time',
      'upload.link_ph': '...link to social or website',
      'upload.desc_ph': '...description',
      'upload.submit_20s': 'On air for 20 seconds',
      // keep <span> placeholders — JS вставляет числа внутрь этих тегов
      'upload.reset_title': 'Reset <span data-mins>0</span> minutes for <span data-coins>0</span> PLAMc',

      // Policy
      'policy.title': 'Photo submission rules',
      'policy.ban':
        'Forbidden: nudity/erotica; alcohol/tobacco/drugs; violence and dangerous acts; discrimination/extremism; ads, QR codes, links and contacts; personal/confidential data; other people’s photos without consent; attempts to bypass moderation.',
      'policy.req':
        'Requirements: safe content, no watermarks or large text, reasonable quality.',
      'policy.note':
        'By submitting a photo, you confirm you are 13+ and you own the rights to the image. We may remove content and restrict access on violations.',
      'policy.checkbox': 'I am 13+ and I agree to the rules',

      // Shop
      'shop.title': 'Exchange',
      'shop.sub': 'Choose the number of stars',
      'shop.item_25': '25 stars',
      'shop.item_75': '75 stars',
      'shop.item_100': '100 stars',
      'shop.item_350': '350 stars',
      'shop.item_750': '750 stars',
      'shop.item_1500': '1500 stars',

      // FAQ
      'faq.title': 'FAQ',

      // Prizes
      'prizes.pay': 'Payout',
      'prizes.note': 'By pressing “Payout” you confirm you are familiar with the rules and public offer.',

      // Profile
      'profile.get_premium': 'Get Premium',
      'profile.photos_count': 'Photos uploaded:',
      'profile.photos_hint': 'More photos — longer on-air time. Every 100 photos = +1 second',
      'profile.show_time': 'Photo on-air time:',

      // Premium
      'premium.active': 'Premium is active',
      'premium.countdown': 'Countdown to subscription end',
      'premium.about_title': 'What is Premium?',
      'premium.confirm_text': 'Do you want Premium for 7 days for 350 PLAMc?',

      // Subs
      'subs.title': 'Subscription required',
      'subs.sub': 'Subscribe to our channels to submit photos.',
      'subs.yt': 'YouTube channel',
      'subs.tg': 'Telegram channel',
      'subs.check': 'Verify subscriptions',
      'subs.note': 'After successful verification you can close this window and send a photo.',

      // Fortune
      'fortune.wheel': 'Wheel of Fortune',
      'fortune.tasks': 'Tasks',
      'fortune.spin': 'Spin',
      'fortune.tasks_empty': 'Tasks will appear here soon.',
    }
  };

  // -------- core --------
  let currentLang = readLang();

  function readLang(){
    try { return localStorage.getItem(STORAGE_KEY) || DEFAULT_LANG; }
    catch(_) { return DEFAULT_LANG; }
  }
  function writeLang(lang){
    try { localStorage.setItem(STORAGE_KEY, lang); } catch(_) {}
  }

  function t(key){
    const dict = DICT[currentLang] || {};
    return (dict && dict[key]) || (DICT[DEFAULT_LANG] && DICT[DEFAULT_LANG][key]) || null;
  }

  function setTextLike(el, value){
    if (value == null) return;
    // если перевод содержит HTML-теги — используем innerHTML, иначе textContent
    if (value.indexOf('<') !== -1) {
      // Сохранение динамических значений (например, data-mins/data-coins) если они уже были установлены
      const minsOld   = el.querySelector?.('[data-mins]')?.textContent;
      const coinsOld  = el.querySelector?.('[data-coins]')?.textContent;
      el.innerHTML = value;
      if (minsOld != null)  { const m = el.querySelector('[data-mins]');  if (m) m.textContent = minsOld; }
      if (coinsOld != null) { const c = el.querySelector('[data-coins]'); if (c) c.textContent = coinsOld; }
    } else {
      el.textContent = value;
    }
  }

  function apply(root=document){
    const scope = root instanceof Document ? root : (root || document);

    // data-i18n → текст
    scope.querySelectorAll('[data-i18n]').forEach(el=>{
      const key = el.getAttribute('data-i18n');
      const value = t(key);
      if (value) setTextLike(el, value);
    });

    // placeholder/title/aria-label
    scope.querySelectorAll('[data-i18n-placeholder]').forEach(el=>{
      const key = el.getAttribute('data-i18n-placeholder');
      const value = t(key);
      if (value) el.setAttribute('placeholder', value);
    });
    scope.querySelectorAll('[data-i18n-title]').forEach(el=>{
      const key = el.getAttribute('data-i18n-title');
      const value = t(key);
      if (value) el.setAttribute('title', value);
    });
    scope.querySelectorAll('[data-i18n-aria-label]').forEach(el=>{
      const key = el.getAttribute('data-i18n-aria-label');
      const value = t(key);
      if (value) el.setAttribute('aria-label', value);
    });

    // html lang
    try {
      (scope.ownerDocument || document).documentElement.setAttribute('lang', currentLang);
    } catch(_) {}
  }

  function setLang(lang){
    if (!DICT[lang]) lang = DEFAULT_LANG;
    currentLang = lang;
    writeLang(lang);
    apply(document);
  }

  function init(opts = {}){
    const lang = opts.lang && DICT[opts.lang] ? opts.lang : readLang();
    currentLang = lang;
    try { document.documentElement.setAttribute('lang', lang); } catch(_) {}
  }

  // Экспорт в window
  window.i18n = {
    init,
    apply,
    setLang,
    t,
    get lang(){ return currentLang; },
    get dict(){ return DICT; },
  };
})();

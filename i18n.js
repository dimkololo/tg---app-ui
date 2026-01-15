// Ничего не перезаписывает, если перевода по ключу нет.
// Поддерживает: data-i18n, data-i18n-placeholder, data-i18n-title, data-i18n-aria-label.
// Синхронизируется с localStorage('plam_lang') и <html data-lang>.

(function () {
  const LS_KEY = 'plam_lang';

  // Словари: оставляем пустыми — UI не меняется, пока не добавим переводы.
  const DICTS = {
    ru: {
      // пример (позже раскомментируем/добавим):
      // "common.close": "Закрыть",
    },
    en: {
      // пример:
      // "common.close": "Close",
    },
  };

  function getInitialLang() {
    const saved = localStorage.getItem(LS_KEY);
    if (saved) return saved.toLowerCase();
    const html = document.documentElement;
    const fromData = html.getAttribute('data-lang');
    const fromAttr = html.getAttribute('lang');
    return (fromData || fromAttr || 'ru').toLowerCase();
  }

  function getLang() {
    return localStorage.getItem(LS_KEY) || getInitialLang();
  }

  function setLang(code) {
    const lang = (code || 'ru').toLowerCase();
    localStorage.setItem(LS_KEY, lang);
    const html = document.documentElement;
    html.setAttribute('data-lang', lang);
    html.setAttribute('lang', lang);
    return lang;
  }

  function t(key, vars) {
    const lang = getLang();
    let out = (DICTS[lang] && DICTS[lang][key]) || null;
    if (!out) return null; // нет перевода — ничего не делаем
    if (vars && typeof out === 'string') {
      out = out.replace(/\{\{(\w+)\}\}/g, (_, k) => (k in vars ? String(vars[k]) : ''));
    }
    return out;
  }

  function translateTextLike(el, key) {
  const raw = t(key);
  if (!raw) return;

  // если есть HTML — кладём как разметку
  if (raw.indexOf('<') !== -1) {
    el.innerHTML = raw;
    return;
  }

  // иначе это «чистый текст»: декодируем HTML-сущности (&nbsp; и др.)
  let val = raw;
  if (/&(?:[a-z]+|#\d+);/i.test(val)) {
    const ta = document.createElement('textarea');
    ta.innerHTML = val;
    val = ta.value;
  }
  el.textContent = val;
}

  function translateAttr(el, dataAttr, realAttr) {
    const key = el.getAttribute(dataAttr);
    if (!key) return;
    const val = t(key);
    if (!val) return; // нет перевода — оставляем исходное значение
    el.setAttribute(realAttr, val);
  }

  function apply(root) {
    const scope = root || document;

    // Текстовые узлы
    scope.querySelectorAll('[data-i18n]').forEach((el) => {
      translateTextLike(el, el.getAttribute('data-i18n'));
    });

    // Атрибуты
    scope.querySelectorAll('[data-i18n-placeholder]').forEach((el) =>
      translateAttr(el, 'data-i18n-placeholder', 'placeholder')
    );
    scope.querySelectorAll('[data-i18n-title]').forEach((el) =>
      translateAttr(el, 'data-i18n-title', 'title')
    );
    scope.querySelectorAll('[data-i18n-aria-label]').forEach((el) =>
      translateAttr(el, 'data-i18n-aria-label', 'aria-label')
    );
  }
function flattenDict(obj, prefix = '', out = {}) {
  if (!obj || typeof obj !== 'object') return out;
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;

    if (v && typeof v === 'object' && !Array.isArray(v)) {
      flattenDict(v, key, out);
    } else {
      out[key] = v;
    }
  }
  return out;
}

  // Позволяет постепенно подливать словари
 function load(lang, dict) {
  if (!lang || !dict) return;
  const code = lang.toLowerCase();

  const flat = flattenDict(dict); // ← ВОТ ЭТО ВАЖНО

  DICTS[code] = Object.assign({}, DICTS[code] || {}, flat);
}


  function init() {
    // зафиксируем язык и проставим атрибуты на <html>
    setLang(getLang());
    // безопасно применим (словари пустые — визуально ничего не изменится)
    apply(document);

    // Автоприменение для вновь вставленных узлов (например, контент попапов из <template>)
    const mo = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node.nodeType !== 1) continue; // ELEMENT_NODE
          const el = /** @type {Element} */ (node);
          if (
            el.hasAttribute?.('data-i18n') ||
            el.querySelector?.('[data-i18n],[data-i18n-placeholder],[data-i18n-title],[data-i18n-aria-label]')
          ) {
            apply(el);
          }
        }
      }
    });
    if (document.body) {
      mo.observe(document.body, { childList: true, subtree: true });
    }
  }

  // Экспорт
  window.i18n = {
    getLang,
    setLang,
    t,
    apply,
    load,
    _dicts: DICTS, // для отладки
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

// ===== Dictionaries (EN + RU) =====
i18n.load('en', { 
  // Common
  "title.app": "Plam — WebApp",
  "common.close": "Close",
  "common.ok": "OK",
  "common.cancel": "Cancel",
  "common.accept": "Accept",
  "common.yes": "Yes",
  "common.no": "No",
  "common.thanks": "Thanks",

  // Units / short
  "units.sec_short": "sec",
  "units.min_short": "min.",
  "units.hour_short": "h.",
  "units.day_short": "d.",

  // Upload popup
  "upload.pick": "Choose photo",
  "upload.rules_title": "Rules",
  "upload.no_photo": "No photo selected",
  "upload.remove_photo": "Remove photo",
  "upload.increase_time": "Increase live time",
  "upload.broadcast_btn": "Go live for {{total}} {{unit}}",
  "upload.reset_timer": "Reset timer",
  "upload.attach_photo": "Attach a photo",
  "upload.in_queue": "Your photo is queued",
  "upload.link_invalid": "The link must start with http:// or https:// (https://t.me/ is also supported)",
  "upload.reset_ok": "Done! Send another photo",
  "upload.promo": "Win. Promote. Invite.",
  "reset.button": "Reset {{mins}} min for {{coins}} PLAMc",
  "reset.or": "or",
  "reset.share": "Share",
  "reset.shared_ok": "Thanks! The timer has been reset.",
  "share.text": "Join PLAM — send photos and win!",
  "reset.shared_used": "Already used",
  "reset.share_wait": "Waiting for sending…",
  "reset.share_fail": "We didn’t detect a share. Try again",

  // Rules
  "rules.title": "Photo submission rules",
  "rules.forbidden": "<strong>Forbidden:</strong> nudity/erotica; alcohol/tobacco/drugs; violence and dangerous activities; discrimination/extremism; ads, QR-codes, links and contacts; personal/confidential data; third-party photos without consent; attempts to bypass moderation.",
  "rules.requirements": "<strong>Requirements:</strong> safe content, no watermarks or large captions, decent quality.",
  "rules.confirmation": "By submitting a photo you confirm that you are 13+ and own the rights to the image. We may remove content and limit access in case of violations.",
  "rules.agree": "I am 13+ and I agree with the rules",

  // Shop / Prizes
  "shop.exchange": "Exchange",
  "shop.choose_amount": "Choose the number of stars",
  "prizes.take": "Claim",
  "prizes.note": "By clicking “Claim” you confirm that you have read the rules and the public offer.",
  "prizes.none": "No prizes yet",

  // Subs
  "subs.title": "Subscription required",
  "subs.subtitle": "Subscribe to our channels to send photos.",
  "subs.youtube": "YouTube channel",
  "subs.telegram": "Telegram channel",
  "subs.check": "Check subscriptions",
  "subs.note": "After a successful check you can close the window and send a photo.",

  // Profile
  "profile.get_premium": "Get Premium",
  "profile.photos_count": "Photos sent:",
  "profile.photos_hint": "The number of sent photos increases your live time.\n100 photos = +1 second",
  "profile.show_time": "Live time:",
  "on": "On",
  "off": "Off",

  // Premium timer/help
  "premium.active": "Premium is active",
  "premium.countdown_note": "Countdown until the subscription ends",
  "premium.expired": "Premium expired",
  "premium.benefits_title": "Premium subscription benefits",
  "premium.basic": "Basic",
  "premium.premium": "Premium",
  "premium.rule_cooldown": "Photo sending cooldown",
  "premium.cooldown_basic": "30\u00A0min",
  "premium.cooldown_premium": "20\u00A0min",
  "premium.rule_showtime": "Live time photo showing",
  "premium.showtime_basic": "20\u00A0sec",
  "premium.showtime_premium": "40\u00A0sec",
  "premium.rule_gifts": "Gifts payout priority",
  "premium.gifts_basic": "—",
  "premium.gifts_premium": "✓",
  "premium.rule_top": "Chance to get into the leaderboard",
  "premium.top_basic": "regular",
  "premium.top_premium": "high",
  "premium.rule_reset_pay": "Reset cooldown for PLAMc",
  "premium.reset_pay_basic": "—",
  "premium.reset_pay_premium": "✓",
  "premium.note": "More submissions and longer showtime mean more chances for prizes and the leaderboard.",
  "confirm.premium_title_static": "Get Premium for 7 days for 350 PLAMc?",

  // Leaders modal
  "leaders.weekly_gifts": "Weekly gifts",
  "leaders.title": "Leaderboard",
  "leaders.podium_aria": "Podium",
  "leaders.rank1": "1st place",
  "leaders.rank2": "2nd place",
  "leaders.rank3": "3rd place",
  "leaders.photos_count": "0 photos",
  "leaders.photos": "photo",

  // ARIA
  "aria.open_actions": "Open actions menu",
  "aria.leaders": "Leaders",
  "aria.open_upload": "Open upload popup",
  "aria.open_stars": "Open stars popup",
  "aria.open_faq": "Open FAQ",
  "aria.open_prizes": "Open prizes popup",
  "aria.open_profile": "Open profile",

  // RESET
  "reset.title": "Reset {{mins}} minutes for {{coins}} PLAMc",
  "reset.confirm": "Confirm",

  //placeholder
  "upload.link_placeholder": "...link to social or website",
  "upload.desc_placeholder": "...description",

  //PROMO
  "promo.placeholder": "Promo code",
  "promo.apply": "Activate",
  "promo.hint": "You can use a promo code once.",
  "promo.title": "Promo: +{{amount}} PLAMc",
  "promo.invalid": "The promo code is used or invalid",
  "promo.already": "You have already activated this promo code",

  
  //fortune
   "fortune.title": "Spin the Wheel",
  "fortune.spin": "Spin",
  "fortune.stop": "Stop",
  "fortune.win": "You won: {{prize}}",
  "fortune.lose": "No prize this time",
  "fortune.try_again": "Try again",
  "fortune.balance": "Balance: {{amount}} PLAMc",
  "fortune.get_more": "Get more PLAMc",
  "fortune.claim": "Claim prize",
  "fortune.not_enough": "Not enough PLAMc",
  "fortune.auto_spin": "Auto spin",
  "fortune.results_title": "Results",
  "fortune.close": "Close",
  "fortune.error": "Something went wrong",
  "fortune.rules": "Rules",
  "fortune.return_in": "Return in: {{time}}",
  "fortune.tasks_tab": "Tasks",
  "fortune.tab_game": "Game",
  "fortune.tasks_empty": "The \"Tasks\" section will be available soon",
  "common.back": "Back",
  faq: {
  title: "FAQ",

  term_plam: "PLAM",
  term_rewards: "rewards",
  term_on_air: "On-air",
  term_winner: "winner",
  term_plamc: "PLAMc",
  term_stump: "stump",
  term_link: "link",
  term_description: "description",
  term_slider: "slider",
  term_go_live_btn: "“Go live for … seconds”",
  term_important: "Important:",
  term_plus_seconds: "extra seconds",
  term_maximum: "Maximum:",
  term_no_premium: "Without Premium:",
  term_with_premium: "With Premium:",
  term_plus_one_second: "+1 second",
  term_20_40: "20 → 40 seconds",
  term_profile: "Profile",
  term_get_premium: "“Get Premium”",
  term_plus: "+",
  support_contact: "support.example.replace.me",

  what_is_title: "What is PLAM?",
  what_is_p1_mid: " is a social project where you send photos on-air for a limited time and receive ",
  what_is_li1_after: " is a 24/7 stream.",
  what_is_li2_before: "Every hour a ",
  what_is_li2_after: " is chosen at random and receives a reward.",
  what_is_li3: "Photos sent on-air are treated as confirmation of participation in the draw and acceptance of the project rules.",
  what_is_li4_before: "You can increase how many photos you can send using ",

  how_send_title: "How do I send a photo on-air?",
  how_send_1_before: "Tap the ",
  how_send_1_after: " (photo upload).",
  how_send_2_before: "Choose a photo → optionally add a ",
  how_send_2_mid: " and a ",
  how_send_3_before: "Set extra time with the ",
  how_send_3_after: " (if needed).",
  how_send_4_before: "Tap ",
  how_send_4_after: " — the photo goes to moderation and, after approval, enters the display queue.",

  queue_title: "Why do we need a queue and moderation?",
  queue_p1: "Each photo is checked after submission to ensure it follows the rules and content restrictions.",
  queue_p2: "The number of photos in the queue affects how many can be shown on-air at the same time. If multiple photos are on-air when a winner is chosen, the reward will be drawn randomly among them.",

  why_link_title: "Why add a link and description?",
  why_link_p1: "If your photo wins the hourly draw and it has a link and description attached, we will publish the winner in our Telegram channel. This gives the winner extra promotion on top of the reward.",
  why_link_p2_after: " the link must not lead to prohibited content/products or to companies involved in propaganda.",

  plamc_title: "PLAMc and display time",
  plamc_what_title: "What is PLAMc?",
  plamc_what_p1_after: " is PLAM’s internal currency. You can spend it to increase photo display time and use certain features.",

  slider_title: "How does the time slider work?",
  slider_p1_before: "The slider adds ",
  slider_p1_after: " to the base display time. The more PLAMc you put in, the longer your photo stays on-air.",
  slider_p2_after: " +20 seconds.",

  default_title: "How long is one photo shown by default?",
  default_li1_after: " base time = 20 seconds",
  default_li2_after: " base time = 40 seconds",
  default_p1_before: "For every 100 photos you send, the base value increases by ",
  default_p1_after: " to the base value.",

  cooldown_title: "Why is there a timer / cooldown?",
  cooldown_p1: "To prevent endless spam and keep it fair for everyone. If a cooldown is active, sending is limited until it ends.",

  premium_title: "Premium and balance",
  premium_what_title: "What does Premium do?",
  premium_what_p1_before: "Premium increases the base photo display time: ",
  premium_what_p1_after: " (no extra cost). You can also see the status and time remaining in your profile.",

  premium_where_title: "Where can I enable Premium?",
  premium_where_p1_before: "Open ",
  premium_where_p1_mid: " (notebook icon) → tap ",

  premium_q_title: "Why is there a “?” next to Premium?",
  premium_q_p1: "It briefly explains what Premium gives, how it works, and why it’s worth it.",

  balance_where_title: "Where can I see my PLAMc balance?",
  balance_where_p1_before: "Your balance is shown in the top-right corner — in the cloud with a ",

  sections_title: "App sections",
  gift_title: "What is the “gift” for?",
  gift_p1: "This is where your rewards/prizes/activities you received in PLAM are stored.",

  wheel_title: "What is the “Wheel of Fortune”?",
  wheel_p1: "It’s a quick way to get PLAMc randomly. After spinning, the won PLAMc are added to your balance.",
  wheel_p2: "One spin is available once per day.",

  tasks_title: "What are “Tasks”?",
  tasks_p1: "Tasks are actions that can earn PLAMc or bonuses: for example, subscribing, opening a partner app, or completing certain conditions.",

  problem_title: "What should I do if I run into a problem?",
  problem_p1_before: "If the app has errors — contact support: "
}

});

// RU dictionary (чтобы переключение RU↔ENG работало без перезагрузки)
i18n.load('ru', {
  "title.app": "Plam — WebApp",
  "common.close": "Закрыть",
  "common.ok": "Ок",
  "common.cancel": "Отмена",
  "common.accept": "Принять",
  "common.yes": "Да",
  "common.no": "Нет",
  "common.thanks": "Спасибо",

  "units.sec_short": "сек",
  "units.min_short": "мин.",
  "units.hour_short": "ч.",
  "units.day_short": "д.",

  "upload.pick": "Выбрать фото",
  "upload.rules_title": "Правила",
  "upload.no_photo": "Фото не выбрано",
  "upload.remove_photo": "Убрать фото",
  "upload.increase_time": "Увеличить эфирное время",
  "upload.broadcast_btn": "В эфир на {{total}} {{unit}}",
  "upload.reset_timer": "Сбросить таймер",
  "upload.attach_photo": "Прикрепите фото",
  "upload.in_queue": "Ваше фото в очереди",
  "upload.link_invalid": "Ссылка должна начинаться с http:// или https:// (поддерживается и https://t.me/...)",
  "upload.reset_ok": "Удачно! Скорее отправляй еще фото",
  "upload.promo": "Побеждай. Рекламируй. Приглашай.",
   "reset.button": "Сбросить {{mins}} минут за {{coins}} PLAMc",
  "reset.or": "или",
  "reset.share": "Поделиться",
  "reset.shared_ok": "Спасибо! Таймер сброшен.",
  "share.text": "Заходи в PLAM — отправляй фото и выигрывай!",
  "reset.shared_used": "Уже использовано",
  "reset.share_wait": "Ожидаем отправку…",
  "reset.share_fail": "Не увидели отправку. Попробуйте ещё раз",


  "rules.title": "Правила отправки фото",
  "rules.forbidden": "<strong>Запрещено:</strong> обнажёнка/эротика; алкоголь/табак/наркотики; насилие и опасные действия; дискриминация/экстремизм; реклама, QR-коды, ссылки и контакты; личные/конфиденциальные данные; чужие фото без согласия; попытки обхода модерации.",
  "rules.requirements": "<strong>Требования:</strong> безопасный сюжет, без водяных знаков и крупных надписей, приличное качество.",
  "rules.confirmation": "Отправляя фото, вы подтверждаете, что вам 13+ и у вас есть права на изображение. Мы можем удалять материалы и ограничивать доступ при нарушениях.",
  "rules.agree": "Мне 13+ и я согласен с правилами",

  "shop.exchange": "Обменять",
  "shop.choose_amount": "Выберите количество звезд",

  "prizes.take": "Забрать",
  "prizes.note": "Нажимая кнопку «Забрать» вы подтверждаете, что ознакомлены с правилами и публичной офертой.",
  "prizes.none": "Пока нет призов",

  "subs.title": "Подписка обязательна",
  "subs.subtitle": "Подпишитесь на наши каналы, чтобы отправлять фото.",
  "subs.youtube": "Youtube канал",
  "subs.telegram": "Telegram канал",
  "subs.check": "Проверить подписки",
  "subs.note": "После успешной проверки можно закрыть окно и отправить фото.",

  "profile.get_premium": "Получить премиум",
  "profile.photos_count": "Количество фото:",
  "profile.photos_hint": "Количество фото влияет на время их отображения.\n100 фото = +1 секунда",
  "profile.show_time": "Время показа фото:",
  "on": "Вкл",
  "off": "Выкл",

  "premium.active": "Премиум активен",
  "premium.countdown_note": "Обратный отсчёт до окончания подписки",
  "premium.expired": "Премиум истёк",
  "premium.benefits_title": "Преимущества премиум-подписки",
  "premium.basic": "Обычный",
  "premium.premium": "Премиум",
  "premium.rule_cooldown": "Таймер отправки фото",
  "premium.cooldown_basic": "30\u00A0мин",
  "premium.cooldown_premium": "20\u00A0мин",
  "premium.rule_showtime": "Время показа фото в эфире",
  "premium.showtime_basic": "20\u00A0сек",
  "premium.showtime_premium": "40\u00A0сек",
  "premium.rule_gifts": "Приоритетный вывод подарков",
  "premium.gifts_basic": "—",
  "premium.gifts_premium": "✓",
  "premium.rule_top": "Шансы попасть в топ-лист",
  "premium.top_basic": "обычные",
  "premium.top_premium": "высокие",
  "premium.rule_reset_pay": "Сброс таймера за PLAMc",
  "premium.reset_pay_basic": "—",
  "premium.reset_pay_premium": "✓",
  "premium.note": "Больше отправок и дольше показ — больше шансов на призы и попадание в таблицу лидеров.",
  "confirm.premium_title_static": "Получить премиум на 7 дней за 350 PLAMc?",
  

  "leaders.weekly_gifts": "Еженедельные подарки",
  "leaders.title": "Таблица лидеров",
  "leaders.podium_aria": "Пьедестал",
  "leaders.rank1": "1 место",
  "leaders.rank2": "2 место",
  "leaders.rank3": "3 место",
  "leaders.photos_count": "0 фото",
  "leaders.photos": "фото",

  "aria.open_actions": "Открыть меню действий",
  "aria.leaders": "Лидеры",
  "aria.open_upload": "Открыть попап загрузки",
  "aria.open_stars": "Открыть попап звёзд",
  "aria.open_faq": "Открыть FAQ",
  "aria.open_prizes": "Открыть попап призов",
  "aria.open_profile": "Открыть профиль",
 

  "upload.link_placeholder": "...ссылка на соц.сеть или сайт",
  "upload.desc_placeholder": "...описание",

  "promo.placeholder": "Промокод",
  "promo.apply": "Активировать",
  "promo.hint": "Промокод можно использовать один раз.",
  "promo.title": "Промокод: +{{amount}} PLAMc",
  "promo.invalid": "Промокод использован или недействителен",
  "promo.already": "Этот промокод вы уже активировали",

   "fortune.title": "Колесо фортуны",
  "fortune.spin": "Вращать",
  "fortune.stop": "Стоп",
  "fortune.win": "Вы выиграли: {{prize}}",
  "fortune.lose": "В этот раз ничего",
  "fortune.try_again": "Попробовать снова",
  "fortune.balance": "Баланс: {{amount}} PLAMc",
  "fortune.get_more": "Пополнить PLAMc",
  "fortune.claim": "Забрать приз",
  "fortune.not_enough": "Недостаточно PLAMc",
  "fortune.auto_spin": "Автокрут",
  "fortune.results_title": "Результаты",
  "fortune.close": "Закрыть",
  "fortune.error": "Что-то пошло не так",
  "fortune.rules": "Правила",
  "fortune.return_in": "Возвращайся через: {{time}}",
  "fortune.tasks_tab": "Задания",
  "fortune.tab_game": "Игра",
  "fortune.tasks_empty": "Раздел «Задания» скоро будет доступен",
  "common.back": "Назад",
  faq: {
  title: "FAQ",

  term_plam: "PLAM",
  term_rewards: "призы",
  term_on_air: "Эфир",
  term_winner: "победитель",
  term_plamc: "PLAMc",
  term_stump: "пень",
  term_link: "ссылку",
  term_description: "описание",
  term_slider: "ползунком",
  term_go_live_btn: "«В эфир на … секунд»",
  term_important: "Важно:",
  term_plus_seconds: "+секунды",
  term_maximum: "Максимум:",
  term_no_premium: "Без премиум:",
  term_with_premium: "С премиум:",
  term_plus_one_second: "+1 секунда",
  term_20_40: "20 → 40 секунд",
  term_profile: "Профиль",
  term_get_premium: "«Получить премиум»",
  term_plus: "+",
  support_contact: "техблаблаподдержка.хватитсюдаписать",

  what_is_title: "Что такое PLAM?",
  what_is_p1_mid: " — это социальный проект, в котором ты отправляешь фото в эфир на время и за это получаешь ",
  what_is_li1_after: " — трансляция 24/7.",
  what_is_li2_before: "Каждый час случайным образом выбирается ",
  what_is_li2_after: " и получает вознаграждение.",
  what_is_li3: "Фото, отправленные в эфир, считаются подтверждением участия в розыгрыше и согласием с правилами проекта.",
  what_is_li4_before: "Увеличить количество отправляемых фото можно за ",

  how_send_title: "Как отправить фото в эфир?",
  how_send_1_before: "Нажми на ",
  how_send_1_after: " (загрузка фото).",
  how_send_2_before: "Выбери фото → добавь (по желанию) ",
  how_send_2_mid: " и ",
  how_send_3_before: "Выставь дополнительное время ",
  how_send_3_after: " (если нужно).",
  how_send_4_before: "Нажми ",
  how_send_4_after: " — фото попадает на модерацию и после успешной проверки встаёт в очередь на показ.",

  queue_title: "Для чего нужна очередь и модерация?",
  queue_p1: "Каждое фото после отправки проверяется на соответствие правилам и ограничениям по контенту.",
  queue_p2: "Количество фото в очереди влияет на то, сколько фото может отображаться в эфире одновременно. Если на момент выбора победителя в эфире показывается несколько фото, приз будет разыгран случайным образом между ними.",

  why_link_title: "Зачем ссылка и описание?",
  why_link_p1: "Если фото победит в ежечасном розыгрыше и к нему прикреплены ссылка и описание — мы опубликуем победителя в нашем Telegram-канале. Тем самым победитель получит еще и рекламу в добавок к выигрышу.",
  why_link_p2_after: " ссылка не должна вести на запрещённый контент/товары или на компании, занимающиеся пропагандой.",

  plamc_title: "PLAMc и время показа",
  plamc_what_title: "Что такое PLAMc?",
  plamc_what_p1_after: " — внутренняя валюта PLAM. Её можно тратить на увеличение времени показа фото и на отдельные функции.",

  slider_title: "Как работает ползунок времени?",
  slider_p1_before: "Ползунок добавляет ",
  slider_p1_after: " к базовому времени показа. Чем больше PLAMc поставишь — тем дольше фото будет в эфире.",
  slider_p2_after: " +20 секунд.",

  default_title: "Сколько по умолчанию показывается одно фото?",
  default_li1_after: " базовое время = 20 секунд",
  default_li2_after: " базовое время = 40 секунд",
  default_p1_before: "За каждые 100 отправленных фото будет прибавляться ",
  default_p1_after: " к базовому значению.",

  cooldown_title: "Зачем нужен таймер/кулдаун?",
  cooldown_p1: "Чтобы эфир не спамили бесконечно и у всех был равный шанс. Если активен кулдаун — отправка ограничена до его окончания.",

  premium_title: "Премиум и баланс",
  premium_what_title: "Что даёт премиум?",
  premium_what_p1_before: "Премиум увеличивает базовый показ фото: ",
  premium_what_p1_after: " (без доплат). Также в профиле видно статус и таймер до окончания.",

  premium_where_title: "Где включить премиум?",
  premium_where_p1_before: "Открой ",
  premium_where_p1_mid: " (значок блокнота) → кнопка ",

  premium_q_title: "Почему рядом есть знак “?” у премиума?",
  premium_q_p1: "Там коротко объяснено: что даёт премиум, как он работает и почему это выгодно.",

  balance_where_title: "Где смотреть баланс PLAMc?",
  balance_where_p1_before: "Баланс виден в правом верхнем углу — в облаке со знаком ",

  sections_title: "Разделы приложения",
  gift_title: "Для чего “подарок”?",
  gift_p1: "Там хранятся награды/призы/активности, которые ты получил в PLAM.",

  wheel_title: "Что такое “Колесо фортуны”?",
  wheel_p1: "Это быстрый способ получить PLAMc случайным образом. После вращения колеса выигранные PLAMc начисляются на баланс.",
  wheel_p2: "Вращение доступно 1 раз в сутки.",

  tasks_title: "Что такое “Задания”?",
  tasks_p1: "Задания — это действия, за которые можно получить PLAMc или бонусы: например подписка, вход в партнёрское приложение, выполнение условий.",

  problem_title: "Что делать, если столкнулся с проблемой?",
  problem_p1_before: "Если возникли ошибки в работе приложения — напиши в техническую поддержку: "
}

    
});

// RU-словарь не обязателен (русский уже в разметке), но можно добавить для симметрии:
// i18n.load('ru', { "profile.get_premium": "Получить премиум" /* ...и т.д. */ });


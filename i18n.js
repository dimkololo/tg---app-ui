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

  // Позволяет постепенно подливать словари
  function load(lang, dict) {
    if (!lang || !dict) return;
    const code = lang.toLowerCase();
    DICTS[code] = Object.assign({}, DICTS[code] || {}, dict);
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
  "profile.photos_hint": "The number of sent photos increases your live time. 100 photos = +1 second",
  "profile.show_time": "Live time:",

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
  "fortune.tasks_empty": "The \"Tasks\" section will be available soon",
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
  "upload.promo": "Побеждай. Рекламируй. Приглашай",
   "reset.button": "Сбросить {{mins}} минут за {{coins}} PLAMc",
  "reset.or": "или",
  "reset.share": "Поделиться",
  "reset.shared_ok": "Спасибо! Таймер сброшен.",
  "share.text": "Заходи в PLAM — отправляй фото и выигрывай!",

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
  "profile.photos_hint": "Количество фото влияет на время их отображения. 100 фото = +1 секунда",
  "profile.show_time": "Время показа фото:",

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
  "fortune.tasks_empty": "Раздел «Задания» скоро будет доступен",
    
});

// RU-словарь не обязателен (русский уже в разметке), но можно добавить для симметрии:
// i18n.load('ru', { "profile.get_premium": "Получить премиум" /* ...и т.д. */ });


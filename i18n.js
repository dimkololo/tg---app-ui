// i18n.js — минимальный безопасный слой перевода для PLAM
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
    const txt = t(key);
    if (!txt) return; // нет перевода — оставляем исходный контент
    // если в переводе есть теги — считаем это версткой ключа и кладём innerHTML
    if (txt.indexOf('<') !== -1) {
      el.innerHTML = txt;
    } else {
      el.textContent = txt;
    }
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

// --- Minimal EN dictionary so RU|ENG toggle is visible ---
i18n.load('en', {
  // common
  "common.close": "Close",
  "common.ok": "OK",
  "common.cancel": "Cancel",
  "common.accept": "Accept",
  "common.yes": "Yes",
  "common.no": "No",

  // profile popup
  "profile.get_premium": "Get Premium",
  "profile.photos_count": "Number of photos:",
  "profile.photos_hint": "The number of photos increases their show time. 100 photos = +1 second",
  "profile.show_time": "Photo show time:",

  // premium timer/help (чтобы окно тоже переводилось)
  "premium.active": "Premium is active",
  "premium.countdown_note": "Countdown until the subscription ends",

  // shop / prizes / subs (пара ключей для наглядности)
  "shop.exchange": "Exchange",
  "shop.choose_amount": "Choose the number of stars",
  "prizes.take": "Claim",
  "prizes.note": "By clicking “Claim” you confirm that you have read the rules and the public offer.",
  "subs.title": "Subscription required",
  "subs.subtitle": "Subscribe to our channels to send photos.",
  "subs.youtube": "YouTube channel",
  "subs.telegram": "Telegram channel",
  "subs.check": "Check subscriptions",
  "subs.note": "After a successful check you can close the window and send a photo."
});

// RU-словарь не обязателен (русский уже в разметке), но можно добавить для симметрии:
// i18n.load('ru', { "profile.get_premium": "Получить премиум" /* ...и т.д. */ });


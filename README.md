# Plam Telegram WebApp Template

Готовый минимальный шаблон, который подхватывает ассеты из папки `Plam_assets` (манифест и изображения — уже готовы).

## Структура
```
Plam_webapp_template/
  index.html
  styles.css
  app.js
Plam_assets/
  manifest.json
  icons/
  popups/
  screens/
```
> Папка `Plam_assets` лежит рядом с шаблоном. Если переносите в другое место — обновите путь `__ASSETS_MANIFEST_PATH__` в `index.html`.

## Запуск локально
1. Положите папки `Plam_webapp_template/` и `Plam_assets/` рядом.
2. Статически поднимите сервер (пример на Python):
   ```bash
   python3 -m http.server 8080
   ```
3. Откройте в браузере: <http://localhost:8080/Plam_webapp_template/>

> В Telegram клиенте WebApp подключается автоматически, но в браузере вне Telegram код просто не будет падать — предусмотрена проверка `window.Telegram?.WebApp`.

## Адаптивные ассеты
- **Иконки**: используются `@1x-32` и `@2x-64` через `srcset`.
- **Попапы/элементы**: `@1x-800` и `@2x-1600`.
- **Скриншоты**: уменьшенные превью 1200px.

## Где править
- Цвета/интерфейс — `styles.css`.
- Логика, работа с манифестом, подключение картинок — `app.js`.
- Разметка и подключение SDK — `index.html`.

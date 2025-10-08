import express from 'express';
import fetch from 'node-fetch';
import crypto from 'crypto';

const app = express();
const BOT_TOKEN = 'ТОКЕН_ОТ_BOTFATHER';

app.use(express.static('public'));
app.use(express.json());

function checkTelegramAuth(initData, botToken) {
  const urlParams = new URLSearchParams(initData);
  const hash = urlParams.get('hash');
  urlParams.delete('hash');

  const dataCheckString = [...urlParams.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(botToken)
    .digest();

  const computedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  return computedHash === hash;
}

app.get('/api/avatar', async (req, res) => {
  const userId = req.query.user_id;
  if (!userId) return res.json({ error: 'user_id required' });

  try {
    const photosRes = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/getUserProfilePhotos?user_id=${userId}&limit=1`
    );
    const photosData = await photosRes.json();

    if (!photosData.ok || photosData.result.total_count === 0)
      return res.json({ photoUrl: null });

    const fileId = photosData.result.photos[0][0].file_id;

    const fileRes = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`
    );
    const fileData = await fileRes.json();
    const filePath = fileData.result.file_path;

    const photoUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`;
    res.json({ photoUrl });
  } catch (err) {
    console.error(err);
    res.json({ photoUrl: null });
  }
});

const PORT = 3000;
app.listen(PORT, () =>
  console.log(`✅ Сервер запущен: http://localhost:${PORT}`)
);

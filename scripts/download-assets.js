/**
 * 可选：将可商用素材下载到 client/assets。
 * 运行：node scripts/download-assets.js（需在项目根目录或指定 NODE_PATH）
 * 若下载失败，游戏会使用 client/assets 下的 SVG 占位图。
 *
 * 素材来源（示例，可替换为 Pixabay/OpenGameArt 等）：
 * - Unsplash (https://unsplash.com) - Unsplash License，可免费商用
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

const ASSETS_DIR = path.join(__dirname, '..', 'client', 'assets');
const URLS = {
  'bg-classroom.jpg': 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=800',
  'bg-corridor.jpg': 'https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=800',
  'bg-bedroom.jpg': 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=800',
  'bg-internet_cafe.jpg': 'https://images.unsplash.com/photo-1493711662062-fa541f4e4e60?w=800'
};

function download(url, filepath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filepath);
    https.get(url, { headers: { 'User-Agent': 'AtarGame/1.0' } }, (res) => {
      if (res.statusCode === 302 && res.headers.location) {
        file.close();
        fs.unlink(filepath, () => {});
        return download(res.headers.location, filepath).then(resolve).catch(reject);
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', (err) => { fs.unlink(filepath, () => {}); reject(err); });
  });
}

if (!fs.existsSync(ASSETS_DIR)) fs.mkdirSync(ASSETS_DIR, { recursive: true });
Promise.all(Object.entries(URLS).map(([name, url]) => {
  const filepath = path.join(ASSETS_DIR, name);
  return download(url, filepath).then(() => console.log('OK', name)).catch((e) => console.warn('Skip', name, e.message));
})).then(() => console.log('Done. 若部分失败，游戏会使用 SVG 占位。'));

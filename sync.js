/**
 * LAJAOS - LOCAL AUTO-SYNC CLIENT
 * Tự động đồng bộ toàn bộ dữ liệu & file đính kèm từ Cloud (Render / MongoDB) về máy tính cục bộ
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const url = require('url');

const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const BACKUP_FILE = path.join(DATA_DIR, 'db.backup.json');
const UPLOADS_DIR = path.join(ROOT_DIR, 'uploads', 'tasks');

// Ensure local directories exist
[DATA_DIR, UPLOADS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Load .env if exists
function loadEnv() {
  const envPath = path.join(ROOT_DIR, '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
    lines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const idx = trimmed.indexOf('=');
        if (idx > 0) {
          const key = trimmed.slice(0, idx).trim();
          const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
          if (!process.env[key]) process.env[key] = val;
        }
      }
    });
  }
}

loadEnv();

const MONGODB_URI = process.env.MONGODB_URI || '';
const REMOTE_URL = process.env.REMOTE_URL || process.argv[2] || '';
const SYNC_SECRET = process.env.SYNC_SECRET || '';
const ACCESS_PIN = process.env.ACCESS_PIN || '';

console.log('==============================================================');
console.log('🔄 LAJAOS - TIẾN TRÌNH ĐỒNG BỘ DỮ LIỆU VỀ MÁY CỤC BỘ');
console.log('==============================================================');

// Helper to make HTTP/HTTPS GET request
function fetchJson(targetUrl, headers = {}) {
  return new Promise((resolve, reject) => {
    const parsed = url.parse(targetUrl);
    const client = parsed.protocol === 'https:' ? https : http;

    const req = client.get(targetUrl, { headers }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json });
        } catch (err) {
          reject(new Error(`Phản hồi không phải JSON: ${data.slice(0, 100)}`));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(15000, () => {
      req.abort();
      reject(new Error('Hết thời gian chờ kết nối (Timeout 15s)'));
    });
  });
}

// 1. Đồng bộ qua Render Web URL
async function syncViaRender(remoteUrl) {
  let cleanUrl = remoteUrl.replace(/\/$/, '');
  if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
    cleanUrl = 'https://' + cleanUrl;
  }

  console.log(`🌐 Đang kết nối tới máy chủ Render: ${cleanUrl}...`);

  const pullEndpoint = `${cleanUrl}/api/sync/pull`;
  const headers = {};
  if (SYNC_SECRET) headers['x-sync-secret'] = SYNC_SECRET;
  if (ACCESS_PIN) headers['x-access-pin'] = ACCESS_PIN;

  const res = await fetchJson(pullEndpoint, headers);
  if (res.status !== 200 || !res.data.success) {
    throw new Error(`Máy chủ báo lỗi (${res.status}): ${res.data.error || 'Không thể lấy dữ liệu'}`);
  }

  const { state, attachments } = res.data;

  // Ghi đè vào db.json và tạo backup
  if (state) {
    const jsonStr = JSON.stringify(state, null, 2);
    fs.writeFileSync(DB_FILE, jsonStr, 'utf-8');
    fs.writeFileSync(BACKUP_FILE, jsonStr, 'utf-8');
    console.log(`✅ Đã cập nhật cơ sở dữ liệu local: ${state.tasks?.length || 0} việc, ${state.projects?.length || 0} dự án.`);
  }

  // Tải các file đính kèm về uploads/tasks/
  let fileSavedCount = 0;
  if (attachments && Array.isArray(attachments)) {
    for (const att of attachments) {
      if (att.fileName && att.data) {
        const filePath = path.join(UPLOADS_DIR, att.fileName);
        if (!fs.existsSync(filePath)) {
          const buffer = Buffer.from(att.data, 'base64');
          fs.writeFileSync(filePath, buffer);
          fileSavedCount++;
        }
      }
    }
  }

  if (fileSavedCount > 0) {
    console.log(`📁 Đã tải ${fileSavedCount} file đính kèm mới về thư mục uploads/tasks/!`);
  } else {
    console.log(`📁 Toàn bộ file đính kèm trên máy local đã ở trạng thái mới nhất.`);
  }

  console.log('\n🎉 ĐỒNG BỘ THÀNH CÔNG VỀ MÁY TÍNH NÀY!');
}

// 2. Đồng bộ trực tiếp qua MongoDB Atlas
async function syncViaMongo(uri) {
  console.log('🍃 Đang kết nối trực tiếp tới MongoDB Atlas...');
  let MongoClient;
  try {
    MongoClient = require('mongodb').MongoClient;
  } catch (e) {
    throw new Error('Chưa cài đặt thư viện mongodb. Hãy chạy `npm install` hoặc dùng đồng bộ qua link Render.');
  }

  const client = new MongoClient(uri, { connectTimeoutMS: 10000 });
  await client.connect();
  const db = client.db();

  const mainDoc = await db.collection('app_state').findOne({ _id: 'lajaos_main_state' });
  if (!mainDoc || !mainDoc.data) {
    console.log('⚠️ Không tìm thấy dữ liệu trên MongoDB Atlas.');
    await client.close();
    return;
  }

  const state = mainDoc.data;
  const jsonStr = JSON.stringify(state, null, 2);
  fs.writeFileSync(DB_FILE, jsonStr, 'utf-8');
  fs.writeFileSync(BACKUP_FILE, jsonStr, 'utf-8');
  console.log(`✅ Đã cập nhật db.json: ${state.tasks?.length || 0} nhiệm vụ, ${state.projects?.length || 0} dự án.`);

  // Đồng bộ file
  let fileSavedCount = 0;
  try {
    const files = await db.collection('attachments').find({}).toArray();
    for (const file of files) {
      if (file.fileName && file.data) {
        const filePath = path.join(UPLOADS_DIR, file.fileName);
        if (!fs.existsSync(filePath)) {
          const buffer = Buffer.from(file.data, 'base64');
          fs.writeFileSync(filePath, buffer);
          fileSavedCount++;
        }
      }
    }
  } catch (e) {
    console.warn('Lỗi khi tải file từ attachments:', e.message);
  }

  await client.close();
  console.log(`📁 Đã cập nhật file đính kèm (${fileSavedCount} file mới tải về).`);
  console.log('\n🎉 ĐỒNG BỘ MONGODB ATLAS THÀNH CÔNG!');
}

// Chạy tiến trình đồng bộ
async function run() {
  try {
    if (REMOTE_URL) {
      await syncViaRender(REMOTE_URL);
    } else if (MONGODB_URI) {
      try {
        await syncViaMongo(MONGODB_URI);
      } catch (err) {
        console.warn(`Lỗi sync MongoDB (${err.message}). Thử tìm REMOTE_URL...`);
      }
    } else {
      console.log('ℹ️ HƯỚNG DẪN CẤU HÌNH ĐỒNG BỘ:');
      console.log('Cách 1: Điền link web Render vào file .env (REMOTE_URL=https://lajaos-xxx.onrender.com)');
      console.log('Cách 2: Chạy lệnh kèm link: node sync.js https://lajaos-xxx.onrender.com');
      console.log('Cách 3: Điền MONGODB_URI=mongodb+srv://... vào file .env');
    }
  } catch (err) {
    console.error('❌ Lỗi đồng bộ:', err.message);
  }
  console.log('==============================================================\n');
}

run();

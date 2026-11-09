const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const ROOT_DIR = __dirname;
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const BACKUP_FILE = path.join(DATA_DIR, 'db.backup.json');
const UPLOADS_DIR = path.join(ROOT_DIR, 'uploads', 'tasks');
const LOGO_DIR = path.join(PUBLIC_DIR, 'custom-logo');

// Environment configurations for Cloud / Render
const MONGODB_URI = process.env.MONGODB_URI || '';
const ACCESS_PIN = process.env.ACCESS_PIN || '';
const SYNC_SECRET = process.env.SYNC_SECRET || '';

// Ensure directories exist
[DATA_DIR, UPLOADS_DIR, LOGO_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// MIME Types
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8',
  '.ico': 'image/x-icon',
  '.zip': 'application/zip'
};

// Database in-memory cache and atomic write
let dbCache = null;
let mongoClient = null;
let mongoDb = null;
let mongoCollection = null;
let mongoAttachments = null;

// Initialize MongoDB Atlas connection if MONGODB_URI is provided
async function initMongo() {
  if (!MONGODB_URI) return false;
  try {
    const { MongoClient } = require('mongodb');
    mongoClient = new MongoClient(MONGODB_URI, {
      connectTimeoutMS: 8000,
      serverSelectionTimeoutMS: 8000
    });
    await mongoClient.connect();
    mongoDb = mongoClient.db();
    mongoCollection = mongoDb.collection('app_state');
    mongoAttachments = mongoDb.collection('attachments');
    console.log('✅ Đã kết nối thành công với MongoDB Atlas (LajaOS Cloud)!');
    return true;
  } catch (err) {
    console.warn('⚠️ Không thể kết nối MongoDB Atlas (sử dụng chế độ Local db.json):', err.message);
    mongoClient = null;
    mongoDb = null;
    mongoCollection = null;
    mongoAttachments = null;
    return false;
  }
}

function loadLocalDatabase() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      dbCache = JSON.parse(content);
      return dbCache;
    }
  } catch (err) {
    console.error('Error loading db.json, attempting backup...', err.message);
    if (fs.existsSync(BACKUP_FILE)) {
      try {
        const backupContent = fs.readFileSync(BACKUP_FILE, 'utf-8');
        dbCache = JSON.parse(backupContent);
        return dbCache;
      } catch (e) {
        console.error('Backup corrupted:', e.message);
      }
    }
  }

  dbCache = {
    settings: { theme: 'dark', currency: 'VND', userName: 'Cá Nhân' },
    projects: [],
    tasks: [],
    finance: { budgets: {}, funds: [], tags: [], transactions: [], dailyRecaps: {} }
  };
  saveLocalDatabase();
  return dbCache;
}

function saveLocalDatabase() {
  try {
    const jsonStr = JSON.stringify(dbCache, null, 2);
    const tmpFile = DB_FILE + '.tmp';
    fs.writeFileSync(tmpFile, jsonStr, 'utf-8');
    fs.renameSync(tmpFile, DB_FILE);
    fs.writeFileSync(BACKUP_FILE, jsonStr, 'utf-8');
    return true;
  } catch (err) {
    return false;
  }
}

function loadDatabase() {
  if (!dbCache) loadLocalDatabase();
  return dbCache;
}

function saveDatabase() {
  saveLocalDatabase();
  if (mongoCollection) {
    mongoCollection.updateOne(
      { _id: 'lajaos_main_state' },
      { $set: { data: dbCache, updatedAt: new Date().toISOString() } },
      { upsert: true }
    ).catch(err => console.error('MongoDB async save error:', err.message));
  }
  return true;
}

// Initial state boot & seed
async function loadInitialDatabase() {
  loadLocalDatabase();

  if (MONGODB_URI) {
    const connected = await initMongo();
    if (connected && mongoCollection) {
      try {
        const doc = await mongoCollection.findOne({ _id: 'lajaos_main_state' });
        if (doc && doc.data) {
          dbCache = doc.data;
          console.log(`📦 Đã nạp dữ liệu từ MongoDB Atlas: ${dbCache.tasks?.length || 0} nhiệm vụ, ${dbCache.projects?.length || 0} dự án.`);
          saveLocalDatabase();
        } else {
          console.log('🌱 Khởi tạo dữ liệu ban đầu từ db.json lên MongoDB Atlas...');
          await mongoCollection.updateOne(
            { _id: 'lajaos_main_state' },
            { $set: { data: dbCache, updatedAt: new Date().toISOString() } },
            { upsert: true }
          );
          console.log('✅ Khởi tạo seed MongoDB Atlas thành công!');
        }
      } catch (err) {
        console.error('Lỗi khi nạp dữ liệu từ MongoDB Atlas:', err.message);
      }
    }
  }
  return dbCache;
}

// Check if request originates from localhost / local loopback
function isLocalRequest(req) {
  const ip = req.socket.remoteAddress || '';
  const host = req.headers.host || '';
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1' ||
         host.startsWith('localhost') || host.startsWith('127.0.0.1');
}

// Check authorization (PIN / Secret)
function isAuthorized(req) {
  if (!ACCESS_PIN) return true;
  if (isLocalRequest(req)) return true;
  const pinHeader = req.headers['x-access-pin'] || '';
  const pinQuery = url.parse(req.url, true).query.pin || '';
  return pinHeader === ACCESS_PIN || pinQuery === ACCESS_PIN;
}

// Logo helper: checks for custom logo in public/custom-logo/
function getCustomLogoInfo() {
  const allowedExts = ['.svg', '.png', '.jpg', '.jpeg', '.webp'];
  try {
    const files = fs.readdirSync(LOGO_DIR);

    // Prefer SVG if present (logo.svg or default-logo.svg)
    let target = files.find(f => f.toLowerCase() === 'logo.svg' || f.toLowerCase() === 'default-logo.svg');

    if (!target) {
      // Find logo.* with allowed extensions
      target = files.find(f => {
        const ext = path.extname(f).toLowerCase();
        const base = path.basename(f, ext).toLowerCase();
        return base === 'logo' && allowedExts.includes(ext);
      });
    }

    if (!target) {
      target = files.find(f => {
        const ext = path.extname(f).toLowerCase();
        return f !== 'README.txt' && allowedExts.includes(ext);
      });
    }

    if (target) {
      return {
        hasCustom: true,
        fileName: target,
        url: `/custom-logo/${encodeURIComponent(target)}?t=${Date.now()}`
      };
    }
  } catch (e) {
    console.error('Error scanning logo dir:', e.message);
  }

  return {
    hasCustom: false,
    fileName: 'default-logo.svg',
    url: '/custom-logo/default-logo.svg'
  };
}

// Helper to read JSON request body
function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const parsed = body ? JSON.parse(body) : {};
        resolve(parsed);
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

// Helper to read Raw buffer body
function parseRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// Send JSON response
function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-cache'
  });
  res.end(JSON.stringify(data));
}

// Serve static file
function serveStatic(req, res, filePath) {
  // Prevent directory traversal
  const safePath = path.normalize(filePath);
  if (!safePath.startsWith(PUBLIC_DIR) && !safePath.startsWith(path.join(ROOT_DIR, 'uploads'))) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  fs.stat(safePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(safePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stats.size,
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600'
    });

    const stream = fs.createReadStream(safePath);
    stream.pipe(res);
  });
}

// Main HTTP request handler
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  // Handle CORS Preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-access-pin, x-sync-secret'
    });
    res.end();
    return;
  }

  // --- API ROUTES ---
  if (pathname.startsWith('/api/')) {
    try {
      // Health check for Render / Monitoring
      if (pathname === '/api/health') {
        return sendJson(res, 200, { status: 'ok', name: 'LajaOS', time: new Date().toISOString() });
      }

      // Verify PIN endpoint (open to all)
      if (pathname === '/api/auth/verify-pin' && method === 'POST') {
        const body = await parseJsonBody(req);
        if (!ACCESS_PIN || body.pin === ACCESS_PIN) {
          return sendJson(res, 200, { success: true });
        }
        return sendJson(res, 401, { error: 'Mã PIN không chính xác' });
      }

      // Check PIN Authorization for remote access
      if (!isAuthorized(req)) {
        return sendJson(res, 401, { error: 'PIN_REQUIRED', message: 'Yêu cầu mã PIN để truy cập LajaOS' });
      }

      const db = loadDatabase();

      // Sync Endpoints
      if (pathname === '/api/sync/status' && method === 'GET') {
        return sendJson(res, 200, {
          success: true,
          mode: mongoDb ? 'cloud' : 'local',
          hasMongo: !!mongoDb,
          hasPin: !!ACCESS_PIN,
          tasksCount: (dbCache.tasks || []).length,
          projectsCount: (dbCache.projects || []).length,
          updatedAt: new Date().toISOString()
        });
      }

      if (pathname === '/api/sync/pull' && method === 'GET') {
        const authHeader = req.headers['x-sync-secret'] || req.headers['x-access-pin'] || '';
        if ((SYNC_SECRET && authHeader !== SYNC_SECRET) && (ACCESS_PIN && authHeader !== ACCESS_PIN) && !isLocalRequest(req)) {
          return sendJson(res, 401, { error: 'Unauthorized sync' });
        }

        let attachmentsList = [];
        if (mongoAttachments) {
          try {
            attachmentsList = await mongoAttachments.find({}).project({ data: 1, fileName: 1, originalName: 1, mimeType: 1, size: 1 }).toArray();
          } catch (e) {
            console.error('Error fetching attachments for sync:', e.message);
          }
        }

        return sendJson(res, 200, {
          success: true,
          state: dbCache,
          updatedAt: new Date().toISOString(),
          attachments: attachmentsList
        });
      }

      if (pathname === '/api/sync/push' && method === 'POST') {
        const authHeader = req.headers['x-sync-secret'] || req.headers['x-access-pin'] || '';
        if ((SYNC_SECRET && authHeader !== SYNC_SECRET) && (ACCESS_PIN && authHeader !== ACCESS_PIN) && !isLocalRequest(req)) {
          return sendJson(res, 401, { error: 'Unauthorized sync' });
        }
        const body = await parseJsonBody(req);
        if (body.state) {
          dbCache = body.state;
          saveDatabase();
          return sendJson(res, 200, { success: true, message: 'Đã đẩy dữ liệu thành công' });
        }
        return sendJson(res, 400, { error: 'Thiếu dữ liệu state' });
      }

      // 1. Full data fetch
      if (pathname === '/api/data' && method === 'GET') {
        const logo = getCustomLogoInfo();
        return sendJson(res, 200, { ...db, logo });
      }

      // 2. Logo info
      if (pathname === '/api/logo' && method === 'GET') {
        return sendJson(res, 200, getCustomLogoInfo());
      }

      // 3. Upload Logo (base64 JSON payload)
      if (pathname === '/api/upload-logo' && method === 'POST') {
        const payload = await parseJsonBody(req);
        if (!payload.fileData || !payload.fileName) {
          return sendJson(res, 400, { error: 'Missing fileData or fileName' });
        }

        // Clean previous custom logo files except default-logo.svg and README.txt
        const allowedExts = ['.png', '.jpg', '.jpeg', '.svg', '.webp'];
        const existingFiles = fs.readdirSync(LOGO_DIR);
        existingFiles.forEach(f => {
          if (f !== 'default-logo.svg' && f !== 'README.txt') {
            try { fs.unlinkSync(path.join(LOGO_DIR, f)); } catch (e) {}
          }
        });

        const ext = path.extname(payload.fileName).toLowerCase() || '.png';
        const targetName = 'logo' + ext;
        const targetPath = path.join(LOGO_DIR, targetName);

        // Strip data:image/...;base64, prefix if present
        const base64Data = payload.fileData.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        fs.writeFileSync(targetPath, buffer);

        return sendJson(res, 200, {
          success: true,
          logo: getCustomLogoInfo()
        });
      }

      // 4. Reset Logo to default
      if (pathname === '/api/reset-logo' && method === 'POST') {
        const existingFiles = fs.readdirSync(LOGO_DIR);
        existingFiles.forEach(f => {
          if (f !== 'default-logo.svg' && f !== 'README.txt') {
            try { fs.unlinkSync(path.join(LOGO_DIR, f)); } catch (e) {}
          }
        });
        return sendJson(res, 200, {
          success: true,
          logo: getCustomLogoInfo()
        });
      }

      // 5. Upload Task Attachment
      if (pathname === '/api/upload-task-file' && method === 'POST') {
        const payload = await parseJsonBody(req);
        if (!payload.fileData || !payload.fileName) {
          return sendJson(res, 400, { error: 'Thiếu file' });
        }

        const safeBaseName = path.basename(payload.fileName).replace(/[^a-zA-Z0-9._-]/g, '_');
        const uniqueName = Date.now() + '_' + safeBaseName;
        const targetPath = path.join(UPLOADS_DIR, uniqueName);

        const base64Data = payload.fileData.replace(/^data:[^;]+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        try {
          fs.writeFileSync(targetPath, buffer);
        } catch (e) {
          // If disk is not writable on ephemeral cloud, continue
        }

        // Save to MongoDB attachments collection for cloud persistence
        if (mongoAttachments) {
          mongoAttachments.updateOne(
            { fileName: uniqueName },
            {
              $set: {
                fileName: uniqueName,
                originalName: payload.fileName,
                mimeType: payload.mimeType || 'application/octet-stream',
                size: buffer.length,
                data: base64Data,
                uploadedAt: new Date().toISOString()
              }
            },
            { upsert: true }
          ).catch(err => console.error('MongoDB upload attachment error:', err.message));
        }

        const attachment = {
          id: 'att-' + Date.now(),
          originalName: payload.fileName,
          fileName: uniqueName,
          size: buffer.length,
          mimeType: payload.mimeType || 'application/octet-stream',
          uploadedAt: new Date().toISOString(),
          url: `/uploads/tasks/${encodeURIComponent(uniqueName)}`
        };

        return sendJson(res, 200, { success: true, attachment });
      }

      // 6. Projects CRUD
      if (pathname === '/api/projects') {
        if (method === 'POST') {
          const body = await parseJsonBody(req);
          const newProject = {
            id: 'proj-' + Date.now(),
            title: body.title || 'Dự án mới',
            description: body.description || '',
            color: body.color || '#38bdf8',
            icon: body.icon || 'folder',
            createdAt: new Date().toISOString()
          };
          db.projects.push(newProject);
          saveDatabase();
          return sendJson(res, 201, newProject);
        }
      }

      if (pathname.startsWith('/api/projects/')) {
        const projId = pathname.replace('/api/projects/', '');
        const index = db.projects.findIndex(p => p.id === projId);

        if (method === 'PUT') {
          if (index === -1) return sendJson(res, 404, { error: 'Not found' });
          const body = await parseJsonBody(req);
          db.projects[index] = { ...db.projects[index], ...body, id: projId };
          saveDatabase();
          return sendJson(res, 200, db.projects[index]);
        }

        if (method === 'DELETE') {
          if (index === -1) return sendJson(res, 404, { error: 'Not found' });
          db.projects.splice(index, 1);
          // Unassign or delete tasks of this project
          db.tasks.forEach(t => {
            if (t.projectId === projId) t.projectId = null;
          });
          saveDatabase();
          return sendJson(res, 200, { success: true });
        }
      }

      // 7. Tasks CRUD
      if (pathname === '/api/tasks') {
        if (method === 'POST') {
          const body = await parseJsonBody(req);
          const newTask = {
            id: 'task-' + Date.now(),
            projectId: body.projectId || null,
            title: body.title || 'Nhiệm vụ mới',
            deadline: body.deadline || '',
            priority: body.priority || 'medium',
            status: body.status || 'todo',
            details: body.details || '',
            subtasks: body.subtasks || [],
            links: body.links || [],
            attachments: body.attachments || [],
            createdAt: new Date().toISOString()
          };
          db.tasks.push(newTask);
          saveDatabase();
          return sendJson(res, 201, newTask);
        }
      }

      if (pathname.startsWith('/api/tasks/')) {
        const taskId = pathname.replace('/api/tasks/', '');
        const index = db.tasks.findIndex(t => t.id === taskId);

        if (method === 'PUT') {
          if (index === -1) return sendJson(res, 404, { error: 'Not found' });
          const body = await parseJsonBody(req);
          db.tasks[index] = { ...db.tasks[index], ...body, id: taskId };
          saveDatabase();
          return sendJson(res, 200, db.tasks[index]);
        }

        if (method === 'DELETE') {
          if (index === -1) return sendJson(res, 404, { error: 'Not found' });
          db.tasks.splice(index, 1);
          saveDatabase();
          return sendJson(res, 200, { success: true });
        }
      }

      // 8. Finance: Set Monthly Budget
      if (pathname === '/api/finance/budget' && method === 'POST') {
        const body = await parseJsonBody(req);
        const { month, totalBudget, note, allocationMode } = body; // month: "YYYY-MM"
        if (!month) return sendJson(res, 400, { error: 'Thiếu tháng (YYYY-MM)' });

        if (!db.finance.budgets) db.finance.budgets = {};
        db.finance.budgets[month] = {
          totalBudget: Number(totalBudget) || 0,
          allocationMode: allocationMode || 'percent',
          note: note || ''
        };
        saveDatabase();
        return sendJson(res, 200, { success: true, budget: db.finance.budgets[month] });
      }

      // 9. Finance: Save Funds configuration
      if (pathname === '/api/finance/funds' && method === 'POST') {
        const body = await parseJsonBody(req);
        if (Array.isArray(body.funds)) {
          db.finance.funds = body.funds;
          saveDatabase();
          return sendJson(res, 200, { success: true, funds: db.finance.funds });
        }
        return sendJson(res, 400, { error: 'Dữ liệu funds không hợp lệ' });
      }

      // 10. Finance: Add Transaction
      if (pathname === '/api/finance/transactions') {
        if (method === 'POST') {
          const body = await parseJsonBody(req);
          const newTx = {
            id: 'tx-' + Date.now(),
            date: body.date || new Date().toISOString().slice(0, 10),
            time: body.time || new Date().toTimeString().slice(0, 5),
            amount: Number(body.amount) || 0,
            fundId: body.fundId || (db.finance.funds[0] ? db.finance.funds[0].id : null),
            tag: body.tag || 'Food',
            note: body.note || '',
            createdAt: new Date().toISOString()
          };
          db.finance.transactions.push(newTx);
          saveDatabase();
          return sendJson(res, 201, newTx);
        }
      }

      if (pathname.startsWith('/api/finance/transactions/')) {
        const txId = pathname.replace('/api/finance/transactions/', '');
        const index = db.finance.transactions.findIndex(t => t.id === txId);

        if (method === 'DELETE') {
          if (index === -1) return sendJson(res, 404, { error: 'Not found' });
          db.finance.transactions.splice(index, 1);
          saveDatabase();
          return sendJson(res, 200, { success: true });
        }
      }

      // 11. Finance: Daily Recap
      if (pathname === '/api/finance/daily-recap' && method === 'POST') {
        const body = await parseJsonBody(req);
        const { date, note, reconciled } = body;
        if (!date) return sendJson(res, 400, { error: 'Thiếu ngày' });

        if (!db.finance.dailyRecaps) db.finance.dailyRecaps = {};

        // Calculate today total
        const todayTxs = db.finance.transactions.filter(t => t.date === date);
        const totalSpent = todayTxs.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

        db.finance.dailyRecaps[date] = {
          reconciled: Boolean(reconciled),
          totalSpent,
          note: note || '',
          reconciledAt: new Date().toISOString()
        };

        saveDatabase();
        return sendJson(res, 200, { success: true, recap: db.finance.dailyRecaps[date] });
      }

      // 12. Reset to Sample Demo Data
      if (pathname === '/api/reset-demo' && method === 'POST') {
        // Load default schema with rich demo data
        dbCache = {
          settings: { theme: 'dark', currency: 'VND', userName: 'Cá Nhân', dailyReminderTime: '21:00' },
          projects: [
            {
              id: "proj-1",
              title: "Học Kỳ 2026.1 - Đại Học Bách Khoa",
              description: "Tập trung các môn Toán chuyên ngành, Đồ án lập trình và tiếng Anh B2",
              color: "#38bdf8",
              icon: "graduation-cap",
              createdAt: "2026-10-01T08:00:00Z"
            },
            {
              id: "proj-2",
              title: "Dự Án Nghiên Cứu Web Cá Nhân Hóa",
              description: "Xây dựng dashboard quản lý tài chính và công việc hiệu năng cao offline",
              color: "#818cf8",
              icon: "cpu",
              createdAt: "2026-10-05T09:30:00Z"
            },
            {
              id: "proj-3",
              title: "Kỷ Luật Cá Nhân & Thể Lực",
              description: "Chạy bộ 4 buổi/tuần, đọc sách tài chính và duy trì tổng kết chi tiêu mỗi tối",
              color: "#34d399",
              icon: "activity",
              createdAt: "2026-10-01T07:00:00Z"
            }
          ],
          tasks: [
            {
              id: "task-1",
              projectId: "proj-1",
              title: "Nộp báo cáo giữa kỳ Đồ án Lập trình",
              deadline: "2026-10-25T17:00",
              priority: "urgent",
              status: "todo",
              details: "### Yêu cầu báo cáo giữa kỳ\n- [x] Tổng hợp kiến trúc hệ thống Client-Server\n- [ ] Vẽ sơ đồ luồng dữ liệu (Dataflow Diagram)\n- [ ] Viết phần mô tả chi tiết chức năng REST API\n- [ ] Đính kèm slide thuyết trình định dạng PDF\n\n> Cần nộp qua cổng quản lý sinh viên trước 17h00 hôm nay!",
              subtasks: [
                { id: "sub-1", text: "Tổng hợp kiến trúc Client-Server", done: true },
                { id: "sub-2", text: "Vẽ sơ đồ luồng dữ liệu", done: false },
                { id: "sub-3", text: "Hoàn thiện mô tả REST API", done: false },
                { id: "sub-4", text: "Xuất file PDF nộp lên portal", done: false }
              ],
              links: [
                { id: "link-1", title: "Cổng thông tin đào tạo QLDST", url: "https://qldt.hust.edu.vn" }
              ],
              attachments: [],
              createdAt: "2026-10-20T14:00:00Z"
            },
            {
              id: "task-2",
              projectId: "proj-2",
              title: "Hoàn thiện module Biểu đồ phân bổ chi tiêu SVG",
              deadline: "2026-10-26T20:00",
              priority: "high",
              status: "in_progress",
              details: "Tối ưu hóa biểu đồ tròn (Donut chart) hiển thị % tỷ trọng chi tiêu của các tag Food, Study, Invest, v.v.\nThêm hiệu ứng hover mềm mại và tooltip xem số tiền cụ thể.",
              subtasks: [
                { id: "sub-21", text: "Tính toán tọa độ arc SVG theo phần trăm", done: true },
                { id: "sub-22", text: "Gắn tooltip hiển thị VND và %", done: true },
                { id: "sub-23", text: "Thử nghiệm trên màn hình di động", done: false }
              ],
              links: [],
              attachments: [],
              createdAt: "2026-10-22T10:00:00Z"
            },
            {
              id: "task-3",
              projectId: "proj-1",
              title: "Ôn tập 50 câu trắc nghiệm Xác suất Thống kê",
              deadline: "2026-10-28T14:30",
              priority: "medium",
              status: "todo",
              details: "Luyện tập dạng bài phân phối nhị thức, phân phối chuẩn và kiểm định giả thuyết thống kê.",
              subtasks: [],
              links: [],
              attachments: [],
              createdAt: "2026-10-23T08:00:00Z"
            },
            {
              id: "task-4",
              projectId: "proj-3",
              title: "Chạy bộ 5km công viên Thống Nhất",
              deadline: "2026-10-25T18:30",
              priority: "medium",
              status: "todo",
              details: "Duy trì pace 6:30, khởi động kỹ cổ chân và uống đủ 1.5L nước sau khi chạy.",
              subtasks: [],
              links: [],
              attachments: [],
              createdAt: "2026-10-24T19:00:00Z"
            }
          ],
          finance: {
            budgets: {
              "2026-10": { totalBudget: 18000000, note: "Ngân sách tháng 10/2026" }
            },
            funds: [
              { id: "fund-1", name: "Nhu Cầu Thiết Yếu", percent: 45, color: "#38bdf8", icon: "home" },
              { id: "fund-2", name: "Học Tập & Tri Thức", percent: 20, color: "#34d399", icon: "book-open" },
              { id: "fund-3", name: "Đầu Tư & Tích Lũy", percent: 20, color: "#818cf8", icon: "trending-up" },
              { id: "fund-4", name: "Hưởng Thụ & Giải Trí", percent: 15, color: "#fbbf24", icon: "smile" }
            ],
            tags: [
              { id: "Food", name: "Food (Ăn uống)", color: "#fb923c" },
              { id: "Study", name: "Study (Học tập)", color: "#34d399" },
              { id: "Invest", name: "Invest (Đầu tư)", color: "#818cf8" },
              { id: "Entertain", name: "Entertain (Giải trí)", color: "#f472b6" },
              { id: "Transport", name: "Transport (Đi lại)", color: "#22d3ee" },
              { id: "Shopping", name: "Shopping (Mua sắm)", color: "#fbbf24" },
              { id: "Medical", name: "Medical (Sức khỏe)", color: "#f87171" },
              { id: "Bills", name: "Bills (Hóa đơn)", color: "#94a3b8" }
            ],
            transactions: [
              { id: "tx-1", date: "2026-10-01", time: "08:30", amount: 3500000, fundId: "fund-1", tag: "Bills", note: "Tiền phòng trọ và dịch vụ tháng 10" },
              { id: "tx-2", date: "2026-10-03", time: "14:00", amount: 650000, fundId: "fund-2", tag: "Study", note: "Sách kỹ thuật và tài liệu B2" },
              { id: "tx-3", date: "2026-10-05", time: "10:00", amount: 2000000, fundId: "fund-3", tag: "Invest", note: "Tích sản cổ phiếu định kỳ" },
              { id: "tx-4", date: "2026-10-10", time: "19:45", amount: 180000, fundId: "fund-4", tag: "Entertain", note: "Xem phim rạp CGV cuối tuần" },
              { id: "tx-5", date: "2026-10-15", time: "12:15", amount: 45000, fundId: "fund-1", tag: "Food", note: "Cơm trưa cơm gà" },
              { id: "tx-6", date: "2026-10-18", time: "09:00", amount: 90000, fundId: "fund-1", tag: "Transport", note: "Đổ xăng xe máy" },
              { id: "tx-7", date: "2026-10-21", time: "15:30", amount: 420000, fundId: "fund-2", tag: "Study", note: "Khóa học thực hành Web Backend" },
              { id: "tx-8", date: "2026-10-23", time: "19:00", amount: 120000, fundId: "fund-4", tag: "Entertain", note: "Cà phê gặp bạn bè" },
              { id: "tx-9", date: "2026-10-24", time: "08:15", amount: 35000, fundId: "fund-1", tag: "Food", note: "Bánh mì chảo ăn sáng" },
              { id: "tx-10", date: "2026-10-24", time: "12:30", amount: 40000, fundId: "fund-1", tag: "Food", note: "Cơm sườn nướng Bách Khoa" },
              { id: "tx-11", date: "2026-10-24", time: "18:45", amount: 50000, fundId: "fund-1", tag: "Food", note: "Phở bò ăn tối" },
              { id: "tx-12", date: "2026-10-25", time: "08:00", amount: 30000, fundId: "fund-1", tag: "Food", note: "Bún chả sáng" },
              { id: "tx-13", date: "2026-10-25", time: "10:30", amount: 35000, fundId: "fund-4", tag: "Entertain", note: "Cà phê muối học bài" }
            ],
            dailyRecaps: {
              "2026-10-24": { reconciled: true, totalSpent: 125000, note: "Chi tiêu 3 bữa chuẩn ngân sách", reconciledAt: "2026-10-24T21:45:00Z" }
            }
          }
        };
        saveDatabase();
        return sendJson(res, 200, { success: true, message: 'Đã nạp lại dữ liệu mẫu thành công!' });
      }

      // 13. Clear all user data
      if (pathname === '/api/clear-all' && method === 'POST') {
        dbCache = {
          settings: { theme: 'dark', currency: 'VND', userName: 'Cá Nhân', dailyReminderTime: '21:00' },
          projects: [],
          tasks: [],
          finance: {
            budgets: {},
            funds: [
              { id: "fund-1", name: "Thiết Yếu", percent: 50, color: "#38bdf8", icon: "home" },
              { id: "fund-2", name: "Học Tập", percent: 20, color: "#34d399", icon: "book-open" },
              { id: "fund-3", name: "Đầu Tư", percent: 15, color: "#818cf8", icon: "trending-up" },
              { id: "fund-4", name: "Giải Trí", percent: 15, color: "#fbbf24", icon: "smile" }
            ],
            tags: [
              { id: "Food", name: "Food (Ăn uống)", color: "#fb923c" },
              { id: "Study", name: "Study (Học tập)", color: "#34d399" },
              { id: "Invest", name: "Invest (Đầu tư)", color: "#818cf8" },
              { id: "Entertain", name: "Entertain (Giải trí)", color: "#f472b6" },
              { id: "Transport", name: "Transport (Đi lại)", color: "#22d3ee" },
              { id: "Shopping", name: "Shopping (Mua sắm)", color: "#fbbf24" },
              { id: "Medical", name: "Medical (Sức khỏe)", color: "#f87171" },
              { id: "Bills", name: "Bills (Hóa đơn)", color: "#94a3b8" }
            ],
            transactions: [],
            dailyRecaps: {}
          }
        };
        saveDatabase();
        return sendJson(res, 200, { success: true, message: 'Đã xóa toàn bộ dữ liệu sạch sẽ!' });
      }

      return sendJson(res, 404, { error: 'API endpoint not found' });
    } catch (err) {
      console.error('API Error:', err);
      return sendJson(res, 500, { error: err.message });
    }
  }

  // --- STATIC FILE SERVING ---
  if (pathname.startsWith('/uploads/tasks/')) {
    const fileName = decodeURIComponent(pathname.replace('/uploads/tasks/', ''));
    const filePath = path.join(UPLOADS_DIR, fileName);

    // If file exists on local disk, serve it directly
    if (fs.existsSync(filePath)) {
      return serveStatic(req, res, filePath);
    }

    // If file is not on local disk (e.g. Render restarted), fetch from MongoDB attachments
    if (mongoAttachments) {
      try {
        const fileDoc = await mongoAttachments.findOne({ fileName });
        if (fileDoc && fileDoc.data) {
          const buf = Buffer.from(fileDoc.data, 'base64');
          res.writeHead(200, {
            'Content-Type': fileDoc.mimeType || 'application/octet-stream',
            'Content-Length': buf.length,
            'Cache-Control': 'public, max-age=86400'
          });
          return res.end(buf);
        }
      } catch (err) {
        console.error('Lỗi khi lấy file từ MongoDB:', err.message);
      }
    }

    return serveStatic(req, res, filePath);
  }

  let staticPath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
  serveStatic(req, res, staticPath);
});

// Start Server with fallback port
let currentPort = Number(PORT);
server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    currentPort++;
    console.log(`Port in use, trying ${currentPort}...`);
    server.listen(currentPort, HOST);
  } else {
    console.error('Server error:', e);
  }
});

// Boot database (Local or Cloud) and listen
loadInitialDatabase().then(() => {
  server.listen(PORT, HOST, () => {
    const actualPort = server.address().port;
    console.log(`\n======================================================`);
    console.log(`🚀 LAJAOS ĐANG HOẠT ĐỘNG TẠI:`);
    console.log(`👉 http://localhost:${actualPort}`);
    if (MONGODB_URI) {
      console.log(`☁️ Chế độ Cloud: Đã kích hoạt MongoDB Atlas`);
    } else {
      console.log(`💻 Chế độ Local: Lưu trữ cục bộ tại data/db.json`);
    }
    if (ACCESS_PIN) {
      console.log(`🔒 Bảo mật: Đã bật mã PIN truy cập từ xa`);
    }
    console.log(`======================================================\n`);
  });
}).catch(err => {
  console.error('Lỗi khi nạp dữ liệu ban đầu:', err);
  server.listen(PORT, HOST);
});

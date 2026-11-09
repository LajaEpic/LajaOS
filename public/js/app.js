/**
 * LAJAOS - MAIN APPLICATION CONTROLLER
 * Router, State Sync, Logo Management, Auth PIN & Cloud Sync Handlers
 */

// Global fetch interceptor to inject x-access-pin
const originalFetch = window.fetch;
window.fetch = function(url, options = {}) {
  const pin = localStorage.getItem('lajaos_pin');
  if (pin && typeof url === 'string' && url.startsWith('/api')) {
    options = options || {};
    options.headers = options.headers || {};
    if (options.headers instanceof Headers) {
      if (!options.headers.has('x-access-pin')) options.headers.set('x-access-pin', pin);
    } else {
      if (!options.headers['x-access-pin']) options.headers['x-access-pin'] = pin;
    }
  }
  return originalFetch(url, options);
};

window.appState = {
  settings: {},
  projects: [],
  tasks: [],
  finance: {
    budgets: {},
    funds: [],
    tags: [],
    transactions: [],
    dailyRecaps: {}
  },
  logo: {}
};

const App = {
  currentTab: 'planner', // 'planner' or 'finance'

  async init() {
    this.updateClock();
    setInterval(() => this.updateClock(), 60000);

    this.bindGlobalEvents();
    await this.fetchData();

    // Init submodules
    window.PlannerModule.init();
    window.FinanceModule.init();

    this.switchTab('planner');
  },

  updateClock() {
    const now = new Date();
    const clockElem = document.getElementById('header-live-date');
    if (clockElem) {
      const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
      const dayName = days[now.getDay()];
      const d = String(now.getDate()).padStart(2, '0');
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const y = now.getFullYear();
      clockElem.textContent = `${dayName}, ${d}/${m}/${y}`;
    }
  },

  async fetchData() {
    try {
      const res = await fetch('/api/data');
      if (res.status === 401) {
        this.showPinModal();
        return;
      }
      const data = await res.json();
      window.appState = data;
      this.updateLogoDisplay(data.logo);
      this.checkSyncStatus();
    } catch (err) {
      console.error('Failed to load application data:', err);
    }
  },

  showPinModal() {
    const modal = document.getElementById('modal-pin-unlock');
    if (modal) {
      modal.classList.add('active');
      const input = document.getElementById('input-access-pin');
      if (input) {
        input.value = '';
        input.focus();
      }
    }
  },

  async submitPin() {
    const input = document.getElementById('input-access-pin');
    const errElem = document.getElementById('pin-error-msg');
    const pin = input ? input.value.trim() : '';
    if (!pin) return;

    try {
      const res = await fetch('/api/auth/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin })
      });
      const data = await res.json();
      if (res.status === 200 && data.success) {
        localStorage.setItem('lajaos_pin', pin);
        if (errElem) errElem.style.display = 'none';
        document.getElementById('modal-pin-unlock')?.classList.remove('active');
        await this.fetchData();
        window.PlannerModule.render();
        window.FinanceModule.render();
      } else {
        if (errElem) errElem.style.display = 'block';
      }
    } catch (e) {
      alert('Lỗi kiểm tra PIN: ' + e.message);
    }
  },

  async checkSyncStatus() {
    try {
      const res = await fetch('/api/sync/status');
      if (res.status === 200) {
        const data = await res.json();
        const indicator = document.getElementById('sync-status-indicator');
        const text = document.getElementById('sync-status-text');
        if (indicator && text) {
          if (data.mode === 'cloud') {
            indicator.style.background = '#06b6d4'; // Cyan
            text.textContent = 'Cloud';
            document.getElementById('btn-sync-cloud')?.setAttribute('title', 'Đang kết nối MongoDB Atlas Cloud (Đồng bộ thời gian thực)');
          } else {
            indicator.style.background = '#10b981'; // Green
            text.textContent = 'Local';
            document.getElementById('btn-sync-cloud')?.setAttribute('title', 'Đang chạy chế độ Local (Lưu tại data/db.json)');
          }
        }
      }
    } catch (e) {}
  },

  async triggerManualSync() {
    const btn = document.getElementById('btn-sync-cloud');
    const icon = document.getElementById('sync-icon-svg');
    if (icon) icon.style.transform = 'rotate(180deg)';

    try {
      const res = await fetch('/api/sync/status');
      const data = await res.json();
      if (data.mode === 'cloud') {
        await this.fetchData();
        window.PlannerModule.render();
        window.FinanceModule.render();
        alert('✅ Đang kết nối trực tiếp với MongoDB Atlas Cloud. Mọi thay đổi đều được lưu tức thì!');
      } else {
        alert('ℹ️ Đang chạy ở chế độ Cục bộ (Local).\nĐể đồng bộ dữ liệu mới nhất từ Render về máy này, bạn chỉ cần nhấp đúp file: Dong-Bo-Du-Lieu.bat!');
      }
    } catch (e) {
      alert('Không thể kiểm tra trạng thái đồng bộ: ' + e.message);
    } finally {
      if (icon) icon.style.transform = 'none';
    }
  },

  updateLogoDisplay(logoInfo) {
    const logoImg = document.getElementById('app-brand-logo');
    if (logoImg && logoInfo) {
      logoImg.src = logoInfo.url;
    }
    const favicon = document.getElementById('app-favicon') || document.querySelector("link[rel*='icon']");
    if (favicon && logoInfo && !favicon.href.includes('favicon.svg')) {
      favicon.href = logoInfo.url;
    }
  },

  switchTab(tabName) {
    this.currentTab = tabName;

    const plannerBtn = document.getElementById('tab-btn-planner');
    const financeBtn = document.getElementById('tab-btn-finance');
    const plannerSec = document.getElementById('section-planner');
    const financeSec = document.getElementById('section-finance');

    if (tabName === 'planner') {
      plannerBtn?.classList.add('active');
      financeBtn?.classList.remove('active');
      financeBtn?.classList.remove('finance-active');
      plannerSec?.classList.add('active');
      financeSec?.classList.remove('active');
      window.PlannerModule.render();
    } else {
      financeBtn?.classList.add('active');
      financeBtn?.classList.add('finance-active');
      plannerBtn?.classList.remove('active');
      financeSec?.classList.add('active');
      plannerSec?.classList.remove('active');
      window.FinanceModule.render();
    }
  },

  bindGlobalEvents() {
    // Nav tabs
    document.getElementById('tab-btn-planner')?.addEventListener('click', () => this.switchTab('planner'));
    document.getElementById('tab-btn-finance')?.addEventListener('click', () => this.switchTab('finance'));

    // Cloud Sync button
    document.getElementById('btn-sync-cloud')?.addEventListener('click', () => this.triggerManualSync());

    // Modals close buttons
    document.querySelectorAll('.modal-close, .modal-cancel').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
      });
    });

    // Logo settings modal open
    document.getElementById('btn-open-logo-modal')?.addEventListener('click', () => {
      document.getElementById('modal-logo-settings')?.classList.add('active');
    });
    document.getElementById('brand-logo-trigger')?.addEventListener('click', () => {
      document.getElementById('modal-logo-settings')?.classList.add('active');
    });

    // App Settings modal open
    document.getElementById('btn-open-settings-modal')?.addEventListener('click', () => {
      document.getElementById('modal-app-settings')?.classList.add('active');
    });

    // Logo File Upload handler
    const logoInput = document.getElementById('logo-file-input');
    const logoDropzone = document.getElementById('logo-dropzone');
    if (logoDropzone && logoInput) {
      logoDropzone.addEventListener('click', () => logoInput.click());
      logoInput.addEventListener('change', (e) => this.handleLogoUpload(e.target.files[0]));

      logoDropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        logoDropzone.classList.add('dragover');
      });
      logoDropzone.addEventListener('dragleave', () => logoDropzone.classList.remove('dragover'));
      logoDropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        logoDropzone.classList.remove('dragover');
        if (e.dataTransfer.files[0]) this.handleLogoUpload(e.dataTransfer.files[0]);
      });
    }

    // Reset Logo button
    document.getElementById('btn-reset-logo')?.addEventListener('click', async () => {
      if (!confirm('Khôi phục logo mặc định của ứng dụng?')) return;
      try {
        const res = await fetch('/api/reset-logo', { method: 'POST' });
        const result = await res.json();
        if (result.success) {
          this.updateLogoDisplay(result.logo);
          document.getElementById('modal-logo-settings')?.classList.remove('active');
          alert('Đã khôi phục logo mặc định!');
        }
      } catch (e) {
        alert('Lỗi: ' + e.message);
      }
    });

    // Reset Demo Data
    document.getElementById('btn-reset-demo-data')?.addEventListener('click', async () => {
      if (!confirm('Nạp lại bộ dữ liệu mẫu sinh động? (Dữ liệu mẫu chứa các task và chi tiêu thực tế)')) return;
      try {
        await fetch('/api/reset-demo', { method: 'POST' });
        await this.fetchData();
        window.PlannerModule.render();
        window.FinanceModule.render();
        document.getElementById('modal-app-settings')?.classList.remove('active');
        alert('Đã nạp lại dữ liệu mẫu thành công!');
      } catch (e) {
        alert('Lỗi: ' + e.message);
      }
    });

    // Clear All Data
    document.getElementById('btn-clear-all-data')?.addEventListener('click', async () => {
      if (!confirm('CẢNH BÁO: Bạn có chắc chắn muốn xóa TOÀN BỘ dữ liệu để bắt đầu trang trắng không?')) return;
      try {
        await fetch('/api/clear-all', { method: 'POST' });
        await this.fetchData();
        window.PlannerModule.render();
        window.FinanceModule.render();
        document.getElementById('modal-app-settings')?.classList.remove('active');
        alert('Đã xóa dữ liệu, sẵn sàng để bạn nhập mới từ đầu!');
      } catch (e) {
        alert('Lỗi: ' + e.message);
      }
    });

    // Form Submissions
    this.bindFormSubmissions();

    // Keyboard ESC to close modals & drawers
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
        window.PlannerModule.closeDrawer();
      }
    });
  },

  async handleLogoUpload(file) {
    if (!file) return;
    try {
      const base64 = await window.PlannerModule.fileToBase64(file);
      const res = await fetch('/api/upload-logo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          fileData: base64
        })
      });
      const result = await res.json();
      if (result.success && result.logo) {
        this.updateLogoDisplay(result.logo);
        document.getElementById('modal-logo-settings')?.classList.remove('active');
        alert('Đã thay đổi logo góc trái thành công!');
      }
    } catch (e) {
      alert('Lỗi thay logo: ' + e.message);
    }
  },

  bindFormSubmissions() {
    // 1. New Project Form
    document.getElementById('form-new-project')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = document.getElementById('project-title-input')?.value.trim();
      const description = document.getElementById('project-desc-input')?.value.trim();
      const color = document.getElementById('project-color-input')?.value || '#38bdf8';

      if (!title) return;

      try {
        const res = await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, description, color })
        });
        const newProj = await res.json();
        window.appState.projects.push(newProj);
        window.PlannerModule.render();
        document.getElementById('modal-new-project')?.classList.remove('active');
        document.getElementById('form-new-project')?.reset();
      } catch (err) {
        alert('Lỗi tạo dự án: ' + err.message);
      }
    });

    // 2. New Task Form
    document.getElementById('form-new-task')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = document.getElementById('task-title-input')?.value.trim();
      const projectId = document.getElementById('task-project-select')?.value || null;
      const deadline = document.getElementById('task-deadline-input')?.value || '';
      const priority = document.getElementById('task-priority-select')?.value || 'medium';
      const details = document.getElementById('task-details-input')?.value.trim() || '';

      if (!title) return;

      try {
        const res = await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, projectId, deadline, priority, details, subtasks: [], links: [], attachments: [] })
        });
        const newTask = await res.json();
        window.appState.tasks.push(newTask);
        window.PlannerModule.render();
        document.getElementById('modal-new-task')?.classList.remove('active');
        document.getElementById('form-new-task')?.reset();
      } catch (err) {
        alert('Lỗi tạo nhiệm vụ: ' + err.message);
      }
    });

    // 3. New Transaction Form
    document.getElementById('form-new-tx')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const amountStr = document.getElementById('tx-amount-input')?.value.replace(/\D/g, '');
      const amount = Number(amountStr) || 0;
      const date = document.getElementById('tx-date-input')?.value;
      const time = document.getElementById('tx-time-input')?.value;
      const fundId = document.getElementById('tx-fund-select')?.value;
      const tag = document.getElementById('tx-tag-select')?.value;
      const note = document.getElementById('tx-note-input')?.value.trim();

      if (!amount) {
        alert('Vui lòng nhập số tiền chi tiêu!');
        return;
      }

      try {
        const res = await fetch('/api/finance/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount, date, time, fundId, tag, note })
        });
        const newTx = await res.json();
        window.appState.finance.transactions.push(newTx);
        window.FinanceModule.render();
        document.getElementById('modal-new-tx')?.classList.remove('active');
        document.getElementById('form-new-tx')?.reset();
      } catch (err) {
        alert('Lỗi lưu khoản chi: ' + err.message);
      }
    });

    // 4. Budget & Funds Form
    document.getElementById('form-budget-config')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const totalBudget = Number(document.getElementById('budget-total-input')?.value) || 0;
      const monthKey = window.FinanceModule.getMonthKey();
      const allocationMode = window.FinanceModule.budgetMode || 'percent';
      const funds = window.FinanceModule.editingFunds || [];

      if (funds.length === 0) {
        alert('Cần có ít nhất 1 Quỹ chi tiêu!');
        return;
      }

      // Check allocation warning
      if (allocationMode === 'percent') {
        const totalPct = funds.reduce((sum, f) => sum + (Number(f.percent) || 0), 0);
        if (totalPct !== 100) {
          if (!confirm(`Tổng tỷ lệ phần trăm các quỹ hiện là ${totalPct}% (khuyên dùng đúng 100%). Bạn có muốn tiếp tục lưu?`)) {
            return;
          }
        }
      } else {
        const totalAmt = funds.reduce((sum, f) => sum + (Number(f.fixedAmount) || 0), 0);
        if (totalBudget > 0 && totalAmt > totalBudget) {
          if (!confirm(`Tổng tiền phân bổ (${formatVND(totalAmt)}) lớn hơn Ngân sách tháng (${formatVND(totalBudget)}). Bạn có muốn tiếp tục lưu?`)) {
            return;
          }
        }
      }

      try {
        await fetch('/api/finance/budget', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ month: monthKey, totalBudget, allocationMode })
        });

        await fetch('/api/finance/funds', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ funds })
        });

        await this.fetchData();
        window.FinanceModule.render();
        document.getElementById('modal-budget-config')?.classList.remove('active');
        alert('Đã cập nhật ngân sách và các quỹ thành công!');
      } catch (err) {
        alert('Lỗi cập nhật ngân sách: ' + err.message);
      }
    });

    // 5. Daily Recap Submit
    document.getElementById('btn-confirm-daily-recap')?.addEventListener('click', async () => {
      const targetDate = window.FinanceModule.selectedDate || window.FinanceModule.formatDateKey(new Date());
      const note = document.getElementById('recap-modal-note')?.value.trim();

      try {
        const res = await fetch('/api/finance/daily-recap', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date: targetDate, note, reconciled: true })
        });
        const result = await res.json();
        if (result.success) {
          if (!window.appState.finance.dailyRecaps) window.appState.finance.dailyRecaps = {};
          window.appState.finance.dailyRecaps[targetDate] = result.recap;
          window.FinanceModule.render();
          document.getElementById('modal-daily-recap')?.classList.remove('active');
          alert(`Đã xác nhận tổng kết chi tiêu ngày ${formatDateVN(targetDate)} thành công!`);
        }
      } catch (err) {
        alert('Lỗi tổng kết: ' + err.message);
      }
    });
  }
};

// Auto start when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});

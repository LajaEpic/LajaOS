/**
 * LIFE OS - FINANCE & CALENDAR MODULE
 * Monthly Budgets, Funds Allocation, Daily Spending, SVG Donut Chart & Daily Recap
 */

const FinanceModule = {
  currentYear: 2026,
  currentMonth: 10, // 1 - 12 (October)
  selectedDate: null, // "YYYY-MM-DD"
  activeTagFilter: 'all',
  budgetMode: 'percent', // 'percent' | 'amount'
  editingFunds: [],

  pastelPalette: [
    { name: 'Sky', hex: '#38bdf8' },
    { name: 'Mint', hex: '#34d399' },
    { name: 'Lavender', hex: '#818cf8' },
    { name: 'Lilac', hex: '#a78bfa' },
    { name: 'Pink', hex: '#f472b6' },
    { name: 'Rose', hex: '#fb7185' },
    { name: 'Amber', hex: '#fbbf24' },
    { name: 'Peach', hex: '#fb923c' },
    { name: 'Sage', hex: '#a3e635' },
    { name: 'Teal', hex: '#2dd4bf' },
    { name: 'Blue', hex: '#60a5fa' },
    { name: 'Slate', hex: '#94a3b8' }
  ],

  init() {
    const now = new Date();
    this.currentYear = now.getFullYear();
    this.currentMonth = now.getMonth() + 1;
    this.selectedDate = this.formatDateKey(now);

    this.bindEvents();
    this.render();
  },

  formatDateKey(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  },

  getMonthKey() {
    const m = String(this.currentMonth).padStart(2, '0');
    return `${this.currentYear}-${m}`;
  },

  bindEvents() {
    // Calendar month navigation
    document.getElementById('cal-prev-month')?.addEventListener('click', () => {
      this.currentMonth--;
      if (this.currentMonth < 1) {
        this.currentMonth = 12;
        this.currentYear--;
      }
      this.render();
    });

    document.getElementById('cal-next-month')?.addEventListener('click', () => {
      this.currentMonth++;
      if (this.currentMonth > 12) {
        this.currentMonth = 1;
        this.currentYear++;
      }
      this.render();
    });

    document.getElementById('cal-today-btn')?.addEventListener('click', () => {
      const now = new Date();
      this.currentYear = now.getFullYear();
      this.currentMonth = now.getMonth() + 1;
      this.selectedDate = this.formatDateKey(now);
      this.render();
    });

    // Add Transaction button
    document.getElementById('btn-new-tx')?.addEventListener('click', () => {
      this.openTransactionModal();
    });

    // Budget & Funds Config button
    document.getElementById('btn-config-budget')?.addEventListener('click', () => {
      this.openBudgetModal();
    });

    // Daily Recap Banner trigger
    document.getElementById('btn-trigger-recap')?.addEventListener('click', () => {
      this.openRecapModal();
    });

    // Export CSV button
    document.getElementById('btn-export-csv')?.addEventListener('click', () => {
      this.exportTransactionsCSV();
    });

    // Amount input auto format in modal
    const amountInput = document.getElementById('tx-amount-input');
    const amountPreview = document.getElementById('tx-amount-preview');
    if (amountInput && amountPreview) {
      amountInput.addEventListener('input', (e) => {
        const val = Number(e.target.value.replace(/\D/g, '')) || 0;
        amountPreview.textContent = formatVND(val);
      });
    }

    // Search and filter in transaction table
    document.getElementById('tx-search-input')?.addEventListener('input', () => this.renderTransactionsTable());
    document.getElementById('tx-filter-tag')?.addEventListener('change', () => this.renderTransactionsTable());

    // Close color popovers on click outside
    window.addEventListener('click', (e) => {
      if (!e.target.closest('.pastel-color-popover') && !e.target.closest('.fund-color-preview-btn')) {
        document.querySelectorAll('.pastel-color-popover').forEach(p => p.classList.remove('active'));
      }
    });
  },

  render() {
    this.renderKPIs();
    this.renderDailyRecapBanner();
    this.renderCalendar();
    this.renderFundsProgress();
    this.renderDonutChart();
    this.renderTransactionsTable();
  },

  // 1. KPI Cards
  renderKPIs() {
    const monthKey = this.getMonthKey();
    const finance = window.appState.finance || {};
    const budgetObj = (finance.budgets && finance.budgets[monthKey]) || { totalBudget: 0 };
    const totalBudget = budgetObj.totalBudget || 0;

    // Filter txs of current month
    const txs = (finance.transactions || []).filter(t => t.date.startsWith(monthKey));
    const totalSpent = txs.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const remaining = totalBudget - totalSpent;

    // Days in current month
    const daysInMonth = new Date(this.currentYear, this.currentMonth, 0).getDate();
    const dailyAvg = totalSpent / (new Date().getDate() || 1);

    const budgetElem = document.getElementById('kpi-total-budget');
    const spentElem = document.getElementById('kpi-total-spent');
    const remainElem = document.getElementById('kpi-remaining-budget');
    const avgElem = document.getElementById('kpi-daily-avg');

    if (budgetElem) budgetElem.textContent = formatVND(totalBudget);
    if (spentElem) spentElem.textContent = formatVND(totalSpent);
    if (remainElem) {
      remainElem.textContent = formatVND(remaining);
      remainElem.style.color = remaining >= 0 ? 'var(--accent-emerald)' : 'var(--accent-rose)';
    }
    if (avgElem) avgElem.textContent = formatVND(Math.round(dailyAvg));
  },

  // 2. Daily Recap Banner
  renderDailyRecapBanner() {
    const banner = document.getElementById('daily-recap-banner');
    if (!banner) return;

    const todayKey = this.formatDateKey(new Date());
    const finance = window.appState.finance || {};
    const recaps = finance.dailyRecaps || {};
    const todayRecap = recaps[todayKey];

    const todayTxs = (finance.transactions || []).filter(t => t.date === todayKey);
    const todayTotal = todayTxs.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    const isEvening = new Date().getHours() >= 18;

    if (todayRecap && todayRecap.reconciled) {
      banner.className = 'daily-recap-banner';
      banner.innerHTML = `
        <div style="display:flex; align-items:center; gap:12px;">
          <div style="color:var(--accent-emerald);">${renderIcon('check-circle', 28)}</div>
          <div>
            <div style="font-weight:700; color:var(--text-primary); font-size:1rem;">Đã hoàn thành tổng kết chi tiêu hôm nay (${formatDateVN(todayKey)})</div>
            <div style="font-size:0.83rem; color:var(--text-secondary);">Tổng chi trong ngày: <strong style="color:var(--accent-emerald);">${formatVND(todayTotal)}</strong> • Ghi chú: "${todayRecap.note || 'Chi tiêu hợp lý'}"</div>
          </div>
        </div>
        <button class="btn btn-secondary" onclick="FinanceModule.openRecapModal()">
          ${renderIcon('edit', 14)} Cập nhật lại
        </button>
      `;
    } else {
      banner.className = 'daily-recap-banner pending';
      banner.innerHTML = `
        <div style="display:flex; align-items:center; gap:12px;">
          <div style="color:var(--accent-amber);">${renderIcon('clock', 28)}</div>
          <div>
            <div style="font-weight:700; color:var(--text-primary); font-size:1rem;">
              ${isEvening ? '🌙 Đã đến tối! Hãy tổng kết chi tiêu hôm nay' : '📌 Rà soát & tổng kết chi tiêu hàng ngày'} (${formatDateVN(todayKey)})
            </div>
            <div style="font-size:0.83rem; color:var(--text-secondary);">
              Hiện có <strong>${todayTxs.length}</strong> khoản chi với tổng tiền <strong>${formatVND(todayTotal)}</strong>. Bấm nút đối soát để xác nhận hoàn tất ngày.
            </div>
          </div>
        </div>
        <button class="btn btn-primary" onclick="FinanceModule.openRecapModal()">
          ${renderIcon('check', 14)} Tổng kết hôm nay
        </button>
      `;
    }
  },

  // 3. Interactive Calendar
  renderCalendar() {
    const titleElem = document.getElementById('cal-month-title');
    if (titleElem) {
      titleElem.textContent = `Tháng ${this.currentMonth} / ${this.currentYear}`;
    }

    const grid = document.getElementById('calendar-days-grid');
    if (!grid) return;

    const firstDayIndex = new Date(this.currentYear, this.currentMonth - 1, 1).getDay();
    const daysInCurrentMonth = new Date(this.currentYear, this.currentMonth, 0).getDate();
    const daysInPrevMonth = new Date(this.currentYear, this.currentMonth - 1, 0).getDate();

    const finance = window.appState.finance || {};
    const txs = finance.transactions || [];
    const recaps = finance.dailyRecaps || {};
    const todayStr = this.formatDateKey(new Date());

    let html = '';

    // Previous month filler days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      html += `<div class="calendar-day-cell other-month"><div class="day-number">${dayNum}</div></div>`;
    }

    // Days of current month
    for (let day = 1; day <= daysInCurrentMonth; day++) {
      const mStr = String(this.currentMonth).padStart(2, '0');
      const dStr = String(day).padStart(2, '0');
      const dateKey = `${this.currentYear}-${mStr}-${dStr}`;

      const dayTxs = txs.filter(t => t.date === dateKey);
      const dayTotal = dayTxs.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
      const isReconciled = recaps[dateKey] && recaps[dateKey].reconciled;
      const isToday = dateKey === todayStr;
      const isSelected = dateKey === this.selectedDate;

      html += `
        <div class="calendar-day-cell ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}" onclick="FinanceModule.selectCalendarDay('${dateKey}')">
          <div class="day-header">
            <span class="day-number">${day}</span>
            ${isReconciled ? `<span class="reconciled-icon" title="Đã đối soát">${renderIcon('check-circle', 13)}</span>` : ''}
          </div>
          ${dayTotal > 0 ? `
            <div class="day-spent" title="${formatVND(dayTotal)}">
              -${dayTotal >= 1000000 ? (dayTotal / 1000000).toFixed(1) + 'Tr' : Math.round(dayTotal / 1000) + 'k'}
            </div>
          ` : '<div style="height:14px;"></div>'}
        </div>
      `;
    }

    grid.innerHTML = html;
  },

  selectCalendarDay(dateKey) {
    this.selectedDate = dateKey;
    this.renderCalendar();
    this.renderTransactionsTable();
  },

  // 4. Funds Allocation Progress Bars
  renderFundsProgress() {
    const container = document.getElementById('funds-progress-container');
    if (!container) return;

    const monthKey = this.getMonthKey();
    const finance = window.appState.finance || {};
    const budgetObj = (finance.budgets && finance.budgets[monthKey]) || { totalBudget: 0 };
    const totalBudget = budgetObj.totalBudget || 0;
    const funds = finance.funds || [];
    const txs = (finance.transactions || []).filter(t => t.date.startsWith(monthKey));

    if (funds.length === 0) {
      container.innerHTML = '<p style="color:var(--text-tertiary); font-style:italic;">Chưa thiết lập quỹ nào. Bấm nút cài đặt quỹ để bắt đầu.</p>';
      return;
    }

    const isAmountMode = budgetObj.allocationMode === 'amount';

    container.innerHTML = funds.map(fund => {
      const allocated = (isAmountMode && fund.fixedAmount !== undefined) ? Number(fund.fixedAmount) : Math.round((totalBudget * (fund.percent || 0)) / 100);
      const spent = txs.filter(t => t.fundId === fund.id).reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
      const remaining = allocated - spent;
      const pctSpent = allocated > 0 ? Math.round((spent / allocated) * 100) : 0;
      const remainingPct = Math.max(0, 100 - pctSpent);
      const displayPct = totalBudget > 0 ? Math.round((allocated / totalBudget) * 100) : (fund.percent || 0);

      // Color logic for depleting bar (full at start, decreases as spent)
      let barColor = fund.color || 'var(--accent-cyan)';
      let warningTag = '';

      if (spent > allocated) {
        barColor = 'var(--accent-rose)';
        warningTag = `<span style="color:var(--accent-rose); font-size:0.75rem; font-weight:700;">(Vượt ${formatVND(spent - allocated)})</span>`;
      } else if (remainingPct <= 20) {
        barColor = 'var(--accent-amber)';
        warningTag = `<span style="color:var(--accent-amber); font-size:0.75rem; font-weight:700;">(Sắp hết)</span>`;
      }

      return `
        <div class="fund-bar-item">
          <div class="fund-bar-header">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="width:10px; height:10px; border-radius:50%; background:${fund.color};"></span>
              <span>${fund.name} (${displayPct}%)</span>
            </div>
            <div>
              <span style="font-size:0.75rem; color:var(--text-tertiary);">Còn lại: </span>
              <strong style="color:${remaining > 0 ? (remainingPct <= 20 ? 'var(--accent-amber)' : 'var(--text-primary)') : 'var(--accent-rose)'};">${formatVND(Math.max(0, remaining))}</strong>
              <span style="color:var(--text-tertiary); font-size:0.8rem;"> / ${formatVND(allocated)}</span>
              ${warningTag}
            </div>
          </div>
          <div class="progress-track" title="Còn lại ${remainingPct}% (${formatVND(Math.max(0, remaining))})">
            <div class="progress-fill" style="width: ${remainingPct}%; background-color: ${barColor};"></div>
          </div>
          <div style="display:flex; justify-content:space-between; font-size:0.75rem; color:var(--text-tertiary); margin-top:4px;">
            <span>${fund.description || ''}</span>
            <span>Còn <strong>${remainingPct}%</strong> • Đã tiêu ${formatVND(spent)} (${pctSpent}%)</span>
          </div>
        </div>
      `;
    }).join('');
  },

  // 5. SVG Donut Chart for Tag Distribution
  renderDonutChart() {
    const container = document.getElementById('donut-chart-wrapper');
    const legendContainer = document.getElementById('chart-legend-container');
    if (!container) return;

    const monthKey = this.getMonthKey();
    const finance = window.appState.finance || {};
    const txs = (finance.transactions || []).filter(t => t.date.startsWith(monthKey));
    const tags = finance.tags || [];

    // Calculate sum per tag
    const tagTotals = {};
    let grandTotal = 0;

    txs.forEach(t => {
      const amt = Number(t.amount) || 0;
      tagTotals[t.tag] = (tagTotals[t.tag] || 0) + amt;
      grandTotal += amt;
    });

    if (grandTotal === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding:2rem 0; color:var(--text-tertiary);">
          <div style="margin-bottom:0.5rem;">${renderIcon('pie-chart', 36)}</div>
          <p>Chưa có chi tiêu nào trong tháng ${this.currentMonth}/${this.currentYear}</p>
        </div>
      `;
      if (legendContainer) legendContainer.innerHTML = '';
      return;
    }

    // Build SVG Donut Slices
    const radius = 70;
    const strokeWidth = 24;
    const center = 100;
    const circumference = 2 * Math.PI * radius;

    let accumulatedAngle = 0;
    const slices = [];
    const legendItems = [];

    const tagKeys = Object.keys(tagTotals).sort((a, b) => tagTotals[b] - tagTotals[a]);

    tagKeys.forEach(tagKey => {
      const tagObj = tags.find(t => t.id === tagKey) || { name: tagKey, color: '#94a3b8' };
      const amount = tagTotals[tagKey];
      const percent = (amount / grandTotal);
      const dashLength = percent * circumference;
      const dashOffset = -accumulatedAngle;

      accumulatedAngle += dashLength;

      slices.push(`
        <circle cx="${center}" cy="${center}" r="${radius}"
          fill="none"
          stroke="${tagObj.color}"
          stroke-width="${strokeWidth}"
          stroke-dasharray="${dashLength} ${circumference - dashLength}"
          stroke-dashoffset="${dashOffset}"
          style="transition: stroke-width 0.2s, opacity 0.2s; cursor:pointer;"
          onmouseenter="FinanceModule.onSliceHover('${tagObj.name}', '${formatVND(amount)}', '${Math.round(percent * 100)}%')"
          onmouseleave="FinanceModule.onSliceLeave('${formatVND(grandTotal)}')"
        />
      `);

      legendItems.push(`
        <div class="legend-item">
          <div class="legend-color-dot" style="background:${tagObj.color};"></div>
          <span style="font-weight:600;">${tagObj.name}:</span>
          <span>${Math.round(percent * 100)}% (${formatVND(amount)})</span>
        </div>
      `);
    });

    container.innerHTML = `
      <svg width="200" height="200" viewBox="0 0 200 200" style="transform: rotate(-90deg);">
        ${slices.join('')}
      </svg>
      <div id="donut-center-text" style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); text-align:center; pointer-events:none;">
        <div style="font-size:0.75rem; color:var(--text-tertiary); font-weight:600;">TỔNG CHI</div>
        <div style="font-size:1.05rem; font-weight:800; color:var(--text-primary);">${formatVND(grandTotal)}</div>
      </div>
    `;

    if (legendContainer) {
      legendContainer.innerHTML = legendItems.join('');
    }
  },

  onSliceHover(tagName, amountStr, pctStr) {
    const center = document.getElementById('donut-center-text');
    if (center) {
      center.innerHTML = `
        <div style="font-size:0.75rem; color:var(--accent-cyan); font-weight:700;">${tagName}</div>
        <div style="font-size:1.05rem; font-weight:800; color:var(--text-primary);">${amountStr}</div>
        <div style="font-size:0.75rem; color:var(--text-secondary);">${pctStr}</div>
      `;
    }
  },

  onSliceLeave(grandTotalStr) {
    const center = document.getElementById('donut-center-text');
    if (center) {
      center.innerHTML = `
        <div style="font-size:0.75rem; color:var(--text-tertiary); font-weight:600;">TỔNG CHI</div>
        <div style="font-size:1.05rem; font-weight:800; color:var(--text-primary);">${grandTotalStr}</div>
      `;
    }
  },

  // 6. Transactions Table
  renderTransactionsTable() {
    const tbody = document.getElementById('transactions-tbody');
    const tableHeader = document.getElementById('tx-table-context-title');
    if (!tbody) return;

    const finance = window.appState.finance || {};
    let txs = [...(finance.transactions || [])];
    const funds = finance.funds || [];
    const tags = finance.tags || [];

    // Filter by selected date if selected, or month
    if (this.selectedDate) {
      txs = txs.filter(t => t.date === this.selectedDate);
      if (tableHeader) {
        tableHeader.textContent = `Các khoản chi ngày ${formatDateVN(this.selectedDate)} (${txs.length} giao dịch)`;
      }
    } else {
      const monthKey = this.getMonthKey();
      txs = txs.filter(t => t.date.startsWith(monthKey));
      if (tableHeader) {
        tableHeader.textContent = `Tất cả giao dịch tháng ${this.currentMonth}/${this.currentYear} (${txs.length} giao dịch)`;
      }
    }

    // Filter by search query
    const searchVal = document.getElementById('tx-search-input')?.value.trim().toLowerCase();
    if (searchVal) {
      txs = txs.filter(t => (t.note || '').toLowerCase().includes(searchVal) || (t.tag || '').toLowerCase().includes(searchVal));
    }

    // Filter by tag select
    const tagFilter = document.getElementById('tx-filter-tag')?.value;
    if (tagFilter && tagFilter !== 'all') {
      txs = txs.filter(t => t.tag === tagFilter);
    }

    // Sort descending by date & time
    txs.sort((a, b) => {
      const dtA = new Date(`${a.date}T${a.time || '00:00'}`);
      const dtB = new Date(`${b.date}T${b.time || '00:00'}`);
      return dtB - dtA;
    });

    if (txs.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align:center; padding:2rem; color:var(--text-tertiary);">
            Không có giao dịch nào thỏa mãn điều kiện lọc.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = txs.map(t => {
      const fund = funds.find(f => f.id === t.fundId);
      const tag = tags.find(tg => tg.id === t.tag);

      return `
        <tr>
          <td style="white-space:nowrap; font-weight:600;">
            ${formatDateVN(t.date)} <span style="color:var(--text-tertiary); font-size:0.8em;">${t.time || ''}</span>
          </td>
          <td style="font-weight:700; color:var(--accent-rose); white-space:nowrap;">
            -${formatVND(t.amount)}
          </td>
          <td>
            ${fund ? `<span style="display:inline-flex; align-items:center; gap:4px; font-weight:600; color:${fund.color};">● ${fund.name}</span>` : '-'}
          </td>
          <td>
            ${tag ? `<span class="task-badge" style="background:${tag.color}22; color:${tag.color}; border:1px solid ${tag.color}55;">${tag.name}</span>` : t.tag}
          </td>
          <td style="max-width:280px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
            ${t.note || '<span style="color:var(--text-tertiary); font-style:italic;">Không có ghi chú</span>'}
          </td>
          <td style="text-align:right;">
            <button class="btn btn-icon btn-secondary" title="Xóa khoản này" onclick="FinanceModule.deleteTransaction('${t.id}')">
              ${renderIcon('trash', 13)}
            </button>
          </td>
        </tr>
      `;
    }).join('');
  },

  async deleteTransaction(txId) {
    if (!confirm('Xác nhận xóa khoản chi này?')) return;
    try {
      await fetch(`/api/finance/transactions/${txId}`, { method: 'DELETE' });
      window.appState.finance.transactions = window.appState.finance.transactions.filter(t => t.id !== txId);
      this.render();
    } catch (e) {
      alert('Lỗi: ' + e.message);
    }
  },

  // Modals & Action dialogs
  openTransactionModal() {
    const modal = document.getElementById('modal-new-tx');
    if (!modal) return;

    // Date & Time defaults
    const dateInput = document.getElementById('tx-date-input');
    const timeInput = document.getElementById('tx-time-input');
    const now = new Date();

    if (dateInput) dateInput.value = this.selectedDate || this.formatDateKey(now);
    if (timeInput) timeInput.value = now.toTimeString().slice(0, 5);

    // Populate Funds select
    const fundSelect = document.getElementById('tx-fund-select');
    if (fundSelect) {
      const funds = window.appState.finance.funds || [];
      const monthKey = this.getMonthKey();
      const budgetObj = (window.appState.finance.budgets && window.appState.finance.budgets[monthKey]) || {};
      const isAmount = budgetObj.allocationMode === 'amount';
      fundSelect.innerHTML = funds.map(f => {
        const info = isAmount && f.fixedAmount ? formatVND(f.fixedAmount) : `${f.percent}%`;
        return `<option value="${f.id}">● ${f.name} (${info})</option>`;
      }).join('');
    }

    // Populate Tags select
    const tagSelect = document.getElementById('tx-tag-select');
    if (tagSelect) {
      const tags = window.appState.finance.tags || [];
      tagSelect.innerHTML = tags.map(tg => `<option value="${tg.id}">${tg.name}</option>`).join('');
    }

    // Clear input
    const amtInput = document.getElementById('tx-amount-input');
    const noteInput = document.getElementById('tx-note-input');
    const preview = document.getElementById('tx-amount-preview');
    if (amtInput) amtInput.value = '';
    if (noteInput) noteInput.value = '';
    if (preview) preview.textContent = '0 ₫';

    modal.classList.add('active');
  },

  openBudgetModal() {
    const modal = document.getElementById('modal-budget-config');
    if (!modal) return;

    const monthKey = this.getMonthKey();
    const finance = window.appState.finance || {};
    const budgetObj = (finance.budgets && finance.budgets[monthKey]) || { totalBudget: 0, allocationMode: 'percent' };
    const totalBudget = Number(budgetObj.totalBudget) || 0;

    this.budgetMode = budgetObj.allocationMode || 'percent';

    const totalInput = document.getElementById('budget-total-input');
    if (totalInput) totalInput.value = totalBudget || '';

    // Copy funds to editingFunds
    const originalFunds = finance.funds || [];
    this.editingFunds = originalFunds.map(f => {
      const pct = Number(f.percent) || 0;
      const amt = f.fixedAmount !== undefined ? Number(f.fixedAmount) : Math.round((totalBudget * pct) / 100);
      return {
        id: f.id || ('fund-' + Date.now() + Math.random()),
        name: f.name || 'Quỹ mới',
        percent: pct,
        fixedAmount: amt,
        color: f.color || '#38bdf8',
        icon: f.icon || 'wallet',
        description: f.description || ''
      };
    });

    this.updateModeButtonsUI();
    this.renderFundsEditor();

    // Attach total budget input listener for live calculation
    if (totalInput) {
      totalInput.oninput = () => {
        this.recalculateFromTotalBudget();
        this.renderFundsEditor();
      };
    }

    modal.classList.add('active');
  },

  updateModeButtonsUI() {
    const btnPct = document.getElementById('btn-mode-percent');
    const btnAmt = document.getElementById('btn-mode-amount');
    if (this.budgetMode === 'percent') {
      btnPct?.classList.add('active');
      btnAmt?.classList.remove('active');
    } else {
      btnAmt?.classList.add('active');
      btnPct?.classList.remove('active');
    }
  },

  switchBudgetMode(mode) {
    if (this.budgetMode === mode) return;
    this.budgetMode = mode;
    this.updateModeButtonsUI();
    this.renderFundsEditor();
  },

  recalculateFromTotalBudget() {
    const totalBudget = Number(document.getElementById('budget-total-input')?.value) || 0;
    this.editingFunds.forEach(f => {
      if (this.budgetMode === 'percent') {
        f.fixedAmount = Math.round((totalBudget * (f.percent || 0)) / 100);
      } else {
        f.percent = totalBudget > 0 ? Math.round(((f.fixedAmount || 0) / totalBudget) * 100) : 0;
      }
    });
  },

  addNewFundRow() {
    const nextColor = this.pastelPalette[this.editingFunds.length % this.pastelPalette.length].hex;
    const totalBudget = Number(document.getElementById('budget-total-input')?.value) || 0;
    const defaultPct = 10;
    const defaultAmt = Math.round((totalBudget * defaultPct) / 100);

    this.editingFunds.push({
      id: 'fund-' + Date.now(),
      name: `Quỹ ${this.editingFunds.length + 1}`,
      percent: defaultPct,
      fixedAmount: defaultAmt,
      color: nextColor,
      icon: 'wallet',
      description: ''
    });

    this.renderFundsEditor();
  },

  removeFundRow(index) {
    if (this.editingFunds.length <= 1) {
      alert('Bạn cần giữ lại ít nhất 1 Quỹ chi tiêu!');
      return;
    }
    const target = this.editingFunds[index];
    if (confirm(`Bạn có chắc chắn muốn xóa "${target.name}"?`)) {
      this.editingFunds.splice(index, 1);
      this.renderFundsEditor();
    }
  },

  toggleColorPopover(index, event) {
    event.stopPropagation();
    document.querySelectorAll('.pastel-color-popover').forEach(p => {
      if (p.id !== `popover-color-${index}`) p.classList.remove('active');
    });
    const popover = document.getElementById(`popover-color-${index}`);
    if (popover) popover.classList.toggle('active');
  },

  selectFundColor(index, hexColor) {
    if (this.editingFunds[index]) {
      this.editingFunds[index].color = hexColor;
      const previewBtn = document.getElementById(`fund-color-btn-${index}`);
      if (previewBtn) previewBtn.style.backgroundColor = hexColor;
      const popover = document.getElementById(`popover-color-${index}`);
      if (popover) popover.classList.remove('active');
    }
  },

  onFundNameChange(index, val) {
    if (this.editingFunds[index]) {
      this.editingFunds[index].name = val;
    }
  },

  onFundValueChange(index, val) {
    const totalBudget = Number(document.getElementById('budget-total-input')?.value) || 0;
    const num = Number(val) || 0;
    if (this.editingFunds[index]) {
      if (this.budgetMode === 'percent') {
        this.editingFunds[index].percent = num;
        this.editingFunds[index].fixedAmount = Math.round((totalBudget * num) / 100);
        const preview = document.getElementById(`fund-preview-${index}`);
        if (preview) preview.textContent = `(${formatVND(this.editingFunds[index].fixedAmount)})`;
      } else {
        this.editingFunds[index].fixedAmount = num;
        this.editingFunds[index].percent = totalBudget > 0 ? Math.round((num / totalBudget) * 100) : 0;
        const preview = document.getElementById(`fund-preview-${index}`);
        if (preview) preview.textContent = `(${this.editingFunds[index].percent}%)`;
      }
      this.renderAllocationSummary();
    }
  },

  renderAllocationSummary() {
    const summaryContainer = document.getElementById('budget-allocation-summary');
    if (!summaryContainer) return;

    const totalBudget = Number(document.getElementById('budget-total-input')?.value) || 0;
    const isPct = this.budgetMode === 'percent';

    if (isPct) {
      const sumPct = this.editingFunds.reduce((sum, f) => sum + (Number(f.percent) || 0), 0);
      const sumAmt = Math.round((totalBudget * sumPct) / 100);
      const remainPct = 100 - sumPct;
      const isOk = sumPct === 100;
      const statusColor = isOk ? 'var(--accent-emerald)' : (sumPct > 100 ? 'var(--accent-rose)' : 'var(--accent-amber)');

      summaryContainer.innerHTML = `
        <div>
          <span>Tổng phân bổ: </span>
          <strong style="color: ${statusColor}; font-size:0.92rem;">${sumPct}%</strong>
          <span style="color: var(--text-tertiary);"> (${formatVND(sumAmt)})</span>
        </div>
        <div>
          ${isOk ? `
            <span style="color: var(--accent-emerald); font-weight:700;">✅ Đạt chuẩn 100%</span>
          ` : `
            <span style="color: ${statusColor}; font-weight:600;">
              ${remainPct > 0 ? `Chưa phân bổ: ${remainPct}% (${formatVND(Math.round(totalBudget * remainPct / 100))})` : `Vượt mức: ${Math.abs(remainPct)}%`}
            </span>
          `}
        </div>
      `;
    } else {
      const sumAmt = this.editingFunds.reduce((sum, f) => sum + (Number(f.fixedAmount) || 0), 0);
      const remainAmt = totalBudget - sumAmt;
      const sumPct = totalBudget > 0 ? Math.round((sumAmt / totalBudget) * 100) : 0;
      const isOk = sumAmt === totalBudget;
      const statusColor = sumAmt <= totalBudget ? (isOk ? 'var(--accent-emerald)' : 'var(--accent-cyan)') : 'var(--accent-rose)';

      summaryContainer.innerHTML = `
        <div>
          <span>Tổng phân bổ: </span>
          <strong style="color: ${statusColor}; font-size:0.92rem;">${formatVND(sumAmt)}</strong>
          <span style="color: var(--text-tertiary);"> (${sumPct}%)</span>
        </div>
        <div>
          ${isOk ? `
            <span style="color: var(--accent-emerald); font-weight:700;">✅ Vừa khớp ngân sách</span>
          ` : (remainAmt > 0 ? `
            <span style="color: var(--accent-cyan); font-weight:600;">Còn lại: ${formatVND(remainAmt)}</span>
          ` : `
            <span style="color: var(--accent-rose); font-weight:700;">Vượt ngân sách: ${formatVND(Math.abs(remainAmt))}</span>
          `)}
        </div>
      `;
    }
  },

  renderFundsEditor() {
    const list = document.getElementById('budget-funds-editor-list');
    if (!list) return;

    const totalBudget = Number(document.getElementById('budget-total-input')?.value) || 0;
    const isPct = this.budgetMode === 'percent';

    list.innerHTML = this.editingFunds.map((f, i) => {
      const value = isPct ? f.percent : f.fixedAmount;
      const previewText = isPct ? `(${formatVND(f.fixedAmount)})` : `(${f.percent}%)`;

      return `
        <div class="fund-editor-row" id="fund-row-${i}">
          <!-- Color Picker Button with Popover -->
          <button type="button" class="fund-color-preview-btn" id="fund-color-btn-${i}" style="background-color: ${f.color};" onclick="FinanceModule.toggleColorPopover(${i}, event)" title="Chọn màu pastel"></button>

          <!-- 12 Pastel Colors Popover -->
          <div class="pastel-color-popover" id="popover-color-${i}" onclick="event.stopPropagation()">
            <div style="font-size:0.75rem; font-weight:700; color:var(--text-secondary); margin-bottom:4px; display:flex; justify-content:space-between;">
              <span>Màu Pastel dịu mắt:</span>
              <span style="color:var(--text-tertiary);">12 màu + Tự chọn</span>
            </div>
            <div class="pastel-swatches-grid">
              ${this.pastelPalette.map(c => `
                <div class="pastel-swatch ${c.hex.toLowerCase() === f.color.toLowerCase() ? 'active' : ''}" style="background-color: ${c.hex};" onclick="FinanceModule.selectFundColor(${i}, '${c.hex}')" title="${c.name}"></div>
              `).join('')}
              <!-- 13th Custom Color Option -->
              <div class="pastel-swatch rainbow-swatch" title="Tự chọn màu khác">
                <input type="color" value="${f.color}" onchange="FinanceModule.selectFundColor(${i}, this.value)">
              </div>
            </div>
          </div>

          <!-- Fund Name Input -->
          <input type="text" class="form-input" value="${f.name}" placeholder="Tên quỹ" style="flex:2;" oninput="FinanceModule.onFundNameChange(${i}, this.value)">

          <!-- Value Input -->
          <div style="display:flex; align-items:center; gap:4px; flex: 1.8;">
            <input type="number" class="form-input" value="${value}" placeholder="${isPct ? '%' : 'VNĐ'}" style="width: 100%; font-weight:700;" min="0" oninput="FinanceModule.onFundValueChange(${i}, this.value)">
            <span style="font-weight:700; color:var(--text-secondary);">${isPct ? '%' : '₫'}</span>
          </div>

          <!-- Converted Preview Badge -->
          <div id="fund-preview-${i}" style="font-size:0.75rem; color:var(--text-tertiary); min-width:85px; text-align:right;">
            ${previewText}
          </div>

          <!-- Delete Row Button -->
          <button type="button" class="btn btn-icon btn-secondary" style="padding:4px; margin-left:2px;" onclick="FinanceModule.removeFundRow(${i})" title="Xóa quỹ này">
            ${renderIcon('trash', 14)}
          </button>
        </div>
      `;
    }).join('');

    this.renderAllocationSummary();
  },

  openRecapModal() {
    const modal = document.getElementById('modal-daily-recap');
    if (!modal) return;

    const targetDate = this.selectedDate || this.formatDateKey(new Date());
    const finance = window.appState.finance || {};
    const recaps = finance.dailyRecaps || {};
    const existingRecap = recaps[targetDate];

    const todayTxs = (finance.transactions || []).filter(t => t.date === targetDate);
    const todayTotal = todayTxs.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    document.getElementById('recap-modal-date').textContent = formatDateVN(targetDate);
    document.getElementById('recap-modal-total').textContent = formatVND(todayTotal);
    document.getElementById('recap-modal-count').textContent = todayTxs.length;

    const noteInput = document.getElementById('recap-modal-note');
    if (noteInput) {
      noteInput.value = (existingRecap && existingRecap.note) || '';
    }

    modal.classList.add('active');
  },

  // Export CSV
  exportTransactionsCSV() {
    const finance = window.appState.finance || {};
    const txs = finance.transactions || [];
    const funds = finance.funds || [];

    if (txs.length === 0) {
      alert('Chưa có dữ liệu để xuất file CSV!');
      return;
    }

    const headers = ['Ngày', 'Giờ', 'Số tiền (VND)', 'Quỹ chi tiêu', 'Tag', 'Ghi chú'];
    const rows = txs.map(t => {
      const fund = funds.find(f => f.id === t.fundId);
      const safeNote = (t.note || '').replace(/"/g, '""');
      return [
        t.date,
        t.time || '',
        t.amount,
        `"${fund ? fund.name : ''}"`,
        `"${t.tag}"`,
        `"${safeNote}"`
      ].join(',');
    });

    // UTF-8 BOM for Excel
    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Chi_Tieu_LajaOS_${this.getMonthKey()}.csv`;
    link.click();
  }
};

window.FinanceModule = FinanceModule;

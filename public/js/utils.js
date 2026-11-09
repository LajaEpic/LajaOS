/**
 * LIFE OS - UTILITY FUNCTIONS
 * High-performance offline helpers
 */

// 1. Format Currency to VND
function formatVND(amount) {
  const num = Number(amount) || 0;
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0
  }).format(num);
}

// 2. Format Date strings
function formatDateVN(dateStr) {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

function getDayOfWeekVN(dateObj) {
  const days = ['Chủ Nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
  return days[dateObj.getDay()];
}

// 3. Deadline Countdown & Status Analyzer
function getDeadlineInfo(deadlineStr) {
  if (!deadlineStr) return null;
  const deadline = new Date(deadlineStr);
  const now = new Date();
  const diffMs = deadline - now;
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  const timeStr = deadline.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  const dateStr = `${deadline.getDate()}/${deadline.getMonth() + 1}`;

  // Overdue
  if (diffMs < 0) {
    const overdueHours = Math.abs(diffHours);
    if (overdueHours < 24) {
      return {
        className: 'overdue',
        text: `Quá hạn ${overdueHours} giờ`,
        fullDate: `${dateStr} ${timeStr}`,
        isOverdue: true
      };
    }
    const overdueDays = Math.abs(diffDays);
    return {
      className: 'overdue',
      text: `Quá hạn ${overdueDays} ngày`,
      fullDate: `${dateStr} ${timeStr}`,
      isOverdue: true
    };
  }

  // Today
  const isToday = deadline.toDateString() === now.toDateString();
  if (isToday) {
    return {
      className: 'today',
      text: `Hôm nay ${timeStr}`,
      fullDate: `${dateStr} ${timeStr}`,
      isToday: true
    };
  }

  // Tomorrow
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (deadline.toDateString() === tomorrow.toDateString()) {
    return {
      className: 'upcoming',
      text: `Ngày mai ${timeStr}`,
      fullDate: `${dateStr} ${timeStr}`
    };
  }

  // Remaining days
  if (diffDays <= 7) {
    return {
      className: 'upcoming',
      text: `Còn ${diffDays} ngày (${timeStr})`,
      fullDate: `${dateStr} ${timeStr}`
    };
  }

  return {
    className: 'upcoming',
    text: `${dateStr} ${timeStr}`,
    fullDate: `${dateStr} ${timeStr}`
  };
}

// 4. Lucide-Style Vector Icon Generator
function renderIcon(name, size = 16, strokeWidth = 2) {
  const icons = {
    'folder': `<path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/>`,
    'graduation-cap': `<path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>`,
    'cpu': `<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3"/>`,
    'activity': `<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>`,
    'calendar': `<rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/>`,
    'check': `<path d="M20 6 9 17l-5-5"/>`,
    'check-circle': `<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/>`,
    'clock': `<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>`,
    'plus': `<path d="M5 12h14M12 5v14"/>`,
    'trash': `<path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>`,
    'edit': `<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>`,
    'link': `<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>`,
    'file': `<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/>`,
    'upload': `<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>`,
    'alert-circle': `<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>`,
    'x': `<path d="M18 6 6 18M6 6l12 12"/>`,
    'chevron-left': `<path d="m15 18-6-6 6-6"/>`,
    'chevron-right': `<path d="m9 18 6-6-6-6"/>`,
    'settings': `<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>`,
    'pie-chart': `<path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/>`,
    'wallet': `<path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/>`,
    'home': `<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>`,
    'book-open': `<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>`,
    'trending-up': `<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>`,
    'smile': `<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" x2="9.01" y1="9" y2="9"/><line x1="15" x2="15.01" y1="9" y2="9"/>`,
    'utensils': `<path d="M18 2v6a3 3 0 0 1-3 3 3 3 0 0 1-3-3V2"/><path d="M15 11v11"/><path d="M6 2v20"/><path d="M6 2a3 3 0 0 1 3 3v3a3 3 0 0 1-3 3"/>`,
    'film': `<rect width="20" height="20" x="2" y="2" rx="2.18" ry="2.18"/><line x1="7" x2="7" y1="2" y2="22"/><line x1="17" x2="17" y1="2" y2="22"/><line x1="2" x2="22" y1="12" y2="12"/><line x1="2" x2="7" y1="7" y2="7"/><line x1="2" x2="7" y1="17" y2="17"/><line x1="17" x2="22" y1="17" y2="17"/><line x1="17" x2="22" y1="7" y2="7"/>`,
    'car': `<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8C1.4 11.2 1 12 1 13v3c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>`,
    'shopping-bag': `<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>`,
    'heart-pulse': `<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/><path d="M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27"/>`,
    'receipt': `<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1Z"/><path d="M14 8H8"/><path d="M16 12H8"/><path d="M13 16H8"/>`,
    'download': `<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>`,
    'external-link': `<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" x2="21" y1="14" y2="3"/>`
  };

  const svgContent = icons[name] || icons['folder'];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" class="icon icon-${name}">${svgContent}</svg>`;
}

// 5. Lightweight Markdown to HTML (Notion-style)
function markdownToHtml(md) {
  if (!md) return '';
  let html = md
    // Escape basic html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Headings
  html = html.replace(/^### (.*$)/gim, '<h3 style="font-size:1.05rem; font-weight:700; color:var(--text-primary); margin:0.8rem 0 0.4rem 0;">$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2 style="font-size:1.2rem; font-weight:700; color:var(--text-primary); margin:1rem 0 0.5rem 0;">$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1 style="font-size:1.35rem; font-weight:800; color:var(--text-primary); margin:1.2rem 0 0.6rem 0;">$1</h1>');

  // Blockquotes
  html = html.replace(/^\> (.*$)/gim, '<blockquote style="border-left: 3px solid var(--accent-cyan); padding-left: 0.8rem; margin: 0.6rem 0; color: var(--text-secondary); background: rgba(56, 189, 248, 0.05); padding-top: 0.3rem; padding-bottom: 0.3rem; border-radius: 0 6px 6px 0;">$1</blockquote>');

  // Checkboxes
  html = html.replace(/^- \[x\] (.*$)/gim, '<div style="display:flex; align-items:center; gap:0.5rem; margin:0.3rem 0; color:var(--text-tertiary); text-decoration:line-through;"><span style="color:var(--accent-emerald);">☑</span> $1</div>');
  html = html.replace(/^- \[ \] (.*$)/gim, '<div style="display:flex; align-items:center; gap:0.5rem; margin:0.3rem 0; color:var(--text-primary);"><span style="color:var(--text-tertiary);">☐</span> $1</div>');

  // Bullet list
  html = html.replace(/^- (.*$)/gim, '<li style="margin-left: 1.2rem; color: var(--text-secondary);">$1</li>');

  // Bold & Italic
  html = html.replace(/\*\*(.*?)\*\*/gim, '<strong style="color: var(--text-primary);">$1</strong>');
  html = html.replace(/\*(.*?)\*/gim, '<em>$1</em>');

  // Inline Code
  html = html.replace(/`(.*?)`/gim, '<code style="background:var(--bg-input); border:1px solid var(--border-subtle); padding:0.1rem 0.35rem; border-radius:4px; font-family:var(--font-mono); font-size:0.85em; color:var(--accent-cyan);">$1</code>');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2" target="_blank" rel="noopener noreferrer" style="color:var(--accent-cyan); text-decoration:underline;">$1</a>');

  // Line breaks
  html = html.replace(/\n/gim, '<br>');

  return html;
}

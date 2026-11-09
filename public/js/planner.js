/**
 * LIFE OS - PLANNER & DEADLINES MODULE
 * Notion-like Task Detail Drawer, Projects Hierarchy & Smart Sorting
 */

const PlannerModule = {
  currentFilter: 'all', // 'all', 'today', 'project', 'done'
  selectedProjectId: null,
  currentSort: 'deadline', // 'deadline', 'priority', 'created'
  activeTaskId: null,

  init() {
    this.bindEvents();
    this.render();
  },

  bindEvents() {
    // Project filter click
    document.getElementById('all-projects-btn')?.addEventListener('click', () => {
      this.selectedProjectId = null;
      this.currentFilter = 'all';
      this.render();
    });

    // Task filter pills
    document.querySelectorAll('.planner-filter-pill').forEach(pill => {
      pill.addEventListener('click', (e) => {
        document.querySelectorAll('.planner-filter-pill').forEach(p => p.classList.remove('active'));
        e.target.classList.add('active');
        this.currentFilter = e.target.dataset.filter;
        this.render();
      });
    });

    // Sort select
    const sortSelect = document.getElementById('task-sort-select');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        this.currentSort = e.target.value;
        this.renderTasks();
      });
    }

    // New Project Modal open
    document.getElementById('btn-new-project')?.addEventListener('click', () => {
      this.openProjectModal();
    });

    // New Task Modal open
    document.getElementById('btn-new-task')?.addEventListener('click', () => {
      this.openTaskModal();
    });

    // Close Drawer
    document.getElementById('close-drawer-btn')?.addEventListener('click', () => this.closeDrawer());
    document.getElementById('drawer-overlay')?.addEventListener('click', () => this.closeDrawer());

    // Drawer File Drag & Drop
    const dropzone = document.getElementById('drawer-dropzone');
    const fileInput = document.getElementById('drawer-file-input');

    if (dropzone && fileInput) {
      dropzone.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', (e) => this.handleFileUpload(e.target.files));

      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
      });
      dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        if (e.dataTransfer.files.length) {
          this.handleFileUpload(e.dataTransfer.files);
        }
      });
    }

    // Drawer Add Link
    document.getElementById('btn-add-drawer-link')?.addEventListener('click', () => {
      this.addDrawerLink();
    });

    // Drawer Add Subtask
    document.getElementById('drawer-subtask-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.addDrawerSubtask();
      }
    });
    document.getElementById('btn-add-subtask')?.addEventListener('click', () => this.addDrawerSubtask());

    // Drawer Markdown Edit toggle
    document.getElementById('btn-toggle-edit-details')?.addEventListener('click', () => {
      this.toggleDetailsEdit();
    });
    document.getElementById('btn-save-details')?.addEventListener('click', () => {
      this.saveDetailsText();
    });

    // Drawer Task Quick Settings (Edit Title & Deadline)
    document.getElementById('btn-toggle-task-settings')?.addEventListener('click', () => {
      this.toggleTaskSettings();
    });
    document.getElementById('btn-cancel-task-settings')?.addEventListener('click', () => {
      this.closeTaskSettings();
    });
    document.getElementById('btn-save-task-settings')?.addEventListener('click', () => {
      this.saveTaskSettings();
    });
  },

  render() {
    this.renderProjectsList();
    this.renderTasks();
  },

  renderProjectsList() {
    const container = document.getElementById('project-list-container');
    if (!container) return;

    const projects = window.appState.projects || [];
    const tasks = window.appState.tasks || [];

    const allBtn = document.getElementById('all-projects-btn');
    if (allBtn) {
      if (!this.selectedProjectId) allBtn.classList.add('active');
      else allBtn.classList.remove('active');
    }

    container.innerHTML = projects.map(proj => {
      const projTasks = tasks.filter(t => t.projectId === proj.id);
      const pendingCount = projTasks.filter(t => t.status !== 'done').length;
      const isSelected = this.selectedProjectId === proj.id;

      return `
        <div class="project-item ${isSelected ? 'active' : ''}" onclick="PlannerModule.selectProject('${proj.id}')">
          <div class="project-dot" style="background-color: ${proj.color};"></div>
          <div class="project-info">
            <div class="project-name">${proj.title}</div>
            <div class="project-task-count">${pendingCount} việc cần làm • ${projTasks.length} tổng</div>
          </div>
          <button class="btn btn-icon btn-secondary" style="padding:4px; margin-left:4px;" title="Xóa dự án" onclick="event.stopPropagation(); PlannerModule.deleteProject('${proj.id}')">
            ${renderIcon('trash', 13)}
          </button>
        </div>
      `;
    }).join('');
  },

  selectProject(projId) {
    if (this.selectedProjectId === projId) {
      this.selectedProjectId = null;
    } else {
      this.selectedProjectId = projId;
      this.currentFilter = 'project';
    }
    this.render();
  },

  renderTasks() {
    const container = document.getElementById('tasks-container');
    if (!container) return;

    let tasks = [...(window.appState.tasks || [])];
    const projects = window.appState.projects || [];
    const now = new Date();

    // 1. Filter
    if (this.currentFilter === 'today') {
      tasks = tasks.filter(t => {
        if (!t.deadline) return false;
        const d = new Date(t.deadline);
        return d.toDateString() === now.toDateString();
      });
    } else if (this.currentFilter === 'done') {
      tasks = tasks.filter(t => t.status === 'done');
    } else if (this.selectedProjectId) {
      tasks = tasks.filter(t => t.projectId === this.selectedProjectId);
    } else if (this.currentFilter === 'all') {
      // By default show unfinished first or all
    }

    // 2. Sort
    if (this.currentSort === 'deadline') {
      // Default: Sort by deadline ascending (soonest deadline first, tasks with no deadline at the bottom)
      tasks.sort((a, b) => {
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return new Date(a.deadline) - new Date(b.deadline);
      });
    } else if (this.currentSort === 'priority') {
      const priorityOrder = { 'urgent': 1, 'high': 2, 'medium': 3, 'low': 4 };
      tasks.sort((a, b) => (priorityOrder[a.priority] || 3) - (priorityOrder[b.priority] || 3));
    } else if (this.currentSort === 'created') {
      tasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    if (tasks.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 3rem 1rem; color: var(--text-tertiary); background: var(--bg-surface); border: 1px dashed var(--border-subtle); border-radius: 12px;">
          <div style="margin-bottom: 0.5rem;">${renderIcon('check-circle', 36)}</div>
          <p style="font-size: 1rem; font-weight: 600;">Không có nhiệm vụ nào trong mục này</p>
          <p style="font-size: 0.85rem; margin-top: 0.25rem;">Bấm "+ Thêm Nhiệm Vụ" để tạo kế hoạch mới ngay!</p>
        </div>
      `;
      return;
    }

    container.innerHTML = tasks.map(task => {
      const proj = projects.find(p => p.id === task.projectId);
      const isDone = task.status === 'done';
      const deadlineInfo = getDeadlineInfo(task.deadline);
      const subtaskCount = task.subtasks ? task.subtasks.length : 0;
      const subtaskDone = task.subtasks ? task.subtasks.filter(s => s.done).length : 0;
      const fileCount = task.attachments ? task.attachments.length : 0;
      const linkCount = task.links ? task.links.length : 0;

      const priorityBadges = {
        'urgent': `<span class="task-badge badge-urgent">🔥 Khẩn cấp</span>`,
        'high': `<span class="task-badge badge-high">⚡ Ưu tiên cao</span>`,
        'medium': `<span class="task-badge badge-medium">🔷 Trung bình</span>`,
        'low': `<span class="task-badge badge-low">⚪ Thấp</span>`
      };

      return `
        <div class="task-card ${isDone ? 'done' : ''}" onclick="PlannerModule.openDrawer('${task.id}')">
          <div class="task-checkbox-area" onclick="event.stopPropagation(); PlannerModule.toggleTaskStatus('${task.id}')">
            <div class="custom-checkbox ${isDone ? 'checked' : ''}">
              ${renderIcon('check', 14, 3)}
            </div>
          </div>

          <div class="task-content-main">
            <div class="task-title">${task.title}</div>
            <div class="task-meta">
              ${proj ? `
                <span style="display:inline-flex; align-items:center; gap:4px; color:${proj.color}; font-weight:600;">
                  <span style="width:7px; height:7px; border-radius:50%; background:${proj.color};"></span>
                  ${proj.title}
                </span>
              ` : ''}

              ${priorityBadges[task.priority] || priorityBadges['medium']}

              ${deadlineInfo ? `
                <span class="badge-deadline ${deadlineInfo.className}">
                  ${renderIcon('clock', 12)}
                  ${deadlineInfo.text}
                </span>
              ` : ''}

              ${subtaskCount > 0 ? `
                <span title="Việc con">${renderIcon('check', 12)} ${subtaskDone}/${subtaskCount}</span>
              ` : ''}

              ${fileCount > 0 ? `
                <span title="File đính kèm">${renderIcon('file', 12)} ${fileCount}</span>
              ` : ''}

              ${linkCount > 0 ? `
                <span title="Liên kết">${renderIcon('link', 12)} ${linkCount}</span>
              ` : ''}
            </div>
          </div>

          <div class="task-actions" onclick="event.stopPropagation()">
            <button class="btn btn-icon btn-secondary" title="Xóa nhiệm vụ" onclick="PlannerModule.deleteTask('${task.id}')">
              ${renderIcon('trash', 14)}
            </button>
          </div>
        </div>
      `;
    }).join('');
  },

  async toggleTaskStatus(taskId) {
    const task = window.appState.tasks.find(t => t.id === taskId);
    if (!task) return;

    task.status = task.status === 'done' ? 'todo' : 'done';
    task.completedAt = task.status === 'done' ? new Date().toISOString() : null;

    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(task)
      });
      this.render();
      if (this.activeTaskId === taskId) {
        this.renderDrawerContent(task);
      }
    } catch (e) {
      console.error('Failed to update task:', e);
    }
  },

  async deleteTask(taskId) {
    if (!confirm('Bạn có chắc chắn muốn xóa nhiệm vụ này?')) return;
    try {
      await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      window.appState.tasks = window.appState.tasks.filter(t => t.id !== taskId);
      if (this.activeTaskId === taskId) this.closeDrawer();
      this.render();
    } catch (e) {
      alert('Lỗi khi xóa: ' + e.message);
    }
  },

  async deleteProject(projId) {
    if (!confirm('Xóa dự án này? (Các nhiệm vụ sẽ được giữ lại ở trạng thái độc lập)')) return;
    try {
      await fetch(`/api/projects/${projId}`, { method: 'DELETE' });
      window.appState.projects = window.appState.projects.filter(p => p.id !== projId);
      if (this.selectedProjectId === projId) this.selectedProjectId = null;
      this.render();
    } catch (e) {
      alert('Lỗi khi xóa dự án: ' + e.message);
    }
  },

  // --- NOTION-STYLE TASK DETAIL DRAWER ---
  openDrawer(taskId) {
    const task = window.appState.tasks.find(t => t.id === taskId);
    if (!task) return;

    this.activeTaskId = taskId;
    this.closeTaskSettings();
    this.renderDrawerContent(task);

    document.getElementById('task-drawer-overlay').classList.add('active');
    document.getElementById('task-drawer').classList.add('active');
  },

  closeDrawer() {
    this.activeTaskId = null;
    this.closeTaskSettings();
    document.getElementById('task-drawer-overlay').classList.remove('active');
    document.getElementById('task-drawer').classList.remove('active');
  },

  renderDrawerContent(task) {
    const projects = window.appState.projects || [];
    const proj = projects.find(p => p.id === task.projectId);
    const deadlineInfo = getDeadlineInfo(task.deadline);

    // Title
    document.getElementById('drawer-task-title').textContent = task.title;

    // Populate Quick Settings Form
    const editTitle = document.getElementById('edit-task-title');
    const editDeadline = document.getElementById('edit-task-deadline');
    const editPriority = document.getElementById('edit-task-priority');
    const editProj = document.getElementById('edit-task-project');

    if (editTitle) editTitle.value = task.title || '';
    if (editDeadline) editDeadline.value = task.deadline ? task.deadline.slice(0, 16) : '';
    if (editPriority) editPriority.value = task.priority || 'medium';
    if (editProj) {
      editProj.innerHTML = '<option value="">(Không chọn - Task độc lập)</option>' +
        projects.map(p => `<option value="${p.id}" ${task.projectId === p.id ? 'selected' : ''}>${p.title}</option>`).join('');
    }

    // Project Name badge
    const projElem = document.getElementById('drawer-proj-badge');
    if (projElem) {
      projElem.innerHTML = proj ? `<span style="color:${proj.color}; font-weight:700;">● ${proj.title}</span>` : 'Độc lập (Không thuộc dự án)';
    }

    // Deadline badge
    const dlElem = document.getElementById('drawer-deadline-badge');
    if (dlElem) {
      dlElem.innerHTML = deadlineInfo ? `
        <span class="badge-deadline ${deadlineInfo.className}">
          ${renderIcon('clock', 13)}
          ${deadlineInfo.text} (${deadlineInfo.fullDate})
        </span>
      ` : '<span style="color:var(--text-tertiary);">Chưa đặt hạn chót</span>';
    }

    // Priority
    const prioElem = document.getElementById('drawer-priority-badge');
    const priorityLabels = {
      'urgent': '🔥 Khẩn cấp',
      'high': '⚡ Ưu tiên cao',
      'medium': '🔷 Trung bình',
      'low': '⚪ Thấp'
    };
    if (prioElem) prioElem.textContent = priorityLabels[task.priority] || 'Trung bình';

    // Details Markdown
    const detailsView = document.getElementById('drawer-details-view');
    const detailsEdit = document.getElementById('drawer-details-edit');
    const detailsText = document.getElementById('drawer-details-textarea');

    if (detailsView && detailsEdit && detailsText) {
      detailsView.innerHTML = task.details ? markdownToHtml(task.details) : '<p style="color:var(--text-tertiary); font-style:italic;">Chưa có nội dung chi tiết. Bấm nút sửa để viết ghi chú kiểu Notion...</p>';
      detailsText.value = task.details || '';
      detailsView.style.display = 'block';
      detailsEdit.style.display = 'none';
    }

    // Subtasks with progress
    this.renderDrawerSubtasks(task);

    // Links
    this.renderDrawerLinks(task);

    // Attachments
    this.renderDrawerAttachments(task);
  },

  renderDrawerSubtasks(task) {
    const list = document.getElementById('drawer-subtasks-list');
    const progressTrack = document.getElementById('drawer-subtasks-progress');
    const progressText = document.getElementById('drawer-subtasks-percent');
    if (!list) return;

    const subtasks = task.subtasks || [];
    const total = subtasks.length;
    const doneCount = subtasks.filter(s => s.done).length;
    const percent = total > 0 ? Math.round((doneCount / total) * 100) : 0;

    if (progressTrack) progressTrack.style.width = `${percent}%`;
    if (progressText) progressText.textContent = `${doneCount}/${total} (${percent}%)`;

    if (total === 0) {
      list.innerHTML = '<p style="font-size:0.82rem; color:var(--text-tertiary); font-style:italic;">Chưa có việc con nào. Nhập vào ô bên dưới và nhấn Enter để thêm.</p>';
      return;
    }

    list.innerHTML = subtasks.map((sub, idx) => `
      <div class="subtask-item ${sub.done ? 'done' : ''}">
        <div class="custom-checkbox ${sub.done ? 'checked' : ''}" onclick="PlannerModule.toggleSubtask(${idx})">
          ${renderIcon('check', 12, 3)}
        </div>
        <span style="flex:1; margin-left:8px;">${sub.text}</span>
        <button class="btn btn-icon btn-secondary" style="padding:2px 6px;" title="Xóa" onclick="PlannerModule.deleteSubtask(${idx})">
          ${renderIcon('x', 12)}
        </button>
      </div>
    `).join('');
  },

  async toggleSubtask(index) {
    const task = window.appState.tasks.find(t => t.id === this.activeTaskId);
    if (!task || !task.subtasks[index]) return;

    task.subtasks[index].done = !task.subtasks[index].done;
    await this.syncTaskUpdate(task);
    this.renderDrawerSubtasks(task);
    this.renderTasks();
  },

  async addDrawerSubtask() {
    const input = document.getElementById('drawer-subtask-input');
    const text = input ? input.value.trim() : '';
    if (!text || !this.activeTaskId) return;

    const task = window.appState.tasks.find(t => t.id === this.activeTaskId);
    if (!task) return;

    if (!task.subtasks) task.subtasks = [];
    task.subtasks.push({
      id: 'sub-' + Date.now(),
      text: text,
      done: false
    });

    input.value = '';
    await this.syncTaskUpdate(task);
    this.renderDrawerSubtasks(task);
    this.renderTasks();
  },

  async deleteSubtask(index) {
    const task = window.appState.tasks.find(t => t.id === this.activeTaskId);
    if (!task || !task.subtasks) return;

    task.subtasks.splice(index, 1);
    await this.syncTaskUpdate(task);
    this.renderDrawerSubtasks(task);
    this.renderTasks();
  },

  renderDrawerLinks(task) {
    const container = document.getElementById('drawer-links-list');
    if (!container) return;

    const links = task.links || [];
    if (links.length === 0) {
      container.innerHTML = '<p style="font-size:0.82rem; color:var(--text-tertiary); font-style:italic;">Chưa có liên kết tài liệu nào.</p>';
      return;
    }

    container.innerHTML = links.map((link, idx) => `
      <div class="link-card">
        <a href="${link.url}" target="_blank" rel="noopener noreferrer" style="flex:1; text-decoration:none; overflow:hidden;">
          <div class="link-card-title">${link.title || link.url}</div>
          <div class="link-card-url">${link.url}</div>
        </a>
        <div style="display:flex; gap:4px; margin-left:8px;">
          <a href="${link.url}" target="_blank" class="btn btn-icon btn-secondary" title="Mở link">
            ${renderIcon('external-link', 14)}
          </a>
          <button class="btn btn-icon btn-secondary" title="Xóa" onclick="PlannerModule.deleteDrawerLink(${idx})">
            ${renderIcon('x', 14)}
          </button>
        </div>
      </div>
    `).join('');
  },

  async addDrawerLink() {
    const titleInput = document.getElementById('drawer-link-title');
    const urlInput = document.getElementById('drawer-link-url');
    const title = titleInput ? titleInput.value.trim() : '';
    let linkUrl = urlInput ? urlInput.value.trim() : '';

    if (!linkUrl || !this.activeTaskId) {
      alert('Vui lòng nhập đường dẫn URL!');
      return;
    }
    if (!linkUrl.startsWith('http://') && !linkUrl.startsWith('https://')) {
      linkUrl = 'https://' + linkUrl;
    }

    const task = window.appState.tasks.find(t => t.id === this.activeTaskId);
    if (!task) return;

    if (!task.links) task.links = [];
    task.links.push({
      id: 'link-' + Date.now(),
      title: title || linkUrl,
      url: linkUrl
    });

    if (titleInput) titleInput.value = '';
    if (urlInput) urlInput.value = '';

    await this.syncTaskUpdate(task);
    this.renderDrawerLinks(task);
    this.renderTasks();
  },

  async deleteDrawerLink(index) {
    const task = window.appState.tasks.find(t => t.id === this.activeTaskId);
    if (!task || !task.links) return;

    task.links.splice(index, 1);
    await this.syncTaskUpdate(task);
    this.renderDrawerLinks(task);
    this.renderTasks();
  },

  renderDrawerAttachments(task) {
    const container = document.getElementById('drawer-attachments-list');
    if (!container) return;

    const files = task.attachments || [];
    if (files.length === 0) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = files.map((file, idx) => {
      const sizeKb = Math.round((file.size || 0) / 1024);
      return `
        <div class="file-item">
          <div style="display:flex; align-items:center; gap:8px; overflow:hidden;">
            ${renderIcon('file', 16)}
            <div style="overflow:hidden;">
              <div style="font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${file.originalName}</div>
              <div style="font-size:0.75rem; color:var(--text-tertiary);">${sizeKb} KB</div>
            </div>
          </div>
          <div style="display:flex; gap:6px;">
            <a href="${file.url}" download="${file.originalName}" class="btn btn-icon btn-secondary" title="Tải về">
              ${renderIcon('download', 14)}
            </a>
            <button class="btn btn-icon btn-secondary" title="Xóa file" onclick="PlannerModule.deleteDrawerFile(${idx})">
              ${renderIcon('trash', 14)}
            </button>
          </div>
        </div>
      `;
    }).join('');
  },

  async handleFileUpload(files) {
    if (!files || !files.length || !this.activeTaskId) return;

    const task = window.appState.tasks.find(t => t.id === this.activeTaskId);
    if (!task) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const base64 = await this.fileToBase64(file);
        const res = await fetch('/api/upload-task-file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: file.name,
            mimeType: file.type,
            fileData: base64
          })
        });
        const result = await res.json();
        if (result.success && result.attachment) {
          if (!task.attachments) task.attachments = [];
          task.attachments.push(result.attachment);
        }
      } catch (err) {
        alert('Lỗi upload file: ' + err.message);
      }
    }

    await this.syncTaskUpdate(task);
    this.renderDrawerAttachments(task);
    this.renderTasks();
  },

  async deleteDrawerFile(index) {
    const task = window.appState.tasks.find(t => t.id === this.activeTaskId);
    if (!task || !task.attachments) return;

    task.attachments.splice(index, 1);
    await this.syncTaskUpdate(task);
    this.renderDrawerAttachments(task);
    this.renderTasks();
  },

  fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },

  toggleDetailsEdit() {
    const view = document.getElementById('drawer-details-view');
    const edit = document.getElementById('drawer-details-edit');
    if (!view || !edit) return;

    if (edit.style.display === 'none') {
      edit.style.display = 'block';
      view.style.display = 'none';
    } else {
      edit.style.display = 'none';
      view.style.display = 'block';
    }
  },

  async saveDetailsText() {
    const task = window.appState.tasks.find(t => t.id === this.activeTaskId);
    if (!task) return;

    const text = document.getElementById('drawer-details-textarea')?.value || '';
    task.details = text;

    await this.syncTaskUpdate(task);

    const view = document.getElementById('drawer-details-view');
    const edit = document.getElementById('drawer-details-edit');
    if (view && edit) {
      view.innerHTML = markdownToHtml(text);
      edit.style.display = 'none';
      view.style.display = 'block';
    }
  },

  toggleTaskSettings() {
    const panel = document.getElementById('drawer-task-settings-panel');
    if (!panel) return;

    if (panel.style.display === 'none' || !panel.style.display) {
      const task = window.appState.tasks.find(t => t.id === this.activeTaskId);
      if (task) {
        const editTitle = document.getElementById('edit-task-title');
        const editDeadline = document.getElementById('edit-task-deadline');
        const editPriority = document.getElementById('edit-task-priority');
        const editProj = document.getElementById('edit-task-project');
        const projects = window.appState.projects || [];

        if (editTitle) editTitle.value = task.title || '';
        if (editDeadline) editDeadline.value = task.deadline ? task.deadline.slice(0, 16) : '';
        if (editPriority) editPriority.value = task.priority || 'medium';
        if (editProj) {
          editProj.innerHTML = '<option value="">(Không chọn - Task độc lập)</option>' +
            projects.map(p => `<option value="${p.id}" ${task.projectId === p.id ? 'selected' : ''}>${p.title}</option>`).join('');
        }
      }
      panel.style.display = 'block';
      document.getElementById('edit-task-title')?.focus();
    } else {
      panel.style.display = 'none';
    }
  },

  closeTaskSettings() {
    const panel = document.getElementById('drawer-task-settings-panel');
    if (panel) panel.style.display = 'none';
  },

  async saveTaskSettings() {
    if (!this.activeTaskId) return;
    const task = window.appState.tasks.find(t => t.id === this.activeTaskId);
    if (!task) return;

    const titleInput = document.getElementById('edit-task-title');
    const deadlineInput = document.getElementById('edit-task-deadline');
    const priorityInput = document.getElementById('edit-task-priority');
    const projectInput = document.getElementById('edit-task-project');

    const newTitle = titleInput ? titleInput.value.trim() : '';
    if (!newTitle) {
      alert('Vui lòng nhập tên nhiệm vụ!');
      titleInput?.focus();
      return;
    }

    task.title = newTitle;
    task.deadline = deadlineInput && deadlineInput.value ? deadlineInput.value : null;
    task.priority = priorityInput ? priorityInput.value : 'medium';
    task.projectId = projectInput && projectInput.value ? projectInput.value : null;

    try {
      await this.syncTaskUpdate(task);
      this.closeTaskSettings();
      this.renderDrawerContent(task);
      this.render();
    } catch (err) {
      alert('Lỗi khi lưu thông tin nhiệm vụ: ' + err.message);
    }
  },

  async syncTaskUpdate(task) {
    try {
      await fetch(`/api/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(task)
      });
    } catch (e) {
      console.error('Error syncing task update:', e);
    }
  },

  // Modals for Task and Project creation
  openTaskModal() {
    const modal = document.getElementById('modal-new-task');
    if (!modal) return;

    // Populate project options
    const select = document.getElementById('task-project-select');
    if (select) {
      const projects = window.appState.projects || [];
      select.innerHTML = '<option value="">(Không chọn - Task độc lập)</option>' +
        projects.map(p => `<option value="${p.id}" ${this.selectedProjectId === p.id ? 'selected' : ''}>${p.title}</option>`).join('');
    }

    // Default deadline to today + 2 hours or tomorrow
    const dlInput = document.getElementById('task-deadline-input');
    if (dlInput) {
      const target = new Date();
      target.setHours(target.getHours() + 4);
      target.setMinutes(0);
      dlInput.value = target.toISOString().slice(0, 16);
    }

    modal.classList.add('active');
  },

  openProjectModal() {
    const modal = document.getElementById('modal-new-project');
    if (modal) modal.classList.add('active');
  }
};

window.PlannerModule = PlannerModule;

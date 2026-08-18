/**
 * Cloudflare R2 File Manager - Client Application
 * Modular, Desktop-Class State & UI Engine
 */

(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Global Application State
  // ---------------------------------------------------------------------------
  const state = {
    currentPrefix: '',
    breadcrumbs: [],
    folders: [],
    files: [],
    selectedKeys: new Set(),
    viewMode: localStorage.getItem('r2_view_mode') || 'grid', // 'grid' | 'table'
    currentFilter: 'all',
    sortKey: localStorage.getItem('r2_sort_key') || 'name', // 'name' | 'size' | 'date' | 'type'
    sortOrder: localStorage.getItem('r2_sort_order') || 'asc', // 'asc' | 'desc'
    searchQuery: '',
    stats: null,
    activeInspectorFile: null,
    activePreviewFile: null,
    previewZoom: 1,
    previewRotation: 0,
    uploadQueue: [],
    activeUploadsCount: 0,
    maxConcurrentUploads: 2,
  };

  // ---------------------------------------------------------------------------
  // DOM Element Selectors
  // ---------------------------------------------------------------------------
  const dom = {
    // Header & Stats
    bucketNameBadge: document.getElementById('bucketNameBadge'),
    storageFilesCount: document.getElementById('storageFilesCount'),
    storageTotalSize: document.getElementById('storageTotalSize'),
    searchInput: document.getElementById('searchInput'),
    searchClearBtn: document.getElementById('searchClearBtn'),
    refreshBtn: document.getElementById('refreshBtn'),
    logoutBtn: document.getElementById('logoutBtn'),

    // Diagnostic Alert Banner
    diagnosticBanner: document.getElementById('diagnosticBanner'),
    diagnosticTitle: document.getElementById('diagnosticTitle'),
    diagnosticMessage: document.getElementById('diagnosticMessage'),
    diagnosticDismissBtn: document.getElementById('diagnosticDismissBtn'),

    // Breadcrumbs & Toolbar
    breadcrumbsContainer: document.getElementById('breadcrumbsContainer'),
    newFolderBtn: document.getElementById('newFolderBtn'),
    uploadFilesBtn: document.getElementById('uploadFilesBtn'),
    uploadFolderBtn: document.getElementById('uploadFolderBtn'),
    fileInput: document.getElementById('fileInput'),
    folderInput: document.getElementById('folderInput'),

    // Batch Actions Toolbar
    batchToolbar: document.getElementById('batchToolbar'),
    batchCountText: document.getElementById('batchCountText'),
    batchDownloadBtn: document.getElementById('batchDownloadBtn'),
    batchMoveBtn: document.getElementById('batchMoveBtn'),
    batchDeleteBtn: document.getElementById('batchDeleteBtn'),
    batchClearBtn: document.getElementById('batchClearBtn'),

    // Filter & View Controls
    filterChips: document.querySelectorAll('.filter-chip'),
    viewToggleGrid: document.getElementById('viewToggleGrid'),
    viewToggleTable: document.getElementById('viewToggleTable'),
    sortSelect: document.getElementById('sortSelect'),

    // Main Workspace
    foldersSection: document.getElementById('foldersSection'),
    foldersGrid: document.getElementById('foldersGrid'),
    filesSectionTitle: document.getElementById('filesSectionTitle'),
    filesContainer: document.getElementById('filesContainer'),
    emptyState: document.getElementById('emptyState'),
    emptyStateTitle: document.getElementById('emptyStateTitle'),
    emptyStateDesc: document.getElementById('emptyStateDesc'),

    // Drag & Drop
    dropzoneOverlay: document.getElementById('dropzoneOverlay'),

    // Upload Drawer
    uploadDrawer: document.getElementById('uploadDrawer'),
    uploadDrawerTitle: document.getElementById('uploadDrawerTitle'),
    uploadDrawerMinimizeBtn: document.getElementById('uploadDrawerMinimizeBtn'),
    uploadDrawerCloseBtn: document.getElementById('uploadDrawerCloseBtn'),
    uploadQueueList: document.getElementById('uploadQueueList'),

    // Preview Modal
    previewModal: document.getElementById('previewModal'),
    previewFilename: document.getElementById('previewFilename'),
    previewBody: document.getElementById('previewBody'),
    previewCloseBtn: document.getElementById('previewCloseBtn'),
    previewDownloadBtn: document.getElementById('previewDownloadBtn'),
    previewDirectBtn: document.getElementById('previewDirectBtn'),
    previewZoomInBtn: document.getElementById('previewZoomInBtn'),
    previewZoomOutBtn: document.getElementById('previewZoomOutBtn'),
    previewRotateBtn: document.getElementById('previewRotateBtn'),
    previewZoomControls: document.getElementById('previewZoomControls'),

    // Inspector Drawer
    inspectorBackdrop: document.getElementById('inspectorBackdrop'),
    inspectorDrawer: document.getElementById('inspectorDrawer'),
    inspectorCloseBtn: document.getElementById('inspectorCloseBtn'),
    inspectorPreview: document.getElementById('inspectorPreview'),
    inspectorFileName: document.getElementById('inspectorFileName'),
    inspectorFileSize: document.getElementById('inspectorFileSize'),
    inspectorMimeType: document.getElementById('inspectorMimeType'),
    inspectorLastModified: document.getElementById('inspectorLastModified'),
    inspectorETag: document.getElementById('inspectorETag'),
    inspectorDirectUrlRow: document.getElementById('inspectorDirectUrlRow'),
    inspectorDirectUrl: document.getElementById('inspectorDirectUrl'),
    inspectorCopyDirectBtn: document.getElementById('inspectorCopyDirectBtn'),
    presignDurationSelect: document.getElementById('presignDurationSelect'),
    inspectorGeneratePresignBtn: document.getElementById('inspectorGeneratePresignBtn'),
    inspectorPresignResult: document.getElementById('inspectorPresignResult'),
    inspectorPresignUrl: document.getElementById('inspectorPresignUrl'),
    inspectorCopyPresignBtn: document.getElementById('inspectorCopyPresignBtn'),
    inspectorDownloadBtn: document.getElementById('inspectorDownloadBtn'),
    inspectorRenameBtn: document.getElementById('inspectorRenameBtn'),
    inspectorDeleteBtn: document.getElementById('inspectorDeleteBtn'),

    // Dialog Modals
    newFolderModal: document.getElementById('newFolderModal'),
    newFolderNameInput: document.getElementById('newFolderNameInput'),
    newFolderCancelBtn: document.getElementById('newFolderCancelBtn'),
    newFolderConfirmBtn: document.getElementById('newFolderConfirmBtn'),

    renameModal: document.getElementById('renameModal'),
    renameInput: document.getElementById('renameInput'),
    renameCancelBtn: document.getElementById('renameCancelBtn'),
    renameConfirmBtn: document.getElementById('renameConfirmBtn'),

    moveModal: document.getElementById('moveModal'),
    moveDestinationSelect: document.getElementById('moveDestinationSelect'),
    moveCancelBtn: document.getElementById('moveCancelBtn'),
    moveConfirmBtn: document.getElementById('moveConfirmBtn'),

    confirmDeleteModal: document.getElementById('confirmDeleteModal'),
    confirmDeleteMessage: document.getElementById('confirmDeleteMessage'),
    confirmDeleteCancelBtn: document.getElementById('confirmDeleteCancelBtn'),
    confirmDeleteConfirmBtn: document.getElementById('confirmDeleteConfirmBtn'),

    // Toast Container
    toastContainer: document.getElementById('toastContainer'),
  };

  // ---------------------------------------------------------------------------
  // Helper Utilities
  // ---------------------------------------------------------------------------
  function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  function formatDate(isoString) {
    if (!isoString) return '-';
    const date = new Date(isoString);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function getFileExtension(filename) {
    const parts = (filename || '').split('.');
    return parts.length > 1 ? parts.pop().toLowerCase() : '';
  }

  function getFileCategory(filename, mimeType = '') {
    const ext = getFileExtension(filename);
    const mime = (mimeType || '').toLowerCase();

    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'avif', 'ico'].includes(ext) || mime.startsWith('image/')) {
      return 'image';
    }
    if (['mp4', 'webm', 'mov', 'mkv', 'avi', 'm4v', 'ogv'].includes(ext) || mime.startsWith('video/')) {
      return 'video';
    }
    if (['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'].includes(ext) || mime.startsWith('audio/')) {
      return 'audio';
    }
    if (['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv', 'rtf'].includes(ext) || mime.includes('pdf') || mime.includes('document') || mime.includes('sheet')) {
      return 'document';
    }
    if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'iso'].includes(ext) || mime.includes('zip') || mime.includes('tar') || mime.includes('compressed')) {
      return 'archive';
    }
    if (['js', 'ts', 'jsx', 'tsx', 'html', 'css', 'json', 'py', 'go', 'rs', 'c', 'cpp', 'java', 'sql', 'sh', 'yaml', 'yml', 'xml', 'md', 'env'].includes(ext) || mime.includes('javascript') || mime.includes('json') || mime.includes('text/')) {
      return 'code';
    }
    return 'other';
  }

  function showToast(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let icon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="8.01"></line></svg>`;
    if (type === 'success') {
      icon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`;
    } else if (type === 'error') {
      icon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;
    }

    toast.innerHTML = `${icon}<span>${escapeHtml(message)}</span>`;
    dom.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.2s ease';
      setTimeout(() => toast.remove(), 200);
    }, duration);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function getRawFileUrl(key, download = false) {
    return `/api/files/raw?key=${encodeURIComponent(key)}${download ? '&download=1' : ''}`;
  }

  function getFileIconSvg(category, ext) {
    switch (category) {
      case 'image':
        return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>`;
      case 'video':
        return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>`;
      case 'audio':
        return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>`;
      case 'document':
        return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>`;
      case 'archive':
        return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 8 21 21 3 21 3 8"></polyline><rect x="1" y="3" width="22" height="5"></rect><line x1="10" y1="12" x2="14" y2="12"></line></svg>`;
      case 'code':
        return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>`;
      default:
        return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>`;
    }
  }

  // ---------------------------------------------------------------------------
  // Diagnostic Banner Helpers
  // ---------------------------------------------------------------------------
  function showDiagnosticBanner(title, message) {
    if (!dom.diagnosticBanner) return;
    dom.diagnosticTitle.textContent = title || 'Configuration Notice';
    dom.diagnosticMessage.textContent = message || 'Please check your Cloudflare R2 credentials in the .env file.';
    dom.diagnosticBanner.style.display = 'flex';
  }

  function hideDiagnosticBanner() {
    if (!dom.diagnosticBanner) return;
    dom.diagnosticBanner.style.display = 'none';
  }

  if (dom.diagnosticDismissBtn) {
    dom.diagnosticDismissBtn.addEventListener('click', hideDiagnosticBanner);
  }

  async function checkDiagnostics() {
    try {
      const res = await fetch('/api/diagnostics');
      const data = await res.json();
      if (!data.healthy) {
        showDiagnosticBanner(data.title, data.solution);
      } else {
        hideDiagnosticBanner();
      }
    } catch (err) {
      console.warn('Diagnostics check error:', err);
    }
  }

  // ---------------------------------------------------------------------------
  // Data Fetching & API Handlers
  // ---------------------------------------------------------------------------
  async function fetchStats() {
    try {
      const res = await fetch('/api/stats');
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        if (errData.diagnosticTitle) {
          showDiagnosticBanner(errData.diagnosticTitle, errData.message);
        }
        return;
      }
      const data = await res.json();
      if (data.success && data.stats) {
        state.stats = data.stats;
        dom.bucketNameBadge.textContent = `${data.stats.bucketName} (${data.stats.jurisdiction})`;
        dom.storageFilesCount.textContent = `${data.stats.totalFiles.toLocaleString()} files`;
        dom.storageTotalSize.textContent = formatBytes(data.stats.totalSize);
      }
    } catch (err) {
      console.warn('Failed to load bucket stats:', err);
    }
  }

  async function fetchFiles(prefix = state.currentPrefix, search = '') {
    state.selectedKeys.clear();
    updateBatchToolbar();
    renderLoadingSkeleton();

    try {
      let url = `/api/files?prefix=${encodeURIComponent(prefix)}`;
      if (search) {
        url = `/api/files?search=${encodeURIComponent(search)}`;
      }

      const res = await fetch(url);
      if (res.status === 401) {
        window.location.href = '/login.html';
        return;
      }

      const data = await res.json();
      if (!data.success) {
        if (data.diagnosticTitle) {
          showDiagnosticBanner(data.diagnosticTitle, data.message);
        }
        showToast(data.message || 'Failed to fetch files.', 'error');
        renderErrorState(data.message || 'Failed to load directory.');
        return;
      }

      state.currentPrefix = data.currentPrefix || '';
      state.breadcrumbs = data.breadcrumbs || [];
      state.folders = data.folders || [];
      state.files = data.files || [];

      // Update URL hash
      if (!search) {
        window.location.hash = state.currentPrefix ? `#/${state.currentPrefix}` : '';
      }

      renderBreadcrumbs();
      renderContent();
    } catch (err) {
      console.error('Fetch files error:', err);
      showToast('Error loading directory: ' + err.message, 'error');
      renderErrorState(err.message);
    }
  }

  // ---------------------------------------------------------------------------
  // Rendering System
  // ---------------------------------------------------------------------------
  function renderBreadcrumbs() {
    if (state.searchQuery) {
      dom.breadcrumbsContainer.innerHTML = `
        <span class="breadcrumb-item active">
          Search results for "${escapeHtml(state.searchQuery)}"
        </span>
      `;
      return;
    }

    dom.breadcrumbsContainer.innerHTML = state.breadcrumbs
      .map((crumb, idx) => {
        const isLast = idx === state.breadcrumbs.length - 1;
        const icon = idx === 0 ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>` : '';
        return `
          <a class="breadcrumb-item ${isLast ? 'active' : ''}" data-prefix="${escapeHtml(crumb.prefix)}">
            ${icon}
            <span>${escapeHtml(crumb.name)}</span>
          </a>
          ${!isLast ? '<span class="breadcrumb-separator">/</span>' : ''}
        `;
      })
      .join('');

    // Attach click listeners
    dom.breadcrumbsContainer.querySelectorAll('.breadcrumb-item:not(.active)').forEach((el) => {
      el.addEventListener('click', () => {
        const prefix = el.getAttribute('data-prefix');
        state.searchQuery = '';
        dom.searchInput.value = '';
        dom.searchClearBtn.style.display = 'none';
        fetchFiles(prefix);
      });
    });
  }

  function getFilteredAndSortedFiles() {
    let list = [...state.files];

    // Filter by Category Chip
    if (state.currentFilter !== 'all') {
      list = list.filter((file) => {
        const category = getFileCategory(file.name, file.mimeType);
        return category === state.currentFilter;
      });
    }

    // Sort Files
    list.sort((a, b) => {
      let valA, valB;
      switch (state.sortKey) {
        case 'size':
          valA = a.size || 0;
          valB = b.size || 0;
          break;
        case 'date':
          valA = new Date(a.lastModified || 0).getTime();
          valB = new Date(b.lastModified || 0).getTime();
          break;
        case 'type':
          valA = getFileExtension(a.name);
          valB = getFileExtension(b.name);
          break;
        case 'name':
        default:
          valA = a.name.toLowerCase();
          valB = b.name.toLowerCase();
          break;
      }

      if (valA < valB) return state.sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return state.sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return list;
  }

  function renderContent() {
    const filteredFiles = getFilteredAndSortedFiles();
    const hasFolders = state.folders.length > 0;
    const hasFiles = filteredFiles.length > 0;

    // Render Folders
    if (hasFolders && !state.searchQuery) {
      dom.foldersSection.style.display = 'block';
      dom.foldersGrid.innerHTML = state.folders
        .map((folder) => {
          return `
            <div class="folder-card" data-prefix="${escapeHtml(folder.prefix)}">
              <div class="folder-left">
                <div class="folder-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z"></path></svg>
                </div>
                <span class="folder-name" title="${escapeHtml(folder.name)}">${escapeHtml(folder.name)}</span>
              </div>
              <button class="folder-menu-btn" title="Folder Options" data-folder-action="delete" data-prefix="${escapeHtml(folder.prefix)}" data-name="${escapeHtml(folder.name)}">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              </button>
            </div>
          `;
        })
        .join('');

      // Folder card click listeners
      dom.foldersGrid.querySelectorAll('.folder-card').forEach((card) => {
        card.addEventListener('click', (e) => {
          if (e.target.closest('.folder-menu-btn')) return;
          const prefix = card.getAttribute('data-prefix');
          fetchFiles(prefix);
        });
      });

      // Folder delete button
      dom.foldersGrid.querySelectorAll('.folder-menu-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const prefix = btn.getAttribute('data-prefix');
          const name = btn.getAttribute('data-name');
          openConfirmDeleteModal({
            title: `Delete Folder "${name}"?`,
            message: `This will permanently delete the folder "${name}" and all objects inside it. This action cannot be undone.`,
            onConfirm: async () => {
              try {
                const res = await fetch(`/api/folders?prefix=${encodeURIComponent(prefix)}`, { method: 'DELETE' });
                const data = await res.json();
                if (data.success) {
                  showToast(data.message, 'success');
                  fetchFiles();
                  fetchStats();
                } else {
                  showToast(data.message, 'error');
                }
              } catch (err) {
                showToast('Error: ' + err.message, 'error');
              }
            },
          });
        });
      });
    } else {
      dom.foldersSection.style.display = 'none';
      dom.foldersGrid.innerHTML = '';
    }

    // Render Files or Empty State
    if (!hasFolders && !hasFiles) {
      dom.filesContainer.innerHTML = '';
      dom.emptyState.style.display = 'flex';
      dom.filesSectionTitle.style.display = 'none';
      if (state.searchQuery) {
        dom.emptyStateTitle.textContent = 'No matching files found';
        dom.emptyStateDesc.textContent = `No files in the bucket matched "${state.searchQuery}". Try a different keyword.`;
      } else {
        dom.emptyStateTitle.textContent = 'This folder is empty';
        dom.emptyStateDesc.textContent = 'Drag & drop files here or click "Upload Files" to get started.';
      }
      return;
    }

    dom.emptyState.style.display = 'none';
    dom.filesSectionTitle.style.display = 'flex';

    if (state.viewMode === 'grid') {
      renderGridView(filteredFiles);
    } else {
      renderTableView(filteredFiles);
    }
  }

  function renderGridView(files) {
    dom.filesContainer.innerHTML = `
      <div class="files-grid">
        ${files
          .map((file) => {
            const isSelected = state.selectedKeys.has(file.key);
            const category = getFileCategory(file.name, file.mimeType);
            const ext = getFileExtension(file.name);
            const isImage = category === 'image';
            const rawUrl = getRawFileUrl(file.key);

            let thumbnailContent = '';
            if (isImage) {
              thumbnailContent = `<img src="${rawUrl}" class="file-thumbnail-img" alt="${escapeHtml(file.name)}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'file-icon-placeholder\\'>${getFileIconSvg(category, ext)}<span class=\\'file-badge-ext\\'>${ext}</span></div>'">`;
            } else {
              thumbnailContent = `
                <div class="file-icon-placeholder">
                  ${getFileIconSvg(category, ext)}
                  <span class="file-badge-ext">${ext || 'FILE'}</span>
                </div>
              `;
            }

            return `
              <div class="file-card ${isSelected ? 'selected' : ''}" data-key="${escapeHtml(file.key)}">
                <input type="checkbox" class="file-card-checkbox" ${isSelected ? 'checked' : ''} data-key="${escapeHtml(file.key)}">
                
                <div class="file-card-actions">
                  <button class="action-icon-btn" title="Download" data-action="download" data-key="${escapeHtml(file.key)}">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                  </button>
                  <button class="action-icon-btn" title="Details / Share" data-action="inspect" data-key="${escapeHtml(file.key)}">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="8.01"></line></svg>
                  </button>
                </div>

                <div class="file-thumbnail-box">
                  ${thumbnailContent}
                </div>

                <div class="file-card-info">
                  <div class="file-card-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</div>
                  <div class="file-card-meta">
                    <span>${formatBytes(file.size)}</span>
                    <span>${formatDate(file.lastModified).split(',')[0]}</span>
                  </div>
                </div>
              </div>
            `;
          })
          .join('')}
      </div>
    `;

    attachFileEventListeners();
  }

  function renderTableView(files) {
    dom.filesContainer.innerHTML = `
      <div class="table-container">
        <table class="file-table">
          <thead>
            <tr>
              <th style="width: 40px;">
                <input type="checkbox" id="selectAllCheckbox" ${state.selectedKeys.size > 0 && state.selectedKeys.size === files.length ? 'checked' : ''}>
              </th>
              <th data-sort="name">Name</th>
              <th data-sort="size" style="width: 110px;">Size</th>
              <th data-sort="type" style="width: 110px;">Type</th>
              <th data-sort="date" style="width: 170px;">Last Modified</th>
              <th style="width: 140px; text-align: right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${files
              .map((file) => {
                const isSelected = state.selectedKeys.has(file.key);
                const category = getFileCategory(file.name, file.mimeType);
                const ext = getFileExtension(file.name);

                return `
                  <tr class="${isSelected ? 'selected' : ''}" data-key="${escapeHtml(file.key)}">
                    <td>
                      <input type="checkbox" class="file-table-checkbox" ${isSelected ? 'checked' : ''} data-key="${escapeHtml(file.key)}">
                    </td>
                    <td>
                      <div class="table-filename-cell">
                        <span class="table-icon">${getFileIconSvg(category, ext)}</span>
                        <span title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</span>
                      </div>
                    </td>
                    <td>${formatBytes(file.size)}</td>
                    <td><span class="file-badge-ext">${ext || 'FILE'}</span></td>
                    <td>${formatDate(file.lastModified)}</td>
                    <td>
                      <div class="table-actions-cell">
                        <button class="btn btn-ghost btn-sm" title="Preview" data-action="preview" data-key="${escapeHtml(file.key)}">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                        </button>
                        <button class="btn btn-ghost btn-sm" title="Details / Share" data-action="inspect" data-key="${escapeHtml(file.key)}">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="8.01"></line></svg>
                        </button>
                        <button class="btn btn-ghost btn-sm" title="Download" data-action="download" data-key="${escapeHtml(file.key)}">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                `;
              })
              .join('')}
          </tbody>
        </table>
      </div>
    `;

    // Select all checkbox
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    if (selectAllCheckbox) {
      selectAllCheckbox.addEventListener('change', (e) => {
        if (e.target.checked) {
          files.forEach((f) => state.selectedKeys.add(f.key));
        } else {
          state.selectedKeys.clear();
        }
        updateBatchToolbar();
        renderContent();
      });
    }

    // Sort column headers
    dom.filesContainer.querySelectorAll('th[data-sort]').forEach((th) => {
      th.addEventListener('click', () => {
        const sortType = th.getAttribute('data-sort');
        if (state.sortKey === sortType) {
          state.sortOrder = state.sortOrder === 'asc' ? 'desc' : 'asc';
        } else {
          state.sortKey = sortType;
          state.sortOrder = 'asc';
        }
        localStorage.setItem('r2_sort_key', state.sortKey);
        localStorage.setItem('r2_sort_order', state.sortOrder);
        renderContent();
      });
    });

    attachFileEventListeners();
  }

  function attachFileEventListeners() {
    // Checkbox toggles
    dom.filesContainer.querySelectorAll('input[type="checkbox"][data-key]').forEach((checkbox) => {
      checkbox.addEventListener('click', (e) => {
        e.stopPropagation();
        const key = checkbox.getAttribute('data-key');
        if (checkbox.checked) {
          state.selectedKeys.add(key);
        } else {
          state.selectedKeys.delete(key);
        }
        updateBatchToolbar();
        updateSelectionStyles();
      });
    });

    // Row / Card item clicks
    dom.filesContainer.querySelectorAll('[data-key]').forEach((item) => {
      item.addEventListener('click', (e) => {
        if (e.target.closest('button') || e.target.closest('input[type="checkbox"]')) return;
        const key = item.getAttribute('data-key');
        const file = state.files.find((f) => f.key === key);
        if (file) {
          openPreviewModal(file);
        }
      });
    });

    // Action buttons (Download, Inspect, Preview)
    dom.filesContainer.querySelectorAll('button[data-action]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = btn.getAttribute('data-action');
        const key = btn.getAttribute('data-key');
        const file = state.files.find((f) => f.key === key);
        if (!file) return;

        if (action === 'download') {
          window.location.href = getRawFileUrl(file.key, true);
        } else if (action === 'inspect') {
          openInspectorDrawer(file);
        } else if (action === 'preview') {
          openPreviewModal(file);
        }
      });
    });
  }

  function updateSelectionStyles() {
    dom.filesContainer.querySelectorAll('[data-key]').forEach((el) => {
      const key = el.getAttribute('data-key');
      const isSelected = state.selectedKeys.has(key);
      el.classList.toggle('selected', isSelected);
      const cb = el.querySelector('input[type="checkbox"]');
      if (cb) cb.checked = isSelected;
    });
  }

  function updateBatchToolbar() {
    const count = state.selectedKeys.size;
    if (count > 0) {
      dom.batchToolbar.style.display = 'flex';
      dom.batchCountText.textContent = `${count} selected`;
    } else {
      dom.batchToolbar.style.display = 'none';
    }
  }

  function renderLoadingSkeleton() {
    dom.filesContainer.innerHTML = `
      <div style="padding: 40px; text-align: center; color: var(--text-muted);">
        <svg class="dropzone-icon" style="width: 32px; height: 32px; margin-bottom: 8px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg>
        <p>Loading files and folders...</p>
      </div>
    `;
  }

  function renderErrorState(message) {
    dom.filesContainer.innerHTML = `
      <div class="empty-state">
        <svg class="empty-state-icon" style="color: var(--accent-danger);" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12" y2="16.01"></line></svg>
        <div class="empty-state-title">Failed to load files</div>
        <div class="empty-state-desc">${escapeHtml(message)}</div>
        <button class="btn btn-secondary btn-sm" onclick="location.reload()">Retry</button>
      </div>
    `;
  }

  // ---------------------------------------------------------------------------
  // Universal File Preview Modal
  // ---------------------------------------------------------------------------
  async function openPreviewModal(file) {
    state.activePreviewFile = file;
    state.previewZoom = 1;
    state.previewRotation = 0;

    dom.previewFilename.textContent = file.name;
    dom.previewDownloadBtn.onclick = () => {
      window.location.href = getRawFileUrl(file.key, true);
    };

    if (file.directUrl) {
      dom.previewDirectBtn.style.display = 'inline-flex';
      dom.previewDirectBtn.onclick = () => {
        navigator.clipboard.writeText(file.directUrl);
        showToast('Public link copied to clipboard!', 'success');
      };
    } else {
      dom.previewDirectBtn.style.display = 'none';
    }

    const category = getFileCategory(file.name, file.mimeType);
    const rawUrl = getRawFileUrl(file.key);

    dom.previewZoomControls.style.display = category === 'image' ? 'flex' : 'none';
    dom.previewBody.innerHTML = '<div style="color: var(--text-muted);">Loading preview...</div>';
    dom.previewModal.classList.add('open');

    try {
      if (category === 'image') {
        dom.previewBody.innerHTML = `
          <img id="previewMediaImg" src="${rawUrl}" class="preview-media-img" alt="${escapeHtml(file.name)}">
        `;
      } else if (category === 'video') {
        dom.previewBody.innerHTML = `
          <video class="preview-media-video" controls autoplay>
            <source src="${rawUrl}" type="${file.mimeType || 'video/mp4'}">
            Your browser does not support the video tag.
          </video>
        `;
      } else if (category === 'audio') {
        dom.previewBody.innerHTML = `
          <audio class="preview-media-audio" controls autoplay>
            <source src="${rawUrl}" type="${file.mimeType || 'audio/mpeg'}">
            Your browser does not support the audio tag.
          </audio>
        `;
      } else if (file.name.toLowerCase().endsWith('.pdf') || (file.mimeType && file.mimeType.includes('pdf'))) {
        dom.previewBody.innerHTML = `
          <iframe class="preview-iframe" src="${rawUrl}"></iframe>
        `;
      } else if (category === 'code' || category === 'document') {
        // Text / Code streaming
        const res = await fetch(rawUrl);
        if (!res.ok) throw new Error('Could not fetch file content');
        const textContent = await res.text();

        dom.previewBody.innerHTML = `
          <div style="width: 100%; height: 100%; display: flex; flex-direction: column; gap: 8px;">
            <div style="display: flex; justify-content: flex-end;">
              <button class="btn btn-secondary btn-sm" id="copyCodeBtn">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                Copy Text
              </button>
            </div>
            <pre class="preview-code-block"><code>${escapeHtml(textContent)}</code></pre>
          </div>
        `;

        document.getElementById('copyCodeBtn')?.addEventListener('click', () => {
          navigator.clipboard.writeText(textContent);
          showToast('Text copied to clipboard!', 'success');
        });
      } else {
        dom.previewBody.innerHTML = `
          <div class="empty-state">
            ${getFileIconSvg(category, getFileExtension(file.name))}
            <div class="empty-state-title">No direct preview available</div>
            <div class="empty-state-desc">This file format (${file.mimeType || 'binary'}) cannot be displayed inline.</div>
            <button class="btn btn-primary btn-sm" onclick="window.location.href='${rawUrl}&download=1'">
              Download File (${formatBytes(file.size)})
            </button>
          </div>
        `;
      }
    } catch (err) {
      dom.previewBody.innerHTML = `
        <div style="color: var(--accent-danger);">
          Failed to load preview: ${escapeHtml(err.message)}
        </div>
      `;
    }
  }

  function closePreviewModal() {
    dom.previewModal.classList.remove('open');
    dom.previewBody.innerHTML = '';
    state.activePreviewFile = null;
  }

  function updateImageTransforms() {
    const img = document.getElementById('previewMediaImg');
    if (img) {
      img.style.transform = `scale(${state.previewZoom}) rotate(${state.previewRotation}deg)`;
    }
  }

  dom.previewZoomInBtn.addEventListener('click', () => {
    state.previewZoom = Math.min(state.previewZoom + 0.25, 3);
    updateImageTransforms();
  });

  dom.previewZoomOutBtn.addEventListener('click', () => {
    state.previewZoom = Math.max(state.previewZoom - 0.25, 0.5);
    updateImageTransforms();
  });

  dom.previewRotateBtn.addEventListener('click', () => {
    state.previewRotation = (state.previewRotation + 90) % 360;
    updateImageTransforms();
  });

  dom.previewCloseBtn.addEventListener('click', closePreviewModal);
  dom.previewModal.addEventListener('click', (e) => {
    if (e.target === dom.previewModal) closePreviewModal();
  });

  // ---------------------------------------------------------------------------
  // File Inspector Drawer
  // ---------------------------------------------------------------------------
  function openInspectorDrawer(file) {
    state.activeInspectorFile = file;
    const category = getFileCategory(file.name, file.mimeType);
    const rawUrl = getRawFileUrl(file.key);

    dom.inspectorFileName.textContent = file.name;
    dom.inspectorFileSize.textContent = `${formatBytes(file.size)} (${file.size.toLocaleString()} bytes)`;
    dom.inspectorMimeType.textContent = file.mimeType || 'application/octet-stream';
    dom.inspectorLastModified.textContent = formatDate(file.lastModified);
    dom.inspectorETag.textContent = file.etag ? `"${file.etag}"` : '-';

    if (file.directUrl) {
      dom.inspectorDirectUrlRow.style.display = 'flex';
      dom.inspectorDirectUrl.textContent = file.directUrl;
    } else {
      dom.inspectorDirectUrlRow.style.display = 'none';
    }

    dom.inspectorPresignResult.style.display = 'none';

    if (category === 'image') {
      dom.inspectorPreview.innerHTML = `<img src="${rawUrl}" class="inspector-preview-img" alt="${escapeHtml(file.name)}">`;
    } else {
      dom.inspectorPreview.innerHTML = `
        <div class="file-icon-placeholder">
          ${getFileIconSvg(category, getFileExtension(file.name))}
          <span class="file-badge-ext">${getFileExtension(file.name) || 'FILE'}</span>
        </div>
      `;
    }

    dom.inspectorBackdrop.style.display = 'block';
    dom.inspectorDrawer.classList.add('open');
  }

  function closeInspectorDrawer() {
    dom.inspectorDrawer.classList.remove('open');
    dom.inspectorBackdrop.style.display = 'none';
    state.activeInspectorFile = null;
  }

  dom.inspectorCloseBtn.addEventListener('click', closeInspectorDrawer);
  dom.inspectorBackdrop.addEventListener('click', closeInspectorDrawer);

  dom.inspectorCopyDirectBtn.addEventListener('click', () => {
    if (state.activeInspectorFile && state.activeInspectorFile.directUrl) {
      navigator.clipboard.writeText(state.activeInspectorFile.directUrl);
      showToast('Direct CDN link copied!', 'success');
    }
  });

  dom.inspectorGeneratePresignBtn.addEventListener('click', async () => {
    if (!state.activeInspectorFile) return;
    const expiresIn = parseInt(dom.presignDurationSelect.value, 10) || 3600;

    dom.inspectorGeneratePresignBtn.disabled = true;
    try {
      const res = await fetch('/api/files/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: state.activeInspectorFile.key, expiresIn }),
      });
      const data = await res.json();
      if (data.success && data.presignedUrl) {
        dom.inspectorPresignUrl.textContent = data.presignedUrl;
        dom.inspectorPresignResult.style.display = 'flex';
        showToast('Presigned link generated!', 'success');
      } else {
        showToast('Failed: ' + data.message, 'error');
      }
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    } finally {
      dom.inspectorGeneratePresignBtn.disabled = false;
    }
  });

  dom.inspectorCopyPresignBtn.addEventListener('click', () => {
    const text = dom.inspectorPresignUrl.textContent;
    if (text) {
      navigator.clipboard.writeText(text);
      showToast('Presigned link copied!', 'success');
    }
  });

  dom.inspectorDownloadBtn.addEventListener('click', () => {
    if (state.activeInspectorFile) {
      window.location.href = getRawFileUrl(state.activeInspectorFile.key, true);
    }
  });

  dom.inspectorRenameBtn.addEventListener('click', () => {
    if (state.activeInspectorFile) {
      openRenameModal(state.activeInspectorFile);
    }
  });

  dom.inspectorDeleteBtn.addEventListener('click', () => {
    if (!state.activeInspectorFile) return;
    const file = state.activeInspectorFile;
    openConfirmDeleteModal({
      title: `Delete File "${file.name}"?`,
      message: `Are you sure you want to delete "${file.name}"? This file will be permanently removed from your Cloudflare R2 bucket.`,
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/files/${encodeURIComponent(file.key)}`, { method: 'DELETE' });
          const data = await res.json();
          if (data.success) {
            showToast('File deleted successfully.', 'success');
            closeInspectorDrawer();
            fetchFiles();
            fetchStats();
          } else {
            showToast(data.message, 'error');
          }
        } catch (err) {
          showToast('Error: ' + err.message, 'error');
        }
      },
    });
  });

  // ---------------------------------------------------------------------------
  // Dialog Modals (New Folder, Rename, Move, Delete)
  // ---------------------------------------------------------------------------
  function openNewFolderModal() {
    dom.newFolderNameInput.value = '';
    dom.newFolderModal.classList.add('open');
    setTimeout(() => dom.newFolderNameInput.focus(), 50);
  }

  function closeNewFolderModal() {
    dom.newFolderModal.classList.remove('open');
  }

  dom.newFolderBtn.addEventListener('click', openNewFolderModal);
  dom.newFolderCancelBtn.addEventListener('click', closeNewFolderModal);
  dom.newFolderConfirmBtn.addEventListener('click', async () => {
    const folderName = dom.newFolderNameInput.value.trim();
    if (!folderName) {
      showToast('Please enter a folder name.', 'error');
      return;
    }

    try {
      const res = await fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefix: state.currentPrefix, folderName }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message, 'success');
        closeNewFolderModal();
        fetchFiles();
      } else {
        showToast(data.message, 'error');
      }
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    }
  });

  function openRenameModal(file) {
    dom.renameInput.value = file.name;
    dom.renameModal.classList.add('open');
    setTimeout(() => dom.renameInput.focus(), 50);

    dom.renameConfirmBtn.onclick = async () => {
      const newName = dom.renameInput.value.trim();
      if (!newName || newName === file.name) {
        closeRenameModal();
        return;
      }

      const parentPrefix = file.key.slice(0, file.key.length - file.name.length);
      const newKey = `${parentPrefix}${newName}`;

      try {
        const res = await fetch('/api/files/rename', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ oldKey: file.key, newKey }),
        });
        const data = await res.json();
        if (data.success) {
          showToast(data.message, 'success');
          closeRenameModal();
          closeInspectorDrawer();
          fetchFiles();
        } else {
          showToast(data.message, 'error');
        }
      } catch (err) {
        showToast('Error: ' + err.message, 'error');
      }
    };
  }

  function closeRenameModal() {
    dom.renameModal.classList.remove('open');
  }
  dom.renameCancelBtn.addEventListener('click', closeRenameModal);

  function openConfirmDeleteModal({ title, message, onConfirm }) {
    document.getElementById('confirmDeleteTitle').textContent = title;
    dom.confirmDeleteMessage.textContent = message;
    dom.confirmDeleteModal.classList.add('open');

    dom.confirmDeleteConfirmBtn.onclick = async () => {
      dom.confirmDeleteConfirmBtn.disabled = true;
      try {
        await onConfirm();
      } finally {
        dom.confirmDeleteConfirmBtn.disabled = false;
        closeConfirmDeleteModal();
      }
    };
  }

  function closeConfirmDeleteModal() {
    dom.confirmDeleteModal.classList.remove('open');
  }
  dom.confirmDeleteCancelBtn.addEventListener('click', closeConfirmDeleteModal);

  // ---------------------------------------------------------------------------
  // Batch Actions Toolbar Handlers
  // ---------------------------------------------------------------------------
  dom.batchClearBtn.addEventListener('click', () => {
    state.selectedKeys.clear();
    updateBatchToolbar();
    updateSelectionStyles();
  });

  dom.batchDeleteBtn.addEventListener('click', () => {
    const keys = Array.from(state.selectedKeys);
    if (keys.length === 0) return;

    openConfirmDeleteModal({
      title: `Delete ${keys.length} item(s)?`,
      message: `Are you sure you want to delete ${keys.length} selected file(s)? This cannot be undone.`,
      onConfirm: async () => {
        try {
          const res = await fetch('/api/files/batch-delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ keys }),
          });
          const data = await res.json();
          if (data.success) {
            showToast(data.message, 'success');
            state.selectedKeys.clear();
            updateBatchToolbar();
            fetchFiles();
            fetchStats();
          } else {
            showToast(data.message, 'error');
          }
        } catch (err) {
          showToast('Error: ' + err.message, 'error');
        }
      },
    });
  });

  dom.batchDownloadBtn.addEventListener('click', async () => {
    const keys = Array.from(state.selectedKeys);
    if (keys.length === 0) return;

    showToast('Preparing ZIP download...', 'info');

    try {
      const response = await fetch('/api/files/batch-download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keys, zipName: `r2_export_${Date.now()}.zip` }),
      });

      if (!response.ok) throw new Error('ZIP generation failed');

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `r2_export_${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
      showToast('ZIP download started!', 'success');
    } catch (err) {
      showToast('Download error: ' + err.message, 'error');
    }
  });

  dom.batchMoveBtn.addEventListener('click', () => {
    const keys = Array.from(state.selectedKeys);
    if (keys.length === 0) return;

    // Populate available folders
    dom.moveDestinationSelect.innerHTML = `
      <option value="">Root ( / )</option>
      ${state.folders
        .map((f) => `<option value="${escapeHtml(f.prefix)}">${escapeHtml(f.name)}/</option>`)
        .join('')}
    `;

    dom.moveModal.classList.add('open');

    dom.moveConfirmBtn.onclick = async () => {
      const destinationPrefix = dom.moveDestinationSelect.value;
      try {
        const res = await fetch('/api/files/move', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keys, destinationPrefix }),
        });
        const data = await res.json();
        if (data.success) {
          showToast(data.message, 'success');
          dom.moveModal.classList.remove('open');
          state.selectedKeys.clear();
          updateBatchToolbar();
          fetchFiles();
        } else {
          showToast(data.message, 'error');
        }
      } catch (err) {
        showToast('Error: ' + err.message, 'error');
      }
    };
  });
  dom.moveCancelBtn.addEventListener('click', () => dom.moveModal.classList.remove('open'));

  // ---------------------------------------------------------------------------
  // Multi-File & Folder Upload Queue Engine
  // ---------------------------------------------------------------------------
  dom.uploadFilesBtn.addEventListener('click', () => dom.fileInput.click());
  dom.uploadFolderBtn.addEventListener('click', () => dom.folderInput.click());

  dom.fileInput.addEventListener('change', (e) => {
    handleIncomingFiles(Array.from(e.target.files));
    dom.fileInput.value = '';
  });

  dom.folderInput.addEventListener('change', (e) => {
    handleIncomingFiles(Array.from(e.target.files));
    dom.folderInput.value = '';
  });

  function handleIncomingFiles(files) {
    if (!files || files.length === 0) return;

    files.forEach((file) => {
      const taskId = 'upload_' + Math.random().toString(36).substr(2, 9);
      // If webkitRelativePath exists, preserve folder structure relative to upload
      const relativePath = file.webkitRelativePath || file.name;

      state.uploadQueue.push({
        id: taskId,
        file: file,
        folder: state.currentPrefix,
        name: relativePath,
        size: file.size,
        status: 'queued', // 'queued' | 'uploading' | 'completed' | 'error' | 'canceled'
        percent: 0,
        speed: '0 MB/s',
        loaded: 0,
        total: file.size,
        xhr: null,
      });
    });

    dom.uploadDrawer.style.display = 'flex';
    dom.uploadDrawer.classList.remove('minimized');
    renderUploadDrawer();
    processUploadQueue();
  }

  function processUploadQueue() {
    const queuedItems = state.uploadQueue.filter((item) => item.status === 'queued');
    const availableSlots = state.maxConcurrentUploads - state.activeUploadsCount;

    if (queuedItems.length === 0 && state.activeUploadsCount === 0) {
      // All done
      fetchFiles();
      fetchStats();
      return;
    }

    for (let i = 0; i < Math.min(queuedItems.length, availableSlots); i++) {
      startSingleUpload(queuedItems[i]);
    }
  }

  function startSingleUpload(item) {
    item.status = 'uploading';
    state.activeUploadsCount++;
    renderUploadDrawer();

    const formData = new FormData();
    formData.append('folder', item.folder);
    formData.append('file', item.file, item.name);

    const xhr = new XMLHttpRequest();
    item.xhr = xhr;
    const startTime = Date.now();
    let lastLoaded = 0;
    let lastTime = startTime;

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        item.loaded = e.loaded;
        item.total = e.total;
        item.percent = Math.round((e.loaded / e.total) * 100);

        const now = Date.now();
        const timeDiff = (now - lastTime) / 1000;
        if (timeDiff >= 0.4) {
          const bytesDiff = e.loaded - lastLoaded;
          item.speed = `${formatBytes(bytesDiff / timeDiff)}/s`;
          lastLoaded = e.loaded;
          lastTime = now;
        }

        updateUploadItemProgress(item);
      }
    });

    xhr.onreadystatechange = () => {
      if (xhr.readyState === XMLHttpRequest.DONE) {
        state.activeUploadsCount--;
        if (xhr.status === 200) {
          item.status = 'completed';
          item.percent = 100;
        } else {
          item.status = 'error';
        }
        renderUploadDrawer();
        processUploadQueue();
      }
    };

    xhr.open('POST', '/upload', true);
    xhr.send(formData);
  }

  function renderUploadDrawer() {
    const activeCount = state.uploadQueue.filter((item) => item.status === 'uploading' || item.status === 'queued').length;
    dom.uploadDrawerTitle.textContent = activeCount > 0 ? `Uploading ${activeCount} item(s)...` : 'Uploads completed';

    dom.uploadQueueList.innerHTML = state.uploadQueue
      .map((item) => {
        let statusBadge = '';
        if (item.status === 'completed') {
          statusBadge = '<span style="color: var(--accent-success); font-weight: 600;">Done</span>';
        } else if (item.status === 'error') {
          statusBadge = '<span style="color: var(--accent-danger); font-weight: 600;">Failed</span>';
        } else if (item.status === 'uploading') {
          statusBadge = `<span style="color: var(--accent-primary);">${item.percent}%</span>`;
        } else {
          statusBadge = '<span style="color: var(--text-muted);">Queued</span>';
        }

        return `
          <div class="upload-item" id="item_${item.id}">
            <div class="upload-item-header">
              <span class="upload-item-name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</span>
              <span class="upload-item-status">${statusBadge}</span>
            </div>
            <div class="upload-progress-bar">
              <div class="upload-progress-fill" style="width: ${item.percent}%"></div>
            </div>
            <div class="upload-item-meta">
              <span>${formatBytes(item.loaded)} / ${formatBytes(item.total)}</span>
              <span>${item.status === 'uploading' ? item.speed : ''}</span>
            </div>
          </div>
        `;
      })
      .join('');
  }

  function updateUploadItemProgress(item) {
    const el = document.getElementById(`item_${item.id}`);
    if (!el) return;
    const fill = el.querySelector('.upload-progress-fill');
    if (fill) fill.style.width = `${item.percent}%`;
    const status = el.querySelector('.upload-item-status');
    if (status) status.innerHTML = `<span style="color: var(--accent-primary);">${item.percent}%</span>`;
    const meta = el.querySelector('.upload-item-meta');
    if (meta) meta.innerHTML = `<span>${formatBytes(item.loaded)} / ${formatBytes(item.total)}</span><span>${item.speed}</span>`;
  }

  dom.uploadDrawerMinimizeBtn.addEventListener('click', () => {
    dom.uploadDrawer.classList.toggle('minimized');
  });

  dom.uploadDrawerCloseBtn.addEventListener('click', () => {
    // Clear completed or errored tasks
    state.uploadQueue = state.uploadQueue.filter((item) => item.status === 'uploading' || item.status === 'queued');
    if (state.uploadQueue.length === 0) {
      dom.uploadDrawer.style.display = 'none';
    } else {
      renderUploadDrawer();
    }
  });

  // ---------------------------------------------------------------------------
  // View Mode & Filter Controls
  // ---------------------------------------------------------------------------
  dom.viewToggleGrid.addEventListener('click', () => {
    state.viewMode = 'grid';
    localStorage.setItem('r2_view_mode', 'grid');
    dom.viewToggleGrid.classList.add('active');
    dom.viewToggleTable.classList.remove('active');
    renderContent();
  });

  dom.viewToggleTable.addEventListener('click', () => {
    state.viewMode = 'table';
    localStorage.setItem('r2_view_mode', 'table');
    dom.viewToggleTable.classList.add('active');
    dom.viewToggleGrid.classList.remove('active');
    renderContent();
  });

  dom.filterChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      dom.filterChips.forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      state.currentFilter = chip.getAttribute('data-filter') || 'all';
      renderContent();
    });
  });

  dom.sortSelect.value = state.sortKey;
  dom.sortSelect.addEventListener('change', (e) => {
    state.sortKey = e.target.value;
    localStorage.setItem('r2_sort_key', state.sortKey);
    renderContent();
  });

  // ---------------------------------------------------------------------------
  // Search Bar
  // ---------------------------------------------------------------------------
  let searchDebounceTimeout = null;
  dom.searchInput.addEventListener('input', (e) => {
    const val = e.target.value.trim();
    dom.searchClearBtn.style.display = val ? 'block' : 'none';

    clearTimeout(searchDebounceTimeout);
    searchDebounceTimeout = setTimeout(() => {
      state.searchQuery = val;
      fetchFiles(state.currentPrefix, val);
    }, 250);
  });

  dom.searchClearBtn.addEventListener('click', () => {
    dom.searchInput.value = '';
    dom.searchClearBtn.style.display = 'none';
    state.searchQuery = '';
    fetchFiles(state.currentPrefix);
  });

  // ---------------------------------------------------------------------------
  // Global Drag & Drop Overlay
  // ---------------------------------------------------------------------------
  let dragCounter = 0;
  window.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dragCounter++;
    dom.dropzoneOverlay.classList.add('active');
  });

  window.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dragCounter--;
    if (dragCounter <= 0) {
      dragCounter = 0;
      dom.dropzoneOverlay.classList.remove('active');
    }
  });

  window.addEventListener('dragover', (e) => e.preventDefault());

  window.addEventListener('drop', (e) => {
    e.preventDefault();
    dragCounter = 0;
    dom.dropzoneOverlay.classList.remove('active');
    if (e.dataTransfer && e.dataTransfer.files.length > 0) {
      handleIncomingFiles(Array.from(e.dataTransfer.files));
    }
  });

  // ---------------------------------------------------------------------------
  // Global Keyboard Shortcuts
  // ---------------------------------------------------------------------------
  window.addEventListener('keydown', (e) => {
    // Focus search with / or Ctrl+K
    if ((e.key === '/' || ((e.ctrlKey || e.metaKey) && e.key === 'k')) && document.activeElement !== dom.searchInput) {
      e.preventDefault();
      dom.searchInput.focus();
      return;
    }

    // Escape closes modals and drawers
    if (e.key === 'Escape') {
      if (dom.previewModal.classList.contains('open')) {
        closePreviewModal();
      } else if (dom.inspectorDrawer.classList.contains('open')) {
        closeInspectorDrawer();
      } else if (dom.newFolderModal.classList.contains('open')) {
        closeNewFolderModal();
      } else if (dom.renameModal.classList.contains('open')) {
        closeRenameModal();
      } else if (dom.confirmDeleteModal.classList.contains('open')) {
        closeConfirmDeleteModal();
      } else if (dom.moveModal.classList.contains('open')) {
        dom.moveModal.classList.remove('open');
      } else if (state.selectedKeys.size > 0) {
        state.selectedKeys.clear();
        updateBatchToolbar();
        updateSelectionStyles();
      }
      return;
    }

    // Ctrl+A selects all files in current view
    if ((e.ctrlKey || e.metaKey) && e.key === 'a' && document.activeElement.tagName !== 'INPUT') {
      e.preventDefault();
      const files = getFilteredAndSortedFiles();
      files.forEach((f) => state.selectedKeys.add(f.key));
      updateBatchToolbar();
      updateSelectionStyles();
      return;
    }

    // Delete key triggers batch delete
    if (e.key === 'Delete' && state.selectedKeys.size > 0 && document.activeElement.tagName !== 'INPUT') {
      dom.batchDeleteBtn.click();
    }
  });

  // Refresh & Logout
  dom.refreshBtn.addEventListener('click', () => {
    fetchFiles();
    fetchStats();
    showToast('Refreshing files...', 'info');
  });

  dom.logoutBtn.addEventListener('click', async () => {
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/login.html';
  });

  // URL Hash Navigation Sync
  window.addEventListener('hashchange', () => {
    const rawHash = window.location.hash.replace(/^#\/?/, '');
    if (rawHash !== state.currentPrefix) {
      fetchFiles(rawHash);
    }
  });

  // Initial Boot
  function init() {
    if (state.viewMode === 'table') {
      dom.viewToggleTable.classList.add('active');
      dom.viewToggleGrid.classList.remove('active');
    } else {
      dom.viewToggleGrid.classList.add('active');
      dom.viewToggleTable.classList.remove('active');
    }

    const initialHash = window.location.hash.replace(/^#\/?/, '');
    checkDiagnostics();
    fetchStats();
    fetchFiles(initialHash);
  }

  init();
})();

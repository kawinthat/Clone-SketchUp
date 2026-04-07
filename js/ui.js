// ============================================================
// UI: Furniture Panel, Properties Panel, Toolbar
// ============================================================

import {
  state, subscribe, notify,
  getSelected, updateElement, removeElement, select,
  setTool, setMode,
  canUndo, canRedo, undo, redo,
  clearAll, getStats,
} from './state.js';

import { CATEGORIES, ALL_FURNITURE, getFurnitureInfo } from './furniture-catalog.js';
import { zoomIn, zoomOut, fitToContent, getCanvas } from './canvas2d.js';
import { init3D, refresh3D, resetCamera, topView } from './renderer3d.js';

// ---- BUILD FURNITURE CATALOG ----

export function buildFurnitureCatalog() {
  const container = document.getElementById('furniture-catalog');
  if (!container) return;
  container.innerHTML = '';

  for (const cat of CATEGORIES) {
    const section = document.createElement('div');
    section.className = 'cat-section';
    section.dataset.catId = cat.id;

    const title = document.createElement('div');
    title.className = 'cat-title';
    title.innerHTML = `<span class="cat-icon">${cat.icon}</span>${cat.label}`;
    section.appendChild(title);

    const items = document.createElement('div');
    items.className = 'cat-items';

    for (const item of cat.items) {
      const el = document.createElement('div');
      el.className = 'furniture-item';
      el.dataset.furnitureType = item.type;
      el.title = `${item.label} (${item.width}×${item.depth} ซม.)`;
      el.innerHTML = `
        <span class="fi-icon">${item.icon}</span>
        <span class="fi-label">${item.label}</span>
      `;
      el.addEventListener('click', () => selectFurnitureTool(item, el));
      items.appendChild(el);
    }

    section.appendChild(items);
    container.appendChild(section);
  }
}

function selectFurnitureTool(item, clickedEl) {
  // Toggle off if already selected
  if (state.pendingFurniture && state.pendingFurniture.type === item.type) {
    state.pendingFurniture = null;
    clickedEl.classList.remove('selected');
    document.getElementById('placement-hint').classList.add('hidden');
    setTool('select');
    return;
  }

  // Deselect others
  document.querySelectorAll('.furniture-item').forEach(el => el.classList.remove('selected'));
  clickedEl.classList.add('selected');

  state.pendingFurniture = { ...item };
  document.getElementById('placement-hint').classList.remove('hidden');

  // Switch to furniture placement pseudo-tool
  state.tool = 'select'; // still select but with pending furniture
  notify();
}

// ---- SEARCH ----

export function initFurnitureSearch() {
  const input = document.getElementById('furniture-search');
  if (!input) return;

  input.addEventListener('input', () => {
    const q = input.value.toLowerCase().trim();
    document.querySelectorAll('.furniture-item').forEach(el => {
      const label = el.querySelector('.fi-label').textContent.toLowerCase();
      const type  = el.dataset.furnitureType.toLowerCase();
      el.style.display = (!q || label.includes(q) || type.includes(q)) ? '' : 'none';
    });
    document.querySelectorAll('.cat-section').forEach(sec => {
      const visible = [...sec.querySelectorAll('.furniture-item')].some(
        el => el.style.display !== 'none',
      );
      sec.style.display = visible ? '' : 'none';
    });
  });
}

// ---- TOOLBAR ----

export function initToolbar() {
  // Tool buttons
  document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tool = btn.dataset.tool;
      setTool(tool);
      setActiveToolBtn(tool);
      // Cancel furniture placement
      state.pendingFurniture = null;
      document.getElementById('placement-hint').classList.add('hidden');
      document.querySelectorAll('.furniture-item').forEach(el => el.classList.remove('selected'));
    });
  });

  // 2D / 3D / Split toggle
  document.getElementById('btn-2d').addEventListener('click', () => {
    state.splitView = false;
    switchMode('2d');
  });
  document.getElementById('btn-3d').addEventListener('click', () => {
    state.splitView = false;
    switchMode('3d');
  });
  document.getElementById('btn-split').addEventListener('click', () => {
    state.splitView = !state.splitView;
    if (state.splitView) {
      switchMode('split');
    } else {
      switchMode('2d');
    }
  });

  // Undo / Redo
  document.getElementById('btn-undo').addEventListener('click', () => {
    undo();
    updateUndoRedoBtns();
  });
  document.getElementById('btn-redo').addEventListener('click', () => {
    redo();
    updateUndoRedoBtns();
  });

  // Clear
  document.getElementById('btn-clear').addEventListener('click', () => {
    if (state.elements.length === 0) return;
    if (confirm('ล้างแปลนทั้งหมด? การกระทำนี้ไม่สามารถย้อนกลับได้ทันที')) {
      clearAll();
    }
  });

  // Export PNG
  document.getElementById('btn-export').addEventListener('click', exportPNG);

  // Save JSON
  document.getElementById('btn-save-json').addEventListener('click', () => {
    const data = JSON.stringify({ version: '1.0', elements: state.elements }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.download = `floorplan_${new Date().toISOString().slice(0, 10)}.json`;
    a.href = url;
    a.click();
    URL.revokeObjectURL(url);
  });

  // Load JSON
  document.getElementById('btn-load-json').addEventListener('click', () => {
    document.getElementById('file-input-json').click();
  });

  document.getElementById('file-input-json').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        const elements = Array.isArray(data) ? data : (data.elements || []);
        clearAll();
        for (const el of elements) state.elements.push(el);
        notify();
        fitToContent();
      } catch (err) {
        alert('ไม่สามารถเปิดไฟล์ได้: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  // Ctrl+S → save
  window.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      document.getElementById('btn-save-json').click();
    }
  });

  // Grid size selector
  const gridSel = document.getElementById('grid-size-select');
  if (gridSel) {
    gridSel.addEventListener('change', e => {
      state.gridSize = Number(e.target.value);
      const gridEl = document.getElementById('status-grid');
      if (gridEl) gridEl.textContent = `กริด: ${state.gridSize} ซม.`;
      notify();
    });
  }

  // Zoom controls
  document.getElementById('btn-zoom-in').addEventListener('click', zoomIn);
  document.getElementById('btn-zoom-out').addEventListener('click', zoomOut);
  document.getElementById('btn-fit').addEventListener('click', fitToContent);

  // Snap toggle
  document.getElementById('snap-toggle').addEventListener('change', e => {
    state.snapEnabled = e.target.checked;
  });

  // Keyboard shortcut for undo/redo
  window.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); updateUndoRedoBtns(); }
      if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) { e.preventDefault(); redo(); updateUndoRedoBtns(); }
    }
    // Tool shortcuts
    if (!e.ctrlKey && !e.metaKey && !e.altKey) {
      const shortcuts = { v: 'select', r: 'room', w: 'wall', e: 'erase' };
      const tool = shortcuts[e.key.toLowerCase()];
      if (tool) { setTool(tool); setActiveToolBtn(tool); }
    }
  });
}

function setActiveToolBtn(tool) {
  document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tool === tool);
  });
  // Update canvas area class for cursor
  const area = document.getElementById('canvas-area');
  if (area) {
    area.className = 'canvas-area tool-' + tool;
  }
}

function updateUndoRedoBtns() {
  const u = document.getElementById('btn-undo');
  const r = document.getElementById('btn-redo');
  if (u) u.disabled = !canUndo();
  if (r) r.disabled = !canRedo();
}

// ---- MODE SWITCH ----

function switchMode(mode) {
  // mode: '2d' | '3d' | 'split'
  const area     = document.getElementById('canvas-area');
  const pane2d   = document.getElementById('pane-2d');
  const pane3d   = document.getElementById('pane-3d');
  const cont3d   = document.getElementById('container-3d');
  const hint3d   = document.getElementById('view3d-hint');
  const btn2d    = document.getElementById('btn-2d');
  const btn3d    = document.getElementById('btn-3d');
  const btnSplit = document.getElementById('btn-split');

  // Reset all
  area.classList.remove('split-active', 'mode-3d');
  btn2d.classList.remove('active');
  btn3d.classList.remove('active');
  btnSplit.classList.remove('active');
  if (hint3d) hint3d.classList.add('hidden');

  if (mode === '2d') {
    setMode('2d');
    state.splitView = false;
    btn2d.classList.add('active');
    pane3d.classList.add('hidden');
    pane2d.classList.remove('hidden');
  } else if (mode === '3d') {
    setMode('3d');
    state.splitView = false;
    btn3d.classList.add('active');
    area.classList.add('mode-3d');
    pane2d.classList.add('hidden');
    pane3d.classList.remove('hidden');
    if (hint3d) hint3d.classList.remove('hidden');
    init3D(cont3d);
    refresh3D();
    // Add 3D overlay controls
    inject3DControls(pane3d, cont3d);
  } else if (mode === 'split') {
    setMode('2d'); // 2D remains active for editing
    state.splitView = true;
    btnSplit.classList.add('active');
    area.classList.add('split-active');
    pane2d.classList.remove('hidden');
    pane3d.classList.remove('hidden');
    // Init 3D in right pane
    init3D(cont3d);
    refresh3D();
    inject3DControls(pane3d, cont3d);
    // Show realtime badge
    injectRealtimeBadge(pane3d);
    // Real-time: subscribe to state changes → rebuild 3D
    subscribe(() => {
      if (state.splitView) {
        requestAnimationFrame(() => refresh3D());
      }
    });
  }
}

function inject3DControls(pane, cont3d) {
  if (pane.querySelector('.view3d-controls')) return;
  const div = document.createElement('div');
  div.className = 'view3d-controls';
  div.innerHTML = `
    <button class="view3d-ctrl-btn" id="btn-reset-cam" title="Reset camera">⌂</button>
    <button class="view3d-ctrl-btn" id="btn-cam-top"   title="Top view">⊙</button>
  `;
  pane.appendChild(div);
  div.querySelector('#btn-reset-cam').addEventListener('click', () => resetCamera());
  div.querySelector('#btn-cam-top').addEventListener('click', () => topView());
}

function injectRealtimeBadge(pane) {
  if (pane.querySelector('.realtime-badge')) return;
  const div = document.createElement('div');
  div.className = 'realtime-badge';
  div.innerHTML = '<div class="realtime-dot"></div> Realtime 3D';
  pane.appendChild(div);
}

// ---- PROPERTIES PANEL ----

export function initPropertiesPanel() {
  const propLabel  = document.getElementById('prop-label');
  const propX      = document.getElementById('prop-x');
  const propY      = document.getElementById('prop-y');
  const propWidth  = document.getElementById('prop-width');
  const propDepth  = document.getElementById('prop-depth');
  const propColor  = document.getElementById('prop-color');
  const propColorHex = document.getElementById('prop-color-hex');

  // Live input handlers
  propLabel.addEventListener('input', () => {
    if (state.selectedId) updateElement(state.selectedId, { label: propLabel.value });
  });
  propX.addEventListener('change', () => {
    if (state.selectedId) updateElement(state.selectedId, { x: Number(propX.value) });
  });
  propY.addEventListener('change', () => {
    if (state.selectedId) updateElement(state.selectedId, { y: Number(propY.value) });
  });
  propWidth.addEventListener('change', () => {
    if (state.selectedId) updateElement(state.selectedId, { width: Math.max(10, Number(propWidth.value)) });
  });
  propDepth.addEventListener('change', () => {
    if (state.selectedId) updateElement(state.selectedId, { depth: Math.max(10, Number(propDepth.value)) });
  });
  propColor.addEventListener('input', () => {
    const hex = propColor.value;
    if (propColorHex) propColorHex.textContent = hex;
    if (state.selectedId) updateElement(state.selectedId, { color: hex });
  });

  // Rotation buttons
  document.querySelectorAll('.rot-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const deg = Number(btn.dataset.deg);
      if (state.selectedId) {
        const el = getSelected();
        if (el && el.type === 'furniture') {
          updateElement(state.selectedId, { rotation: deg });
          updateRotationBtns(deg);
        }
      }
    });
  });

  // Delete button
  document.getElementById('btn-delete').addEventListener('click', () => {
    if (state.selectedId) removeElement(state.selectedId);
  });

  // Subscribe to state changes to update panel
  subscribe(updatePropertiesPanel);
  updatePropertiesPanel();
}

function updatePropertiesPanel() {
  const el = getSelected();
  const noSel   = document.getElementById('no-sel-msg');
  const propsPanel = document.getElementById('props-panel');
  const sizeRow  = document.getElementById('prop-size-row');
  const rotRow   = document.getElementById('prop-rotation-row');
  const colorRow = document.getElementById('prop-color-row');

  if (!el) {
    noSel.classList.remove('hidden');
    propsPanel.classList.add('hidden');
    updateSummary();
    updateUndoRedoBtns();
    return;
  }

  noSel.classList.add('hidden');
  propsPanel.classList.remove('hidden');

  // Populate fields
  setInputVal('prop-label', el.label || '');

  if (el.type === 'wall') {
    setInputVal('prop-x', Math.round(el.x1));
    setInputVal('prop-y', Math.round(el.y1));
    sizeRow.classList.add('hidden');
    rotRow.classList.add('hidden');
  } else {
    setInputVal('prop-x', Math.round(el.x));
    setInputVal('prop-y', Math.round(el.y));
    sizeRow.classList.remove('hidden');

    const rot = (el.rotation || 0) % 360;
    const swapped = rot === 90 || rot === 270;
    const dispW = el.type === 'furniture' && swapped ? el.depth : el.width;
    const dispD = el.type === 'furniture' && swapped ? el.width : el.depth;

    setInputVal('prop-width', Math.round(dispW || el.width || 0));
    setInputVal('prop-depth', Math.round(dispD || el.depth || 0));

    if (el.type === 'furniture') {
      rotRow.classList.remove('hidden');
      updateRotationBtns(el.rotation || 0);
    } else {
      rotRow.classList.add('hidden');
    }

    // Dimensions display
    const w = el.width || dispW || 0;
    const d = el.depth || dispD || 0;
    setText('dim-w', `${w} ซม. (${(w / 100).toFixed(2)} ม.)`);
    setText('dim-d', `${d} ซม. (${(d / 100).toFixed(2)} ม.)`);
    setText('dim-a', `${(w * d / 10000).toFixed(2)} ตร.ม.`);
  }

  // Color
  const colorHex = el.color || '#ffffff';
  const colorInput = document.getElementById('prop-color');
  if (colorInput) colorInput.value = colorHex;
  const colorHexEl = document.getElementById('prop-color-hex');
  if (colorHexEl) colorHexEl.textContent = colorHex;
  if (colorRow) colorRow.classList.remove('hidden');

  updateSummary();
  updateUndoRedoBtns();
}

function updateRotationBtns(deg) {
  const norm = ((deg % 360) + 360) % 360;
  document.querySelectorAll('.rot-btn').forEach(btn => {
    btn.classList.toggle('active', Number(btn.dataset.deg) === norm);
  });
}

function updateSummary() {
  const stats = getStats();
  setText('sum-rooms',     stats.roomCount);
  setText('sum-furniture', stats.furnitureCount);
  setText('sum-area',      `${stats.totalArea} ตร.ม.`);
  const cnt = document.getElementById('status-count');
  if (cnt) cnt.textContent = `${state.elements.length} องค์ประกอบ`;
}

// ---- EXPORT PNG ----

function exportPNG() {
  const cvs = getCanvas();
  if (!cvs) return;

  const link = document.createElement('a');
  link.download = `floorplan_${Date.now()}.png`;
  link.href = cvs.toDataURL('image/png');
  link.click();
}

// ---- UTILS ----

function setInputVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

// ---- STATUS GRID ----

export function initStatusBar() {
  subscribe(() => {
    const gridEl = document.getElementById('status-grid');
    if (gridEl) gridEl.textContent = `กริด: ${state.gridSize} ซม.`;
  });
}


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
import { init3D, refresh3D, resetCamera } from './renderer3d.js';

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

  // 2D / 3D toggle
  document.getElementById('btn-2d').addEventListener('click', () => switchMode('2d'));
  document.getElementById('btn-3d').addEventListener('click', () => switchMode('3d'));

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

  // Export
  document.getElementById('btn-export').addEventListener('click', exportPNG);

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
  setMode(mode);

  const canvas2d = document.getElementById('canvas-2d');
  const cont3d   = document.getElementById('container-3d');
  const hint3d   = document.getElementById('view3d-hint');

  const btn2d = document.getElementById('btn-2d');
  const btn3d = document.getElementById('btn-3d');

  if (mode === '2d') {
    canvas2d.classList.remove('hidden');
    cont3d.classList.add('hidden');
    hint3d.classList.add('hidden');
    btn2d.classList.add('active');
    btn3d.classList.remove('active');
  } else {
    canvas2d.classList.add('hidden');
    cont3d.classList.remove('hidden');
    hint3d.classList.remove('hidden');
    btn2d.classList.remove('active');
    btn3d.classList.add('active');

    // Initialize or refresh 3D
    init3D(cont3d);
    refresh3D();
  }
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


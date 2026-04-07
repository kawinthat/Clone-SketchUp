// ============================================================
// State Management with Pub/Sub + Undo/Redo
// ============================================================

export const state = {
  elements: [],          // All floor plan elements
  selectedId: null,      // Currently selected element ID
  tool: 'select',        // Active tool: 'select'|'room'|'wall'|'furniture'|'erase'
  mode: '2d',            // View mode: '2d'|'3d'
  zoom: 1.0,             // Canvas zoom level
  panX: 250,             // Canvas pan offset X (pixels)
  panY: 150,             // Canvas pan offset Y (pixels)
  snapEnabled: true,     // Snap to grid
  gridSize: 50,          // Grid size in cm
  pendingFurniture: null,// { type, label, width, depth, color } when placing furniture
  drawing: {             // Temp state during draw operations
    active: false,
    startX: 0, startY: 0,
    currentX: 0, currentY: 0,
  },
  dragging: {            // Temp state during drag operations
    active: false,
    offsetX: 0, offsetY: 0,
  },
  // Wall drawing (multi-click)
  wallPoints: [],
  // Split view
  splitView: false,
};

const listeners = new Set();
let idCounter = 1;

// ---- Pub/Sub ----

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function notify() {
  listeners.forEach(fn => fn());
}

// ---- ID generation ----

export function newId() {
  return `el_${Date.now()}_${idCounter++}`;
}

// ---- History ----

const history = [[]];
let historyIndex = 0;

function snapshot() {
  return JSON.parse(JSON.stringify(state.elements));
}

function saveHistory() {
  // Trim redo history
  history.splice(historyIndex + 1);
  history.push(snapshot());
  historyIndex = history.length - 1;
  if (history.length > 60) {
    history.shift();
    historyIndex--;
  }
}

export function undo() {
  if (historyIndex > 0) {
    historyIndex--;
    state.elements = JSON.parse(JSON.stringify(history[historyIndex]));
    state.selectedId = null;
    notify();
    return true;
  }
  return false;
}

export function redo() {
  if (historyIndex < history.length - 1) {
    historyIndex++;
    state.elements = JSON.parse(JSON.stringify(history[historyIndex]));
    state.selectedId = null;
    notify();
    return true;
  }
  return false;
}

export function canUndo() { return historyIndex > 0; }
export function canRedo() { return historyIndex < history.length - 1; }

// Public snapshot save (for drag-end)
export function saveSnapshot() { saveHistory(); }

// ---- Element CRUD ----

export function addElement(el) {
  saveHistory();
  state.elements.push(el);
  notify();
}

export function removeElement(id) {
  saveHistory();
  const idx = state.elements.findIndex(e => e.id === id);
  if (idx !== -1) state.elements.splice(idx, 1);
  if (state.selectedId === id) state.selectedId = null;
  notify();
}

export function updateElement(id, updates) {
  const el = state.elements.find(e => e.id === id);
  if (!el) return;
  saveHistory();
  Object.assign(el, updates);
  notify();
}

export function getElement(id) {
  return state.elements.find(e => e.id === id) || null;
}

export function getSelected() {
  return getElement(state.selectedId);
}

// ---- Selection ----

export function select(id) {
  if (state.selectedId === id) return;
  state.selectedId = id;
  notify();
}

export function deselect() {
  if (!state.selectedId) return;
  state.selectedId = null;
  notify();
}

// ---- Tool / Mode ----

export function setTool(tool) {
  state.tool = tool;
  state.pendingFurniture = null;
  state.drawing.active = false;
  state.wallPoints = [];
  notify();
}

export function setMode(mode) {
  state.mode = mode;
  notify();
}

// ---- Pan / Zoom ----

export function setZoom(z) {
  state.zoom = Math.max(0.1, Math.min(10, z));
  notify();
}

export function setPan(x, y) {
  state.panX = x;
  state.panY = y;
  // No notify - pan is continuous
}

// ---- Coordinates ----

export function worldToScreen(wx, wy) {
  return {
    x: wx * state.zoom + state.panX,
    y: wy * state.zoom + state.panY,
  };
}

export function screenToWorld(sx, sy) {
  return {
    x: (sx - state.panX) / state.zoom,
    y: (sy - state.panY) / state.zoom,
  };
}

export function snapToGrid(v) {
  if (!state.snapEnabled) return v;
  return Math.round(v / state.gridSize) * state.gridSize;
}

// ---- Clear ----

export function clearAll() {
  saveHistory();
  state.elements = [];
  state.selectedId = null;
  notify();
}

// ---- Stats ----

export function getStats() {
  const rooms = state.elements.filter(e => e.type === 'room');
  const furniture = state.elements.filter(e => e.type === 'furniture');
  const walls = state.elements.filter(e => e.type === 'wall');
  const totalArea = rooms.reduce((sum, r) => sum + (r.width * r.depth) / 10000, 0);
  return {
    roomCount: rooms.length,
    furnitureCount: furniture.length,
    wallCount: walls.length,
    totalArea: totalArea.toFixed(1),
  };
}

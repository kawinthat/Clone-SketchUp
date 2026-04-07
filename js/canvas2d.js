// ============================================================
// 2D Floor Plan Canvas Editor
// ============================================================

import {
  state, subscribe, notify,
  newId, addElement, removeElement, updateElement,
  getElement, getSelected,
  select, deselect,
  worldToScreen, screenToWorld, snapToGrid,
  setTool, saveSnapshot,
} from './state.js';

import { getFurnitureInfo } from './furniture-catalog.js';

// Palette of room colors (cycling)
const ROOM_COLORS = [
  '#DCEEFB', '#D4EDDA', '#FFF3CD', '#F3E5F5',
  '#E8EAF6', '#E0F7FA', '#FBE9E7', '#F1F8E9',
];
let roomColorIndex = 0;

let canvas, ctx;
let rafId = null;
let isPanning = false;
let panStart = { x: 0, y: 0 };
let panStartOffset = { x: 0, y: 0 };
let ghostRotation = 0; // 0|90|180|270

export function initCanvas2D(canvasEl) {
  canvas = canvasEl;
  ctx = canvas.getContext('2d');

  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  // Mouse events
  canvas.addEventListener('mousedown', onMouseDown);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('mouseleave', onMouseLeave);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('dblclick', onDblClick);
  canvas.addEventListener('contextmenu', e => e.preventDefault());

  // Keyboard
  window.addEventListener('keydown', onKeyDown);

  subscribe(() => {
    if (state.mode === '2d') scheduleRender();
  });

  scheduleRender();
}

function resizeCanvas() {
  const container = canvas.parentElement;
  canvas.width = container.clientWidth;
  canvas.height = container.clientHeight;
  scheduleRender();
}

function scheduleRender() {
  if (rafId) return;
  rafId = requestAnimationFrame(() => {
    rafId = null;
    render();
  });
}

// ---- RENDERING ----

function render() {
  if (!ctx) return;
  const W = canvas.width, H = canvas.height;

  ctx.clearRect(0, 0, W, H);

  // Background
  ctx.fillStyle = '#F5F5F0';
  ctx.fillRect(0, 0, W, H);

  // Grid
  drawGrid();

  // Elements
  for (const el of state.elements) {
    if (el.type === 'room') drawRoom(el);
  }
  for (const el of state.elements) {
    if (el.type === 'wall') drawWall(el);
  }
  for (const el of state.elements) {
    if (el.type === 'furniture') drawFurniture(el);
  }

  // Selection handles
  const sel = getSelected();
  if (sel) drawSelectionHandles(sel);

  // Temp drawing preview
  if (state.drawing.active) drawTempShape();

  // Furniture ghost (placement mode)
  if (state.pendingFurniture && state.drawing.currentX !== undefined) {
    drawFurnitureGhost();
  }

  // Wall building points
  if (state.tool === 'wall' && state.wallPoints.length > 0) {
    drawWallPreview();
  }

  // Compass
  drawCompass();
}

function drawGrid() {
  const { zoom, panX, panY } = state;
  const W = canvas.width, H = canvas.height;
  const gs = state.gridSize;

  // Calculate visible world bounds
  const left   = -panX / zoom;
  const top    = -panY / zoom;
  const right  = (W - panX) / zoom;
  const bottom = (H - panY) / zoom;

  // Minor grid (gridSize)
  const startX = Math.floor(left / gs) * gs;
  const startY = Math.floor(top  / gs) * gs;

  ctx.beginPath();
  ctx.strokeStyle = 'rgba(0,0,0,0.06)';
  ctx.lineWidth = 0.5;
  for (let x = startX; x <= right; x += gs) {
    const sx = x * zoom + panX;
    ctx.moveTo(sx, 0);
    ctx.lineTo(sx, H);
  }
  for (let y = startY; y <= bottom; y += gs) {
    const sy = y * zoom + panY;
    ctx.moveTo(0, sy);
    ctx.lineTo(W, sy);
  }
  ctx.stroke();

  // Major grid (every 5 cells = 250cm)
  const major = gs * 5;
  const mStartX = Math.floor(left / major) * major;
  const mStartY = Math.floor(top  / major) * major;

  ctx.beginPath();
  ctx.strokeStyle = 'rgba(0,0,0,0.13)';
  ctx.lineWidth = 1;
  for (let x = mStartX; x <= right; x += major) {
    const sx = x * zoom + panX;
    ctx.moveTo(sx, 0);
    ctx.lineTo(sx, H);
  }
  for (let y = mStartY; y <= bottom; y += major) {
    const sy = y * zoom + panY;
    ctx.moveTo(0, sy);
    ctx.lineTo(W, sy);
  }
  ctx.stroke();

  // Origin cross
  const ox = panX, oy = panY;
  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(ox - 10, oy); ctx.lineTo(ox + 10, oy); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(ox, oy - 10); ctx.lineTo(ox, oy + 10); ctx.stroke();
}

function drawRoom(room) {
  const { zoom, panX, panY } = state;
  const sx = room.x * zoom + panX;
  const sy = room.y * zoom + panY;
  const sw = room.width  * zoom;
  const sh = room.depth  * zoom;
  const wt = (room.wallThickness || 15) * zoom;

  // Floor fill
  ctx.fillStyle = room.color || '#DCEEFB';
  ctx.fillRect(sx, sy, sw, sh);

  // Wall fill (border-like walls)
  ctx.fillStyle = room.wallColor || '#D0C8B8';
  ctx.strokeStyle = room.wallColor || '#B0A898';
  ctx.lineWidth = Math.max(2, wt);
  ctx.strokeRect(sx, sy, sw, sh);

  // Room label
  if (sw > 50 && sh > 30) {
    const label = room.label || 'ห้อง';
    ctx.fillStyle = 'rgba(60,50,40,0.7)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const fontSize = Math.min(14, Math.max(8, sw / (label.length * 0.8)));
    ctx.font = `500 ${fontSize}px 'Noto Sans Thai', sans-serif`;
    ctx.fillText(label, sx + sw / 2, sy + sh / 2);
  }

  // Dimension labels
  if (zoom >= 0.6) {
    drawDimensionLabel(
      sx + sw / 2, sy - 12,
      `${room.width} ซม.`, 'h',
    );
    drawDimensionLabel(
      sx + sw + 12, sy + sh / 2,
      `${room.depth} ซม.`, 'v',
    );
  }
}

function drawWall(wall) {
  const { zoom, panX, panY } = state;
  const sx1 = wall.x1 * zoom + panX;
  const sy1 = wall.y1 * zoom + panY;
  const sx2 = wall.x2 * zoom + panX;
  const sy2 = wall.y2 * zoom + panY;
  const wt = Math.max(2, (wall.thickness || 15) * zoom);

  const isSelected = wall.id === state.selectedId;

  ctx.beginPath();
  ctx.strokeStyle = isSelected ? '#0099DD' : '#888880';
  ctx.lineWidth = wt;
  ctx.lineCap = 'round';
  ctx.moveTo(sx1, sy1);
  ctx.lineTo(sx2, sy2);
  ctx.stroke();

  // Dimension
  if (zoom >= 0.5) {
    const len = Math.round(Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1));
    const mx = (sx1 + sx2) / 2;
    const my = (sy1 + sy2) / 2;
    const angle = Math.atan2(sy2 - sy1, sx2 - sx1);
    ctx.save();
    ctx.translate(mx, my);
    ctx.rotate(angle);
    ctx.fillStyle = '#555';
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`${len} ซม.`, 0, -wt / 2 - 2);
    ctx.restore();
  }
}

function drawFurniture(item) {
  const { zoom, panX, panY } = state;
  const info = getFurnitureInfo(item.furnitureType);

  // Get effective dimensions (swap on 90/270 rotation)
  const rot = (item.rotation || 0) % 360;
  const swapped = rot === 90 || rot === 270;
  const dispW = swapped ? item.depth : item.width;
  const dispD = swapped ? item.width : item.depth;

  const sx = item.x * zoom + panX;
  const sy = item.y * zoom + panY;
  const sw = dispW * zoom;
  const sh = dispD * zoom;

  const isSelected = item.id === state.selectedId;

  ctx.save();
  ctx.translate(sx + sw / 2, sy + sh / 2);
  // No extra rotation needed; dimensions handle it

  // Shadow
  ctx.shadowColor = 'rgba(0,0,0,0.15)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;

  // Body
  const color = item.color || (info && info.color2d) || '#C0A870';
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(-sw / 2, -sh / 2, sw, sh, Math.min(4, sw * 0.05));
  ctx.fill();

  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  // Border
  ctx.strokeStyle = isSelected ? '#0099DD' : adjustColor(color, -40);
  ctx.lineWidth = isSelected ? 2 : 1;
  ctx.stroke();

  // Icon + label
  if (sw > 24 && sh > 20) {
    const icon  = item.icon  || (info && info.icon) || '■';
    const label = item.label || (info && info.label) || '';
    const iconSize = Math.min(24, Math.max(10, Math.min(sw, sh) * 0.35));

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (sw > 36 && sh > 36) {
      ctx.font = `${iconSize}px sans-serif`;
      ctx.fillText(icon, 0, sh > 50 ? -sh * 0.12 : 0);

      if (sw > 50 && sh > 50 && label) {
        const fs = Math.min(11, Math.max(7, sw / (label.length * 0.9 + 1)));
        ctx.font = `500 ${fs}px 'Noto Sans Thai', sans-serif`;
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.fillText(label, 0, sh * 0.18);
      }
    } else {
      ctx.font = `${iconSize}px sans-serif`;
      ctx.fillText(icon, 0, 0);
    }
  }

  ctx.restore();

  // Dimension labels
  if (isSelected && zoom >= 0.5) {
    drawDimensionLabel(sx + sw / 2, sy - 12, `${dispW} ซม.`, 'h');
    drawDimensionLabel(sx + sw + 12, sy + sh / 2, `${dispD} ซม.`, 'v');
  }
}

function drawSelectionHandles(el) {
  const { zoom, panX, panY } = state;

  if (el.type === 'room' || el.type === 'furniture') {
    const rot = (el.rotation || 0) % 360;
    const swapped = rot === 90 || rot === 270;
    const w = el.type === 'furniture' ? (swapped ? el.depth : el.width) : el.width;
    const d = el.type === 'furniture' ? (swapped ? el.width : el.depth) : el.depth;

    const sx = el.x * zoom + panX;
    const sy = el.y * zoom + panY;
    const sw = w * zoom;
    const sh = d * zoom;

    // Selection border
    ctx.strokeStyle = '#0099DD';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 3]);
    ctx.strokeRect(sx - 1, sy - 1, sw + 2, sh + 2);
    ctx.setLineDash([]);

    // Corner handles
    const handles = [
      [sx, sy], [sx + sw, sy], [sx, sy + sh], [sx + sw, sy + sh],
      [sx + sw / 2, sy], [sx + sw / 2, sy + sh],
      [sx, sy + sh / 2], [sx + sw, sy + sh / 2],
    ];
    for (const [hx, hy] of handles) {
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = '#0099DD';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(hx, hy, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  } else if (el.type === 'wall') {
    const sx1 = el.x1 * zoom + panX;
    const sy1 = el.y1 * zoom + panY;
    const sx2 = el.x2 * zoom + panX;
    const sy2 = el.y2 * zoom + panY;

    ctx.fillStyle = '#0099DD';
    for (const [hx, hy] of [[sx1, sy1], [sx2, sy2]]) {
      ctx.beginPath(); ctx.arc(hx, hy, 5, 0, Math.PI * 2); ctx.fill();
    }
  }
}

function drawTempShape() {
  const { drawing, zoom, panX, panY, tool } = state;
  const sx = drawing.startX   * zoom + panX;
  const sy = drawing.startY   * zoom + panY;
  const ex = drawing.currentX * zoom + panX;
  const ey = drawing.currentY * zoom + panY;

  if (tool === 'room') {
    const rx = Math.min(sx, ex), ry = Math.min(sy, ey);
    const rw = Math.abs(ex - sx), rh = Math.abs(ey - sy);

    ctx.fillStyle = 'rgba(0,153,221,0.1)';
    ctx.fillRect(rx, ry, rw, rh);
    ctx.strokeStyle = '#0099DD';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 4]);
    ctx.strokeRect(rx, ry, rw, rh);
    ctx.setLineDash([]);

    // Live dimension labels
    const wx = Math.abs(drawing.currentX - drawing.startX);
    const wy = Math.abs(drawing.currentY - drawing.startY);
    if (wx > 0 || wy > 0) {
      drawDimensionLabel(rx + rw / 2, ry - 14, `${Math.round(wx)} ซม.`, 'h');
      drawDimensionLabel(rx + rw + 14, ry + rh / 2, `${Math.round(wy)} ซม.`, 'v');
    }
  }
}

function drawFurnitureGhost() {
  const { pendingFurniture, drawing, zoom, panX, panY } = state;
  if (!pendingFurniture || drawing.currentX === undefined) return;

  const rot = ghostRotation % 360;
  const swapped = rot === 90 || rot === 270;
  const dispW = swapped ? pendingFurniture.depth : pendingFurniture.width;
  const dispD = swapped ? pendingFurniture.width : pendingFurniture.depth;

  const cx = snapToGrid(drawing.currentX);
  const cy = snapToGrid(drawing.currentY);

  const sx = cx * zoom + panX;
  const sy = cy * zoom + panY;
  const sw = dispW * zoom;
  const sh = dispD * zoom;

  ctx.globalAlpha = 0.6;
  ctx.fillStyle = pendingFurniture.color2d || '#C0A870';
  ctx.beginPath();
  ctx.roundRect(sx, sy, sw, sh, 4);
  ctx.fill();
  ctx.strokeStyle = '#0099DD';
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 3]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  // Label
  ctx.font = '11px Noto Sans Thai, sans-serif';
  ctx.fillStyle = '#0099DD';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(`${dispW}×${dispD} ซม.`, sx + sw / 2, sy - 4);
}

function drawWallPreview() {
  const { wallPoints, drawing, zoom, panX, panY } = state;
  const points = [...wallPoints, { x: drawing.currentX, y: drawing.currentY }];

  ctx.beginPath();
  ctx.strokeStyle = '#FF6B35';
  ctx.lineWidth = Math.max(2, 15 * zoom);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  let first = true;
  for (const pt of points) {
    const sx = pt.x * zoom + panX;
    const sy = pt.y * zoom + panY;
    if (first) { ctx.moveTo(sx, sy); first = false; }
    else ctx.lineTo(sx, sy);
  }
  ctx.stroke();

  // Point markers
  for (const pt of wallPoints) {
    ctx.beginPath();
    ctx.fillStyle = '#FF6B35';
    ctx.arc(pt.x * zoom + panX, pt.y * zoom + panY, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawDimensionLabel(cx, cy, text, orientation) {
  ctx.save();
  ctx.font = 'bold 10px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (orientation === 'v') {
    ctx.translate(cx, cy);
    ctx.rotate(-Math.PI / 2);
    cx = 0; cy = 0;
  }

  const tw = ctx.measureText(text).width;
  const pad = 4;
  const bx = (orientation === 'v' ? 0 : cx) - tw / 2 - pad;
  const by = (orientation === 'v' ? 0 : cy) - 8;

  ctx.fillStyle = 'rgba(255,80,30,0.85)';
  ctx.beginPath();
  ctx.roundRect(bx, by, tw + pad * 2, 16, 3);
  ctx.fill();

  ctx.fillStyle = '#fff';
  ctx.fillText(text, orientation === 'v' ? 0 : cx, orientation === 'v' ? 0 : cy);

  ctx.restore();
}

function drawCompass() {
  const x = 30, y = 30, r = 18;
  ctx.save();
  ctx.translate(x, y);

  // Circle
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fill();
  ctx.strokeStyle = '#ccc';
  ctx.lineWidth = 1;
  ctx.stroke();

  // N arrow
  ctx.fillStyle = '#E53935';
  ctx.beginPath();
  ctx.moveTo(0, -r + 4);
  ctx.lineTo(5, 4);
  ctx.lineTo(-5, 4);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#999';
  ctx.beginPath();
  ctx.moveTo(0, r - 4);
  ctx.lineTo(5, -4);
  ctx.lineTo(-5, -4);
  ctx.closePath();
  ctx.fill();

  // N label
  ctx.fillStyle = '#333';
  ctx.font = 'bold 9px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('N', 0, -r - 8);

  ctx.restore();
}

// ---- HIT TESTING ----

function hitTest(wx, wy) {
  // Test in reverse order (top-most first)
  for (let i = state.elements.length - 1; i >= 0; i--) {
    const el = state.elements[i];
    if (hitTestElement(el, wx, wy)) return el;
  }
  return null;
}

function hitTestElement(el, wx, wy) {
  if (el.type === 'room') {
    return wx >= el.x && wx <= el.x + el.width
        && wy >= el.y && wy <= el.y + el.depth;
  }
  if (el.type === 'furniture') {
    const rot = (el.rotation || 0) % 360;
    const swapped = rot === 90 || rot === 270;
    const w = swapped ? el.depth : el.width;
    const d = swapped ? el.width : el.depth;
    return wx >= el.x && wx <= el.x + w
        && wy >= el.y && wy <= el.y + d;
  }
  if (el.type === 'wall') {
    return distToSegment(wx, wy, el.x1, el.y1, el.x2, el.y2) < (el.thickness || 15) / 2 + 5;
  }
  return false;
}

function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

// ---- MOUSE HANDLERS ----

function getWorldPos(e) {
  const rect = canvas.getBoundingClientRect();
  const sx = e.clientX - rect.left;
  const sy = e.clientY - rect.top;
  return screenToWorld(sx, sy);
}

function getSnappedWorldPos(e) {
  const wp = getWorldPos(e);
  return { x: snapToGrid(wp.x), y: snapToGrid(wp.y) };
}

function onMouseDown(e) {
  const rect = canvas.getBoundingClientRect();
  const sx = e.clientX - rect.left;
  const sy = e.clientY - rect.top;

  // Middle mouse or Alt+left = pan
  if (e.button === 1 || (e.button === 0 && e.altKey)) {
    isPanning = true;
    panStart = { x: sx, y: sy };
    panStartOffset = { x: state.panX, y: state.panY };
    canvas.style.cursor = 'grabbing';
    return;
  }

  if (e.button !== 0) return;

  const wp = getWorldPos(e);
  const snapped = { x: snapToGrid(wp.x), y: snapToGrid(wp.y) };

  // Furniture placement
  if (state.pendingFurniture) {
    placeFurniture(snapped.x, snapped.y);
    return;
  }

  if (state.tool === 'select') {
    const hit = hitTest(wp.x, wp.y);
    if (hit) {
      select(hit.id);
      // Start drag
      const rot = (hit.rotation || 0) % 360;
      const swapped = rot === 90 || rot === 270;
      const hw = hit.type === 'furniture' ? (swapped ? hit.depth : hit.width) : hit.width;
      const hd = hit.type === 'furniture' ? (swapped ? hit.width : hit.depth) : hit.depth;
      state.dragging = {
        active: true,
        offsetX: wp.x - (hit.x !== undefined ? hit.x : hit.x1),
        offsetY: wp.y - (hit.y !== undefined ? hit.y : hit.y1),
        elementType: hit.type,
      };
    } else {
      deselect();
    }
  }

  if (state.tool === 'room') {
    state.drawing = {
      active: true,
      startX: snapped.x, startY: snapped.y,
      currentX: snapped.x, currentY: snapped.y,
    };
  }

  if (state.tool === 'wall') {
    if (state.wallPoints.length === 0) {
      state.wallPoints = [snapped];
      state.drawing = { active: true, startX: snapped.x, startY: snapped.y, currentX: snapped.x, currentY: snapped.y };
    } else {
      // Add segment from last point to snapped
      const last = state.wallPoints[state.wallPoints.length - 1];
      addElement({
        id: newId(), type: 'wall',
        x1: last.x, y1: last.y,
        x2: snapped.x, y2: snapped.y,
        thickness: 15,
      });
      state.wallPoints.push(snapped);
    }
  }

  if (state.tool === 'erase') {
    const hit = hitTest(wp.x, wp.y);
    if (hit) removeElement(hit.id);
  }

  scheduleRender();
}

function onMouseMove(e) {
  const rect = canvas.getBoundingClientRect();
  const sx = e.clientX - rect.left;
  const sy = e.clientY - rect.top;

  // Pan
  if (isPanning) {
    state.panX = panStartOffset.x + (sx - panStart.x);
    state.panY = panStartOffset.y + (sy - panStart.y);
    scheduleRender();
    updateStatusBar(getWorldPos(e));
    return;
  }

  const wp = getWorldPos(e);
  const snapped = { x: snapToGrid(wp.x), y: snapToGrid(wp.y) };

  // Update drawing current pos
  state.drawing.currentX = snapped.x;
  state.drawing.currentY = snapped.y;

  // Dragging element
  if (state.dragging.active && state.selectedId) {
    const el = getSelected();
    if (!el) { state.dragging.active = false; return; }

    const nx = snapToGrid(wp.x - state.dragging.offsetX);
    const ny = snapToGrid(wp.y - state.dragging.offsetY);

    if (el.type === 'room' || el.type === 'furniture') {
      el.x = nx;
      el.y = ny;
    } else if (el.type === 'wall') {
      const dx = nx - el.x1;
      const dy = ny - el.y1;
      el.x1 += dx; el.y1 += dy;
      el.x2 += dx; el.y2 += dy;
    }
    notify();
    scheduleRender();
  } else {
    scheduleRender();
  }

  updateStatusBar(wp);
}

function onMouseUp(e) {
  if (isPanning) {
    isPanning = false;
    canvas.style.cursor = '';
    return;
  }

  if (state.dragging.active) {
    state.dragging.active = false;
    saveSnapshot(); // Save drag result to history
    notify();
    return;
  }

  if (state.tool === 'room' && state.drawing.active) {
    finishRoom();
  }
}

function onMouseLeave() {
  if (isPanning) isPanning = false;
  state.drawing.currentX = undefined;
  scheduleRender();
}

function onDblClick(e) {
  if (state.tool === 'wall' && state.wallPoints.length > 0) {
    state.wallPoints = [];
    state.drawing.active = false;
    scheduleRender();
  }
}

function onWheel(e) {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const sx = e.clientX - rect.left;
  const sy = e.clientY - rect.top;

  const zoomFactor = e.deltaY < 0 ? 1.12 : (1 / 1.12);
  const oldZoom = state.zoom;
  const newZoom = Math.max(0.1, Math.min(10, oldZoom * zoomFactor));

  // Zoom towards mouse position
  state.panX = sx - (sx - state.panX) * (newZoom / oldZoom);
  state.panY = sy - (sy - state.panY) * (newZoom / oldZoom);
  state.zoom = newZoom;

  scheduleRender();
  updateZoomDisplay();
}

function onKeyDown(e) {
  if (state.mode !== '2d') return;

  // Ignore when typing in inputs
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

  switch (e.key) {
    case 'Delete':
    case 'Backspace':
      if (state.selectedId) { removeElement(state.selectedId); }
      break;
    case 'Escape':
      if (state.pendingFurniture) {
        state.pendingFurniture = null;
        document.getElementById('placement-hint').classList.add('hidden');
        document.querySelectorAll('.furniture-item').forEach(el => el.classList.remove('selected'));
      } else if (state.drawing.active) {
        state.drawing.active = false;
        state.wallPoints = [];
      } else {
        deselect();
      }
      break;
    case 'r': case 'R':
      if (state.pendingFurniture) {
        ghostRotation = (ghostRotation + 90) % 360;
      } else if (state.selectedId) {
        const el = getSelected();
        if (el && el.type === 'furniture') {
          updateElement(el.id, { rotation: ((el.rotation || 0) + 90) % 360 });
        }
      }
      break;
    case 'f': case 'F':
      fitToContent();
      break;
    case 'g': case 'G':
      state.snapEnabled = !state.snapEnabled;
      document.getElementById('snap-toggle').checked = state.snapEnabled;
      break;
  }
  scheduleRender();
}

// ---- ACTIONS ----

function finishRoom() {
  const { drawing } = state;
  const x = Math.min(drawing.startX, drawing.currentX);
  const y = Math.min(drawing.startY, drawing.currentY);
  const w = Math.abs(drawing.currentX - drawing.startX);
  const d = Math.abs(drawing.currentY - drawing.startY);

  if (w >= 50 && d >= 50) {
    const color = ROOM_COLORS[roomColorIndex % ROOM_COLORS.length];
    roomColorIndex++;
    addElement({
      id: newId(),
      type: 'room',
      x, y, width: w, depth: d,
      label: 'ห้อง',
      color,
      wallColor: '#B0A090',
      wallThickness: 15,
    });
  }

  state.drawing = { active: false, startX: 0, startY: 0, currentX: 0, currentY: 0 };
}

function placeFurniture(wx, wy) {
  const pf = state.pendingFurniture;
  if (!pf) return;

  const rot = ghostRotation % 360;
  const swapped = rot === 90 || rot === 270;
  const displayW = swapped ? pf.depth : pf.width;
  const displayD = swapped ? pf.width : pf.depth;

  addElement({
    id: newId(),
    type: 'furniture',
    furnitureType: pf.type,
    label: pf.label,
    icon: pf.icon,
    x: wx,
    y: wy,
    width: pf.width,
    depth: pf.depth,
    rotation: ghostRotation,
    color: pf.color2d,
  });

  // Keep placing until Escape
  // state.pendingFurniture = null;
}

// ---- ZOOM / FIT ----

export function zoomIn()  { zoomAroundCenter(1.2); }
export function zoomOut() { zoomAroundCenter(1 / 1.2); }

function zoomAroundCenter(factor) {
  const cx = canvas.width  / 2;
  const cy = canvas.height / 2;
  const oldZ = state.zoom;
  const newZ = Math.max(0.1, Math.min(10, oldZ * factor));
  state.panX = cx - (cx - state.panX) * (newZ / oldZ);
  state.panY = cy - (cy - state.panY) * (newZ / oldZ);
  state.zoom = newZ;
  scheduleRender();
  updateZoomDisplay();
}

export function fitToContent() {
  if (state.elements.length === 0) {
    // Center on origin
    state.zoom = 1.0;
    state.panX = canvas.width  / 2 - 200;
    state.panY = canvas.height / 2 - 150;
    scheduleRender();
    updateZoomDisplay();
    return;
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  for (const el of state.elements) {
    if (el.type === 'room' || el.type === 'furniture') {
      const rot = (el.rotation || 0) % 360;
      const swapped = rot === 90 || rot === 270;
      const w = el.type === 'furniture' ? (swapped ? el.depth : el.width) : el.width;
      const d = el.type === 'furniture' ? (swapped ? el.width : el.depth) : el.depth;
      minX = Math.min(minX, el.x); minY = Math.min(minY, el.y);
      maxX = Math.max(maxX, el.x + w); maxY = Math.max(maxY, el.y + d);
    } else if (el.type === 'wall') {
      minX = Math.min(minX, el.x1, el.x2); minY = Math.min(minY, el.y1, el.y2);
      maxX = Math.max(maxX, el.x1, el.x2); maxY = Math.max(maxY, el.y1, el.y2);
    }
  }

  const margin = 60;
  const contentW = maxX - minX;
  const contentH = maxY - minY;
  const scaleX = (canvas.width  - margin * 2) / contentW;
  const scaleY = (canvas.height - margin * 2) / contentH;
  const newZoom = Math.max(0.05, Math.min(5, Math.min(scaleX, scaleY)));

  state.zoom = newZoom;
  state.panX = canvas.width  / 2 - (minX + contentW / 2) * newZoom;
  state.panY = canvas.height / 2 - (minY + contentH / 2) * newZoom;

  scheduleRender();
  updateZoomDisplay();
}

function updateZoomDisplay() {
  const el = document.getElementById('zoom-display');
  if (el) el.textContent = `${Math.round(state.zoom * 100)}%`;
}

// ---- STATUS BAR ----

function updateStatusBar(wp) {
  const pos = document.getElementById('status-pos');
  const cnt = document.getElementById('status-count');
  if (pos) pos.textContent = `X: ${Math.round(wp.x)}, Y: ${Math.round(wp.y)} ซม.`;
  if (cnt) cnt.textContent = `${state.elements.length} องค์ประกอบ`;
}

// ---- UTILS ----

function adjustColor(hex, amount) {
  try {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.max(0, Math.min(255, (num >> 16) + amount));
    const g = Math.max(0, Math.min(255, ((num >> 8) & 0xFF) + amount));
    const b = Math.max(0, Math.min(255, (num & 0xFF) + amount));
    return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
  } catch {
    return '#888';
  }
}

export function getCanvas() { return canvas; }
export function triggerRender() { scheduleRender(); }

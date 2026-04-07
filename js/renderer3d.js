// ============================================================
// Realistic 3D Renderer - SketchUp-like with PBR materials
// Three.js with procedural textures, detailed furniture, shadows
// ============================================================

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { state, subscribe } from './state.js';
import { getFurnitureInfo } from './furniture-catalog.js';

let scene, camera, renderer, controls;
let container;
let isInitialized = false;
let rafId3d = null;
let roomGroup = null;
let furnitureGroup = null;

const WALL_HEIGHT = 260;
const WALL_THICKNESS = 15;

// ---- Procedural Textures ----

function makeWoodTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const ctx = c.getContext('2d');
  // Base warm wood color
  ctx.fillStyle = '#C4935A';
  ctx.fillRect(0, 0, 512, 512);
  // Plank lines (horizontal)
  const plankH = 64;
  for (let y = 0; y < 512; y += plankH) {
    // Plank border
    ctx.fillStyle = 'rgba(80,50,20,0.35)';
    ctx.fillRect(0, y, 512, 2);
    // Grain lines
    for (let g = 0; g < 8; g++) {
      const gy = y + 8 + g * 6 + Math.random() * 4;
      ctx.strokeStyle = `rgba(${100 + Math.floor(Math.random()*40)},${60 + Math.floor(Math.random()*30)},20,0.12)`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, gy);
      // Slightly wavy line
      for (let x = 0; x <= 512; x += 20) {
        ctx.lineTo(x, gy + (Math.random() - 0.5) * 3);
      }
      ctx.stroke();
    }
    // Subtle color variation per plank
    const alpha = (Math.random() * 0.08);
    ctx.fillStyle = `rgba(${Math.random() > 0.5 ? 180 : 140},${Math.random() > 0.5 ? 110 : 80},40,${alpha})`;
    ctx.fillRect(0, y + 2, 512, plankH - 4);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  return tex;
}

function makeWallTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#F0EDE6';
  ctx.fillRect(0, 0, 256, 256);
  // Subtle plaster noise
  for (let i = 0; i < 3000; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const v = Math.floor(Math.random() * 20 - 10);
    ctx.fillStyle = `rgba(${180 + v},${170 + v},${155 + v},0.08)`;
    ctx.fillRect(x, y, 2, 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 1);
  return tex;
}

function makeTileTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#E8E8E8';
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = '#C8C8C8';
  ctx.lineWidth = 3;
  const ts = 64;
  for (let x = 0; x <= 256; x += ts) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 256); ctx.stroke(); }
  for (let y = 0; y <= 256; y += ts) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke(); }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  return tex;
}

function makeSkyTexture() {
  const c = document.createElement('canvas');
  c.width = 2; c.height = 512;
  const ctx = c.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#B8D4EC');
  grad.addColorStop(0.5, '#D8EAF5');
  grad.addColorStop(1, '#F0F0EB');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 2, 512);
  return new THREE.CanvasTexture(c);
}

// Cache textures
let _woodTex, _wallTex, _tileTex;
function getWoodTex() { if (!_woodTex) _woodTex = makeWoodTexture(); return _woodTex; }
function getWallTex() { if (!_wallTex) _wallTex = makeWallTexture(); return _wallTex; }
function getTileTex() { if (!_tileTex) _tileTex = makeTileTexture(); return _tileTex; }

// ---- Helper functions ----

function mkMesh(geo, mat) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function box(w, h, d) { return new THREE.BoxGeometry(w, h, d); }

function stdMat(opts) {
  return new THREE.MeshStandardMaterial(opts);
}

function addEdges(meshObj, parent, color = 0x444444, opacity = 0.18) {
  const eg = new THREE.EdgesGeometry(meshObj.geometry, 20);
  const el = new THREE.LineSegments(eg, new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
  el.position.copy(meshObj.position);
  el.rotation.copy(meshObj.rotation);
  parent.add(el);
}

function addMesh(parent, geo, mat, x, y, z, rx = 0, ry = 0, rz = 0, withEdges = false) {
  const m = mkMesh(geo, mat);
  m.position.set(x, y, z);
  if (rx) m.rotation.x = rx;
  if (ry) m.rotation.y = ry;
  if (rz) m.rotation.z = rz;
  parent.add(m);
  if (withEdges) addEdges(m, parent);
  return m;
}

// ---- Material presets ----

const MAT = {
  get woodFloor() { return stdMat({ map: getWoodTex(), roughness: 0.75, metalness: 0 }); },
  get wall() { return stdMat({ map: getWallTex(), roughness: 0.9, metalness: 0, color: 0xF5F0E8 }); },
  get wallFront() { return stdMat({ map: getWallTex(), roughness: 0.9, metalness: 0, color: 0xF5F0E8, transparent: true, opacity: 0.1 }); },
  get tileFloor() { return stdMat({ map: getTileTex(), roughness: 0.35, metalness: 0.05 }); },
  get ceiling() { return stdMat({ color: 0xF8F6F2, roughness: 1, metalness: 0, transparent: true, opacity: 0.07 }); },
  get baseboard() { return stdMat({ color: 0xECE8E0, roughness: 0.8 }); },
  get ground() { return stdMat({ color: 0x7A8A6A, roughness: 1, metalness: 0 }); },
  get glass() { return stdMat({ color: 0xADD8F0, transparent: true, opacity: 0.25, roughness: 0.05, metalness: 0.1 }); },
  get ceramic() { return stdMat({ color: 0xF5F5F5, roughness: 0.3, metalness: 0.05 }); },
  get metal() { return stdMat({ color: 0xC0C8D0, roughness: 0.2, metalness: 0.85 }); },
  get woodFurn() { return stdMat({ color: 0x7A5530, roughness: 0.75, metalness: 0 }); },
  get darkWood() { return stdMat({ color: 0x3C2D1E, roughness: 0.7, metalness: 0 }); },
  get lightWood() { return stdMat({ color: 0xC4A882, roughness: 0.65, metalness: 0 }); },
  get fabric() { return stdMat({ color: 0x7A5548, roughness: 0.9, metalness: 0 }); },
  get white() { return stdMat({ color: 0xF8F8F8, roughness: 0.5 }); },
};

// ---- Room building ----

function buildRoom(room, group) {
  const w = room.width;
  const d = room.depth;
  const x0 = room.x + w / 2;
  const z0 = room.y + d / 2;
  const T = WALL_THICKNESS;
  const H = WALL_HEIGHT;
  const innerW = w - T * 2;
  const innerD = d - T * 2;

  // Detect bathroom/kitchen by label
  const isBath = room.label && /bath|น้ำ|toilet/i.test(room.label);
  const floorMat = isBath ? MAT.tileFloor : MAT.woodFloor;

  // Floor
  const floorGeo = new THREE.PlaneGeometry(innerW, innerD);
  const floor = mkMesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(x0, 0.5, z0);
  floor.receiveShadow = true;
  floor.castShadow = false;
  group.add(floor);

  // Ceiling
  const ceilGeo = new THREE.PlaneGeometry(innerW, innerD);
  const ceil = mkMesh(ceilGeo, MAT.ceiling);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(x0, H, z0);
  ceil.castShadow = false;
  group.add(ceil);

  // Walls: left, right, back (solid), front (transparent)
  // Left wall (x = x0 - w/2 + T/2)
  const wallMats = [MAT.wall, MAT.wall, MAT.wall, MAT.wallFront];
  const wallDefs = [
    { pos: [x0 - w / 2 + T / 2, H / 2, z0], size: [T, H, d], solid: true },    // left
    { pos: [x0 + w / 2 - T / 2, H / 2, z0], size: [T, H, d], solid: true },    // right
    { pos: [x0, H / 2, z0 - d / 2 + T / 2], size: [w, H, T], solid: true },    // back
    { pos: [x0, H / 2, z0 + d / 2 - T / 2], size: [w, H, T], solid: false },   // front (transparent)
  ];

  wallDefs.forEach(({ pos, size, solid }, i) => {
    const mat = solid ? MAT.wall : MAT.wallFront;
    const wm = mkMesh(box(...size), mat);
    wm.position.set(...pos);
    group.add(wm);
    if (solid) {
      addEdges(wm, group, 0xCCC0B0, 0.35);
      // Baseboard
      const bm = mkMesh(box(size[0] + 1, 8, size[2] + 1), MAT.baseboard);
      bm.position.set(pos[0], 4, pos[2]);
      group.add(bm);
    }
  });
}

// ---- Furniture builders ----

function buildBed(g, fw, fd, isSingle) {
  const woodMat = stdMat({ color: 0x7A5530, roughness: 0.8 });
  const mattressMat = stdMat({ color: 0xF0ECE4, roughness: 0.9 });
  const headMat = stdMat({ color: 0x6B4520, roughness: 0.8 });
  const pilMat = stdMat({ color: 0xF5F2EE, roughness: 0.95 });
  const duvetMat = stdMat({ color: 0x6B8DB8, roughness: 0.9 });

  // Frame
  addMesh(g, box(fw, 35, fd), woodMat, 0, 17.5, 0, 0, 0, 0, true);
  // Mattress
  addMesh(g, box(fw - 8, 22, fd - 6), mattressMat, 0, 35 + 11, 0);
  // Headboard
  addMesh(g, box(fw, 85, 12), headMat, 0, 35 + 42, -fd / 2 - 6);
  // Pillows
  const pw = fw * 0.4, ph = 12, pd = fd * 0.2;
  addMesh(g, box(pw, ph, pd), pilMat, fw * 0.2, 35 + 22 + 6, -fd * 0.28);
  addMesh(g, box(pw, ph, pd), pilMat, -fw * 0.2, 35 + 22 + 6, -fd * 0.28);
  // Duvet
  addMesh(g, box(fw - 10, 10, fd * 0.6), duvetMat, 0, 35 + 22 + 5, fd * 0.15);
}

function buildSofa(g, fw, fd) {
  const armW = fw * 0.08;
  const frameMat = stdMat({ color: 0x6B4C2A, roughness: 0.85 });
  const cushMat = stdMat({ color: 0x8A6A48, roughness: 0.9 });
  const backMat = stdMat({ color: 0x5C3D20, roughness: 0.8 });
  const legMat = stdMat({ color: 0x3E2918, roughness: 0.7 });

  // Base
  addMesh(g, box(fw, 40, fd), frameMat, 0, 20, 0, 0, 0, 0, true);
  // Seat cushions (3)
  const cw = (fw - armW * 2) / 3 - 3;
  for (let i = -1; i <= 1; i++) {
    addMesh(g, box(cw, 16, fd * 0.52), cushMat, i * (cw + 3), 48, fd * 0.05);
  }
  // Backrest
  addMesh(g, box(fw - armW * 2, 55, fd * 0.2), backMat, 0, 27, -fd / 2 + fd * 0.1);
  // Armrests
  addMesh(g, box(armW, 58, fd), frameMat, fw / 2 - armW / 2, 29, 0);
  addMesh(g, box(armW, 58, fd), frameMat, -fw / 2 + armW / 2, 29, 0);
  // Legs
  const legX = fw / 2 - 8, legZ = fd / 2 - 8;
  [[legX, legZ], [-legX, legZ], [legX, -legZ], [-legX, -legZ]].forEach(([lx, lz]) => {
    addMesh(g, box(6, 14, 6), legMat, lx, 7, lz);
  });
}

function buildWardrobe(g, fw, fd) {
  const bodyMat = stdMat({ color: 0x5C3D2E, roughness: 0.7 });
  const doorMat = stdMat({ color: 0x7A5540, roughness: 0.65 });
  const handleMat = stdMat({ color: 0xC8A040, roughness: 0.2, metalness: 0.8 });

  addMesh(g, box(fw, 220, fd), bodyMat, 0, 110, 0, 0, 0, 0, true);
  addMesh(g, box(fw / 2 - 3, 215, 5), doorMat, fw / 4, 107, fd / 2 + 2.5);
  addMesh(g, box(fw / 2 - 3, 215, 5), doorMat, -fw / 4, 107, fd / 2 + 2.5);
  addMesh(g, box(3, 22, 4), handleMat, fw / 4 - fw * 0.15, 107, fd / 2 + 5);
  addMesh(g, box(3, 22, 4), handleMat, -fw / 4 + fw * 0.15, 107, fd / 2 + 5);
}

function buildTvStand(g, fw, fd) {
  const cabMat = stdMat({ color: 0x3C2D1E, roughness: 0.7 });
  const frameMat = stdMat({ color: 0x1A1A1A, roughness: 0.5 });
  const screenMat = stdMat({ color: 0x1B3A6B, emissive: new THREE.Color(0x0A1E40), emissiveIntensity: 0.5, roughness: 0.1 });

  addMesh(g, box(fw, 52, fd), cabMat, 0, 26, 0, 0, 0, 0, true);
  const tvH = fw * 0.55;
  addMesh(g, box(fw * 0.92, tvH, 8), frameMat, 0, 52 + tvH / 2 + 8, -fd * 0.1);
  addMesh(g, box(fw * 0.86, tvH - 6, 3), screenMat, 0, 52 + tvH / 2 + 8, -fd * 0.1 - 1);
}

function buildDesk(g, fw, fd) {
  const topMat = stdMat({ color: 0xC4A882, roughness: 0.65 });
  const legMat = stdMat({ color: 0x5A4030, roughness: 0.6 });

  addMesh(g, box(fw, 5, fd), topMat, 0, 74, 0);
  [[fw / 2 - 4, fd / 2 - 4], [-fw / 2 + 4, fd / 2 - 4], [fw / 2 - 4, -fd / 2 + 4], [-fw / 2 + 4, -fd / 2 + 4]].forEach(([lx, lz]) => {
    addMesh(g, box(5, 70, 5), legMat, lx, 35, lz);
  });
}

function buildChair(g, fw, fd) {
  const seatMat = stdMat({ color: 0x7A5548, roughness: 0.85 });
  const legMat = stdMat({ color: 0x3E2723, roughness: 0.7 });

  addMesh(g, box(fw - 4, 7, fd * 0.68), seatMat, 0, 44, 0);
  addMesh(g, box(fw - 4, 42, 6), seatMat, 0, 44 + 21, -fd * 0.37);
  [[fw / 2 - 4, fd / 2 - 4], [-fw / 2 + 4, fd / 2 - 4], [fw / 2 - 4, -fd / 2 + 4], [-fw / 2 + 4, -fd / 2 + 4]].forEach(([lx, lz]) => {
    addMesh(g, box(4, 44, 4), legMat, lx, 22, lz);
  });
}

function buildToilet(g, fw, fd) {
  const cerMat = stdMat({ color: 0xF5F5F5, roughness: 0.3, metalness: 0.05 });

  addMesh(g, box(fw, 10, fd), cerMat, 0, 5, 0);
  addMesh(g, box(fw - 4, 28, fd * 0.68), cerMat, 0, 10 + 14, fd * 0.1);
  addMesh(g, box(fw - 10, 38, 20), cerMat, 0, 19, -fd / 2 + 10);
  addMesh(g, box(fw - 4, 4, fd * 0.68), stdMat({ color: 0xEEEEEE, roughness: 0.3 }), 0, 10 + 28 + 2, fd * 0.1);
}

function buildSink(g, fw, fd) {
  const cerMat = stdMat({ color: 0xF5F5F5, roughness: 0.3, metalness: 0.05 });
  const metMat = stdMat({ color: 0xC0C8D0, roughness: 0.2, metalness: 0.85 });

  addMesh(g, box(18, 62, 18), cerMat, 0, 31, 0);
  addMesh(g, box(fw, 10, fd), cerMat, 0, 66, 0);
  addMesh(g, box(fw - 14, 14, fd - 14), stdMat({ color: 0xEEEEEE, roughness: 0.2 }), 0, 60, 0);
  addMesh(g, box(6, 5, 6), metMat, 0, 73, -fd * 0.25);
  addMesh(g, box(3, 14, 3), metMat, 0, 80, -fd * 0.25);
  addMesh(g, box(12, 3, 3), metMat, 0, 87, -fd * 0.15);
}

function buildShower(g, fw, fd) {
  const baseMat = stdMat({ color: 0xE8E8E8, roughness: 0.3 });
  const glassMat = stdMat({ color: 0xADD8F0, transparent: true, opacity: 0.22, roughness: 0.05 });
  const metMat = stdMat({ color: 0xB8BEC4, roughness: 0.15, metalness: 0.85 });

  addMesh(g, box(fw, 10, fd), baseMat, 0, 5, 0);
  // Glass walls: back, left, right
  addMesh(g, box(fw, 200, 5), glassMat, 0, 100 + 10, -fd / 2 + 2.5);
  addMesh(g, box(5, 200, fd), glassMat, -fw / 2 + 2.5, 100 + 10, 0);
  addMesh(g, box(5, 200, fd), glassMat, fw / 2 - 2.5, 100 + 10, 0);
  // Pole + showerhead
  addMesh(g, box(4, 185, 4), metMat, -fw / 2 + 5, 95 + 10, -fd / 2 + 5);
  addMesh(g, box(22, 6, 22), metMat, -fw / 2 + 5, 185 + 10, -fd / 2 + 5);
}

function buildFridge(g, fw, fd) {
  const bodyMat = stdMat({ color: 0xECEFF1, roughness: 0.25, metalness: 0.15 });
  const handleMat = stdMat({ color: 0xB0BEC5, roughness: 0.15, metalness: 0.8 });
  const divMat = stdMat({ color: 0x546E7A, roughness: 0.3 });

  addMesh(g, box(fw, 170, fd), bodyMat, 0, 85, 0, 0, 0, 0, true);
  addMesh(g, box(fw + 2, 3, 2), divMat, 0, 170 * 0.65, fd / 2 + 1);
  addMesh(g, box(4, 45, 4), handleMat, fw / 2 - 7, 170 * 0.75, fd / 2 + 3);
}

function buildKitchenCounter(g, fw, fd) {
  const cabMat = stdMat({ color: 0xE0E0E0, roughness: 0.5 });
  const topMat = stdMat({ color: 0xF0F0EC, roughness: 0.25, metalness: 0.05 });

  addMesh(g, box(fw, 88, fd), cabMat, 0, 44, 0, 0, 0, 0, true);
  addMesh(g, box(fw + 5, 5, fd + 5), topMat, 0, 90, 0);
  // Door lines
  const divW = fw / 2 - 4;
  addMesh(g, box(3, 80, 3), stdMat({ color: 0xC8C8C8 }), 0, 44, fd / 2 + 1);
}

function buildWindow(g, fw, fd) {
  const frameMat = stdMat({ color: 0xF0EDE8, roughness: 0.7 });
  const glassMat = stdMat({ color: 0xADD8F0, transparent: true, opacity: 0.3, roughness: 0.05 });
  const sillMat = stdMat({ color: 0xE8E4DC, roughness: 0.6 });

  // Frame
  addMesh(g, box(8, 125, fd + 2), frameMat, -fw / 2 + 4, 90 + 62, 0);
  addMesh(g, box(8, 125, fd + 2), frameMat, fw / 2 - 4, 90 + 62, 0);
  addMesh(g, box(fw, 7, fd + 2), frameMat, 0, 90, 0);
  addMesh(g, box(fw, 7, fd + 2), frameMat, 0, 215, 0);
  // Glass
  addMesh(g, box(fw - 8, 122, 3), glassMat, 0, 90 + 61, 0);
  // Sill
  addMesh(g, box(fw + 10, 5, fd + 15), sillMat, 0, 88, 0);
}

function buildDoor(g, fw, fd) {
  const frameMat = stdMat({ color: 0x9E8060, roughness: 0.8 });
  const panelMat = stdMat({ color: 0xA8906A, roughness: 0.75 });
  const handleMat = stdMat({ color: 0xD4AF37, roughness: 0.2, metalness: 0.9 });
  const decMat = stdMat({ color: 0x8A7050, roughness: 0.8 });

  addMesh(g, box(fw + 8, 215, fd + 4), frameMat, 0, 107, 0, 0, 0, 0, true);
  addMesh(g, box(fw - 2, 210, fd + 6), panelMat, 0, 105, 0);
  // Panel decorations
  addMesh(g, box(fw * 0.6, 210 * 0.22, 5), decMat, 0, 210 * 0.25, fd / 2 + 3);
  addMesh(g, box(fw * 0.6, 210 * 0.22, 5), decMat, 0, 210 * 0.65, fd / 2 + 3);
  // Handle
  addMesh(g, box(4, 20, 4), handleMat, fw / 2 - 14, 210 * 0.45, fd / 2 + 5);
}

function buildGenericFurniture(g, fw, fd, info) {
  const mat = stdMat({ color: new THREE.Color(info.color3d || info.color2d || '#8B7355'), roughness: 0.75 });
  const h = info.draw3dHeight || 80;
  addMesh(g, box(fw, h, fd), mat, 0, h / 2, 0, 0, 0, 0, true);
}

// ---- Dispatch furniture builder ----

function buildFurnitureItem(item, furnitureGroup) {
  const info = getFurnitureInfo(item.subtype || item.furnitureType);
  if (!info) return;

  const fw = item.width;
  const fd = item.depth;
  const cx = item.x + fw / 2;
  const cz = item.y + fd / 2;

  const g = new THREE.Group();
  g.position.set(cx, 0, cz);
  g.rotation.y = -(item.rotation || 0) * Math.PI / 180;

  const t = item.subtype || item.furnitureType || '';

  if (t.startsWith('bed')) buildBed(g, fw, fd, t === 'bed_single');
  else if (t.startsWith('sofa')) buildSofa(g, fw, fd);
  else if (t === 'wardrobe') buildWardrobe(g, fw, fd);
  else if (t === 'tv_stand') buildTvStand(g, fw, fd);
  else if (t === 'desk') buildDesk(g, fw, fd);
  else if (t === 'chair') buildChair(g, fw, fd);
  else if (t === 'toilet') buildToilet(g, fw, fd);
  else if (t === 'sink') buildSink(g, fw, fd);
  else if (t === 'shower') buildShower(g, fw, fd);
  else if (t === 'fridge') buildFridge(g, fw, fd);
  else if (t === 'kitchen_counter') buildKitchenCounter(g, fw, fd);
  else if (t === 'window') buildWindow(g, fw, fd);
  else if (t === 'door') buildDoor(g, fw, fd);
  else buildGenericFurniture(g, fw, fd, info);

  furnitureGroup.add(g);
}

// ---- Scene rebuild ----

function clearGroup(grp) {
  if (!grp) return;
  grp.traverse(obj => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
      else obj.material.dispose();
    }
  });
  while (grp.children.length) grp.remove(grp.children[0]);
}

function rebuildScene() {
  if (!isInitialized) return;

  clearGroup(roomGroup);
  clearGroup(furnitureGroup);

  const rooms = state.elements.filter(e => e.type === 'room');
  const walls = state.elements.filter(e => e.type === 'wall');
  const furniture = state.elements.filter(e => e.type === 'furniture');

  rooms.forEach(r => buildRoom(r, roomGroup));

  // Standalone walls
  walls.forEach(w => {
    const dx = w.x2 - w.x1, dz = w.y2 - w.y1;
    const len = Math.sqrt(dx * dx + dz * dz);
    const angle = Math.atan2(dz, dx);
    const wm = mkMesh(box(len, WALL_HEIGHT, w.thickness || 15), MAT.wall);
    wm.position.set((w.x1 + w.x2) / 2, WALL_HEIGHT / 2, (w.y1 + w.y2) / 2);
    wm.rotation.y = -angle;
    roomGroup.add(wm);
    addEdges(wm, roomGroup, 0xCCC0B0, 0.35);
  });

  furniture.forEach(f => buildFurnitureItem(f, furnitureGroup));

  // Update camera target to center of floor plan
  if (rooms.length > 0) {
    let cx = 0, cz = 0;
    rooms.forEach(r => { cx += r.x + r.width / 2; cz += r.y + r.depth / 2; });
    cx /= rooms.length; cz /= rooms.length;
    controls.target.set(cx, 0, cz);
    controls.update();
  }
}

// ---- Init ----

export function init3D(containerEl) {
  container = containerEl;
  if (isInitialized) {
    rebuildScene();
    return;
  }

  // Scene
  scene = new THREE.Scene();
  scene.background = makeSkyTexture();
  scene.fog = new THREE.FogExp2(0xE8EEF5, 0.0003);

  // Camera
  camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 1, 20000);
  camera.position.set(500, 600, 800);
  camera.lookAt(350, 0, 300);

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  // OrbitControls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.maxPolarAngle = Math.PI / 2 - 0.03;
  controls.target.set(350, 0, 300);
  controls.update();

  // Lighting
  const ambient = new THREE.AmbientLight(0xffffff, 0.35);
  scene.add(ambient);

  const sun = new THREE.DirectionalLight(0xFFF5E0, 1.6);
  sun.position.set(800, 900, 400);
  sun.castShadow = true;
  sun.shadow.mapSize.width = 4096;
  sun.shadow.mapSize.height = 4096;
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 5000;
  sun.shadow.camera.left = -2000;
  sun.shadow.camera.right = 2000;
  sun.shadow.camera.top = 2000;
  sun.shadow.camera.bottom = -2000;
  sun.shadow.bias = -0.0005;
  scene.add(sun);

  const fill = new THREE.DirectionalLight(0xC8D8FF, 0.45);
  fill.position.set(-500, 400, -200);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xFFE8C0, 0.25);
  rim.position.set(100, 300, -700);
  scene.add(rim);

  const hemi = new THREE.HemisphereLight(0xC8E0FF, 0xD4B896, 0.3);
  scene.add(hemi);

  // Ground plane
  const ground = mkMesh(new THREE.PlaneGeometry(6000, 6000), MAT.ground);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.5;
  ground.receiveShadow = true;
  ground.castShadow = false;
  scene.add(ground);

  // Grid
  const grid = new THREE.GridHelper(6000, 120, 0x555555, 0x444444);
  grid.position.y = 0.1;
  scene.add(grid);

  // Groups
  roomGroup = new THREE.Group();
  furnitureGroup = new THREE.Group();
  scene.add(roomGroup);
  scene.add(furnitureGroup);

  isInitialized = true;
  rebuildScene();

  // Resize handler
  const ro = new ResizeObserver(() => {
    if (!container) return;
    renderer.setSize(container.clientWidth, container.clientHeight);
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
  });
  ro.observe(container);

  // Animation loop
  function animate() {
    rafId3d = requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();
}

export function refresh3D() {
  rebuildScene();
}

export function is3DInitialized() {
  return isInitialized;
}

export function resetCamera() {
  if (!controls) return;
  const rooms = state.elements.filter(e => e.type === 'room');
  let cx = 350, cz = 300;
  if (rooms.length > 0) {
    cx = 0; cz = 0;
    rooms.forEach(r => { cx += r.x + r.width / 2; cz += r.y + r.depth / 2; });
    cx /= rooms.length; cz /= rooms.length;
  }
  camera.position.set(cx + 500, 600, cz + 800);
  controls.target.set(cx, 0, cz);
  controls.update();
}

export function topView() {
  if (!controls) return;
  const rooms = state.elements.filter(e => e.type === 'room');
  let cx = 350, cz = 300;
  if (rooms.length > 0) {
    cx = 0; cz = 0;
    rooms.forEach(r => { cx += r.x + r.width / 2; cz += r.y + r.depth / 2; });
    cx /= rooms.length; cz /= rooms.length;
  }
  camera.position.set(cx, 1200, cz);
  controls.target.set(cx, 0, cz);
  controls.update();
}

export function stop3DLoop() {
  if (rafId3d) {
    cancelAnimationFrame(rafId3d);
    rafId3d = null;
  }
}

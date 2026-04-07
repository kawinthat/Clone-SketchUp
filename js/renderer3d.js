// ============================================================
// 3D Isometric Renderer using Three.js
// ============================================================

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { state, subscribe } from './state.js';
import { getFurnitureInfo } from './furniture-catalog.js';

let scene, camera, renderer, controls;
let container;
let isInitialized = false;
let rafId3d = null;

// Material cache
const matCache = new Map();

function getMat(colorHex, opts = {}) {
  const key = `${colorHex}_${JSON.stringify(opts)}`;
  if (matCache.has(key)) return matCache.get(key);
  const mat = new THREE.MeshLambertMaterial({
    color: colorHex,
    ...opts,
  });
  matCache.set(key, mat);
  return mat;
}

export function init3D(containerEl) {
  container = containerEl;
  if (isInitialized) return;

  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x2B2B2B);
  scene.fog = new THREE.Fog(0x2B2B2B, 3000, 8000);

  // Camera (perspective, positioned at isometric-like angle)
  camera = new THREE.PerspectiveCamera(
    45,
    container.clientWidth / container.clientHeight,
    1,
    10000,
  );
  camera.position.set(600, 700, 700);
  camera.lookAt(300, 0, 250);

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  container.appendChild(renderer.domElement);

  // Lights
  const ambient = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambient);

  const sun = new THREE.DirectionalLight(0xfff5e0, 1.2);
  sun.position.set(500, 800, 300);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 4000;
  sun.shadow.camera.left  = -1000;
  sun.shadow.camera.right =  1000;
  sun.shadow.camera.top   =  1000;
  sun.shadow.camera.bottom = -1000;
  sun.shadow.bias = -0.001;
  scene.add(sun);

  const fill = new THREE.DirectionalLight(0xc8deff, 0.4);
  fill.position.set(-300, 400, -200);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xffe0b0, 0.3);
  rim.position.set(200, 200, -500);
  scene.add(rim);

  // Hemisphere light (sky/ground)
  const hemi = new THREE.HemisphereLight(0xddeeff, 0xD4C4A0, 0.4);
  scene.add(hemi);

  // OrbitControls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 50;
  controls.maxDistance = 5000;
  controls.maxPolarAngle = Math.PI / 2 - 0.05;
  controls.target.set(300, 0, 250);
  controls.update();

  // Resize handler
  window.addEventListener('resize', on3DResize);

  isInitialized = true;

  // Subscribe to state changes
  subscribe(() => {
    if (state.mode === '3d') rebuildScene();
  });

  // Initial build
  rebuildScene();
  start3DLoop();
}

function on3DResize() {
  if (!renderer || !container) return;
  const w = container.clientWidth;
  const h = container.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}

// ---- RENDER LOOP ----

function start3DLoop() {
  function loop() {
    rafId3d = requestAnimationFrame(loop);
    controls.update();
    renderer.render(scene, camera);
  }
  loop();
}

export function stop3DLoop() {
  if (rafId3d) {
    cancelAnimationFrame(rafId3d);
    rafId3d = null;
  }
}

// ---- SCENE BUILDING ----

// Groups for easy clearing
let roomGroup, furnitureGroup, groundGroup, gridGroup;

function rebuildScene() {
  if (!scene) return;

  // Remove old groups
  if (roomGroup)      scene.remove(roomGroup);
  if (furnitureGroup) scene.remove(furnitureGroup);
  if (groundGroup)    scene.remove(groundGroup);
  if (gridGroup)      scene.remove(gridGroup);

  roomGroup      = new THREE.Group();
  furnitureGroup = new THREE.Group();
  groundGroup    = new THREE.Group();
  gridGroup      = new THREE.Group();

  scene.add(roomGroup);
  scene.add(furnitureGroup);
  scene.add(groundGroup);
  scene.add(gridGroup);

  // Ground plane (large)
  const groundGeo = new THREE.PlaneGeometry(4000, 4000);
  const groundMat = new THREE.MeshLambertMaterial({ color: 0x3a3a3a });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -1;
  ground.receiveShadow = true;
  groundGroup.add(ground);

  // Grid helper on ground
  const gridHelper = new THREE.GridHelper(4000, 80, 0x555555, 0x444444);
  gridHelper.position.y = 0;
  gridGroup.add(gridHelper);

  // Build rooms
  const rooms = state.elements.filter(e => e.type === 'room');
  const furniture = state.elements.filter(e => e.type === 'furniture');
  const walls = state.elements.filter(e => e.type === 'wall');

  for (const room of rooms) buildRoom3D(room);
  for (const wall of walls) buildWall3D(wall);
  for (const item of furniture) buildFurniture3D(item);

  // Auto-center camera on content if there's content
  if (state.elements.length > 0 && rooms.length > 0) {
    const cx = rooms.reduce((s, r) => s + r.x + r.width  / 2, 0) / rooms.length;
    const cy = rooms.reduce((s, r) => s + r.y + r.depth / 2, 0) / rooms.length;
    controls.target.set(cx, 0, cy);
    controls.update();
  }
}

const WALL_HEIGHT = 250;
const WALL_THICKNESS = 15;

function buildRoom3D(room) {
  const { x, y, width: w, depth: d } = room;
  const roomColor = hexStrToInt(room.color || '#DCEEFB');
  const wallColor = 0xF8F4EE;

  // Floor
  const floorGeo = new THREE.BoxGeometry(w - WALL_THICKNESS * 2, 4, d - WALL_THICKNESS * 2);
  const floorMat = getMat(0xC8B49A); // warm wood color
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.position.set(x + w / 2, -2, y + d / 2);
  floor.receiveShadow = true;
  roomGroup.add(floor);

  // Decorative floor lines (wood planks look)
  const plankMat = getMat(0xB8A48A, { wireframe: false });
  for (let i = 0; i < 5; i++) {
    const plank = new THREE.Mesh(
      new THREE.BoxGeometry(w - WALL_THICKNESS * 2, 0.5, 2),
      plankMat,
    );
    plank.position.set(
      x + w / 2,
      1,
      y + WALL_THICKNESS + (d - WALL_THICKNESS * 2) * i / 5 + 10,
    );
    roomGroup.add(plank);
  }

  const wMat = getMat(wallColor);

  // Left wall (x side)
  const lWall = makeWallBox(WALL_THICKNESS, WALL_HEIGHT, d, wMat);
  lWall.position.set(x + WALL_THICKNESS / 2, WALL_HEIGHT / 2, y + d / 2);
  roomGroup.add(lWall);

  // Right wall
  const rWall = makeWallBox(WALL_THICKNESS, WALL_HEIGHT, d, wMat);
  rWall.position.set(x + w - WALL_THICKNESS / 2, WALL_HEIGHT / 2, y + d / 2);
  roomGroup.add(rWall);

  // Back wall (far z)
  const bWall = makeWallBox(w, WALL_HEIGHT, WALL_THICKNESS, wMat);
  bWall.position.set(x + w / 2, WALL_HEIGHT / 2, y + WALL_THICKNESS / 2);
  roomGroup.add(bWall);

  // Front wall (near z) - semi-transparent so we can see inside
  const fWallMat = new THREE.MeshLambertMaterial({ color: wallColor, transparent: true, opacity: 0.25 });
  const fWall = makeWallBox(w, WALL_HEIGHT, WALL_THICKNESS, fWallMat);
  fWall.position.set(x + w / 2, WALL_HEIGHT / 2, y + d - WALL_THICKNESS / 2);
  roomGroup.add(fWall);

  // Baseboard
  const bbMat = getMat(0xD0C8B0);
  const bb = new THREE.Mesh(new THREE.BoxGeometry(w - WALL_THICKNESS * 2, 8, 4), bbMat);
  bb.position.set(x + w / 2, 4, y + WALL_THICKNESS + 2);
  roomGroup.add(bb);

  // Room label as 3D text approximation (simple plane with color)
  // We'll skip text for now since TextGeometry needs font loading
}

function makeWallBox(w, h, d, mat) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function buildWall3D(wall) {
  const len = Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1);
  const cx  = (wall.x1 + wall.x2) / 2;
  const cz  = (wall.y1 + wall.y2) / 2;
  const angle = Math.atan2(wall.y2 - wall.y1, wall.x2 - wall.x1);
  const t = wall.thickness || 15;

  const geo = new THREE.BoxGeometry(len, WALL_HEIGHT, t);
  const mat = getMat(0xECE8E0);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(cx, WALL_HEIGHT / 2, cz);
  mesh.rotation.y = -angle;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  roomGroup.add(mesh);
}

function buildFurniture3D(item) {
  const info = getFurnitureInfo(item.furnitureType) || {};
  const rot = (item.rotation || 0) % 360;
  const swapped = rot === 90 || rot === 270;

  const fw = swapped ? item.depth : item.width;
  const fd = swapped ? item.width : item.depth;
  const fh = info.draw3dHeight || 80;
  const fcolor = hexStrToInt(item.color || info.color2d || '#C0A870');

  const cx = item.x + fw / 2;
  const cz = item.y + fd / 2;

  // Main body
  const geo = new THREE.BoxGeometry(fw, fh, fd);
  const mat = getMat(fcolor);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(cx, fh / 2, cz);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  furnitureGroup.add(mesh);

  // Type-specific details
  addFurnitureDetails(item.furnitureType, cx, cz, fw, fd, fh);
}

function addFurnitureDetails(type, cx, cz, fw, fd, fh) {
  switch (type) {
    case 'bed_queen':
    case 'bed_single': {
      // Pillow
      const pillow = new THREE.Mesh(
        new THREE.BoxGeometry(fw * 0.7, 12, fd * 0.2),
        getMat(0xF5F5F5),
      );
      pillow.position.set(cx, fh + 6, cz - fd * 0.3);
      furnitureGroup.add(pillow);

      // Blanket area
      const blanket = new THREE.Mesh(
        new THREE.BoxGeometry(fw * 0.95, 8, fd * 0.6),
        getMat(0x8C9EBE),
      );
      blanket.position.set(cx, fh + 4, cz + fd * 0.1);
      furnitureGroup.add(blanket);
      break;
    }
    case 'sofa':
    case 'sofa_small': {
      // Backrest
      const back = new THREE.Mesh(
        new THREE.BoxGeometry(fw, fh * 0.5, fd * 0.15),
        getMat(0x6B4226),
      );
      back.position.set(cx, fh * 0.75, cz - fd * 0.43);
      furnitureGroup.add(back);
      break;
    }
    case 'tv_stand': {
      // TV screen
      const tv = new THREE.Mesh(
        new THREE.BoxGeometry(fw * 0.9, fh * 1.5, 8),
        getMat(0x1A1A2E),
      );
      tv.position.set(cx, fh * 1.75, cz);
      furnitureGroup.add(tv);

      // Screen glow
      const screen = new THREE.Mesh(
        new THREE.BoxGeometry(fw * 0.85, fh * 1.35, 2),
        getMat(0x1B3A6B),
      );
      screen.position.set(cx, fh * 1.75, cz - 4);
      furnitureGroup.add(screen);
      break;
    }
    case 'shower': {
      // Shower walls (glass-like)
      const glassMat = new THREE.MeshLambertMaterial({
        color: 0x9DD9F3,
        transparent: true,
        opacity: 0.3,
      });
      for (const [wx, wz, wfw, wfd] of [
        [cx - fw / 2 + 2, cz, 4, fd],
        [cx, cz - fd / 2 + 2, fw, 4],
      ]) {
        const wall = new THREE.Mesh(new THREE.BoxGeometry(wfw, 200, wfd), glassMat);
        wall.position.set(wx, 100, wz);
        furnitureGroup.add(wall);
      }
      break;
    }
    case 'window': {
      // Window pane
      const glassMat = new THREE.MeshLambertMaterial({ color: 0x81D4FA, transparent: true, opacity: 0.4 });
      const pane = new THREE.Mesh(new THREE.BoxGeometry(fw, 120, 8), glassMat);
      pane.position.set(cx, 130, cz);
      furnitureGroup.add(pane);
      break;
    }
  }
}

// ---- UTILS ----

function hexStrToInt(hex) {
  if (!hex) return 0xCCCCCC;
  if (typeof hex === 'number') return hex;
  return parseInt(hex.replace('#', ''), 16);
}

export function resetCamera() {
  if (!camera || !controls) return;
  camera.position.set(600, 700, 700);
  controls.target.set(300, 0, 250);
  controls.update();
}

export function is3DInitialized() {
  return isInitialized;
}

export function refresh3D() {
  rebuildScene();
}

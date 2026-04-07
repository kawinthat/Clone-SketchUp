// ============================================================
// App Entry Point
// ============================================================

import { state, addElement, newId, subscribe, notify } from './state.js';
import { initCanvas2D, fitToContent } from './canvas2d.js';
import { buildFurnitureCatalog, initFurnitureSearch, initToolbar, initPropertiesPanel, initStatusBar } from './ui.js';

// ---- INIT ----

function init() {
  // Build UI
  buildFurnitureCatalog();
  initFurnitureSearch();
  initToolbar();
  initPropertiesPanel();
  initStatusBar();

  // Init 2D canvas
  const canvas = document.getElementById('canvas-2d');
  initCanvas2D(canvas);

  // Load demo floor plan
  loadDemoFloorPlan();

  // Fit to content after a brief delay (so canvas is sized)
  setTimeout(() => {
    fitToContent();
  }, 100);

  console.log('FloorPlan Pro initialized ✓');
}

// ---- DEMO FLOOR PLAN ----
// A pre-built studio room resembling the reference image

function loadDemoFloorPlan() {
  // Main studio room: 686cm x 500cm
  addElement({
    id: newId(), type: 'room',
    x: 0, y: 0, width: 686, depth: 500,
    label: 'ห้องสตูดิโอ',
    color: '#F5EDD8',
    wallColor: '#A09080',
    wallThickness: 15,
  });

  // Bathroom zone: 236cm x 212cm (left side)
  addElement({
    id: newId(), type: 'room',
    x: 0, y: 0, width: 212, depth: 236,
    label: 'ห้องน้ำ',
    color: '#E8F0F5',
    wallColor: '#9090A0',
    wallThickness: 12,
  });

  // Balcony: 155cm x 130cm (right)
  addElement({
    id: newId(), type: 'room',
    x: 686, y: 0, width: 155, depth: 130,
    label: 'ระเบียง',
    color: '#F0E8D0',
    wallColor: '#B0A090',
    wallThickness: 10,
  });

  // Kitchen area (top right): 127cm x 230cm
  addElement({
    id: newId(), type: 'room',
    x: 686, y: 130, width: 127, depth: 230,
    label: 'ห้องครัว',
    color: '#FFE8E8',
    wallColor: '#C09090',
    wallThickness: 10,
  });

  // -- BATHROOM FURNITURE --
  addElement({
    id: newId(), type: 'furniture',
    furnitureType: 'toilet',
    label: 'ชักโครก', icon: '🚽',
    x: 20, y: 140, width: 40, depth: 65,
    rotation: 0, color: '#F5F5F5',
  });

  addElement({
    id: newId(), type: 'furniture',
    furnitureType: 'sink',
    label: 'อ่างล้างหน้า', icon: '🪥',
    x: 80, y: 145, width: 55, depth: 50,
    rotation: 0, color: '#F5F5F5',
  });

  addElement({
    id: newId(), type: 'furniture',
    furnitureType: 'shower',
    label: 'ฝักบัว', icon: '🚿',
    x: 20, y: 30, width: 80, depth: 80,
    rotation: 0, color: '#B3E5FC',
  });

  // -- MAIN ROOM FURNITURE --

  // Bed: 212cm x 212cm (from image)
  addElement({
    id: newId(), type: 'furniture',
    furnitureType: 'bed_queen',
    label: 'เตียง', icon: '🛏️',
    x: 230, y: 50, width: 212, depth: 212,
    rotation: 0, color: '#C8A96E',
  });

  // Wardrobe: 217cm wide (from image, near window)
  addElement({
    id: newId(), type: 'furniture',
    furnitureType: 'wardrobe',
    label: 'ตู้เสื้อผ้า', icon: '🗄️',
    x: 450, y: 20, width: 120, depth: 60,
    rotation: 0, color: '#5C3D2E',
  });

  // Sofa
  addElement({
    id: newId(), type: 'furniture',
    furnitureType: 'sofa',
    label: 'โซฟา', icon: '🛋️',
    x: 460, y: 150, width: 180, depth: 80,
    rotation: 0, color: '#7B5B3A',
  });

  // TV + stand
  addElement({
    id: newId(), type: 'furniture',
    furnitureType: 'tv_stand',
    label: 'ทีวี', icon: '📺',
    x: 280, y: 350, width: 120, depth: 40,
    rotation: 0, color: '#2C2C2C',
  });

  // -- KITCHEN FURNITURE --
  addElement({
    id: newId(), type: 'furniture',
    furnitureType: 'kitchen_counter',
    label: 'เคาน์เตอร์', icon: '🍳',
    x: 695, y: 145, width: 100, depth: 60,
    rotation: 0, color: '#E0E0E0',
  });

  addElement({
    id: newId(), type: 'furniture',
    furnitureType: 'fridge',
    label: 'ตู้เย็น', icon: '🧊',
    x: 700, y: 210, width: 65, depth: 70,
    rotation: 0, color: '#ECEFF1',
  });

  // -- DOORS / WINDOWS --
  addElement({
    id: newId(), type: 'furniture',
    furnitureType: 'door',
    label: 'ทางเข้า (71ซม.)', icon: '🚪',
    x: 110, y: 490, width: 71, depth: 10,
    rotation: 0, color: '#8D6E63',
  });

  addElement({
    id: newId(), type: 'furniture',
    furnitureType: 'window',
    label: 'หน้าต่าง', icon: '🪟',
    x: 580, y: 0, width: 100, depth: 15,
    rotation: 0, color: '#81D4FA',
  });
}

// ---- START ----

document.addEventListener('DOMContentLoaded', init);

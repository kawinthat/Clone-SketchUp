// ============================================================
// Furniture Catalog with Thai Labels
// ============================================================

export const CATEGORIES = [
  {
    id: 'bedroom',
    label: 'ห้องนอน / นั่งเล่น',
    icon: '🛏️',
    items: [
      {
        type: 'bed_queen',
        label: 'เตียง (ควีน)',
        width: 160, depth: 200,
        color2d: '#C8A96E', color3d: 0xC8A96E,
        icon: '🛏️',
        draw3dHeight: 50,
      },
      {
        type: 'bed_single',
        label: 'เตียงเดี่ยว',
        width: 90, depth: 200,
        color2d: '#C8A96E', color3d: 0xC8A96E,
        icon: '🛏️',
        draw3dHeight: 50,
      },
      {
        type: 'sofa',
        label: 'โซฟา 3 ที่นั่ง',
        width: 210, depth: 85,
        color2d: '#7B5B3A', color3d: 0x7B5B3A,
        icon: '🛋️',
        draw3dHeight: 85,
      },
      {
        type: 'sofa_small',
        label: 'โซฟา 2 ที่นั่ง',
        width: 140, depth: 80,
        color2d: '#8B6B4A', color3d: 0x8B6B4A,
        icon: '🛋️',
        draw3dHeight: 80,
      },
      {
        type: 'wardrobe',
        label: 'ตู้เสื้อผ้า',
        width: 120, depth: 60,
        color2d: '#5C3D2E', color3d: 0x5C3D2E,
        icon: '🗄️',
        draw3dHeight: 220,
      },
      {
        type: 'tv_stand',
        label: 'ชั้นวางทีวี',
        width: 120, depth: 40,
        color2d: '#5D4037', color3d: 0x5D4037,
        icon: '📺',
        draw3dHeight: 50,
      },
      {
        type: 'desk',
        label: 'โต๊ะทำงาน',
        width: 120, depth: 60,
        color2d: '#B5926C', color3d: 0xB5926C,
        icon: '💻',
        draw3dHeight: 75,
      },
      {
        type: 'chair',
        label: 'เก้าอี้',
        width: 55, depth: 55,
        color2d: '#795548', color3d: 0x795548,
        icon: '🪑',
        draw3dHeight: 45,
      },
      {
        type: 'dining_table',
        label: 'โต๊ะอาหาร',
        width: 120, depth: 80,
        color2d: '#C4A882', color3d: 0xC4A882,
        icon: '🍽️',
        draw3dHeight: 75,
      },
      {
        type: 'bookshelf',
        label: 'ชั้นหนังสือ',
        width: 80, depth: 30,
        color2d: '#6D4C41', color3d: 0x6D4C41,
        icon: '📚',
        draw3dHeight: 180,
      },
    ],
  },
  {
    id: 'kitchen',
    label: 'ห้องครัว',
    icon: '🍳',
    items: [
      {
        type: 'kitchen_counter',
        label: 'เคาน์เตอร์ครัว',
        width: 120, depth: 60,
        color2d: '#E0E0E0', color3d: 0xE0E0E0,
        icon: '🍳',
        draw3dHeight: 90,
      },
      {
        type: 'stove',
        label: 'เตาแก๊ส',
        width: 60, depth: 60,
        color2d: '#BDBDBD', color3d: 0xBDBDBD,
        icon: '🔥',
        draw3dHeight: 90,
      },
      {
        type: 'fridge',
        label: 'ตู้เย็น',
        width: 65, depth: 70,
        color2d: '#ECEFF1', color3d: 0xECEFF1,
        icon: '🧊',
        draw3dHeight: 170,
      },
      {
        type: 'sink_kitchen',
        label: 'อ่างล้างจาน',
        width: 60, depth: 50,
        color2d: '#90CAF9', color3d: 0x90CAF9,
        icon: '🚰',
        draw3dHeight: 90,
      },
      {
        type: 'microwave',
        label: 'ไมโครเวฟ',
        width: 50, depth: 35,
        color2d: '#757575', color3d: 0x757575,
        icon: '📡',
        draw3dHeight: 35,
      },
    ],
  },
  {
    id: 'bathroom',
    label: 'ห้องน้ำ',
    icon: '🚿',
    items: [
      {
        type: 'toilet',
        label: 'ชักโครก',
        width: 40, depth: 65,
        color2d: '#F5F5F5', color3d: 0xF5F5F5,
        icon: '🚽',
        draw3dHeight: 40,
      },
      {
        type: 'sink',
        label: 'อ่างล้างหน้า',
        width: 55, depth: 50,
        color2d: '#F5F5F5', color3d: 0xF5F5F5,
        icon: '🪥',
        draw3dHeight: 85,
      },
      {
        type: 'shower',
        label: 'ฝักบัว',
        width: 80, depth: 80,
        color2d: '#B3E5FC', color3d: 0xB3E5FC,
        icon: '🚿',
        draw3dHeight: 10,
      },
      {
        type: 'bathtub',
        label: 'อ่างอาบน้ำ',
        width: 75, depth: 170,
        color2d: '#F0F0F0', color3d: 0xF0F0F0,
        icon: '🛁',
        draw3dHeight: 55,
      },
    ],
  },
  {
    id: 'doors',
    label: 'ประตู / หน้าต่าง',
    icon: '🚪',
    items: [
      {
        type: 'door',
        label: 'ประตู',
        width: 90, depth: 10,
        color2d: '#8D6E63', color3d: 0x8D6E63,
        icon: '🚪',
        draw3dHeight: 210,
      },
      {
        type: 'door_double',
        label: 'ประตูคู่',
        width: 160, depth: 10,
        color2d: '#8D6E63', color3d: 0x8D6E63,
        icon: '🚪🚪',
        draw3dHeight: 210,
      },
      {
        type: 'window',
        label: 'หน้าต่าง',
        width: 100, depth: 15,
        color2d: '#81D4FA', color3d: 0x81D4FA,
        icon: '🪟',
        draw3dHeight: 120,
      },
      {
        type: 'sliding_door',
        label: 'บานเลื่อน',
        width: 150, depth: 15,
        color2d: '#80DEEA', color3d: 0x80DEEA,
        icon: '🪟',
        draw3dHeight: 210,
      },
    ],
  },
];

// Look up furniture by type
export function getFurnitureInfo(type) {
  for (const cat of CATEGORIES) {
    const item = cat.items.find(i => i.type === type);
    if (item) return item;
  }
  return null;
}

// Flat list for searching
export const ALL_FURNITURE = CATEGORIES.flatMap(c => c.items);

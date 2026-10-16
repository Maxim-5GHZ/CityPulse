import { DistrictScenario } from './types';

export const EMPTY_DISTRICT: DistrictScenario = {
  id: 'empty-project',
  name: 'Новый генеральный план',
  description: 'Пустой проект района. Используйте панель инструментов для трассировки улиц и застройки.',
  nodes: [],
  edges: [],
  buildings: [],
  amenities: [],
};

export const OBNINSK_2040_DISTRICT: DistrictScenario = {
  id: 'obninsk-51-2040',
  name: '51-й микрорайон (г. Обнинск, 2040)',
  description:
    'пр. Маркса, ул. Гагарина, ул. Энгельса: 7 домов, 2 остановки, 2 сквера, велополоса. Калитки — снаружи подошв.',
  nodes: [
    { id: 'n-a1', x: 90, y: 110, label: 'Подъезд Маркса, 74', type: 'house_gate' },
    { id: 'n-a2', x: 260, y: 110, label: 'Подъезд Маркса, 70', type: 'house_gate' },
    { id: 'n-a3', x: 430, y: 110, label: 'Подъезд ЖК «Циолковский»', type: 'house_gate' },
    { id: 'n-a4', x: 600, y: 110, label: 'Подъезд Гагарина, 15', type: 'house_gate' },
    { id: 'n-a5', x: 780, y: 110, label: 'Маркса / Северный', type: 'intersection' },

    { id: 'n-b1', x: 90, y: 240, label: 'Маркса (Запад)', type: 'intersection' },
    { id: 'n-b2', x: 260, y: 240, label: 'Ост. Музыкальный колледж', type: 'bus_stop' },
    { id: 'n-b3', x: 430, y: 240, label: 'Маркса / Гагарина', type: 'intersection' },
    { id: 'n-b4', x: 600, y: 240, label: 'Маркса (Центр)', type: 'intersection' },
    { id: 'n-b5', x: 780, y: 240, label: 'Маркса (Восток)', type: 'intersection' },

    { id: 'n-c1', x: 90, y: 380, label: 'Западный створ', type: 'intersection' },
    { id: 'n-c2', x: 260, y: 380, label: 'Створ зебры «Север»', type: 'intersection' },
    { id: 'n-c3', x: 430, y: 380, label: 'Гагарина (Юг)', type: 'intersection' },
    { id: 'n-c4', x: 600, y: 380, label: 'Ост. ТРК «Плаза»', type: 'bus_stop' },
    { id: 'n-c5', x: 780, y: 380, label: 'Вход ТЦ «Обними»', type: 'amenity_gate' },

    { id: 'n-d1', x: 90, y: 520, label: 'Подъезд Маркса, 61', type: 'house_gate' },
    { id: 'n-d2', x: 260, y: 520, label: 'Энгельса (Запад)', type: 'intersection' },
    { id: 'n-d3', x: 430, y: 520, label: 'Подъезд Энгельса, 14', type: 'house_gate' },
    { id: 'n-d4', x: 600, y: 520, label: 'Подъезд Энгельса, 20', type: 'house_gate' },
    { id: 'n-d5', x: 780, y: 520, label: 'Энгельса (Восток)', type: 'intersection' },

    { id: 'n-pk', x: 260, y: 450, label: 'Сквер им. Кудрявцевой', type: 'park_gate' },
    { id: 'n-gg', x: 700, y: 470, label: 'Сквер Гагарина', type: 'park_gate' },
  ],
  edges: [
    // Проспект Маркса (4 ребра) + ул. Гагарина (север/юг).
    { id: 'e-r1', from: 'n-b1', to: 'n-b2', lengthM: 170, type: 'road', lanes: 2, isActive: true, isAccessible: true },
    { id: 'e-r2', from: 'n-b2', to: 'n-b3', lengthM: 170, type: 'road', lanes: 2, isActive: true, isAccessible: true },
    { id: 'e-r3', from: 'n-b3', to: 'n-b4', lengthM: 170, type: 'road', lanes: 2, isActive: true, isAccessible: true },
    { id: 'e-r4', from: 'n-b4', to: 'n-b5', lengthM: 170, type: 'road', lanes: 2, isActive: true, isAccessible: true },
    { id: 'e-r5', from: 'n-a3', to: 'n-b3', lengthM: 130, type: 'road', lanes: 2, isActive: true, isAccessible: true },
    { id: 'e-r6', from: 'n-b3', to: 'n-c3', lengthM: 140, type: 'road', lanes: 2, isActive: true, isAccessible: true },

    // 4 наземные зебры.
    { id: 'e-x1', from: 'n-b2', to: 'n-c2', lengthM: 140, type: 'crossing', isActive: true, isAccessible: true },
    { id: 'e-x2', from: 'n-b4', to: 'n-c4', lengthM: 140, type: 'crossing', isActive: true, isAccessible: true },
    { id: 'e-x3', from: 'n-c3', to: 'n-d3', lengthM: 140, type: 'crossing', isActive: true, isAccessible: true },
    { id: 'e-x4', from: 'n-b1', to: 'n-c1', lengthM: 140, type: 'crossing', isActive: true, isAccessible: true },

    // Тротуары: запад/восток, северный ряд, средний ряд, выходы из домов.
    { id: 'e-s01', from: 'n-a1', to: 'n-b1', lengthM: 130, type: 'sidewalk', isActive: true, isAccessible: true },
    { id: 'e-s02', from: 'n-a2', to: 'n-b2', lengthM: 130, type: 'sidewalk', isActive: true, isAccessible: true },
    { id: 'e-s03', from: 'n-a4', to: 'n-b4', lengthM: 130, type: 'sidewalk', isActive: true, isAccessible: true },
    { id: 'e-s04', from: 'n-c1', to: 'n-d1', lengthM: 140, type: 'sidewalk', isActive: true, isAccessible: true },
    { id: 'e-s05', from: 'n-c2', to: 'n-d2', lengthM: 140, type: 'sidewalk', isActive: true, isAccessible: true },
    { id: 'e-s06', from: 'n-a1', to: 'n-a2', lengthM: 170, type: 'sidewalk', isActive: true, isAccessible: true },
    { id: 'e-s07', from: 'n-a2', to: 'n-a3', lengthM: 170, type: 'sidewalk', isActive: true, isAccessible: true },
    { id: 'e-s08', from: 'n-a3', to: 'n-a4', lengthM: 170, type: 'sidewalk', isActive: true, isAccessible: true },
    { id: 'e-s09', from: 'n-a4', to: 'n-a5', lengthM: 180, type: 'sidewalk', isActive: true, isAccessible: true },
    { id: 'e-s10', from: 'n-a5', to: 'n-b5', lengthM: 130, type: 'sidewalk', isActive: true, isAccessible: true },
    { id: 'e-s11', from: 'n-b5', to: 'n-c5', lengthM: 140, type: 'sidewalk', isActive: true, isAccessible: true },
    { id: 'e-s12', from: 'n-c5', to: 'n-d5', lengthM: 140, type: 'sidewalk', isActive: true, isAccessible: true },
    { id: 'e-s13', from: 'n-c1', to: 'n-c2', lengthM: 170, type: 'sidewalk', isActive: true, isAccessible: true },
    { id: 'e-s14', from: 'n-c2', to: 'n-c3', lengthM: 170, type: 'sidewalk', isActive: true, isAccessible: true },
    { id: 'e-s15', from: 'n-c3', to: 'n-c4', lengthM: 170, type: 'sidewalk', isActive: true, isAccessible: true },
    { id: 'e-s16', from: 'n-c4', to: 'n-c5', lengthM: 180, type: 'sidewalk', isActive: true, isAccessible: true },
    { id: 'e-s17', from: 'n-d1', to: 'n-d2', lengthM: 170, type: 'sidewalk', isActive: true, isAccessible: true },
    { id: 'e-s18', from: 'n-d4', to: 'n-d5', lengthM: 180, type: 'sidewalk', isActive: true, isAccessible: true },

    // Велополоса ул. Энгельса (витрина инструмента «Велодорожка»).
    { id: 'e-k1', from: 'n-d2', to: 'n-d3', lengthM: 170, type: 'bike_lane', isActive: true, isAccessible: true },
    { id: 'e-k2', from: 'n-d3', to: 'n-d4', lengthM: 170, type: 'bike_lane', isActive: true, isAccessible: true },

    // Тропы скверов.
    { id: 'e-p1', from: 'n-c2', to: 'n-pk', lengthM: 70, type: 'park_path', isActive: true, isAccessible: true },
    { id: 'e-p2', from: 'n-pk', to: 'n-d2', lengthM: 70, type: 'park_path', isActive: true, isAccessible: true },
    { id: 'e-p3', from: 'n-c4', to: 'n-gg', lengthM: 135, type: 'park_path', isActive: true, isAccessible: true },
    { id: 'e-p4', from: 'n-gg', to: 'n-d4', lengthM: 112, type: 'park_path', isActive: true, isAccessible: true },
  ],
  buildings: [
    { id: 'ob51-b1', name: 'пр. Маркса, 74', address: 'г. Обнинск, пр. Маркса, 74', floors: 9, residentsPerFloor: 31, residents: 279, gateNodeId: 'n-a1', x: 45, y: 35, width: 85, height: 50 },
    { id: 'ob51-b2', name: 'пр. Маркса, 70', address: 'г. Обнинск, пр. Маркса, 70', floors: 9, residentsPerFloor: 38, residents: 342, gateNodeId: 'n-a2', x: 215, y: 35, width: 85, height: 50 },
    { id: 'ob51-b3', name: 'ЖК «Циолковский»', address: 'г. Обнинск, пр. Маркса', floors: 22, residentsPerFloor: 36, residents: 792, gateNodeId: 'n-a3', x: 380, y: 20, width: 95, height: 65 },
    { id: 'ob51-b4', name: 'ул. Гагарина, 15', address: 'г. Обнинск, ул. Гагарина, 15', floors: 12, residentsPerFloor: 32, residents: 384, gateNodeId: 'n-a4', x: 560, y: 35, width: 80, height: 50, rotationDeg: 22 },
    { id: 'ob51-b5', name: 'пр. Маркса, 61', address: 'г. Обнинск, пр. Маркса, 61', floors: 9, residentsPerFloor: 32, residents: 288, gateNodeId: 'n-d1', x: 45, y: 545, width: 85, height: 50 },
    { id: 'ob51-b6', name: 'ул. Энгельса, 14', address: 'г. Обнинск, ул. Энгельса, 14', floors: 10, residentsPerFloor: 32, residents: 320, gateNodeId: 'n-d3', x: 385, y: 545, width: 85, height: 50 },
    { id: 'ob51-b7', name: 'ул. Энгельса, 20', address: 'г. Обнинск, ул. Энгельса, 20', floors: 12, residentsPerFloor: 31, residents: 372, gateNodeId: 'n-d4', x: 640, y: 545, width: 85, height: 50, rotationDeg: -15 },
  ],
  amenities: [
    { id: 'ob51-bus-west', name: 'Ост. Музыкальный колледж', type: 'bus_stop', nodeId: 'n-b2', coverageRadiusM: 500 },
    { id: 'ob51-bus-plaza', name: 'Ост. ТРК «Плаза»', type: 'bus_stop', nodeId: 'n-c4', coverageRadiusM: 500 },
    { id: 'ob51-park-kudr', name: 'Сквер им. Кудрявцевой', type: 'park', nodeId: 'n-pk', coverageRadiusM: 350 },
    { id: 'ob51-park-gag', name: 'Сквер Гагарина', type: 'park', nodeId: 'n-gg', coverageRadiusM: 300 },
    { id: 'ob51-mall', name: 'ТЦ «Обними»', type: 'mall', nodeId: 'n-c5', coverageRadiusM: 800 },
  ],
};

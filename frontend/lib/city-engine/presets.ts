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

export const OBNINSK_MARX_DISTRICT: DistrictScenario = {
  id: 'obninsk-marx-51',
  name: '51-й микрорайон (г. Обнинск)',
  description: 'Проспект Маркса, ул. Гагарина, ТРК «Триумф Плаза», сквер им. Кудрявцевой.',
  nodes: [
    { id: 'n1', x: 120, y: 130, label: 'Вход Маркса, 74', type: 'house_gate' },
    { id: 'n2', x: 280, y: 130, label: 'Вход Маркса, 70', type: 'house_gate' },
    { id: 'n3', x: 440, y: 110, label: 'ЖК «Циолковский» (Север)', type: 'house_gate' },
    { id: 'n4', x: 640, y: 130, label: 'Вход Гагарина, 15', type: 'house_gate' },
    { id: 'n5', x: 860, y: 130, label: 'С-В перекрёсток', type: 'intersection' },

    { id: 'n6', x: 80, y: 250, label: 'пр. Маркса (Запад)', type: 'intersection' },
    { id: 'n7', x: 280, y: 250, label: 'Ост. Музыкальный колледж', type: 'bus_stop' },
    { id: 'n8', x: 440, y: 250, label: 'Створ перехода Циолковский', type: 'intersection' },
    { id: 'n9', x: 660, y: 250, label: 'Маркса / Гагарина', type: 'intersection' },
    { id: 'n10', x: 860, y: 250, label: 'пр. Маркса (Восток)', type: 'intersection' },

    { id: 'n11', x: 80, y: 390, label: 'Маркса Юг', type: 'intersection' },
    { id: 'n12', x: 280, y: 390, label: 'Вход сквер Кудрявцевой', type: 'park_gate' },
    { id: 'n13', x: 440, y: 390, label: 'Створ перехода Плаза', type: 'intersection' },
    { id: 'n14', x: 660, y: 390, label: 'Ост. ТРК «Плаза»', type: 'bus_stop' },
    { id: 'n15', x: 860, y: 390, label: 'Гагарина Юг', type: 'intersection' },

    { id: 'n16', x: 120, y: 550, label: 'Вход Маркса, 61', type: 'house_gate' },
    { id: 'n17', x: 300, y: 540, label: 'Сквер Кудрявцевой', type: 'park_gate' },
    { id: 'n18', x: 500, y: 550, label: 'Вход Энгельса, 14', type: 'house_gate' },
    { id: 'n19', x: 740, y: 550, label: 'Вход Энгельса, 20', type: 'house_gate' },
  ],
  edges: [
    { id: 'e-road-1', from: 'n6', to: 'n7', lengthM: 140, type: 'road', lanes: 2, isActive: true, isAccessible: true },
    { id: 'e-road-2', from: 'n7', to: 'n8', lengthM: 120, type: 'road', lanes: 2, isActive: true, isAccessible: true },
    { id: 'e-road-3', from: 'n8', to: 'n9', lengthM: 160, type: 'road', lanes: 2, isActive: true, isAccessible: true },
    { id: 'e-road-4', from: 'n9', to: 'n10', lengthM: 140, type: 'road', lanes: 2, isActive: true, isAccessible: true },
    { id: 'e-road-gagar', from: 'n9', to: 'n15', lengthM: 140, type: 'road', lanes: 2, isActive: true, isAccessible: true },

    { id: 'e-cross-1', from: 'n8', to: 'n13', lengthM: 80, type: 'crossing', isActive: true, isAccessible: true },
    { id: 'e-cross-2', from: 'n7', to: 'n12', lengthM: 85, type: 'crossing', isActive: true, isAccessible: true },

    { id: 'e1', from: 'n1', to: 'n6', lengthM: 90, type: 'sidewalk', isActive: true, isAccessible: true },
    { id: 'e2', from: 'n2', to: 'n7', lengthM: 90, type: 'sidewalk', isActive: true, isAccessible: true },
    { id: 'e3', from: 'n3', to: 'n8', lengthM: 100, type: 'sidewalk', isActive: true, isAccessible: true },
    { id: 'e4', from: 'n4', to: 'n9', lengthM: 90, type: 'sidewalk', isActive: true, isAccessible: true },
    { id: 'e-top-conn', from: 'n4', to: 'n5', lengthM: 150, type: 'sidewalk', isActive: true, isAccessible: true },
    { id: 'e-top-conn2', from: 'n5', to: 'n10', lengthM: 100, type: 'sidewalk', isActive: true, isAccessible: true },

    { id: 'e11', from: 'n11', to: 'n12', lengthM: 140, type: 'sidewalk', isActive: true, isAccessible: true },
    { id: 'e12', from: 'n12', to: 'n13', lengthM: 120, type: 'sidewalk', isActive: true, isAccessible: true },
    { id: 'e13', from: 'n13', to: 'n14', lengthM: 160, type: 'sidewalk', isActive: true, isAccessible: true },
    { id: 'e14', from: 'n14', to: 'n15', lengthM: 140, type: 'sidewalk', isActive: true, isAccessible: true },
    { id: 'e15', from: 'n11', to: 'n16', lengthM: 120, type: 'sidewalk', isActive: true, isAccessible: true },
    { id: 'e16', from: 'n12', to: 'n17', lengthM: 110, type: 'park_path', isActive: true, isAccessible: true },
    { id: 'e17', from: 'n13', to: 'n17', lengthM: 110, type: 'park_path', isActive: true, isAccessible: true },
    { id: 'e18', from: 'n14', to: 'n18', lengthM: 110, type: 'sidewalk', isActive: true, isAccessible: true },
    { id: 'e19', from: 'n15', to: 'n19', lengthM: 110, type: 'sidewalk', isActive: true, isAccessible: true },
    { id: 'e20', from: 'n17', to: 'n18', lengthM: 150, type: 'park_path', isActive: true, isAccessible: true },
  ],
  buildings: [
    { id: 'b1', name: 'пр. Маркса, 74', address: 'г. Обнинск, пр. Маркса, 74', floors: 9, residentsPerFloor: 31, residents: 279, gateNodeId: 'n1', x: 80, y: 60, width: 85, height: 50 },
    { id: 'b2', name: 'пр. Маркса, 70', address: 'г. Обнинск, пр. Маркса, 70', floors: 9, residentsPerFloor: 38, residents: 342, gateNodeId: 'n2', x: 240, y: 60, width: 85, height: 50 },
    { id: 'b3', name: 'ЖК «Циолковский»', address: 'г. Обнинск, пр. Маркса', floors: 22, residentsPerFloor: 36, residents: 792, gateNodeId: 'n3', x: 400, y: 40, width: 95, height: 65 },
    { id: 'b4', name: 'ул. Гагарина, 15', address: 'г. Обнинск, ул. Гагарина, 15', floors: 12, residentsPerFloor: 32, residents: 384, gateNodeId: 'n4', x: 610, y: 60, width: 80, height: 50, rotationDeg: 22 },
    { id: 'b5', name: 'пр. Маркса, 61', address: 'г. Обнинск, пр. Маркса, 61', floors: 9, residentsPerFloor: 32, residents: 288, gateNodeId: 'n16', x: 80, y: 540, width: 85, height: 50 },
    { id: 'b6', name: 'ул. Энгельса, 14', address: 'г. Обнинск, ул. Энгельса, 14', floors: 14, residentsPerFloor: 32, residents: 448, gateNodeId: 'n18', x: 460, y: 540, width: 85, height: 50 },
    { id: 'b7', name: 'ул. Энгельса, 20', address: 'г. Обнинск, ул. Энгельса, 20', floors: 12, residentsPerFloor: 31, residents: 372, gateNodeId: 'n19', x: 700, y: 540, width: 85, height: 50, rotationDeg: -15 },
  ],
  amenities: [
    { id: 'a-bus-plaza', name: 'Ост. ТРК «Плаза»', type: 'bus_stop', nodeId: 'n14', coverageRadiusM: 500 },
    { id: 'a-bus-music', name: 'Ост. Музыкальный колледж', type: 'bus_stop', nodeId: 'n7', coverageRadiusM: 500 },
    { id: 'a-park-kudr', name: 'Сквер им. Кудрявцевой', type: 'park', nodeId: 'n17', coverageRadiusM: 350 },
    { id: 'a-mall-plaza', name: 'ТРК «Триумф Плаза»', type: 'mall', nodeId: 'n14', coverageRadiusM: 800 },
  ],
};

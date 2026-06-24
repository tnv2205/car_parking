import type { Point, Polygon } from '../physics/Collision';
import { CAR_MODELS, type CarModel } from '../physics/CarPhysics';

export type LevelType = 'parallel' | 'box' | 'angled';

export interface Obstacle extends Polygon {
  isVehicle?: boolean;
  vehicleModel?: CarModel;
  x?: number;
  y?: number;
  heading?: number;
}

export interface LevelData {
  startPos: { x: number; y: number; heading: number };
  targetZone: Polygon;      // Зона, в которую нужно припарковаться
  obstacles: Obstacle[];     // Непроходимые препятствия (стены, другие авто)
  lines: { points: Point[]; isDashed: boolean }[]; // Разметка
  trainingHints?: { point: Point; text: string }[];
}

export class LevelManager {
  public static getLevel(type: LevelType, useTrucks: boolean = false, playerModel: CarModel = 'vesta', lanesCount: number = 2): LevelData {
    switch (type) {
      case 'parallel':
        return this.createParallelLevel(useTrucks, playerModel, lanesCount);
      case 'box':
        return this.createBoxLevel(useTrucks, playerModel, lanesCount);
      case 'angled':
        return this.createAngledLevel(useTrucks, playerModel, lanesCount);
      default:
        return this.createParallelLevel(useTrucks, playerModel, lanesCount);
    }
  }

  private static createVehicleObstacle(x: number, y: number, heading: number, model: CarModel): Obstacle {
    const m = CAR_MODELS[model];
    // Расстояние от центра оси до геометрического центра машины
    const shiftX = (m.length / 2) - m.rearOverhang; 
    const cx = x + shiftX * Math.cos(heading);
    const cy = y + shiftX * Math.sin(heading);

    const hw = m.length / 2;
    const hh = m.width / 2;
    const cosH = Math.cos(heading);
    const sinH = Math.sin(heading);
    
    const points = [
      { x: cx + hw * cosH - hh * sinH, y: cy + hw * sinH + hh * cosH },
      { x: cx + hw * cosH + hh * sinH, y: cy + hw * sinH - hh * cosH },
      { x: cx - hw * cosH + hh * sinH, y: cy - hw * sinH - hh * cosH },
      { x: cx - hw * cosH - hh * sinH, y: cy - hw * sinH + hh * cosH }
    ];

    return { points, isVehicle: true, vehicleModel: model, x, y, heading };
  }

  private static createTargetZone(x: number, y: number, heading: number, width: number, length: number): Polygon {
    const hw = length / 2;
    const hh = width / 2;
    const cosH = Math.cos(heading);
    const sinH = Math.sin(heading);
    return {
      points: [
        { x: x + hw * cosH - hh * sinH, y: y + hw * sinH + hh * cosH },
        { x: x + hw * cosH + hh * sinH, y: y + hw * sinH - hh * cosH },
        { x: x - hw * cosH + hh * sinH, y: y - hw * sinH - hh * cosH },
        { x: x - hw * cosH - hh * sinH, y: y - hw * sinH + hh * cosH }
      ]
    };
  }

  // 1. Параллельная парковка (правостороннее движение)
  private static createParallelLevel(useTrucks: boolean, playerModel: CarModel, lanesCount: number): LevelData {
    const model = useTrucks ? 'truck' : 'vesta';
    const m = CAR_MODELS[model];
    const pm = CAR_MODELS[playerModel];
    
    // Идеальный зазор (1.5 длины машины) — считаем от длины машины игрока
    const gapLength = Math.max(m.length, pm.length) * 1.5;
    const centerX = 150;
    
    // Геометрические центры паркуемых машин
    const geomTopX = centerX + gapLength / 2 + m.length / 2;
    const geomBotX = centerX - gapLength / 2 - m.length / 2;
    
    const shiftX = (m.length / 2) - m.rearOverhang;
    
    const topObsX = geomTopX - shiftX;
    const botObsX = geomBotX - shiftX;

    const yRightEdge = -10;
    const yLeftEdge = yRightEdge - lanesCount * 140;

    const lines: { points: Point[]; isDashed: boolean }[] = [
      // Обочина (правая)
      { points: [{ x: -5000, y: yRightEdge }, { x: 5000, y: yRightEdge }], isDashed: false }
    ];
    for(let i = 1; i < lanesCount; i++) {
       lines.push({ points: [{ x: -5000, y: yRightEdge - i * 140 }, { x: 5000, y: yRightEdge - i * 140 }], isDashed: true });
    }
    // Линия встречной обочины
    lines.push({ points: [{ x: -5000, y: yLeftEdge }, { x: 5000, y: yLeftEdge }], isDashed: false });

    return {
      startPos: { x: centerX - gapLength - 200, y: yRightEdge - 70, heading: 0 }, 
      targetZone: this.createTargetZone(centerX, 40, 0, 88, pm.length * 1.5 - 10),
      obstacles: [
        // Припаркованная машина СВЕРХУ по ходу движения
        this.createVehicleObstacle(topObsX, 40, 0, model),
        // Припаркованная машина СНИЗУ по ходу движения
        this.createVehicleObstacle(botObsX, 40, 0, model),
        // Бордюр (правый)
        { points: [{ x: -5000, y: 90 }, { x: 5000, y: 90 }, { x: 5000, y: 5000 }, { x: -5000, y: 5000 }] },
        // Стена встречной полосы
        { points: [{ x: -5000, y: -5000 }, { x: 5000, y: -5000 }, { x: 5000, y: yLeftEdge }, { x: -5000, y: yLeftEdge }] }
      ],
      lines: lines,
      trainingHints: [
        { point: { x: 175, y: 40 }, text: "Место" },
        { point: { x: 360, y: -100 }, text: "1. Поравняйтесь с этим авто" },
        { point: { x: 175, y: -50 }, text: "2. Выкрутите руль вправо и сдавайте назад" }
      ]
    };
  }

  // 2. Парковка в бокс 90 градусов (гаражи справа)
  private static createBoxLevel(useTrucks: boolean, playerModel: CarModel, lanesCount: number): LevelData {
    const model = useTrucks ? 'truck' : 'tiggo';
    const m = CAR_MODELS[model];
    const pm = CAR_MODELS[playerModel];
    
    // Ширина парковочного места (зазор увеличен на 10%)
    const gapWidth = (Math.max(m.width, pm.width) + 45) * 1.1; 
    const distanceBetweenCenters = gapWidth + m.width;
    
    const leftObsX = -distanceBetweenCenters / 2;
    const rightObsX = distanceBetweenCenters / 2;
    
    const centerX = 0;

    // Y координата препятствия (машина лицом вниз, задним бампером на линии обочины y=50)
    const obsY = 50 + m.rearOverhang;
    
    // Геометрический центр целевой зоны (считаем по длине машины игрока)
    const targetGeomY = 50 + pm.length / 2;

    // Длина парковки и положение стены напрямую зависят от СИЛЬНОЙ длины (игрока или препятствия)
    const maxLen = Math.max(m.length, pm.length);
    const wallY = 50 + maxLen + 10;

    const yRightEdge = 50;
    const yLeftEdge = yRightEdge - lanesCount * 140;

    const lines: { points: Point[]; isDashed: boolean }[] = [
      { points: [{ x: -5000, y: yRightEdge }, { x: 5000, y: yRightEdge }], isDashed: false }
    ];
    for(let i = 1; i < lanesCount; i++) {
       lines.push({ points: [{ x: -5000, y: yRightEdge - i * 140 }, { x: 5000, y: yRightEdge - i * 140 }], isDashed: true });
    }
    lines.push({ points: [{ x: -5000, y: yLeftEdge }, { x: 5000, y: yLeftEdge }], isDashed: false });

    return {
      startPos: { x: -300, y: yRightEdge - 70, heading: 0 },
      // Целевая зона полностью оборачивает габариты машины игрока
      targetZone: this.createTargetZone(centerX, targetGeomY, Math.PI / 2, gapWidth - 10, pm.length + 10),
      obstacles: [
        // Сосед слева
        this.createVehicleObstacle(leftObsX, obsY, Math.PI / 2, model),
        // Сосед справа
        this.createVehicleObstacle(rightObsX, obsY, Math.PI / 2, model),
        // Бордюр снизу (стена) будет находиться сразу перед носом машины
        { points: [{ x: -5000, y: wallY }, { x: 5000, y: wallY }, { x: 5000, y: 5000 }, { x: -5000, y: 5000 }] },
        // Стена встречной полосы
        { points: [{ x: -5000, y: -5000 }, { x: 5000, y: -5000 }, { x: 5000, y: yLeftEdge }, { x: -5000, y: yLeftEdge }] }
      ],
      lines: lines,
      trainingHints: [
        { point: { x: 0, y: 150 }, text: "Место" },
        { point: { x: 250, y: -50 }, text: "1. Проедьте вперед, затем влево" },
        { point: { x: 100, y: -120 }, text: "2. Заезжайте назад (R)" }
      ]
    };
  }

  // 3. Парковка елочкой 45 градусов (места справа)
  private static createAngledLevel(useTrucks: boolean, playerModel: CarModel, lanesCount: number): LevelData {
    const model = useTrucks ? 'truck' : 'sienna';
    const m = CAR_MODELS[model];
    const pm = CAR_MODELS[playerModel];

    const angle = Math.PI / 4; // 45 градусов
    const cos45 = Math.cos(angle); // ≈ 0.707
    const sin45 = Math.sin(angle); // ≈ 0.707

    const yRightEdge = 30;
    const margin = 8;

    // ── Глубина (Y-координата геом. центра) соседних машин ───────────────────
    // При угле 45° самый «верхний» угол кузова отстоит от центра на (L/2 + W/2)*sin45.
    // Ставим центр так, чтобы этот угол был ровно на краю дороги + margin.
    const neighborHalfDiag = (m.length / 2 + m.width / 2) * sin45;
    const neighborCY = yRightEdge + neighborHalfDiag + margin;

    // Аналогично для целевой зоны — по размерам машины игрока
    const playerHalfDiag = (pm.length / 2 + pm.width / 2) * sin45;
    const targetCY = yRightEdge + playerHalfDiag + margin;

    // ── Шаг между слотами ВДОЛЬ ДОРОГИ (ось X) ───────────────────────────────
    // Проекция ширины машины на ось дороги при 45°: pitch = W / sin45 = W * √2
    const slotPitch = m.width * Math.SQRT2 + 10; // +10px зазор

    const centerX = 15;
    // Соседи сдвинуты только по X; глубина (Y) у всех одинаковая
    const leftCX  = centerX - slotPitch;
    const rightCX = centerX + slotPitch;

    // ── Перевод геом. центра в координату задней оси ──────────────────────────
    // createVehicleObstacle(x,y) ожидает позицию задней оси, не центра.
    const axisShift = m.length / 2 - m.rearOverhang;
    const leftX  = leftCX  - axisShift * cos45;
    const leftY  = neighborCY - axisShift * sin45;
    const rightX = rightCX - axisShift * cos45;
    const rightY = neighborCY - axisShift * sin45;

    // ── Стена за парковкой ────────────────────────────────────────────────────
    const neighborDeepEdge = neighborCY + neighborHalfDiag;
    const wallY = neighborDeepEdge + 20;

    const yLeftEdge = yRightEdge - lanesCount * 140;

    const lines: { points: Point[]; isDashed: boolean }[] = [
      { points: [{ x: -5000, y: yRightEdge }, { x: 5000, y: yRightEdge }], isDashed: false }
    ];
    for (let i = 1; i < lanesCount; i++) {
      lines.push({ points: [{ x: -5000, y: yRightEdge - i * 140 }, { x: 5000, y: yRightEdge - i * 140 }], isDashed: true });
    }
    lines.push({ points: [{ x: -5000, y: yLeftEdge }, { x: 5000, y: yLeftEdge }], isDashed: false });

    return {
      startPos: { x: -350, y: yRightEdge - 70, heading: 0 },
      targetZone: this.createTargetZone(centerX, targetCY, angle, (pm.width + 30) * 1.1, pm.length + 20),
      obstacles: [
        // Сосед слева
        this.createVehicleObstacle(leftX, leftY, angle, model),
        // Сосед справа
        this.createVehicleObstacle(rightX, rightY, angle, model),
        // Бордюр за парковкой
        { points: [{ x: -5000, y: wallY }, { x: 5000, y: wallY }, { x: 5000, y: 5000 }, { x: -5000, y: 5000 }] },
        // Стена встречной полосы
        { points: [{ x: -5000, y: -5000 }, { x: 5000, y: -5000 }, { x: 5000, y: yLeftEdge }, { x: -5000, y: yLeftEdge }] }
      ],
      lines: lines,
      trainingHints: [
        { point: { x: centerX, y: targetCY }, text: "Место" },
        { point: { x: -200, y: yRightEdge - 70 }, text: "Возьмите чуть левее и паркуйтесь передом" }
      ]
    };
  }
}

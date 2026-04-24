import { CarPhysics, CAR_MODELS } from '../physics/CarPhysics';
import type { LevelData } from '../game/LevelManager';

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  private cameraX: number = 0;
  private cameraY: number = 0;
  private baseScale: number = 1;
  private userZoom: number = 1.0;

  // Стилевые константы
  private COLORS = {
    asphalt: '#64748b',
    lines: '#ffffff',
    carVesta: '#ef4444', 
    carTiggo: '#3b82f6',
    carSienna: '#f59e0b',
    carTruck: '#5eead4',
    obstacle: '#0f172a',
    target: 'rgba(16, 185, 129, 0.4)',
    glass: '#0ea5e9',
    grass: '#4ade80',
    curb: '#ffffff'
  };

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  public setZoom(zoom: number) {
    // Ограничиваем пользовательский зум (от 0.2 отдаления до 4х приближения)
    this.userZoom = Math.max(0.2, Math.min(4.0, zoom));
  }

  public getZoom(): number {
    return this.userZoom;
  }

  private resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    // Вычисляем мобильное это устройство или нет, ориентируясь на наименьшую и наибольшую стороны (Landscape/Portrait)
    const isMobile = Math.min(window.innerWidth, window.innerHeight) < 600 || navigator.userAgent.includes('Mobile');
    this.baseScale = isMobile ? 0.58 : 1; // Увеличен начальный масштаб на 20%
  }

  public render(car: CarPhysics, level: LevelData, isTraining: boolean, currentTime: number = 0) {
    // 1. Очистка и установка фона
    this.ctx.fillStyle = this.COLORS.asphalt;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // 2. Обновление камеры (следим за машиной)
    const finalScale = this.baseScale * this.userZoom;
    const vWidth = this.canvas.width / finalScale;
    const vHeight = this.canvas.height / finalScale;
    this.cameraX = car.x - vWidth / 2;
    this.cameraY = car.y - vHeight / 2;

    this.ctx.save();
    this.ctx.scale(finalScale, finalScale); // Масштабирование
    this.ctx.translate(-this.cameraX, -this.cameraY); // Смещение в координаты мира

    // 3. Отрисовка уровня (разметка, препятствия)
    this.renderLevel(level);

    // 4. Режим обучения (подсказки на земле)
    if (isTraining && level.trainingHints) {
      // this.renderTrainingHints(level.trainingHints);
    }

    // 5. Отрисовка машины
    this.renderCar(car, currentTime);

    this.ctx.restore();
  }

  private renderLevel(level: LevelData) {
    // Парковочное место (цель)
    this.ctx.fillStyle = this.COLORS.target;
    this.ctx.beginPath();
    this.ctx.moveTo(level.targetZone.points[0].x, level.targetZone.points[0].y);
    for (let i = 1; i < level.targetZone.points.length; i++) {
      this.ctx.lineTo(level.targetZone.points[i].x, level.targetZone.points[i].y);
    }
    this.ctx.closePath();
    this.ctx.fill();

    // Разметка (линии)
    this.ctx.strokeStyle = this.COLORS.lines;
    this.ctx.lineWidth = 4;
    for (const line of level.lines) {
      this.ctx.beginPath();
      if ((line as any).isDashed) {
        this.ctx.setLineDash([20, 20]);
      } else {
        this.ctx.setLineDash([]);
      }
      this.ctx.moveTo(line.points[0].x, line.points[0].y);
      this.ctx.lineTo(line.points[1].x, line.points[1].y);
      this.ctx.stroke();
    }
    this.ctx.setLineDash([]);

    // Препятствия (многоугольники, бордюры и стоящие машины)
    for (const obs of level.obstacles as any[]) {
      if (obs.isVehicle && obs.vehicleModel) {
        // Отрисовка соседней машины с фарами (headlights = true, isObstacle = true)
        const m = CAR_MODELS[obs.vehicleModel as keyof typeof CAR_MODELS];
        this.renderVehicleBase(obs.x, obs.y, obs.heading, m, 0, true, 'none', 0, true);
      } else {
        this.ctx.fillStyle = this.COLORS.grass;
        this.ctx.strokeStyle = this.COLORS.curb;
        this.ctx.lineWidth = 6;
        this.ctx.beginPath();
        this.ctx.moveTo(obs.points[0].x, obs.points[0].y);
        for (let i = 1; i < obs.points.length; i++) {
          this.ctx.lineTo(obs.points[i].x, obs.points[i].y);
        }
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();
      }
    }
  }

  private renderCar(car: CarPhysics, currentTime: number) {
    this.renderVehicleBase(
      car.x, car.y, car.heading,
      car.metrics,
      car.steeringAngle,
      car.headlights,
      car.turnSignal,
      currentTime
    );
  }

  private renderVehicleBase(
    x: number, y: number, heading: number,
    m: any, steeringAngle: number,
    headlights: boolean, turnSignal: string,
    currentTime: number,
    isObstacle: boolean = false
  ) {
    this.ctx.save();
    
    // Перемещаемся в центр задней оси! (точка вращения)
    this.ctx.translate(x, y);
    this.ctx.rotate(heading);

    let carColor = this.COLORS.carVesta;
    if (isObstacle) {
      carColor = this.COLORS.obstacle;
    } else {
      if (m.name.includes('Tiggo')) carColor = this.COLORS.carTiggo;
      else if (m.name.includes('Sienna')) carColor = this.COLORS.carSienna;
      else if (m.name.includes('Грузовик')) carColor = this.COLORS.carTruck;
    }

    // Смещение назад, т.к. центр оси не в центре машины
    const shiftX = (m.length / 2) - m.rearOverhang; 

    // Тень
    this.ctx.fillStyle = 'rgba(0,0,0,0.5)';
    this.ctx.fillRect(shiftX - m.length/2 + 5, -m.width/2 + 5, m.length, m.width);

    // Кузов
    this.ctx.fillStyle = carColor;
    this.ctx.beginPath();
    this.ctx.roundRect(shiftX - m.length/2, -m.width/2, m.length, m.width, 10);
    this.ctx.fill();

    // Окна и стойки A, B, C
    this.ctx.fillStyle = this.COLORS.glass;
    if (m.name.includes('Грузовик')) {
      // У грузовика стекло кабины близко к переду
      this.ctx.fillRect(shiftX + m.length/2 - 60, -m.width/2 + 5, 20, m.width - 10);
      this.ctx.fillRect(shiftX + m.length/2 - 50, -m.width/2 + 2, 30, 4);
      this.ctx.fillRect(shiftX + m.length/2 - 50, m.width/2 - 6, 30, 4);
    } else {
      // Лобовое стекло
      this.ctx.fillRect(shiftX + m.length/4, -m.width/2 + 5, 20, m.width - 10);
      // Заднее стекло
      this.ctx.fillRect(shiftX - m.length/3, -m.width/2 + 5, 15, m.width - 10);

      // Боковые
      if (m.name.includes('Tiggo') || m.name.includes('Sienna')) {
        // Кроссовер/Минивэн: более длинные задние окна
        this.ctx.fillRect(shiftX - m.length/3.5, -m.width/2 + 2, m.length/2.5, 4);
        this.ctx.fillRect(shiftX + m.length/7, -m.width/2 + 2, m.length/6, 4);
        this.ctx.fillRect(shiftX - m.length/3.5, m.width/2 - 6, m.length/2.5, 4);
        this.ctx.fillRect(shiftX + m.length/7, m.width/2 - 6, m.length/6, 4);
      } else {
        // Седан
        this.ctx.fillRect(shiftX - m.length/4, -m.width/2 + 2, m.length/3.5, 4); 
        this.ctx.fillRect(shiftX + m.length/10, -m.width/2 + 2, m.length/5, 4);
        this.ctx.fillRect(shiftX - m.length/4, m.width/2 - 6, m.length/3.5, 4);
        this.ctx.fillRect(shiftX + m.length/10, m.width/2 - 6, m.length/5, 4);
      }
    }

    // Госномера
    this.ctx.fillStyle = '#ffffff'; // Белая табличка
    this.ctx.fillRect(shiftX + m.length/2 - 2, -10, 3, 20); // Спереди
    this.ctx.fillRect(shiftX - m.length/2 - 1, -10, 3, 20); // Сзади

    // Физические фары и стоп-сигналы на кузове
    if (headlights) {
      this.ctx.fillStyle = '#fef08a'; // Передние лампы
      this.ctx.fillRect(shiftX + m.length/2 - 2, -m.width/2 + 5, 4, 15);
      this.ctx.fillRect(shiftX + m.length/2 - 2, m.width/2 - 20, 4, 15);
      
      this.ctx.fillStyle = '#ef4444'; // Задние габариты (светятся красным)
      this.ctx.fillRect(shiftX - m.length/2 - 2, -m.width/2 + 5, 4, 15);
      this.ctx.fillRect(shiftX - m.length/2 - 2, m.width/2 - 20, 4, 15);
    }

    // --- Отрисовка Колес (видимых) ---
    this.ctx.fillStyle = '#000';
    const wheelL = 20;
    const wheelW = 8;
    
    // Задние (не поворачиваются)
    // Левое
    this.ctx.fillRect(-wheelL/2, -m.width/2 - wheelW/2, wheelL, wheelW);
    // Правое
    this.ctx.fillRect(-wheelL/2, m.width/2 - wheelW/2, wheelL, wheelW);

    // Передние (поворачиваются в зависимости от руля)
    this.ctx.save();
    this.ctx.translate(m.wheelbase, -m.width/2); // Ось переднего левого
    this.ctx.rotate(steeringAngle);
    this.ctx.fillRect(-wheelL/2, -wheelW/2, wheelL, wheelW);
    this.ctx.restore();

    this.ctx.save();
    this.ctx.translate(m.wheelbase, m.width/2); // Ось переднего правого
    this.ctx.rotate(steeringAngle);
    this.ctx.fillRect(-wheelL/2, -wheelW/2, wheelL, wheelW);
    this.ctx.restore();

    // --- Поворотники ---
    const isBlinking = currentTime > 0 && Math.floor(currentTime / 400) % 2 === 0;
    if (isBlinking && turnSignal !== 'none') {
      this.ctx.fillStyle = '#f59e0b'; // Оранжевый
      if (turnSignal === 'left') {
        this.ctx.fillRect(shiftX - m.length/2 - 2, -m.width/2 + 2, 6, 6); // задний
        this.ctx.fillRect(shiftX + m.length/2 - 4, -m.width/2 + 2, 6, 6); // передний
      } else {
        this.ctx.fillRect(shiftX - m.length/2 - 2, m.width/2 - 8, 6, 6); // задний
        this.ctx.fillRect(shiftX + m.length/2 - 4, m.width/2 - 8, 6, 6); // передний
      }
    }

    this.ctx.restore();
  }
}

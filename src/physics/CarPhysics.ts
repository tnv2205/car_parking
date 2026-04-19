export type CarModel = 'vesta' | 'tiggo' | 'sienna' | 'truck';

export interface CarMetrics {
  name: string;
  length: number;    // Задний бампер до переднего бампера
  width: number;
  wheelbase: number; // Расстояние от задней до передней оси
  rearOverhang: number; // От задней оси до заднего бампера
  maxSteerAngle: number; // Макс. угол поворота колес (радианы)
  acceleration: number;
  braking: number;
  maxSpeed: number;
}

// 1 метр = 40 пикселей для большей детализации
export const CAR_MODELS: Record<CarModel, CarMetrics> = {
  vesta: {
    name: 'Lada Vesta',
    length: 176, width: 70, wheelbase: 105, rearOverhang: 35,
    maxSteerAngle: Math.PI / 5, // 36 градусов
    acceleration: 150, braking: 300, maxSpeed: 200
  },
  tiggo: {
    name: 'Chery Tiggo 4 Pro',
    length: 173, width: 73, wheelbase: 104, rearOverhang: 34,
    maxSteerAngle: Math.PI / 4.8,
    acceleration: 140, braking: 320, maxSpeed: 200
  },
  sienna: {
    name: 'Toyota Sienna',
    length: 207, width: 80, wheelbase: 122, rearOverhang: 42,
    maxSteerAngle: Math.PI / 5.5,
    acceleration: 120, braking: 280, maxSpeed: 180
  },
  truck: {
    name: 'Грузовик',
    length: 280, width: 100, wheelbase: 160, rearOverhang: 60,
    maxSteerAngle: Math.PI / 6, // Менее поворотливый
    acceleration: 60, braking: 200, maxSpeed: 100
  }
};

export type Gear = 'R' | 'N' | '1' | '2';

export class CarPhysics {
  public metrics: CarMetrics;
  
  // Позиция центра ЗАДНЕЙ ОСИ
  public x: number = 0;
  public y: number = 0;
  
  public heading: number = -Math.PI / 2; // Угол кузова (направление вверх)
  public velocity: number = 0; // Скорость машины по вектору движения
  public steeringAngle: number = 0; // Текущий угол руля

  // Состояние руля и педалей
  public inputGas: number = 0;      // 0..1
  public inputBrake: number = 0;    // 0..1
  public inputClutch: number = 0;   // 0 (выжато) .. 1 (отпущено)
  public targetSteerInput: number = 0; // -1 (лево) .. 1 (право)

  public gear: Gear = 'N';
  public engineRunning: boolean = true;
  public stalled: boolean = false;
  public engineRPM: number = 800;

  public turnSignal: 'left' | 'right' | 'none' = 'none';
  public headlights: boolean = true;

  constructor(model: CarModel) {
    this.metrics = CAR_MODELS[model];
  }

  // Сброс машины в нужную позицию
  public reset(x: number, y: number, heading: number) {
    this.x = x;
    this.y = y;
    this.heading = heading;
    this.velocity = 0;
    this.steeringAngle = 0;
    this.engineRunning = true;
    this.stalled = false;
    this.gear = 'N';
  }

  public update(dt: number) {
    if (!this.engineRunning) {
      // Инерционное торможение
      this.velocity = this.applyFriction(this.velocity, 50, dt);
      return this.integrateMovement(dt);
    }

    // --- Механика МКПП ---
    
    // В зависимости от передачи, мотор крутит трансмиссию в разные стороны
    let gearMultiplier = 0;
    if (this.gear === '1') gearMultiplier = 1;
    if (this.gear === '2') gearMultiplier = 1.5;
    if (this.gear === 'R') gearMultiplier = -1;

    // Тяга двигателя
    let motorForce = 0;
    if (this.engineRunning) {
      motorForce = this.metrics.acceleration * this.inputGas * gearMultiplier;
    }

    // Торможение
    let brakeForce = this.metrics.braking * this.inputBrake;

    // Применение сил
    if (motorForce !== 0) {
      this.velocity += motorForce * dt;
    } else {
      // Естественное трение
      this.velocity = this.applyFriction(this.velocity, 30, dt);
    }

    // Применение тормоза (против вектора движения)
    if (brakeForce > 0) {
      if (this.velocity > 0) {
        this.velocity = Math.max(0, this.velocity - brakeForce * dt);
      } else if (this.velocity < 0) {
        this.velocity = Math.min(0, this.velocity + brakeForce * dt);
      }
    }

    // Ограничение скорости
    const maxV = this.metrics.maxSpeed * Math.abs(gearMultiplier || 0.1); 
    if (this.velocity > maxV) this.velocity = maxV;
    if (this.velocity < -maxV) this.velocity = -maxV;

    // --- Поворот руля (плавная интерполяция к целевому значению) ---
    const steerSpeed = Math.PI * dt; // Скорость вращения руля
    const targetSteerAngle = this.targetSteerInput * this.metrics.maxSteerAngle;
    
    if (this.steeringAngle < targetSteerAngle) {
      this.steeringAngle = Math.min(targetSteerAngle, this.steeringAngle + steerSpeed);
    } else if (this.steeringAngle > targetSteerAngle) {
      this.steeringAngle = Math.max(targetSteerAngle, this.steeringAngle - steerSpeed);
    }

    this.integrateMovement(dt);
  }

  private applyFriction(velocity: number, friction: number, dt: number): number {
    if (velocity > 0) return Math.max(0, velocity - friction * dt);
    if (velocity < 0) return Math.min(0, velocity + friction * dt);
    return 0;
  }

  // Интегрирование Кинематической Bicycle Модели
  private integrateMovement(dt: number) {
    if (Math.abs(this.velocity) < 0.1) this.velocity = 0;
    
    // dx/dt = v * cos(heading), dy/dt = v * sin(heading)
    this.x += this.velocity * Math.cos(this.heading) * dt;
    this.y += this.velocity * Math.sin(this.heading) * dt;

    // d(heading)/dt = (v / L) * tan(steering)
    // Чем длиннее колесная база (wheelbase), тем медленнее поворачивает машина
    const angularVelocity = (this.velocity / this.metrics.wheelbase) * Math.tan(this.steeringAngle);
    this.heading += angularVelocity * dt;

    // Нормализация угла
    this.heading = this.heading % (Math.PI * 2);
  }

  // Получить 4 угла машины (bounding box) для рендера и коллизий
  public getBoundingBox() {
    // В Bicycle Model x,y - это задняя ось.
    // Вычисляем центр машины:
    const cx = this.x + (this.metrics.length / 2 - this.metrics.rearOverhang) * Math.cos(this.heading);
    const cy = this.y + (this.metrics.length / 2 - this.metrics.rearOverhang) * Math.sin(this.heading);

    const hw = this.metrics.length / 2;
    const hh = this.metrics.width / 2;

    const cosH = Math.cos(this.heading);
    const sinH = Math.sin(this.heading);

    return [
      { x: cx + hw * cosH - hh * sinH, y: cy + hw * sinH + hh * cosH }, // Front-Right
      { x: cx + hw * cosH + hh * sinH, y: cy + hw * sinH - hh * cosH }, // Front-Left
      { x: cx - hw * cosH + hh * sinH, y: cy - hw * sinH - hh * cosH }, // Back-Left
      { x: cx - hw * cosH - hh * sinH, y: cy - hw * sinH + hh * cosH }  // Back-Right
    ];
  }
}

import { CarPhysics, type CarModel } from '../physics/CarPhysics';
import { InputManager } from './Input';
import { Renderer } from '../graphics/Renderer';
import { LevelManager, type LevelData, type LevelType } from '../game/LevelManager';
import { Collision } from '../physics/Collision';

export class GameLoop {
  private lastTime: number = 0;
  private animationId: number = 0;
  private isRunning: boolean = false;
  private isTraining: boolean = true;

  private car!: CarPhysics;
  private input: InputManager;
  private renderer: Renderer;
  private level!: LevelData;

  // UI callbacks
  public onWin?: () => void;
  public onFail?: (reason: string) => void;
  public onUpdateUI?: (speed: number, gear: string) => void;
  public onSignalWarning?: () => void;

  private hasWarnedAboutSignal: boolean = false;

  public setZoom(zoom: number) {
      if (this.renderer) {
          this.renderer.setZoom(zoom);
      }
  }

  public getZoom(): number {
      return this.renderer ? this.renderer.getZoom() : 1.0;
  }

  private hasFinished: boolean = false;

  constructor(canvas: HTMLCanvasElement, isTrainingMode: boolean) {
    this.input = new InputManager();
    this.renderer = new Renderer(canvas);
    this.isTraining = isTrainingMode;
  }

  public start(carModel: CarModel, levelType: LevelType, useTrucks: boolean = false, lanesCount: number = 2) {
    this.car = new CarPhysics(carModel);
    this.level = LevelManager.getLevel(levelType, useTrucks, carModel, lanesCount);
    
    this.car.reset(this.level.startPos.x, this.level.startPos.y, this.level.startPos.heading);
    this.input.reset();
    this.hasFinished = false;
    this.hasWarnedAboutSignal = false;

    if (!this.isRunning) {
      this.isRunning = true;
      this.lastTime = performance.now();
      this.animationId = requestAnimationFrame((t) => this.loop(t));
    }
  }

  public stop() {
    this.isRunning = false;
    cancelAnimationFrame(this.animationId);
  }

  private loop(currentTime: number) {
    if (!this.isRunning) return;

    const dt = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;

    // В игре не допускаем слишком большие скачки dt
    this.update(Math.min(dt, 0.1));
    this.renderer.render(this.car, this.level, this.isTraining, currentTime);

    if (this.onUpdateUI) {
      // Перевод скорости (пиксели/сек) в км/ч (примерный)
      const kmh = Math.abs(this.car.velocity * 3.6 / 10);
      this.onUpdateUI(kmh, this.car.gear);
    }

    this.animationId = requestAnimationFrame((t) => this.loop(t));
  }

  private signalMaxSteer: number = 0;

  private update(dt: number) {
    if (this.hasFinished) return;

    // Передаем инпуты в машину
    this.car.inputGas = this.input.gas;
    this.car.inputBrake = this.input.brake;
    this.car.targetSteerInput = this.input.steer;

    // Автоотключение поворотника
    if (this.input.turnSignal !== 'none') {
        const steer = this.car.steeringAngle;
        if (this.input.turnSignal === 'left') {
            if (steer < this.signalMaxSteer) this.signalMaxSteer = steer;
            // Отключаем сигнал, только когда руль практически полностью выпрямлен
            if (this.signalMaxSteer < -0.2 && steer > -0.05) {
                this.input.turnSignal = 'none';
                this.input.updateTurnSignalUI();
            }
        } else if (this.input.turnSignal === 'right') {
            if (steer > this.signalMaxSteer) this.signalMaxSteer = steer;
            if (this.signalMaxSteer > 0.2 && steer < 0.05) {
                this.input.turnSignal = 'none';
                this.input.updateTurnSignalUI();
            }
        }
    } else {
        this.signalMaxSteer = 0;
    }

    this.car.turnSignal = this.input.turnSignal;
    // Синхронизация КПП
    if (this.car.gear !== this.input.gear && this.car.engineRunning) {
        this.car.gear = this.input.gear;
    }
    console.log(`dt: ${dt}, inputGear: ${this.input.gear}, carGear: ${this.car.gear}, carV: ${this.car.velocity}, gas: ${this.input.gas}`);

    this.car.update(dt);

    if (!this.hasWarnedAboutSignal && Math.abs(this.car.velocity) > 0.5 && this.car.turnSignal === 'none') {
      this.hasWarnedAboutSignal = true;
      if (this.onSignalWarning) this.onSignalWarning();
    }

    const carBoundingBox = this.car.getBoundingBox();

    // Проверка столкновений
    const carPoly = { points: carBoundingBox };
    for (const obs of this.level.obstacles) {
      if (Collision.checkPolygonCollision(carPoly, obs)) {
        this.fail("Авария! Вы врезались в препятствие.");
        return;
      }
    }

    // Проверка победы
    // Скорость почти нулевая, 4 угла внутри парковки и передача N
    if (Math.abs(this.car.velocity) < 0.1 && this.car.gear === 'N') {
      if (Collision.isCarInsideTarget(carBoundingBox, this.level.targetZone.points)) {
        this.win();
      }
    }
  }

  private fail(reason: string) {
    this.hasFinished = true;
    if (this.onFail) this.onFail(reason);
  }

  private win() {
    this.hasFinished = true;
    if (this.onWin) this.onWin();
  }
}

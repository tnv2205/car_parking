import type { Gear } from '../physics/CarPhysics';

export class InputManager {
  // Текущее состояние ввода
  public gas: number = 0;
  public brake: number = 0;
  public steer: number = 0; // -1 (лево) до 1 (право)
  
  public gear: Gear = 'N';
  public turnSignal: 'left' | 'right' | 'none' = 'none';

  constructor() {
    (window as any).InputInstantiations = ((window as any).InputInstantiations || 0) + 1;
    console.warn("InputManager instantiated! Total: " + (window as any).InputInstantiations);
    this.setupKeyboard();
    this.setupMobileUI();
  }

  public reset() {
    this.gear = 'N';
    this.turnSignal = 'none';
    this.updateGearUI();
    this.updateTurnSignalUI();
  }

  private setupKeyboard() {
    const keys: Record<string, boolean> = {};

    window.addEventListener('keydown', (e) => {
      keys[e.code] = true;
      this.updateKeyboardState(keys);

      const key = e.key.toLowerCase();
      
      // Поворотники
      if (e.code === 'KeyQ' || key === 'q' || key === 'й') {
        this.turnSignal = this.turnSignal === 'left' ? 'none' : 'left';
        this.updateTurnSignalUI();
      }
      if (e.code === 'KeyE' || key === 'e' || key === 'у') {
        this.turnSignal = this.turnSignal === 'right' ? 'none' : 'right';
        this.updateTurnSignalUI();
      }

      // Переключение передач клавиатурой
      if (e.code === 'Digit1' || e.code === 'Numpad1' || key === '1') this.gear = '1';
      else if (e.code === 'Digit2' || e.code === 'Numpad2' || key === '2') this.gear = '2';
      else if (e.code === 'KeyR' || key === 'r' || key === 'к') this.gear = 'R';
      else if (e.code === 'KeyN' || key === 'n' || key === 'т') this.gear = 'N';
      
      this.updateGearUI();
    });

    window.addEventListener('keyup', (e) => {
      keys[e.code] = false;
      this.updateKeyboardState(keys);
    });
  }

  private updateKeyboardState(keys: Record<string, boolean>) {
    // Газ/Тормоз
    this.gas = (keys['ArrowUp'] || keys['KeyW']) ? 1 : 0;
    this.brake = (keys['ArrowDown'] || keys['KeyS']) ? 1 : 0;

    // Руль
    if (keys['ArrowLeft'] || keys['KeyA']) {
      this.steer = -1;
    } else if (keys['ArrowRight'] || keys['KeyD']) {
      this.steer = 1;
    } else {
      this.steer = 0;
    }


  }

  private setupMobileUI() {
    const btnBrake = document.getElementById('pedal-brake');
    const btnGas = document.getElementById('pedal-gas');
    const steerWheel = document.getElementById('steer-wheel');

    // Педали
    const addPedalEvents = (el: HTMLElement | null, setter: (val: number) => void) => {
      if (!el) return;
      el.addEventListener('touchstart', (e) => { e.preventDefault(); setter(1); el.classList.add('active'); }, {passive: false});
      el.addEventListener('touchend', (e) => { e.preventDefault(); setter(0); el.classList.remove('active'); }, {passive: false});
      el.addEventListener('mousedown', (e) => { e.preventDefault(); setter(1); el.classList.add('active'); });
      el.addEventListener('mouseup', (e) => { e.preventDefault(); setter(0); el.classList.remove('active'); });
      el.addEventListener('mouseleave', (e) => { e.preventDefault(); setter(0); el.classList.remove('active'); });
    };
    addPedalEvents(btnBrake, (v) => this.brake = v);
    addPedalEvents(btnGas, (v) => this.gas = v);

    // Руль (круговое вращение)
    if (steerWheel) {
      let isDragging = false;
      let startAngle = 0;
      let currentWheelRotation = 0; // Накопленный угол вращения руля
      const maxRotation = 450; // 2.5 оборота от упора до упора = +-450 градусов
      
      const getAngle = (clientX: number, clientY: number) => {
        const rect = steerWheel.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        return Math.atan2(clientY - cy, clientX - cx) * 180 / Math.PI;
      };

      const onStart = (clientX: number, clientY: number) => {
        isDragging = true;
        steerWheel.style.transition = 'none'; // Отключаем плавность при свайпе
        startAngle = getAngle(clientX, clientY);
      };
      
      const onMove = (clientX: number, clientY: number) => {
        if (!isDragging) return;
        const currentAngle = getAngle(clientX, clientY);
        let delta = currentAngle - startAngle;
        
        // Обработка перехода через 180/-180 градусов
        if (delta > 180) delta -= 360;
        if (delta < -180) delta += 360;
        
        currentWheelRotation += delta;
        
        // Ограничиваем вращение
        currentWheelRotation = Math.max(-maxRotation, Math.min(maxRotation, currentWheelRotation));
        
        // Нормализуем для физики (от -1 до 1)
        this.steer = currentWheelRotation / maxRotation;
        
        steerWheel.style.transform = `rotate(${currentWheelRotation}deg)`;
        startAngle = currentAngle;
      };

      const onEnd = () => {
        if (!isDragging) return;
        isDragging = false;
        this.steer = 0;
        currentWheelRotation = 0;
        steerWheel.style.transition = 'transform 0.4s ease-out';
        steerWheel.style.transform = `rotate(0deg)`;
      };

      steerWheel.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (e.targetTouches.length > 0) {
          onStart(e.targetTouches[0].clientX, e.targetTouches[0].clientY);
        }
      }, {passive: false});
      
      steerWheel.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (e.targetTouches.length > 0) {
          onMove(e.targetTouches[0].clientX, e.targetTouches[0].clientY);
        }
      }, {passive: false});
      
      steerWheel.addEventListener('touchend', (e) => {
        if (e.targetTouches.length === 0) onEnd();
      });
      
      steerWheel.addEventListener('mousedown', (e) => onStart(e.clientX, e.clientY));
      window.addEventListener('mousemove', (e) => onMove(e.clientX, e.clientY));
      window.addEventListener('mouseup', onEnd);
    }
    
    // Кнопки поворотников
    document.querySelectorAll('.turn-btn').forEach(btn => {
      const toggleSignal = (e: Event) => {
        e.preventDefault();
        const el = e.currentTarget as HTMLElement;
        const dir = el.dataset.dir as 'left' | 'right';
        this.turnSignal = this.turnSignal === dir ? 'none' : dir;
        this.updateTurnSignalUI();
      };
      btn.addEventListener('touchstart', toggleSignal, {passive: false});
      btn.addEventListener('mousedown', toggleSignal);
    });

    // КПП кнопки
    document.querySelectorAll('.gear-btn').forEach(btn => {
      const setGear = (e: Event) => {
        e.preventDefault();
        const el = e.currentTarget as HTMLElement;
        this.gear = el.dataset.gear as Gear;
        this.updateGearUI();
      };
      btn.addEventListener('touchstart', setGear, {passive: false});
      btn.addEventListener('mousedown', setGear);
    });
  }

  private updateGearUI() {
    document.querySelectorAll('.gear-btn').forEach(btn => {
      const el = btn as HTMLElement;
      if (el.dataset.gear === this.gear) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    });
  }

  public updateTurnSignalUI() {
    document.querySelectorAll('.turn-btn').forEach(btn => {
      const el = btn as HTMLElement;
      if (el.dataset.dir === this.turnSignal) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    });
  }
}

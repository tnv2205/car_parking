import './style.css';
import { GameLoop } from './engine/GameLoop';
import type { CarModel } from './physics/CarPhysics';
import type { LevelType } from './game/LevelManager';

document.addEventListener('DOMContentLoaded', () => {
  console.log('App initialized.');

  const uiElements = {
    menuOverlay: document.getElementById('menu-overlay') as HTMLElement,
    resultOverlay: document.getElementById('result-overlay') as HTMLElement,
    resultTitle: document.getElementById('result-title') as HTMLElement,
    resultDesc: document.getElementById('result-desc') as HTMLElement,
    startBtn: document.getElementById('start-btn') as HTMLButtonElement,
    restartBtn: document.getElementById('restart-btn') as HTMLButtonElement,
    menuBtn: document.getElementById('menu-btn') as HTMLButtonElement,
    carBtns: document.querySelectorAll('.car-btn'),
    levelBtns: document.querySelectorAll('.level-btn'),
    infoMode: document.getElementById('info-mode') as HTMLElement,
    instructions: document.getElementById('instructions') as HTMLElement,
    speedMeter: document.getElementById('speed-meter') as HTMLElement,
    currentGear: document.getElementById('current-gear') as HTMLElement,
    mobileControls: document.getElementById('mobile-controls') as HTMLElement,
    canvas: document.getElementById('gameCanvas') as HTMLCanvasElement,
    useTrucksCheckbox: document.getElementById('use-trucks-checkbox') as HTMLInputElement,
    lanesCountSelect: document.getElementById('lanes-count-select') as HTMLSelectElement,
    hudRestartBtn: document.getElementById('hud-restart-btn') as HTMLButtonElement,
    hudMenuBtn: document.getElementById('hud-menu-btn') as HTMLButtonElement
  };

  let selectedCar: CarModel = 'vesta';
  let selectedLevel: LevelType = 'parallel';
  
  let gameLoop: GameLoop | null = null;

  // Обработка выбора машины
  uiElements.carBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const target = e.currentTarget as HTMLElement;
      uiElements.carBtns.forEach(b => b.classList.remove('active'));
      target.classList.add('active');
      selectedCar = target.dataset.car as CarModel;
    });
  });

  // Обработка выбора уровня
  uiElements.levelBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const target = e.currentTarget as HTMLElement;
      uiElements.levelBtns.forEach(b => b.classList.remove('active'));
      target.classList.add('active');
      selectedLevel = target.dataset.level as LevelType;
    });
  });

  const startGame = () => {
    uiElements.menuOverlay.classList.remove('active');
    uiElements.resultOverlay.classList.remove('active');
    
    // Включение полноэкранного режима на телефонах
    if (!document.fullscreenElement && navigator.userAgent.includes('Mobile')) {
      document.documentElement.requestFullscreen().catch(e => console.warn(e));
    }

    // Скрываем текстовые подсказки
    uiElements.instructions.style.display = 'none';

    if (!gameLoop) {
      // Инициализация движка (режим обучения отключен)
      gameLoop = new GameLoop(uiElements.canvas, false);
      
      gameLoop.onUpdateUI = (speed, gear) => {
        uiElements.speedMeter.textContent = `${speed.toFixed(1)} км/ч`;
        if (uiElements.currentGear) {
            uiElements.currentGear.textContent = `Передача: ${gear}`;
        }
      };

      gameLoop.onWin = () => {
        uiElements.resultTitle.textContent = "Парковка успешна!";
        uiElements.resultTitle.style.color = "var(--success-color)";
        uiElements.resultDesc.textContent = "Идеально ровно и безопасно.";
        uiElements.resultOverlay.classList.add('active');
        if (gameLoop) gameLoop.stop();
      };

      gameLoop.onFail = (reason) => {
        uiElements.resultTitle.textContent = "Упс... Провал";
        uiElements.resultTitle.style.color = "var(--danger-color)";
        uiElements.resultDesc.textContent = reason;
        uiElements.resultOverlay.classList.add('active');
        if (gameLoop) gameLoop.stop();
      };
    }

    // Запуск игры с выбранными параметрами
    const useTrucks = uiElements.useTrucksCheckbox ? uiElements.useTrucksCheckbox.checked : false;
    const lanesCount = uiElements.lanesCountSelect ? parseInt(uiElements.lanesCountSelect.value) : 2;
    gameLoop.start(selectedCar, selectedLevel, useTrucks, lanesCount);
  };

  uiElements.startBtn.addEventListener('click', startGame);
  uiElements.restartBtn.addEventListener('click', startGame);
  uiElements.hudRestartBtn.addEventListener('click', startGame);
  
  const showMenu = () => {
    uiElements.resultOverlay.classList.remove('active');
    uiElements.menuOverlay.classList.add('active');
  };

  uiElements.menuBtn.addEventListener('click', showMenu);
  uiElements.hudMenuBtn.addEventListener('click', showMenu);

  // Логика зума (колесико мыши и Pinch-to-Zoom двумя пальцами)
  function getPinchDist(touches: TouchList) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  let initialZoomDist = 0;
  let initialZoomScale = 1.0;

  uiElements.canvas.addEventListener('wheel', (e) => {
    if (!gameLoop) return;
    const zoomDelta = e.deltaY > 0 ? -0.1 : 0.1;
    gameLoop.setZoom(gameLoop.getZoom() + zoomDelta);
  }, { passive: true });

  uiElements.canvas.addEventListener('touchstart', (e) => {
    if (!gameLoop) return;
    if (e.targetTouches.length === 2) {
      initialZoomDist = getPinchDist(e.targetTouches);
      initialZoomScale = gameLoop.getZoom();
    }
  }, { passive: true });

  uiElements.canvas.addEventListener('touchmove', (e) => {
    if (!gameLoop) return;
    if (e.targetTouches.length === 2) {
      if (e.cancelable) e.preventDefault(); // блокируем браузерный скролл
      const newDist = getPinchDist(e.targetTouches);
      const ratio = newDist / initialZoomDist;
      const smoothRatio = 1 + (ratio - 1) * 0.5; // Снижаем чувствительность
      gameLoop.setZoom(initialZoomScale * smoothRatio);
    }
  }, { passive: false });

});

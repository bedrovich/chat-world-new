import { useEffect, useRef } from 'react';
import * as PIXI from 'pixi.js';
import { useStore } from '../store';

export default function GameWorld() {
  const containerRef = useRef(null);
  const appRef = useRef(null);
  const isInitialized = useRef(false);
  const { players, pets } = useStore();

  useEffect(() => {
    const app = new PIXI.Application();
    appRef.current = app;

    // 🔥 PixiJS v8: инициализация асинхронная
    app.init({
      background: '#1a1a24',
      resizeTo: window,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    }).then(() => {
      if (containerRef.current) {
        containerRef.current.appendChild(app.canvas);
      }
      isInitialized.current = true; // 🔥 Помечаем как готовый

      // Контейнер мира (для камеры)
      const world = new PIXI.Container();
      app.stage.addChild(world);

      // Слои
      const gridLayer = new PIXI.Container();
      const petsLayer = new PIXI.Container();
      const playersLayer = new PIXI.Container();
      world.addChild(gridLayer, petsLayer, playersLayer);

      // Сетка
      const gridGraphics = new PIXI.Graphics();
      gridGraphics.moveTo(0, 0);
      for (let x = 0; x <= 1600; x += 100) {
        gridGraphics.moveTo(x, 0);
        gridGraphics.lineTo(x, 800);
      }
      for (let y = 0; y <= 800; y += 100) {
        gridGraphics.moveTo(0, y);
        gridGraphics.lineTo(1600, y);
      }
      gridGraphics.stroke({ width: 1, color: '#2a2a35' });
      gridLayer.addChild(gridGraphics);

      // Загрузка ассетов
      PIXI.Assets.load([
        '/assets/head.png',
        '/assets/body.png',
        '/assets/dog.png',
        '/assets/cat.png',
        '/assets/tv.png'
      ]).then(() => {
        // Спрайты готовы к использованию
      });

      // Игровой цикл
      app.ticker.add(() => {
        // Камера будет здесь, когда добавим игрока
      });
    }).catch((err) => {
      console.error('PixiJS init error:', err);
    });

    // 🔥 Cleanup: только если app был инициализирован
    return () => {
      if (isInitialized.current && appRef.current) {
        try {
          appRef.current.destroy(true);
        } catch (e) {
          console.warn('PixiJS destroy error (ignored):', e);
        }
      }
      // Если не инициализирован — просто очищаем DOM
      if (containerRef.current && app.canvas?.parent) {
        containerRef.current.removeChild(app.canvas);
      }
    };
  }, []);

  // Обновление позиций (отдельный эффект, чтобы не перезапускать init)
  useEffect(() => {
    if (!isInitialized.current || !appRef.current) return;
    
    // Здесь можно обновлять спрайты при изменении players/pets
    // Например: sprite.x = player.x и т.д.
  }, [players, pets]);

  return <div ref={containerRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} />;
}
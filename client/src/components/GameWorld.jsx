import { useEffect, useRef } from 'react';
import * as PIXI from 'pixi.js';
import { useStore } from '../store';
import { useSocket } from '../hooks/useSocket';

export default function GameWorld() {
  const containerRef = useRef(null);
  const { players, pets, me } = useStore();
  const socket = useSocket();
  
  // Для управления движением
  const keys = useRef({});
  const myPlayer = players[me];

  useEffect(() => {
    // Слушатели клавиш
    const handleDown = (e) => keys.current[e.key.toLowerCase()] = true;
    const handleUp = (e) => keys.current[e.key.toLowerCase()] = false;
    window.addEventListener('keydown', handleDown);
    window.addEventListener('keyup', handleUp);

    const app = new PIXI.Application({
      resizeTo: window,
      backgroundColor: '#1a1a24',
    });
    containerRef.current.appendChild(app.view);

    // Контейнер мира (для камеры)
    const world = new PIXI.Container();
    app.stage.addChild(world);

    // Слои
    const gridLayer = new PIXI.Container();
    const petsLayer = new PIXI.Container();
    const playersLayer = new PIXI.Container();
    world.addChild(gridLayer, petsLayer, playersLayer);

    // Рисуем сетку (один раз)
    const gridGraphics = new PIXI.Graphics();
    gridGraphics.lineStyle(1, '#2a2a35');
    for (let x = 0; x <= 1600; x += 100) {
      gridGraphics.moveTo(x, 0); gridGraphics.lineTo(x, 800);
    }
    for (let y = 0; y <= 800; y += 100) {
      gridGraphics.moveTo(0, y); gridGraphics.lineTo(1600, y);
    }
    gridLayer.addChild(gridGraphics);

    // Спрайты игроков
    const playerSprites = {};
    // Спрайты питомцев
    const petSprites = {};

    // Логика обновления
    app.ticker.add(() => {
      // Движение игрока
      if (myPlayer) {
        let dx = 0, dy = 0;
        if (keys.current['w'] || keys.current['ц']) dy -= 1;
        if (keys.current['s'] || keys.current['ы']) dy += 1;
        if (keys.current['a'] || keys.current['ф']) dx -= 1;
        if (keys.current['d'] || keys.current['в']) dx += 1;

        if (dx || dy) {
          // Нормализация
          const len = Math.sqrt(dx*dx + dy*dy);
          dx /= len; dy /= len;
          
          const speed = 4;
          myPlayer.x = Math.max(20, Math.min(1600 - 20, myPlayer.x + dx * speed));
          myPlayer.y = Math.max(20, Math.min(800 - 20, myPlayer.y + dy * speed));
          
          // Оптимизация: отправляем не каждый кадр, а раз в 50мс (можно добавить throttle)
          if (Math.random() > 0.5) socket.emit('move', { x: myPlayer.x, y: myPlayer.y });
        }

        // Камера
        world.x = -myPlayer.x + app.screen.width / 2;
        world.y = -myPlayer.y + app.screen.height / 2;
      }

      // Обновление спрайтов игроков
      for (const id in players) {
        const p = players[id];
        if (!playerSprites[id]) {
          const sprite = PIXI.Sprite.from('/assets/head.png'); // Заглушка, тут нужна логика сборки из body/head
          sprite.anchor.set(0.5);
          sprite.scale.set(0.8);
          playersLayer.addChild(sprite);
          playerSprites[id] = sprite;
        }
        playerSprites[id].x = p.x;
        playerSprites[id].y = p.y;
      }

      // Обновление спрайтов питомцев
      for (const id in pets) {
        const p = pets[id];
        if (!petSprites[id]) {
          const sprite = PIXI.Sprite.from(p.type === 'dog' ? '/assets/dog.png' : '/assets/cat.png');
          sprite.anchor.set(0.5);
          petsLayer.addChild(sprite);
          petSprites[id] = sprite;
        }
        petSprites[id].x = p.x;
        petSprites[id].y = p.y;
      }
    });

    return () => {
      app.destroy(true);
      window.removeEventListener('keydown', handleDown);
      window.removeEventListener('keyup', handleUp);
    };
  }, [players, pets, myPlayer, socket]);

  return <div ref={containerRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} />;
}
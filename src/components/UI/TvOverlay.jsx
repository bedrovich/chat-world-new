// src/components/UI/TvOverlay.jsx
import React, { useEffect, useRef, useState } from 'react';

// Координаты телевизора в игровом мире
const TV_WORLD_POS = { x: 400, y: -80 };
const TV_SIZE = { w: 500, h: 300 };

export const TvOverlay = ({ tvState }) => {
  const overlayRef = useRef(null);
  const iframeRef = useRef(null);
  // Состояние для камеры: её позиция в мире и зум
  const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 1 });

  useEffect(() => {
    // Функция для обновления состояния камеры
    const updateCamera = () => {
      if (window.gameScene && window.gameScene.cameras?.main) {
        const cam = window.gameScene.cameras.main;
        setCamera({
          x: cam.worldView.x,
          y: cam.worldView.y,
          zoom: cam.zoom
        });
      } else {
        // Продолжаем запрашивать следующий кадр, даже если сцена ещё не готова
        requestAnimationFrame(updateCamera);
        return;
      }
      requestAnimationFrame(updateCamera);
    };
    const frameId = requestAnimationFrame(updateCamera);
    return () => cancelAnimationFrame(frameId);
  }, []);

  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;

    // 1. Переводим мировые координаты центра телевизора в экранные
    // Вычитаем из координат объекта координаты верхнего левого угла камеры
    // и умножаем на зум.
    const screenX = (TV_WORLD_POS.x - camera.x) * camera.zoom;
    const screenY = (TV_WORLD_POS.y - camera.y) * camera.zoom;

    // 2. Проверяем, виден ли телевизор на экране
    const isVisible = screenX > -TV_SIZE.w && screenX < window.innerWidth + TV_SIZE.w &&
                     screenY > -TV_SIZE.h && screenY < window.innerHeight + TV_SIZE.h;

    if (!tvState.currentVideoId || !isVisible) {
      overlay.style.display = 'none';
      return;
    }

    // 3. Показываем оверлей и позиционируем его
    overlay.style.display = 'block';
    // Устанавливаем позицию, чтобы центрировать оверлей по экранным координатам
    overlay.style.left = `${screenX - TV_SIZE.w / 2}px`;
    overlay.style.top = `${screenY - TV_SIZE.h / 2}px`;
    overlay.style.width = `${TV_SIZE.w}px`;
    overlay.style.height = `${TV_SIZE.h}px`;

    // 4. Управляем iframe
    const startTime = Math.max(0, Math.floor((Date.now() - tvState.videoStartTime) / 1000));
    const newSrc = `http://2.26.28.10:3000/embed/${tvState.currentVideoId}?autoplay=1&controls=0&mute=0&loop=0&start=${startTime}`;
    if (iframeRef.current && iframeRef.current.src !== newSrc) {
      iframeRef.current.src = newSrc;
    }
  }, [tvState, camera]);

  return (
    <div id="tv-screen-overlay" ref={overlayRef}>
      <div id="tv-screen-player">
        <iframe ref={iframeRef} title="TV" frameBorder="0" allow="autoplay; encrypted-media" style={{ pointerEvents: 'none', width: '100%', height: '100%' }}></iframe>
      </div>
    </div>
  );
};
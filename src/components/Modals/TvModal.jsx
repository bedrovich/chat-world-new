import React, { useEffect, useRef, useState } from 'react';

export const TvModal = ({ isOpen, socket, onClose, tvState }) => {
  const playerRef = useRef(null);
  const containerRef = useRef(null);
  const [url, setUrl] = useState('');

  useEffect(() => {
    if (isOpen && window.YT && !playerRef.current) {
      playerRef.current = new YT.Player(containerRef.current, {
        height: '240',
        width: '100%',
        playerVars: { controls: 0, modestbranding: 1, rel: 0, playsinline: 1, iv_load_policy: 3, fs: 0, disablekb: 1 },
        events: {
          onReady: () => {
            if (tvState.currentVideoId) {
              playerRef.current.loadVideoById(tvState.currentVideoId);
              playerRef.current.seekTo(tvState.videoStartTime ? (Date.now() - tvState.videoStartTime)/1000 : 0, true);
              if (tvState.isPlaying) playerRef.current.playVideo();
              else playerRef.current.pauseVideo();
            }
          }
        }
      });
    }
  }, [isOpen, tvState]);

  useEffect(() => {
    window.__setPhaserTyping?.(isOpen);
  }, [isOpen]);

  const addVideo = () => {
    const videoId = extractYouTubeId(url);
    if (videoId) socket.emit('tv_add', { url });
    else alert('Неверная ссылка YouTube');
    setUrl('');
  };
  const extractYouTubeId = (url) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };
  const stop = () => socket.emit('tv_stop');

  if (!isOpen) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>📺 Телевизор</h3>
          <button className="close-modal-btn" onClick={onClose}>×</button>
        </div>
        <div ref={containerRef} style={{ width: '100%', height: '240px', margin: '15px 0', background: '#000' }}></div>
        <div className="tv-modal-input-area">
          <input type="text" value={url} onChange={e => setUrl(e.target.value)} placeholder="Вставь ссылку YouTube..." />
          <button onClick={addVideo}>➕ В очередь</button>
        </div>
        <button className="tv-modal-stop-btn" onClick={stop}>⏹ Стоп</button>
      </div>
    </div>
  );
};
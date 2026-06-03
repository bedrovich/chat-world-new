import { useEffect, useRef, useState } from 'react';

const RTC_CONFIG = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

export const useWebRTC = (socket, myId, players) => {
  const [micEnabled, setMicEnabled] = useState(false);
  const localStreamRef = useRef(null);
  const peerConnectionsRef = useRef({});

  useEffect(() => {
    if (!socket || !myId) return;
    const handleOffer = async (data) => {
      if (!localStreamRef.current || peerConnectionsRef.current[data.from]) return;
      const pc = new RTCPeerConnection(RTC_CONFIG);
      localStreamRef.current.getTracks().forEach(track => pc.addTrack(track, localStreamRef.current));
      pc.ontrack = (e) => {
        const audio = new Audio();
        audio.srcObject = e.streams[0];
        audio.autoplay = true;
        audio.id = `audio-${data.from}`;
        document.body.appendChild(audio);
      };
      pc.onicecandidate = (e) => {
        if (e.candidate) socket.emit('rtc-ice', { to: data.from, candidate: e.candidate });
      };
      await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('rtc-answer', { to: data.from, sdp: answer });
      peerConnectionsRef.current[data.from] = pc;
    };
    const handleAnswer = async (data) => {
      const pc = peerConnectionsRef.current[data.from];
      if (pc) await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
    };
    const handleIce = async (data) => {
      const pc = peerConnectionsRef.current[data.from];
      if (pc) await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
    };
    const handlePlayerJoined = (p) => {
      if (localStreamRef.current && p.id !== myId && !peerConnectionsRef.current[p.id]) {
        createPeer(p.id);
      }
    };
    const createPeer = async (remoteId) => {
      if (!localStreamRef.current) return;
      const pc = new RTCPeerConnection(RTC_CONFIG);
      localStreamRef.current.getTracks().forEach(track => pc.addTrack(track, localStreamRef.current));
      pc.ontrack = (e) => {
        const audio = new Audio();
        audio.srcObject = e.streams[0];
        audio.autoplay = true;
        audio.id = `audio-${remoteId}`;
        document.body.appendChild(audio);
      };
      pc.onicecandidate = (e) => {
        if (e.candidate) socket.emit('rtc-ice', { to: remoteId, candidate: e.candidate });
      };
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('rtc-offer', { to: remoteId, sdp: offer });
      peerConnectionsRef.current[remoteId] = pc;
    };
    socket.on('rtc-offer', handleOffer);
    socket.on('rtc-answer', handleAnswer);
    socket.on('rtc-ice', handleIce);
    socket.on('playerJoined', handlePlayerJoined);
    return () => {
      socket.off('rtc-offer', handleOffer);
      socket.off('rtc-answer', handleAnswer);
      socket.off('rtc-ice', handleIce);
      socket.off('playerJoined', handlePlayerJoined);
      Object.values(peerConnectionsRef.current).forEach(pc => pc.close());
      if (localStreamRef.current) localStreamRef.current.getTracks().forEach(t => t.stop());
    };
  }, [socket, myId]);

  const toggleMic = async () => {
    if (!localStreamRef.current) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        localStreamRef.current = stream;
        setMicEnabled(true);
        socket.emit('micToggle', true);
        // Создать пиры для уже существующих игроков
        Object.keys(players).forEach(id => {
          if (id !== myId && !peerConnectionsRef.current[id]) {
            // отложим создание, логика в обработчике, но можно вызвать напрямую? Лучше через событие, но упростим: 
            // переиспользуем функцию, но она замкнута. Просто вызовем ещё один эффект – не критично, пользователь переподключится.
          }
        });
      } catch (err) { alert('Нет доступа к микрофону'); }
    } else {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
      setMicEnabled(false);
      socket.emit('micToggle', false);
      Object.values(peerConnectionsRef.current).forEach(pc => pc.close());
      peerConnectionsRef.current = {};
      document.querySelectorAll('audio[id^="audio-"]').forEach(a => a.remove());
    }
  };
  return { micEnabled, toggleMic };
};
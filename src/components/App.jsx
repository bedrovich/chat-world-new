import React, { useEffect, useState } from 'react';
import { Game } from '../game/Game';
import { useSocket } from '../hooks/useSocket';
import { ChatBox } from './Chat/ChatBox';
import { NicknameModal } from './Modals/NicknameModal';
import { TvModal } from './Modals/TvModal';
import { PetModal } from './Modals/PetModal';
import { Coords } from './UI/Coords';
import { MicButton } from './UI/MicButton';
import { TvOverlay } from './UI/TvOverlay';
import { useWebRTC } from '../hooks/useWebRTC';

const SERVER_URL = 'http://localhost:228'; // подставь свой адрес

function App() {
  const socket = useSocket(SERVER_URL);
  const [gameReady, setGameReady] = useState(false);
  const [players, setPlayers] = useState({});
  const [pets, setPets] = useState({});
  const [currentPlayerId, setCurrentPlayerId] = useState(null);
  const [needNick, setNeedNick] = useState(false);
  const [tvModalOpen, setTvModalOpen] = useState(false);
  const [petModalOpen, setPetModalOpen] = useState(false);
  const [tvState, setTvState] = useState({ currentVideoId: null, videoStartTime: 0, isPlaying: false });

  // WebRTC хук (передаём socket, свой id)
  const { micEnabled, toggleMic } = useWebRTC(socket, currentPlayerId, players);

  useEffect(() => {
    if (!socket) return;
    socket.on('init', (data) => {
      setCurrentPlayerId(data.id);
      setPlayers(data.players);
    });
    socket.on('playerJoined', (p) => setPlayers(prev => ({ ...prev, [p.id]: p })));
    socket.on('playerLeft', (id) => setPlayers(prev => { const copy = {...prev}; delete copy[id]; return copy; }));
    socket.on('playerMoved', (data) => setPlayers(prev => ({ ...prev, [data.id]: { ...prev[data.id], x: data.x, y: data.y, moving: true } })));
    socket.on('playerStopped', (id) => setPlayers(prev => ({ ...prev, [id]: { ...prev[id], moving: false } })));
    socket.on('playerNameUpdate', (data) => setPlayers(prev => ({ ...prev, [data.id]: { ...prev[data.id], name: data.name, emoji: data.emoji, color: data.color } })));
    socket.on('pets_update', (updatedPets) => setPets(updatedPets));
    socket.on('pet_created', (pet) => setPets(prev => ({ ...prev, [pet.id]: pet })));
    socket.on('tv_state', (state) => setTvState(state));
    socket.on('requestNick', () => setNeedNick(true));

    // События для открытия модалок (из Phaser)
    const handleOpenTv = () => setTvModalOpen(true);
    const handleOpenPet = () => setPetModalOpen(true);
    window.addEventListener('openTvModal', handleOpenTv);
    window.addEventListener('openPetModal', handleOpenPet);
    return () => {
      socket.off('init'); socket.off('playerJoined'); socket.off('playerLeft');
      socket.off('playerMoved'); socket.off('playerStopped'); socket.off('playerNameUpdate');
      socket.off('pets_update'); socket.off('pet_created'); socket.off('tv_state');
      socket.off('requestNick');
      window.removeEventListener('openTvModal', handleOpenTv);
      window.removeEventListener('openPetModal', handleOpenPet);
    };
  }, [socket]);

  if (!socket) return <div>Connecting...</div>;

  return (
    <>
      <Game socket={socket} players={players} pets={pets} currentPlayerId={currentPlayerId} onReady={() => setGameReady(true)} />
      <ChatBox socket={socket} currentPlayerId={currentPlayerId} players={players} />
      <Coords players={players} currentPlayerId={currentPlayerId} />
      <MicButton micEnabled={micEnabled} onToggle={toggleMic} />
      <TvOverlay tvState={tvState} />
      
      <NicknameModal isOpen={needNick} socket={socket} onClose={() => setNeedNick(false)} />
      <TvModal isOpen={tvModalOpen} socket={socket} onClose={() => setTvModalOpen(false)} tvState={tvState} />
      <PetModal isOpen={petModalOpen} socket={socket} onClose={() => setPetModalOpen(false)} />
    </>
  );
}

export default App;
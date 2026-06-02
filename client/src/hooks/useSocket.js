import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { useStore } from '../store';

const socket = io('http://localhost:228'); // Или твой IP

export const useSocket = () => {
  const { setMe, setPlayers, updatePlayer, removePlayer, setPets, addPet, addChatMessage, setTvState } = useStore();

  useEffect(() => {
    socket.on('init', (data) => {
      setMe(data.id);
      setPlayers(data.players);
    });

    socket.on('playerJoined', (p) => updatePlayer(p.id, p));
    socket.on('playerLeft', (id) => removePlayer(id));
    socket.on('playerNameUpdate', ({ id, name, emoji }) => updatePlayer(id, { name, emoji }));
    socket.on('playerMoved', ({ id, x, y }) => updatePlayer(id, { x, y }));
    
    socket.on('pet_created', (pet) => addPet(pet));
    socket.on('pets_update', (pets) => setPets(pets));

    socket.on('chatMessage', (msg) => addChatMessage(msg));
    
    socket.on('tv_state', (data) => setTvState(data));
    socket.on('tv_state_update', (data) => setTvState(data));

    return () => socket.off();
  }, []);

  return socket;
};
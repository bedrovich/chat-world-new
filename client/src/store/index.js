import { create } from 'zustand';

export const useStore = create((set, get) => ({
  me: null,
  players: {},
  pets: {},
  chatHistory: [],
  tvState: { currentVideoId: null, isPlaying: false, queue: [] },
  
  setMe: (id) => set({ me: id }),
  setPlayers: (players) => set({ players }),
  updatePlayer: (id, data) => set((state) => ({
    players: { ...state.players, [id]: { ...state.players[id], ...data } }
  })),
  removePlayer: (id) => set((state) => {
    const newPlayers = { ...state.players };
    delete newPlayers[id];
    return { players: newPlayers };
  }),
  setPets: (pets) => set({ pets }),
  addPet: (pet) => set((state) => ({ pets: { ...state.pets, [pet.id]: pet } })),
  addChatMessage: (msg) => set((state) => ({ chatHistory: [...state.chatHistory, msg] })),
  setTvState: (data) => set((state) => ({ tvState: { ...state.tvState, ...data } })),
}));
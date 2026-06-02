import { useStore } from './store';
import GameWorld from './components/GameWorld';
import Chat from './components/Chat';
import NickModal from './components/NickModal';
import TVModal from './components/TVModal';
import { useSocket } from './hooks/useSocket';

function App() {
  useSocket(); // Инициализируем сокеты
  const { me } = useStore();

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative' }}>
      <GameWorld />
      {me && <Chat />}
      <NickModal />
      <TVModal />
    </div>
  );
}

export default App;
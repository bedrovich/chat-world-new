import { useStore } from './store';
import GameWorld from './components/GameWorld';
import { useSocket } from './hooks/useSocket';

function App() {
  useSocket(); // Инициализируем сокеты
  const { me } = useStore();

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative' }}>
      <GameWorld />
    </div>
  );
}

export default App;
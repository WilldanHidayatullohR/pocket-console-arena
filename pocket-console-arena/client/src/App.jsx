import { useState } from 'react';
import { Tv, Gamepad2 } from 'lucide-react';
import HostScreen from './pages/HostScreen';
import ControllerScreen from './pages/ControllerScreen';

export default function App() {
  const params = new URLSearchParams(window.location.search);
  const initialMode = params.get('mode') === 'controller' ? 'controller' : 'host';
  const initialRoom = params.get('room') || '';

  const [mode, setMode] = useState(initialMode);

  if (mode === 'controller') {
    return <ControllerScreen initialRoom={initialRoom} />;
  }

  return (
    <div className="relative">
      <HostScreen />
      <button
        type="button"
        onClick={() => setMode('controller')}
        className="fixed bottom-4 right-4 z-50 inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-slate-800/90 hover:bg-slate-700 border border-slate-600 text-xs font-semibold text-slate-200 shadow-lg backdrop-blur-xs cursor-pointer"
      >
        <Gamepad2 className="w-4 h-4 text-indigo-400" />
        Tes Mode Stik di Layar Ini
      </button>
    </div>
  );
}
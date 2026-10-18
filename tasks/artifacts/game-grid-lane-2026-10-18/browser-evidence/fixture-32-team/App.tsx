import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import GameGrid, { GameGridMode } from 'components/GameGrid/GameGrid';
import 'styles/globals.css';
import { setFixtureState } from './data';
function App() {
  const [mode, setMode] = useState<GameGridMode>('7-Day-Forecast');
  return <main>
    <p>Isolated 32-team fixture (real 2025-03-17 week). No production data is connected.</p>
    {['ready', 'partial', 'postponed', 'empty'].map((s) => <button key={s} onClick={() => setFixtureState(s)}>{s} schedule fixture</button>)}
    <GameGrid mode={mode} setMode={setMode} />
  </main>;
}
document.body.style.cssText = 'margin:0;background:#101115;color:#fff;font-family:Arial,sans-serif';
createRoot(document.getElementById('root')!).render(<App />);

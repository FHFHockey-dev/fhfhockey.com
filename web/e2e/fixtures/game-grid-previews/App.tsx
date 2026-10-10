import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import GameGrid, { GameGridMode } from 'components/GameGrid/GameGrid';
import TeamDetails from 'components/GameGrid/TeamDetails';
import GameGridContext from 'components/GameGrid/contexts/GameGridContext';
import { TEAM_FORECAST_CREDITS, TeamForecastContext, TeamForecastRecord } from 'components/GameGrid/utils/teamForecasts';
import { setFixtureState } from './data';

const context: TeamForecastContext = { seasonId: 20262027, scheduleRevision: 'fixture-schedule', rosterRevision: 'fixture-roster', rosterScope: 'skaters', games: [
  { gameId: 103, startsAt: '2026-10-08T23:00:00Z', state: 'scheduled' },
  { gameId: 106, startsAt: '2026-10-11T23:00:00Z', state: 'scheduled' },
] };
const records: TeamForecastRecord[] = context.games.map((game, index) => ({
  teamId: 1, gameId: game.gameId, seasonId: context.seasonId, category: 'G', mean: index ? 1.24 : 2.44,
  unit: 'count', scope: 'full_game_regulation_overtime', conditioning: 'unconditional', creditDefinition: TEAM_FORECAST_CREDITS.G,
  rosterScope: 'skaters', rosterRevision: context.rosterRevision, scheduleRevision: context.scheduleRevision,
  startsAt: game.startsAt, status: 'qualified', allowedUses: { totals: true, comparison: false }, revisionId: 'fixture-output-' + index,
  modelVersion: 'fixture-model-v1', comparisonLineageId: 'fixture-run', sourceWatermark: 'fixture-source',
  sourceAvailableAt: '2026-10-07T13:00:00Z', cutoffAt: '2026-10-07T14:00:00Z', issuedAt: '2026-10-07T14:30:00Z',
  availableAt: '2026-10-07T14:31:00Z', expiresAt: '2026-10-07T22:00:00Z',
}));
const zeroAssists = records.map((record) => ({ ...record, category: 'A' as const, mean: 0, creditDefinition: TEAM_FORECAST_CREDITS.A }));
const schedule = { THU: { id: 103, season: 20262027, gameType: 2, gameDate: '2026-10-08', gameState: 'FUT', startTimeUTC: context.games[0].startsAt, homeTeam: { id: 1 }, awayTeam: { id: 2 } },
  SUN: { id: 106, season: 20262027, gameType: 2, gameDate: '2026-10-11', gameState: 'PRE', startTimeUTC: context.games[1].startsAt, homeTeam: { id: 1 }, awayTeam: { id: 2 } } };
const dates = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11'];
function App() {
  const [mode, setMode] = useState<GameGridMode>('7-Day-Forecast');
  const [previewState, setPreviewState] = useState('qualified');
  const details = new URLSearchParams(location.search).has('details');
  return <main>
    <p>Isolated synthetic fixtures. The real public-reader consumer uses isolated local HTTP fixtures. No production data is connected.</p>
    {details ? <>
      <h1>Game Grid preview fixture</h1><h2>Upcoming team forecasts</h2>
      <label>Preview fixture <select value={previewState} onChange={(event) => setPreviewState(event.target.value)}>
        {['qualified', 'partial', 'missing', 'bye', 'unknown', 'stale', 'started', 'mixed'].map((state) => <option key={state}>{state}</option>)}
      </select></label>
      <GameGridContext><TeamDetails teamId={1} startDate={dates[0]} asOf="2026-10-07T16:00:00Z"
        schedule={['bye', 'unknown'].includes(previewState) ? {} : previewState === 'started' ? { ...schedule, THU: { ...schedule.THU, gameState: 'LIVE' } } : schedule}
        scheduleCoverage={previewState === 'unknown' ? undefined : { known: 7, expected: 7 }} coveredDates={dates}
        forecastContext={context} forecastRecords={previewState === 'missing' ? undefined : [
          ...(previewState === 'mixed' ? records.map((record, index) => index ? { ...record, cutoffAt: '2026-10-07T13:30:00Z', modelVersion: 'different-model', comparisonLineageId: 'different-run', sourceWatermark: 'different-source' } : record) : previewState === 'partial' ? records.slice(0, 1) : previewState === 'stale' ? records.map((record) => ({ ...record, expiresAt: '2026-10-07T16:00:00Z' })) : records), ...zeroAssists]} />
      </GameGridContext>
    </> : <>
      <button onClick={() => setFixtureState('refreshed')}>Refresh schedule fixture</button>
      <button onClick={() => setFixtureState('partial')}>Partial schedule fixture</button>
      <button onClick={() => setFixtureState('empty')}>Empty schedule fixture</button>
      <GameGrid mode={mode} setMode={setMode} />
    </>}
  </main>;
}
document.body.style.cssText = 'margin:0;background:#101115;color:#fff;font-family:Arial,sans-serif';
createRoot(document.getElementById('root')!).render(<App />);

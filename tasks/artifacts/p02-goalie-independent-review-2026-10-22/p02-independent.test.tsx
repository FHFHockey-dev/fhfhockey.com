import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { PlayerContextualStats } from './PlayerContextualStats';
import { PlayerSummaryStrip } from './PlayerSummaryStrip';
import { PlayerStatsSummary } from './PlayerStatsSummary';
import { aggregateSummaryStat, summarizeQualityStarts } from './playerStatsContract';
import type { GameLogEntry } from './types';

vi.mock('hooks/useMissedGames', () => ({ useMissedGames: () => ({ missedGames: null }) }));
afterEach(cleanup);

// Exactly the goalie per-game columns selected by the current profile page;
// quality_start and time_on_ice deliberately remain absent, like that caller.
const row = (extra: Record<string, unknown> = {}) => ({
  date: '2026-10-20', games_played: 1, games_started: 1, wins: 0, losses: 1,
  ot_losses: 0, save_pct: 0.9, goals_against_avg: 3, shutouts: 0,
  saves: 27, shots_against: 30, goals_against: 3, ...extra
});
const rawLog = (rows: ReturnType<typeof row>[]) => rows as GameLogEntry[];
const contextual = (gameLog: ReturnType<typeof row>[], playoffGameLog: ReturnType<typeof row>[] = []) => (
  <PlayerContextualStats player={{ id: 999001, fullName: 'Synthetic Goalie', position: 'G' }}
    gameLog={gameLog} playoffGameLog={playoffGameLog} seasonTotals={[]} isGoalie
    missedGames={null} asOfDate='2026-10-22' />
);
const contextualCard = (name: string) => within(screen.getByText(name).parentElement!);
const headline = (name: string) => screen.getByText(name).closest('article')!.querySelector('strong')!.textContent;

describe('P02 independent production-consumer controls', () => {
  it('withholds the overview headline as well as context when a query row has unknown participation', () => {
    const log = [row(), row({ date: '2026-10-21', games_played: null, saves: null, shots_against: 10 })];
    render(<><PlayerSummaryStrip gameLog={rawLog(log)} isGoalie windowLabel='Selected games' />{contextual(log)}</>);
    expect(contextualCard('Save Percentage').getByText('-')).toBeTruthy();
    expect(headline('SV%')).toBe('-');
  });
  it('withholds the Trends summary for the same unknown-participation query row', () => {
    const log = [row(), row({ date: '2026-10-21', games_played: null, saves: null, shots_against: 10 })];
    render(<PlayerStatsSummary gameLog={rawLog(log)} selectedStats={['save_pct']} isGoalie />);
    expect(within(screen.getByText('SV%').parentElement!).getByText('-')).toBeTruthy();
  });
  it('preserves unavailable GAA and QS for the actual selected profile column shape', () => {
    const log=[row()];
    render(<><PlayerSummaryStrip gameLog={rawLog(log)} isGoalie windowLabel='Selected games' />{contextual(log)}</>);
    expect(headline('GAA')).toBe('-');
    expect(contextualCard('Quality Start Rate').getByText('-')).toBeTruthy();
    expect(contextualCard('Quality Start Rate').getByText('0 of 1 starts classified')).toBeTruthy();
  });
  it('pairs known appearance counts and excludes only a known nonappearance consistently', () => {
    const log=[row(),row({date:'2026-10-21',games_started:0,saves:10,shots_against:10}),
      row({date:'2026-10-19',games_played:0,games_started:0,saves:null,shots_against:null})];
    render(<><PlayerSummaryStrip gameLog={rawLog(log)} isGoalie windowLabel='Selected games' />{contextual(log)}</>);
    expect(headline('SV%')).toBe('0.925');
    expect(contextualCard('Save Percentage').getByText('0.925')).toBeTruthy();
  });
  it('retains true zero SV with paired positive-shot exposure in the production consumers', () => {
    const log=[row({saves:0,shots_against:10})];
    render(<><PlayerSummaryStrip gameLog={rawLog(log)} isGoalie windowLabel='Selected games' />{contextual(log)}</>);
    expect(headline('SV%')).toBe('0.000');
    expect(contextualCard('Save Percentage').getByText('0.000')).toBeTruthy();
  });
  it('uses relief exposure for GAA and withholds an incomplete pair regardless of row order', () => {
    const log=[row({goals_against:3,time_on_ice:3600}),row({goals_against:1,time_on_ice:600,games_started:0})];
    expect(aggregateSummaryStat(log,'goals_against_avg')).toBeCloseTo(24/7);
    expect(aggregateSummaryStat([...log].reverse(),'goals_against_avg')).toBeCloseTo(24/7);
    expect(aggregateSummaryStat([log[0],row({goals_against:null,time_on_ice:600})],'goals_against_avg')).toBeNull();
  });
  it('retains incomplete start-classification coverage and excludes relief from the QS denominator', () => {
    expect(summarizeQualityStarts([row({quality_start:1}),row({quality_start:0}),row({games_started:0,quality_start:null})]))
      .toEqual({starts:2,classifiedStarts:2,unknownStarts:0,rate:0.5});
    expect(summarizeQualityStarts([row({quality_start:1}),row({quality_start:null}),row({games_started:0})]))
      .toEqual({starts:2,classifiedStarts:1,unknownStarts:0,rate:null});
  });
  it('withholds a playoff SV ratio when the played row lacks its paired saves count', () => {
    render(contextual([], [row({saves:null,shots_against:10})]));
    expect(contextualCard('Playoff Performance').getByText('Playoff save percentage unavailable')).toBeTruthy();
  });
});

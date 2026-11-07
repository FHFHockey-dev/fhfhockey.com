import React from 'react';
import {createRoot} from 'react-dom/client';
import CurrentPlayerCardStudio from '../../../../../web/components/player-cards/CurrentPlayerCardStudio';
import {buildCurrentNhlCard} from '../../../../../web/lib/player-cards/currentNhl';
import identity from './landing.json';
import history from './game-log.json';
import schedule from './team-schedule.json';
import receipt from './RECEIPT.json';
const input={identity,history,schedule,observedAt:receipt.finishedAt,source:'nhl-retained' as const};
const initial=buildCurrentNhlCard({playerId:8476453,season:20262027,count:10},input);
Object.assign(globalThis,{__currentCard:initial,__currentInput:input,__buildCurrentCard:buildCurrentNhlCard});
globalThis.fetch=async()=>{throw new Error('Retained official snapshot preview forbids every network call');};
createRoot(document.getElementById('root')!).render(<CurrentPlayerCardStudio initialCard={initial} load={async request=>{
 if(request.playerId!==8476453||request.season!==20262027)throw new Error('Only the approved Kucherov2026–27 capture is available. No other source was requested.');
 return buildCurrentNhlCard(request,input);
}}/>);

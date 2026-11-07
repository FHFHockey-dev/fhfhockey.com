import React from 'react';
import {createRoot} from 'react-dom/client';
import CurrentPlayerCardStudio from '../../../../web/components/player-cards/CurrentPlayerCardStudio';
import {buildCurrentNhlCard} from '../../../../web/lib/player-cards/currentNhl';
import input from './synthetic-contract-fixture.json';
const fixture={...input,source:'contract-fixture' as const};
const request={playerId:8476453,season:20262027,count:5 as const};
const initial=buildCurrentNhlCard(request,fixture);
globalThis.fetch=async()=>{throw new Error('Offline contract preview forbids all network requests');};
createRoot(document.getElementById('root')!).render(<CurrentPlayerCardStudio initialCard={initial} load={async request=>{
 const copy=structuredClone(fixture);copy.identity.playerId=request.playerId;
 if(request.playerId!==8476453)copy.history.gameLog.pop();
 return buildCurrentNhlCard(request,copy);
}}/>);

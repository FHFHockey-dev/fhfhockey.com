import React from 'react';
import {createRoot} from 'react-dom/client';
import CurrentPlayerCardStudio from '../../../../web/components/player-cards/CurrentPlayerCardStudio';
import {loadCurrentNhlCard} from '../../../../web/lib/player-cards/currentNhl.server';
import {parseCurrentNhlRequest} from '../../../../web/lib/player-cards/currentNhl';
import identity from '../../player-cards-2026-10-26/current-data-01/approved-snapshot-02/landing.json';
import history from '../../player-cards-2026-10-26/current-data-01/approved-snapshot-02/game-log.json';
import schedule from '../../player-cards-2026-10-26/current-data-01/approved-snapshot-02/team-schedule.json';
import receipt from '../../player-cards-2026-10-26/current-data-01/approved-snapshot-02/RECEIPT.json';
const apiCalls:string[]=[],providerPaths:string[]=[];
Object.assign(globalThis,{__cardApiCalls:apiCalls,__cardProviderPaths:providerPaths});
globalThis.fetch=async input=>{
 const url=new URL(String(input),'http://127.0.0.1:3125');
 if(url.origin!=='http://127.0.0.1:3125'||url.pathname!=='/api/v1/player-cards')throw new Error('Offline card flow permits only its intercepted local card endpoint');
 apiCalls.push(url.search);
 try{const request=parseCurrentNhlRequest(Object.fromEntries(url.searchParams));
 const card=await loadCurrentNhlCard(request,async path=>{providerPaths.push(path);if(path.endsWith('/landing'))return identity;if(path.includes('/game-log/'))return history;if(path==='/club-schedule-season/TBL/20262027')return schedule;throw new Error('Uncaptured source path');},()=>new Date(receipt.finishedAt),'nhl-retained');
 return new Response(JSON.stringify(card),{headers:{'Content-Type':'application/json'}});
 }catch{return new Response(JSON.stringify({error:'Uncaptured or unverified player'}),{status:502});}
};
createRoot(document.getElementById('root')!).render(<CurrentPlayerCardStudio/>);

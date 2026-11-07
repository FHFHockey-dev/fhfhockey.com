import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import ResearchPlayerCardStudio from '../../../../web/components/player-cards/ResearchPlayerCardStudio';
import PlayerCardShareStudio from '../../../../web/components/player-cards/PlayerCardShareStudio';
import CurrentPlayerCardStudio from '../../../../web/components/player-cards/CurrentPlayerCardStudio';
import {buildCurrentNhlCard} from '../../../../web/lib/player-cards/currentNhl';
import {RESEARCH_MANIFEST_SHA256} from '../../../../web/lib/player-cards/researchExamples';
import fixtureTexts from './offline-fixtures.json';
import assets from '../../player-cards-2026-10-26/outline-editor-09/local-assets.json';
import identity from '../../player-cards-2026-10-26/current-data-01/approved-snapshot-02/landing.json';
import history from '../../player-cards-2026-10-26/current-data-01/approved-snapshot-02/game-log.json';
import schedule from '../../player-cards-2026-10-26/current-data-01/approved-snapshot-02/team-schedule.json';
import receipt from '../../player-cards-2026-10-26/current-data-01/approved-snapshot-02/RECEIPT.json';
const input={identity,history,schedule,observedAt:receipt.finishedAt,source:'nhl-retained' as const};
const current=buildCurrentNhlCard({playerId:8476453,season:20262027,count:10},input);
globalThis.fetch=async input=>{const key=String(input) as keyof typeof assets;if(!(key in assets))throw new Error('Offline research preview forbids every network request');return new Response(Uint8Array.from(atob(assets[key]),c=>c.charCodeAt(0)),{headers:{'Content-Type':'image/png'}});};
function App(){const[mode,setMode]=useState('research');return <><label style={{display:'block',padding:'16px',color:'#f2f1eb',fontFamily:'Arial'}}>Card source <select aria-label="Card source" value={mode} onChange={e=>setMode(e.target.value)}><option value="research">Historical research examples · offline</option><option value="nhl">Captured NHL results</option><option value="artwork">Illustrative artwork study</option></select></label>{mode==='research'?<ResearchPlayerCardStudio load={async example=>({fixtureText:fixtureTexts[example.file],manifestSha256:RESEARCH_MANIFEST_SHA256})}/>:mode==='nhl'?<CurrentPlayerCardStudio initialCard={current} load={async request=>{if(request.playerId!==8476453||request.season!==20262027)throw new Error('Uncaptured player');return buildCurrentNhlCard(request,input);}}/>:<PlayerCardShareStudio/>}</>;}
createRoot(document.getElementById('root')!).render(<App/>);

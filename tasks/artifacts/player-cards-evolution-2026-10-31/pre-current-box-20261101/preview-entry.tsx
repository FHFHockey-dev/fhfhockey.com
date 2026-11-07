import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import PlayerAnalysisStudio from '../../../web/components/player-cards/PlayerAnalysisStudio';
import CurrentPlayerCardStudio from '../../../web/components/player-cards/CurrentPlayerCardStudio';
import PlayerArtworkControls from '../../../web/components/player-cards/PlayerArtworkControls';
import {usePlayerArtwork} from '../../../web/components/player-cards/usePlayerArtwork';
import {reviewedHeroFor} from '../../../web/lib/player-cards/currentArtwork';
import {captureFixture,goalieFixture,sharedGoalieFixture} from '../../../web/lib/player-cards/analysisFixtures';
import {buildCurrentNhlCard} from '../../../web/lib/player-cards/currentNhl';
import {analysisCaptureFromNhl} from '../../../web/lib/player-cards/analysisSnapshot';
import sources from './offline-inputs.json';
import retainedBlsh from './retained-blsh-provenance-input.json';
import type {RetainedBlshInput} from '../../../web/lib/player-cards/retainedBlsh';
const apiCalls:string[]=[];Object.assign(globalThis,{__offlineCalls:apiCalls});
globalThis.fetch=async(input)=>{const path=String(input);apiCalls.push(path);const asset=sources.assets[path];if(!asset)throw new Error('No provider or API request is allowed in this preview');return new Response(Uint8Array.from(atob(asset.base64),c=>c.charCodeAt(0)),{headers:{'Content-Type':asset.type}});};
const cards=([5,10,20]as const).map(count=>buildCurrentNhlCard({playerId:8476453,season:20262027,count},{identity:sources.identity,history:sources.history,schedule:sources.schedule,observedAt:sources.observedAt,source:'nhl-retained'}));
const retained={...cards[0],windows:cards};
function App(){
 const [baseline,setBaseline]=useState(false),[art,setArt]=useState(false);
 const sample=reviewedHeroFor(retained.player),artwork=usePlayerArtwork(sample),f=captureFixture(),g=goalieFixture();
 const gapFixture=sharedGoalieFixture();gapFixture.goalies[0].games[0].confirmation={state:"projected",source:"validated_events",observedAt:"2026-10-31T11:00:00Z",sourceUrl:null,expiresAt:null};gapFixture.sources[0].reasons=["Reports aren't separated by reporter, so conflicts between sources can't be detected.","No source link or expiry exists for these reports."];
 const selections=[{id:'retained',label:'Nikita Kucherov · retained NHL · 2026–27',capture:analysisCaptureFromNhl(retained),hero:art?artwork.readyHero:null,retainedBlsh:retainedBlsh as RetainedBlshInput},{id:'fixture',label:'Synthetic skater · TBL · 2026–27',capture:f},{id:'short',label:'Synthetic short season · 3 GP',capture:captureFixture(3)},{id:'goalie',label:'Synthetic goalie outlook · TBL',goalie:g.player,inventory:g},{id:'shared-goalie',label:'Synthetic shared goalie inventory · TBL',goalie:g.player,inventory:null,sharedFixture:sharedGoalieFixture()},{id:'shared-goalie-gaps',label:'Synthetic goalie source gaps · TBL',goalie:g.player,inventory:null,sharedFixture:gapFixture},{id:'missing-goalie',label:'Goalie source unavailable · TBL',goalie:{...g.player,id:8473575,name:'Unqualified goalie'},inventory:null}];
 return <><div style={{padding:16,color:'white',fontFamily:'Arial'}}><button onClick={()=>setBaseline(!baseline)}>{baseline?'Open new analysis':'Open preserved four-format editor'}</button><label style={{padding:12}}><input type="checkbox" checked={art} onChange={e=>setArt(e.target.checked)}/> Show approved retained artwork</label><p>Offline review only. Retained NHL observation is 2026-10-29. All other data are synthetic. No provider route exists.</p>{art&&<PlayerArtworkControls artwork={artwork} team="TBL" busy={false} onChange={()=>{}}/>}</div>{baseline?<CurrentPlayerCardStudio initialCard={retained} load={async()=>retained}/>:<PlayerAnalysisStudio selections={selections}/>}</>;
}
createRoot(document.getElementById('root')!).render(<App/>);

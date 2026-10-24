import { createRoot } from 'react-dom/client';
import { useAuth } from '../snapshot/web/contexts/AuthProviderContext';
import AuthProvider from '../snapshot/web/contexts/AuthProviderContext';
import Gate from '../snapshot/web/components/SocialShare/SocialShareAccessGate';
import SocialShare from '../snapshot/web/components/SocialShare/SocialShare';
import { buildScheduleSnapshot, weekDates } from 'lib/socialShare/schedule';
import { fixture } from './auth';
import { fetchEdition } from 'lib/socialShare/editionFetch';
const asOf='2026-10-26T12:00:00.000Z';
(window as any).fixture={...fixture,fetchEdition,makeSnapshot(url:string){const input=new URL(url);const weekStart=input.searchParams.get('weekStart')??'2026-10-26';const dates=weekDates(weekStart);return buildScheduleSnapshot({format:'game-grid',weekStart,generatedAt:asOf,schedule:{data:{},games:[{id:2026020001,season:20262027,gameType:2,gameDate:dates[0],startTimeUTC:dates[0]+'T23:00:00Z',gameState:'FUT',gameScheduleState:'OK',homeTeam:{id:1,abbrev:'NJD'},awayTeam:{id:10,abbrev:'TOR'}}],fetchedAt:asOf,coveredDates:dates,numGamesPerDay:dates.map((_,i)=>i===0?1:0)}});}};
function App(){const auth=useAuth();return <><output id="fixture-auth">{auth.user?.id??'none'}:{auth.user?.role??'none'}</output><button id="fixture-signout" onClick={()=>void auth.signOut()}>Fixture sign out</button><Gate><SocialShare format="game-grid" asOf={asOf}/></Gate></>;}
createRoot(document.getElementById('root')!).render(<AuthProvider><App/></AuthProvider>);

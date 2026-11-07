import React from 'react';
import {createRoot} from 'react-dom/client';
import CurrentPlayerCardStudio from '../../../../web/components/player-cards/CurrentPlayerCardStudio';
const apiCalls:string[]=[],providerPaths:string[]=[];
Object.assign(globalThis,{__cardApiCalls:apiCalls,__cardProviderPaths:providerPaths});
const nativeFetch=globalThis.fetch.bind(globalThis);
globalThis.fetch=async(input,init)=>{const url=new URL(String(input),location.href);if(url.origin!==location.origin||url.pathname!=='/api/v1/player-cards')throw new Error('Local verification permits only the loopback card endpoint');apiCalls.push(url.search);const response=await nativeFetch(input,init);const paths=response.headers.get('X-FHFH-Fixture-Provider-Paths');if(paths)providerPaths.push(...JSON.parse(paths));return response;};
createRoot(document.getElementById('root')!).render(<><p style={{color:'#80dfff',padding:'16px',fontFamily:'Arial'}}>Local verification · retained official Kucherov capture, 2026-10-27 00:42 UTC. No new upstream requests. The application route supports IDs; this isolated fixture endpoint has only the approved player.</p><CurrentPlayerCardStudio/></>);

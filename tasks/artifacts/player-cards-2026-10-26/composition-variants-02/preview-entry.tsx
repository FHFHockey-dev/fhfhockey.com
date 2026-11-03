import React from 'react';
import {createRoot} from 'react-dom/client';
import PlayerCardShareStudio from '../../../../web/components/player-cards/PlayerCardShareStudio';
import assets from './local-assets.json';
globalThis.fetch = async (input) => {
 const key=String(input) as keyof typeof assets;
 if (!(key in assets)) throw new Error('Offline preview permits only its four pinned local artwork files');
 return new Response(Uint8Array.from(atob(assets[key]), c=>c.charCodeAt(0)), {headers:{'Content-Type':'image/png'}});
};
createRoot(document.getElementById('root')!).render(<PlayerCardShareStudio />);

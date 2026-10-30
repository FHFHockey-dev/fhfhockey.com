import React from 'react';
import { it, expect, afterEach, vi } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent, act } from '@testing-library/react';
import Studio from '../../../../web/components/player-cards/PlayerCardShareStudio';
import HeroCard, { type PreparedHero } from '../../../../web/components/player-cards/HeroPlayerCard';
import { REVIEWED_HERO_SAMPLES as samples } from '../../../../web/lib/player-cards/reviewedHeroSamples';
import { PORTRAIT_STYLES, type PortraitStyle, portraitPixels, MAX_PORTRAIT_PIXELS } from '../../../../web/lib/player-cards/portraitTreatment';
import { assertCardExport } from '../../../../web/lib/player-cards/shareExport';
import { adaptLocalSnapshot } from '../../../../web/lib/player-cards/adapter';
import { buildInteractionFixture } from '../../../../web/lib/player-cards/interactionFixtures';
import { displaySnapshot, flowSettings, INITIAL_FLOW } from '../../../../web/lib/player-cards/interactionSnapshot';
const store='fhfh-player-card-portrait-v1';
const load=async (s:typeof samples[number])=>({...s,dataUrl:'data:image/png;base64,AA=='});
const treat=async(h:PreparedHero,s:PortraitStyle):Promise<PreparedHero>=>({...h,dataUrl:`data:image/png;base64,${s}`,treatment:{style:s,version:'fhfh-portrait-v1',sourceAlphaSha256:h.alphaSha256,renderedSha256:'b'.repeat(64),width:h.sourceWidth,height:h.sourceHeight}});
const ready=()=>waitFor(()=>expect((screen.getByRole('button',{name:'Download PNG'}) as HTMLButtonElement).disabled).toBe(false));
afterEach(()=>{cleanup();vi.restoreAllMocks();localStorage.clear();});
it.each([...PORTRAIT_STYLES, 'fresh','invalid','unavailable'])('honors saved %s or correct default',async saved=>{
 if(PORTRAIT_STYLES.includes(saved as PortraitStyle)||saved==='invalid')localStorage.setItem(store,saved);
 if(saved==='unavailable')vi.spyOn(Storage.prototype,'getItem').mockImplementation(()=>{throw Error('blocked');});
 const view=render(<Studio loadArtwork={load} treatArtwork={treat}/>);await ready();
 const expected=PORTRAIT_STYLES.includes(saved as PortraitStyle)?saved:'team-colors';
 expect((screen.getByLabelText('Portrait style') as HTMLSelectElement).value).toBe(expected);
 expect(view.container.querySelector('image')?.getAttribute('href')).toBe(`data:image/png;base64,${expected}`);
});
it('ignores a delayed treatment for the previous player, including late rejection',async()=>{
 const pending:{h:PreparedHero;s:PortraitStyle;resolve:(h:PreparedHero)=>void;reject:(e:Error)=>void}[]=[];
 const delayed=(h:PreparedHero,s:PortraitStyle)=>new Promise<PreparedHero>((resolve,reject)=>pending.push({h,s,resolve,reject}));
 const view=render(<Studio loadArtwork={load} treatArtwork={delayed}/>);
 await waitFor(()=>expect(pending.length).toBe(1));
 fireEvent.change(screen.getByLabelText('Reviewed artwork'),{target:{value:samples[1].id}});
 await waitFor(()=>expect(pending.length).toBe(2));
 await act(async()=>pending[1].resolve(await treat(pending[1].h,pending[1].s)));await ready();
 await act(async()=>pending[0].reject(Error('obsolete failure')));
 expect(screen.queryByRole('alert')).toBeNull();expect(view.container.querySelector('svg')?.textContent).toContain('KAPRIZOV');
});
it('preserves missing and known-undefined labels, blocks unknown GP, rejects stale treatment exports',async()=>{
 const h=await treat(await load(samples[1]),'team-colors');
 const adapted=adaptLocalSnapshot(buildInteractionFixture(flowSettings(INITIAL_FLOW),'complete',1001),1001);if(adapted.state==='rejected')throw Error(adapted.reason);
 const s={...displaySnapshot(adapted),player:{id:String(h.id),name:h.name,team:h.team,position:h.position}};
 s.readings=s.readings.map(r=>r.id==='ixg60'?{...r,value:null,state:'missing' as const,rank:null,reason:'Required component is missing'}:r.id==='ipp'?{...r,value:null,state:'undefined' as const,rank:null,reason:'Zero denominator: metric undefined'}:r);
 const view=render(<HeroCard snapshot={s} hero={h} format='landscape'/>);const svg=view.container.querySelector('svg')!;
 expect(view.container.querySelector('[data-metric-id="ixg60"]')?.textContent).toContain('Missing source');expect(svg.textContent).toContain('zero denominator');
 expect(()=>assertCardExport(svg,s,h,'landscape')).not.toThrow();
 expect(()=>assertCardExport(svg,{...s,sample:{...s.sample,gp:null}},h,'landscape')).toThrow('sample context');
 expect(()=>assertCardExport(svg,s,{...h,treatment:{...h.treatment!,style:'posterized'}},'landscape')).toThrow('changed');
});
it('transforms all 256 alpha values deterministically, without aliasing input, and bounds work',()=>{
 const input=new Uint8ClampedArray(256*4);for(let i=0;i<256;i++)input.set([i,255-i,(i*43)%256,i],i*4);const before=input.slice();
 for(const s of PORTRAIT_STYLES){const out=portraitPixels(input,16,16,s,{primaryColor:'#154734',secondaryColor:'#DDCBA4'});expect(out.length).toBe(input.length);expect(out).toEqual(portraitPixels(input,16,16,s,{primaryColor:'#154734',secondaryColor:'#DDCBA4'}));for(let i=0;i<256;i++)expect(out[i*4+3]).toBe(i);expect(out).not.toBe(input);}
 expect(input).toEqual(before);expect(()=>portraitPixels(input,MAX_PORTRAIT_PIXELS+1,1,'team-colors',{primaryColor:'#154734',secondaryColor:'#DDCBA4'})).toThrow('dimensions');
});

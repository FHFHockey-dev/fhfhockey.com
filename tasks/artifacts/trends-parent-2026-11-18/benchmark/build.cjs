const {execFileSync} = require('node:child_process');
const fs = require('node:fs');
const {createHash} = require('node:crypto');
const path = require('node:path');
const {createRequire} = require('node:module');
const root = path.resolve(__dirname, '../../../..');
const web = path.join(root,'web');
const webRequire = createRequire(path.join(web,'package.json'));
const esbuild = webRequire('esbuild');
const sass = webRequire('sass');
const base = '789713fb5bc12a2bb1c62ab6bea676d4c30cf6a6';

async function build(mode, tmp) {
  const sources = {};
  const hash = text=>createHash('sha256').update(text).digest('hex');
  const source = file=>{
    const relative=path.relative(root,file);
    const content=mode==='before' ? execFileSync('git',['show',base+':'+relative],{cwd:root,encoding:'utf8'}) : fs.readFileSync(file,'utf8');
    sources[relative]=hash(content);
    return content;
  };
  const sourcePlugin = {name:'project-source', setup(ctx){
    ctx.onLoad({filter:/\.[jt]sx?$/}, args=>{
      if (!args.path.startsWith(web + '/') || args.path.includes('/node_modules/')) return;
      return {contents:source(args.path), loader:path.extname(args.path).slice(1), resolveDir:path.dirname(args.path)};
    });
  }};
  const options = {absWorkingDir:web,bundle:true,jsx:'automatic',tsconfig:path.join(web,'tsconfig.json'),
    define:{'process.env.NODE_ENV':'"production"'}, logLevel:'silent'};
  // Retain the actual homepage, ClientOnly, component, sparkline, status and styles.
  // Only replace unrelated data sources, home sections and Next navigation/framework wrappers.
  const isolateHome = {name:'isolate-home',setup(ctx){
    ctx.onResolve({filter:/^(next\/(link|image|head)|next-seo|moment|components\/(Layout\/Container|HomePage\/.*|NewsFeed\/.*|TeamStandingsChart\/.*)|lib\/(NHL\/.*|newsFeed|homepage.*|cors-fetch|supabase\/server|sources\/injuryStatusIngestion|draft-ranker\/api))$/},
      args=>({path:args.path,namespace:'home-fixture'}));
    ctx.onLoad({filter:/.*/,namespace:'home-fixture'},args=>{
      const stubs = {
        'next/link': "import React from 'react'; export default function Link({children, href, ...p}) {return <a href={href} {...p}>{children}</a>}",
        'components/Layout/Container': "export default function Container({children}) {return <main>{children}</main>}",
        'components/HomePage/useHomepageGames':"export const useHomepageGames=()=>({games:[]})",
        'next-seo':"export const NextSeo=()=>null",
      };
      return {contents:stubs[args.path] || 'module.exports = () => null', loader:'jsx',resolveDir:web};
    });
    ctx.onLoad({filter:/\.scss$/}, args=>({contents:sass.compileString(source(args.path),{
      loadPaths:[web],logger:sass.Logger.silent}).css,loader:'local-css'}));
  }};
  await esbuild.build({...options,plugins:[isolateHome,sourcePlugin],platform:'browser',minify:true,
    stdin:{contents:`import {createRoot} from 'react-dom/client';import Home from './pages/index';
      const offseason = new URLSearchParams(location.search).has('offseason');
      createRoot(document.getElementById('root')).render(<Home initialGames={[]} latestNews={[]} isOffseason={offseason} draftRankerHomepageEnabled={offseason} />)`,
      loader:'tsx',resolveDir:web},outfile:path.join(tmp,'home.js')});
  await esbuild.build({...options,plugins:[sourcePlugin],platform:'node',format:'cjs',
    entryPoints:[path.join(web,'pages/api/v1/transactions/ownership-trends.ts')],outfile:path.join(tmp,'handler.cjs'),
    external:['@supabase/supabase-js']});
  if (mode==='after') {
    const migrations = path.join(root,'supabase/migrations');
    const f = fs.readdirSync(migrations).find(f=>f.endsWith('_homepage_yahoo_ownership_page.sql'));
    if(f) source(path.join(migrations,f));
  }
  return sources;
}
module.exports = {build,web,webRequire,base};

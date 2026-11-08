const fs=require('node:fs'),assert=require('node:assert/strict'),{createRequire}=require('node:module');
const req=createRequire('/Users/tim/Code/fhfhockey.com/web/package.json'),sharp=req('sharp');
(async()=>{const results=[];for(const name of ['normal','long-token']){
 const svg=fs.readFileSync(__dirname+'/'+name+'.svg','utf8'),wide=svg.replace('width="1200" height="1020" viewBox="0 0 1200 1020"','width="4000" height="1020" viewBox="0 0 4000 1020"');assert.notEqual(svg,wide);
 await sharp(Buffer.from(svg)).png().toFile(__dirname+'/'+name+'-raster.png');
 await sharp(Buffer.from(wide)).png().toFile(__dirname+'/'+name+'-wide-raster.png');
 const {data,info}=await sharp(Buffer.from(wide)).extract({left:1200,top:870,width:2800,height:70}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 let visiblePixelsBeyondCard=0,rightmost=null;for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]){visiblePixelsBeyondCard++;rightmost=Math.max(rightmost||0,1200+x)}
 results.push({name,visiblePixelsBeyondCard,rightmost,normalRasterDimensions:[1200,1020]});
}assert.equal(results[0].visiblePixelsBeyondCard,0);assert(results[1].visiblePixelsBeyondCard>0);
fs.writeFileSync(__dirname+'/raster-probe.json',JSON.stringify({renderer:'sharp/libvips SVG renderer; independent Chromium launch was blocked before navigation',results},null,2)+'\n');console.log(JSON.stringify(results))})().catch(e=>{console.error(e);process.exitCode=1});

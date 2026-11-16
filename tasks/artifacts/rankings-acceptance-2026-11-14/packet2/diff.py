import json,sys
VOL={'generatedAt','updatedAt'}
def walk(a,b,path,out):
    if isinstance(a,dict) and isinstance(b,dict):
        for k in sorted(set(a)|set(b)):
            if k in VOL: continue
            if k not in a: out.append((path+'.'+k,'<absent>',str(b[k])[:80])); continue
            if k not in b: out.append((path+'.'+k,str(a[k])[:80],'<absent>')); continue
            walk(a[k],b[k],path+'.'+k,out)
    elif isinstance(a,list) and isinstance(b,list):
        if len(a)!=len(b): out.append((path,'len %d'%len(a),'len %d'%len(b)))
        for i,(x,y) in enumerate(zip(a,b)): walk(x,y,'%s[%d]'%(path,i),out)
    elif a!=b: out.append((path,str(a)[:80],str(b)[:80]))
a=json.load(open(sys.argv[1])); b=json.load(open(sys.argv[2]))
if len(sys.argv)>3: a=eval('a'+sys.argv[3]); b=eval('b'+sys.argv[4])
out=[]; walk(a,b,'',out)
import collections
c=collections.Counter(p.split('[')[0] if '[' in p else p for p,_,_ in out)
print('diffs',len(out))
gen=collections.Counter('.'.join(x for x in p.replace(']','').split('[')[0].split('.')) for p,_,_ in out)
keys=collections.Counter(__import__('re').sub(r'\[\d+\]','[]',p) for p,_,_ in out)
for k,n in keys.most_common(25): print(n,k)
for o in out[:12]: print(o)

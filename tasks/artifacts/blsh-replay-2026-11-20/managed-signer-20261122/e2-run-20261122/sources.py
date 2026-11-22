import json, os, sys, urllib.request
tok=json.load(open(os.path.expanduser("~/Library/Application Support/com.vercel.cli/auth.json")))["token"]
T="team_KVFicHhQJARTbO6wRD2x6jpq"
def get(u): return json.load(urllib.request.urlopen(urllib.request.Request(u,headers={"Authorization":"Bearer "+tok}),timeout=20))
projs=get(f"https://api.vercel.com/v9/projects?teamId={T}&limit=50")["projects"]
print("project\tkey\ttarget\ttype\tconfigurationId")
for p in sorted(projs,key=lambda p:p["name"]):
    for e in sorted(get(f"https://api.vercel.com/v10/projects/{p['id']}/env?teamId={T}")["envs"],key=lambda e:e["key"]):
        cid=e.get("configurationId") or "-"
        if cid!="-" or e["key"].startswith(("POSTGRES","SUPABASE","NEXT_PUBLIC_SUPABASE")):
            print(f'{p["name"]}\t{e["key"]}\t{",".join(e.get("target") or [])}\t{e.get("type")}\t{cid}')

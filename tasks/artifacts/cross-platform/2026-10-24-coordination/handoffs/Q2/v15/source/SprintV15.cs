#if UNITY_EDITOR
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;

namespace VesperBasin.Editor
{
    /// <summary>
    /// v15 Distinct Compounds: opens the saved v14 scene and gives the four repeated octagonal blocks their own identity
    /// (NE cooling towers, NW lattice comms mast + dishes, SE jib crane + container stacks, SW sawtooth loading roof) plus
    /// per-block hull/accent paint, then saves a NEW scene. Additions sit only on each roof, placed by raycasting against
    /// temporary colliders on the existing roof props so nothing overlaps; ground footprints, roads and every other object
    /// are untouched. v14/v13 scenes and assets, v12 and the main project are never written.
    /// </summary>
    public static class SprintV15
    {
        public const string ScenePath="Assets/MapPrototype/Scenes/VesperBasin_v15_DistinctCompounds.unity";
        public const string AssetRoot="Assets/MapPrototype/SprintAssets/v15";
        public const string Evidence="/Users/tim/Code/fhfhockey.com/tasks/artifacts/cross-platform/2026-10-24-coordination/handoffs/Q2/v15/evidence";
        public const string RootName="V15 Distinct compounds";
        [Serializable] public class Feature { public string compound,name; public Vector3 center,boundsMin,boundsMax; public int triangles; public bool collider; }
        [Serializable] public class Swap { public string renderer,from,to; public int slot; }
        [Serializable] public class Compound { public string name,block,building; public Vector3 center; public float roofTop,roofRadius; public List<string> placementNotes=new List<string>(); }
        [Serializable] public class Receipt
        {
            public string scene,source,utc; public int addedRenderers,addedColliders,addedTriangles,swappedSlots;
            public List<Compound> compounds=new List<Compound>(); public List<Feature> features=new List<Feature>(); public List<Swap> swaps=new List<Swap>();
            public string note="v14 preserved and read-only. v15 adds one root of roof-mounted features (each inside its block's roof octagon and above its roof top) and swaps hull/accent material slots on the four blocks' existing renderers only. No existing transform, collider or gameplay/HUD field changes. No Scout import, package, project-settings or main-project change.";
        }
        class Block { public string key,block,building; public Material hull,accent; }
        static Material Lit(string name,Color c,float smooth=.28f,float metal=.2f,Color? emission=null)
        {
            string path=AssetRoot+"/"+name+".mat";var m=AssetDatabase.LoadAssetAtPath<Material>(path);
            if(m==null){m=new Material(Shader.Find("Universal Render Pipeline/Lit")){name=name};AssetDatabase.CreateAsset(m,path);}
            m.SetColor("_BaseColor",c);m.SetFloat("_Smoothness",smooth);m.SetFloat("_Metallic",metal);m.enableInstancing=true;
            if(emission.HasValue){m.EnableKeyword("_EMISSION");m.SetColor("_EmissionColor",emission.Value);m.globalIlluminationFlags=MaterialGlobalIlluminationFlags.None;}
            EditorUtility.SetDirty(m);return m;
        }
        public static void BuildAndCapture(){Build();SprintV15Capture.RunMatched();}
        public static void Build()
        {
            if(File.Exists(ScenePath))throw new InvalidOperationException("v15 scene already exists; refusing to overwrite "+ScenePath);
            string v14Hash=SprintV13Capture.Hash(SprintV14.ScenePath),v13Hash=SprintV13Capture.Hash(SprintV13.ScenePath);
            Directory.CreateDirectory(AssetRoot+"/Meshes");Directory.CreateDirectory(Evidence);AssetDatabase.Refresh();
            var receipt=new Receipt{scene=ScenePath,source=SprintV14.ScenePath,utc=DateTime.UtcNow.ToString("o")};
            // Palette: dark industrial hulls with one identity accent each, echoing the concept's zone colour language.
            var concrete=Lit("V15 cooling tower concrete",new Color(.62f,.60f,.56f),.12f,0);
            var stain=Lit("V15 tower soot band",new Color(.20f,.19f,.18f),.1f,0);
            var mastSteel=Lit("V15 comms lattice steel",new Color(.17f,.21f,.28f),.4f,.6f);
            var dish=Lit("V15 dish ceramic",new Color(.86f,.84f,.78f),.35f,.1f);
            var beacon=Lit("V15 red aviation beacon",new Color(.8f,.08f,.05f),.5f,0,new Color(2.2f,.18f,.08f));
            var craneYellow=Lit("V15 crane safety yellow",new Color(.86f,.63f,.12f),.3f,.3f);
            var boxes=new[]{Lit("V15 container rust",new Color(.52f,.22f,.13f),.25f,.3f),Lit("V15 container teal",new Color(.13f,.38f,.40f),.25f,.3f),Lit("V15 container ochre",new Color(.70f,.48f,.18f),.25f,.3f)};
            var glazing=Lit("V15 north-light glazing",new Color(.10f,.22f,.27f),.85f,.1f,new Color(.02f,.09f,.11f));
            var shed=Lit("V15 sawtooth roof steel",new Color(.40f,.17f,.12f),.3f,.45f);
            var blocks=new[]{
                new Block{key="NE",block="Northeast service block",building="NE Cooling and service building",hull=Lit("V15 NE hull teal grey",new Color(.33f,.42f,.43f),.3f,.25f),accent=Lit("V15 NE accent cooling teal",new Color(.16f,.36f,.38f),.35f,.35f)},
                new Block{key="NW",block="Northwest comms block",building="NW Communications building",hull=Lit("V15 NW hull navy",new Color(.20f,.25f,.36f),.3f,.3f),accent=Lit("V15 NW accent signal navy",new Color(.12f,.17f,.30f),.35f,.4f)},
                new Block{key="SE",block="Southeast logistics block",building="SE Logistics building",hull=Lit("V15 SE hull ochre",new Color(.56f,.45f,.27f),.28f,.2f),accent=Lit("V15 SE accent hazard ochre",new Color(.66f,.47f,.14f),.3f,.3f)},
                new Block{key="SW",block="Southwest loading block",building="SW Loading building",hull=Lit("V15 SW hull oxide red",new Color(.45f,.24f,.19f),.28f,.25f),accent=Lit("V15 SW accent oxide",new Color(.42f,.17f,.12f),.3f,.35f)}};

            EditorSceneManager.OpenScene(SprintV14.ScenePath,OpenSceneMode.Single);
            var root=new GameObject(RootName).transform;
            var all=UnityEngine.Object.FindObjectsByType<Renderer>(FindObjectsInactive.Include,FindObjectsSortMode.None);
            foreach(var b in blocks)
            {
                var volume=Find(b.block+" volume");var roof=Find(b.block+" roof");
                var c=new Compound{name=b.key,block=b.block,building=b.building};
                Bounds vb=volume.GetComponent<Renderer>().bounds,rb=roof.GetComponent<Renderer>().bounds;
                c.center=new Vector3(vb.center.x,rb.max.y,vb.center.z);c.roofTop=rb.max.y;c.roofRadius=Mathf.Min(rb.extents.x,rb.extents.z); // inscribed radius of the roof octagon
                receipt.compounds.Add(c);
                // Paint: hull on the octagonal volume, accent on the v12 dressing's blue-steel slots for this building only.
                foreach(var r in all)
                {
                    string n=r.name;bool mine=r.transform==volume||n.StartsWith(b.building+"__",StringComparison.Ordinal)||n.StartsWith(b.building+" service detail__",StringComparison.Ordinal);
                    if(!mine)continue;var mats=r.sharedMaterials;bool changed=false;
                    for(int i=0;i<mats.Length;i++)
                    {
                        Material to=null;
                        if(r.transform==volume&&mats[i]&&mats[i].name=="Architecture pale steel")to=b.hull;
                        else if(mats[i]&&mats[i].name=="Weathered blue steel")to=b.accent;
                        if(to==null)continue;
                        receipt.swaps.Add(new Swap{renderer=SprintV13Survey.Key(r.transform),slot=i,from=mats[i].name,to=AssetDatabase.GetAssetPath(to)});mats[i]=to;changed=true;receipt.swappedSlots++;
                    }
                    if(changed)r.sharedMaterials=mats;
                }
                var probes=TemporaryRoofColliders(volume,roof,b.building,all);
                try
                {
                    var group=new GameObject(b.key+" "+b.building+" identity").transform;group.SetParent(root,false);
                    if(b.key=="NE")Cooling(group,c,concrete,stain,receipt);
                    if(b.key=="NW")Comms(group,c,mastSteel,dish,beacon,receipt);
                    if(b.key=="SE")Logistics(group,c,craneYellow,boxes,beacon,receipt);
                    if(b.key=="SW")Loading(group,c,shed,glazing,receipt);
                }
                finally{foreach(var p in probes)UnityEngine.Object.DestroyImmediate(p);}
            }
            receipt.addedRenderers=root.GetComponentsInChildren<Renderer>(true).Length;receipt.addedColliders=root.GetComponentsInChildren<Collider>(true).Length;
            receipt.addedTriangles=receipt.features.Sum(f=>f.triangles);
            EditorSceneManager.SaveScene(UnityEngine.SceneManagement.SceneManager.GetActiveScene(),ScenePath,true);AssetDatabase.SaveAssets();
            if(SprintV13Capture.Hash(SprintV14.ScenePath)!=v14Hash||SprintV13Capture.Hash(SprintV13.ScenePath)!=v13Hash)throw new InvalidOperationException("v13/v14 scene changed during v15 build");
            File.WriteAllText(Path.Combine(Evidence,"v15-build.json"),JsonUtility.ToJson(receipt,true));
            Debug.Log("VESPER_V15_BUILT "+ScenePath+" features="+receipt.features.Count+" swaps="+receipt.swappedSlots);
        }
        [Serializable] class RoofMap { public string block; public float roofTop; public List<string> rows=new List<string>(); public List<string> colliders=new List<string>(); }
        [Serializable] class RoofMaps { public List<RoofMap> maps=new List<RoofMap>(); }
        /// <summary>Read-only: per-block grid of first-hit heights above each roof (temporary colliders, nothing saved).</summary>
        public static void Diagnose()
        {
            EditorSceneManager.OpenScene(SprintV14.ScenePath,OpenSceneMode.Single);var all=UnityEngine.Object.FindObjectsByType<Renderer>(FindObjectsInactive.Include,FindObjectsSortMode.None);var outp=new RoofMaps();
            foreach(var name in new[]{"Northeast service block","Northwest comms block","Southeast logistics block","Southwest loading block"})
            {
                var volume=Find(name+" volume");var roof=Find(name+" roof");var probes=TemporaryRoofColliders(volume,roof,"",all);
                var vb=volume.GetComponent<Renderer>().bounds;float top=roof.GetComponent<Renderer>().bounds.max.y;var map=new RoofMap{block=name,roofTop=top};var seen=new HashSet<string>();
                for(float z=vb.max.z;z>=vb.min.z;z-=1f){var row="";for(float x=vb.min.x;x<=vb.max.x;x+=1f)
                {
                    if(Physics.Raycast(new Vector3(x,top+30,z),Vector3.down,out var h,60)){float d=h.point.y-top;row+=d<-.12f?"-":d<=.12f?".":d<1?"1":d<3?"3":"#";seen.Add(h.collider.name+" "+(h.point.y-top).ToString("F2"));}else row+=" ";
                }map.rows.Add(row);}
                map.colliders=seen.OrderBy(x=>x).Take(40).ToList();outp.maps.Add(map);
                foreach(var p in probes)UnityEngine.Object.DestroyImmediate(p);
            }
            File.WriteAllText(Path.Combine(Evidence,"v15-roof-occupancy.json"),JsonUtility.ToJson(outp,true));
        }
        static Transform Find(string name)
        {
            var t=UnityEngine.Object.FindObjectsByType<Transform>(FindObjectsInactive.Include,FindObjectsSortMode.None).Where(x=>x.name==name).ToArray();
            if(t.Length!=1)throw new InvalidOperationException("Expected one '"+name+"', found "+t.Length);return t[0];
        }
        // Existing roof dressing has no colliders; give every renderer of this block a temporary MeshCollider so
        // placement rays see it. Removed before the scene is saved.
        static List<Component> TemporaryRoofColliders(Transform volume,Transform roof,string building,Renderer[] all)
        {
            var added=new List<Component>();Bounds area=volume.GetComponent<Renderer>().bounds;area.Expand(new Vector3(2,20,2));
            foreach(var r in all)
            {
                if(!r.enabled||!r.gameObject.activeInHierarchy||!area.Intersects(r.bounds)||r.GetComponent<Collider>()!=null)continue;
                var mf=r.GetComponent<MeshFilter>();if(mf==null||mf.sharedMesh==null)continue;
                var mc=r.gameObject.AddComponent<MeshCollider>();mc.sharedMesh=mf.sharedMesh;added.Add(mc);
            }
            Physics.SyncTransforms();return added;
        }
        // A rectangle (half sizes, yaw) is free when every sample ray first meets the roof surface itself.
        static int failRadial,failMiss,failHeight;static string lastHit="";
        static bool Free(Compound c,Vector3 centre,float hx,float hz,float yaw,bool round)
        {
            var rot=Quaternion.Euler(0,yaw,0);
            for(float x=-hx;x<=hx+.01f;x+=Mathf.Max(.4f,hx/4))for(float z=-hz;z<=hz+.01f;z+=Mathf.Max(.4f,hz/4))
            {
                if(round&&x*x/(hx*hx)+z*z/(hz*hz)>1.0001f)continue;
                Vector3 p=centre+rot*new Vector3(x,0,z);
                if(new Vector2(p.x-c.center.x,p.z-c.center.z).magnitude>c.roofRadius*1.08f){failRadial++;return false;}
                if(!Physics.Raycast(new Vector3(p.x,c.roofTop+30,p.z),Vector3.down,out var hit,60,Physics.DefaultRaycastLayers,QueryTriggerInteraction.Ignore)){failMiss++;return false;}
                if(Mathf.Abs(hit.point.y-c.roofTop)>.12f){failHeight++;lastHit=hit.collider.name+"@"+(hit.point.y-c.roofTop).ToString("F2");return false;}
            }
            return true;
        }
        static Vector3 Spot(Compound c,float hx,float hz,float yaw,Vector2 preferred,string label,bool round=false)
        {
            // Deterministic spiral search outward from the preferred offset.
            for(float ring=0;ring<=c.roofRadius*1.5f;ring+=.25f)for(int k=0;k<(ring==0?1:16);k++)
            {
                float a=k*Mathf.PI/8;Vector3 p=new Vector3(c.center.x+preferred.x+Mathf.Cos(a)*ring,c.roofTop,c.center.z+preferred.y+Mathf.Sin(a)*ring);
                if(Free(c,p,hx,hz,yaw,round)){c.placementNotes.Add(label+" at "+p.ToString("F2")+" ("+ring.ToString("F1")+" m from preferred)");return p;}
            }
            throw new InvalidOperationException("No free roof area for "+label+" on "+c.block+" centre="+c.center+" r="+c.roofRadius+" radial="+failRadial+" miss="+failMiss+" height="+failHeight+" last="+lastHit+" placed="+string.Join("; ",c.placementNotes));
        }
        static void Cooling(Transform g,Compound c,Material concrete,Material stain,Receipt r)
        {
            // Hyperbolic natural-draught towers: thin-walled lathe, open top, soot band at the rim.
            var profile=new[]{new Vector2(3.0f,0),new Vector2(2.55f,2.2f),new Vector2(2.2f,4.6f),new Vector2(2.15f,5.6f),new Vector2(2.3f,7.2f),new Vector2(2.45f,8.4f)};
            var mesh=Tower("V15 cooling tower",profile,.22f,28);
            float[] scale={.78f,.58f};Vector2[] pref={new Vector2(-3.4f,-4.6f),new Vector2(2.6f,-4.9f)};
            for(int i=0;i<2;i++)
            {
                float s=scale[i];var p=Spot(c,3.05f*s,3.05f*s,0,pref[i],"cooling tower "+(i+1),true);
                var go=Part(g,"Cooling tower "+(i+1),mesh,new[]{concrete,stain},p,Quaternion.Euler(0,i*37,0),Vector3.one*s);
                var box=go.AddComponent<CapsuleCollider>();box.direction=1;box.radius=2.2f;box.height=8.4f;box.center=new Vector3(0,4.2f,0); // in local (pre-scale) units
                Record(r,c,go);
            }
        }
        static void Comms(Transform g,Compound c,Material steel,Material dish,Material beacon,Receipt r)
        {
            var parts=new List<(Mesh,Matrix4x4,int)>();var cube=Builtin("Cube");
            const float H=19f,B=1.5f,T=.38f;
            Vector3 Leg(int k,float y){float s=Mathf.Lerp(B,T,y/H);return new Vector3((k&1)==0?-s:s,y,(k&2)==0?-s:s);}
            for(int k=0;k<4;k++)Strut(parts,cube,Leg(k,0),Leg(k,H),.16f,0);
            int[] ring={0,1,3,2};
            for(float y=2.4f;y<H;y+=2.4f)for(int k=0;k<4;k++)
            {
                int a=ring[k],b=ring[(k+1)%4];Strut(parts,cube,Leg(a,y),Leg(b,y),.08f,0);
                Strut(parts,cube,Leg(a,y-2.4f),Leg(b,y),.06f,0);
            }
            for(int k=0;k<3;k++)Strut(parts,cube,new Vector3(0,H-1.2f-k*1.6f,0)+Vector3.left*1.3f,new Vector3(0,H-1.2f-k*1.6f,0)+Vector3.right*1.3f,.07f,0);
            parts.Add((cube,Matrix4x4.TRS(new Vector3(0,H+.3f,0),Quaternion.identity,new Vector3(.45f,.6f,.45f)),1));
            var p=Spot(c,1.7f,1.7f,22,new Vector2(3.0f,-4.6f),"lattice mast");
            var mast=Part(g,"Lattice comms mast",Combine("V15 lattice comms mast",parts,2),new[]{steel,beacon},p,Quaternion.Euler(0,22,0),Vector3.one);
            var core=mast.AddComponent<BoxCollider>();core.center=new Vector3(0,H*.5f,0);core.size=new Vector3(1.4f,H,1.4f);Record(r,c,mast);
            var dishMesh=Dish("V15 comms dish");
            float[] yaw={-35,140};Vector2[] pref={new Vector2(-6.0f,0.5f),new Vector2(-3.0f,-5.0f)};
            for(int i=0;i<2;i++)
            {
                var q=Spot(c,1.4f,1.4f,yaw[i],pref[i],"dish "+(i+1));
                var d=Part(g,"Comms dish "+(i+1),dishMesh,new[]{steel,dish},q,Quaternion.Euler(0,yaw[i],0),Vector3.one*(i==0?1f:.8f));
                var bc=d.AddComponent<BoxCollider>();bc.center=new Vector3(0,1.6f,0);bc.size=new Vector3(2.6f,3.2f,1.6f);Record(r,c,d);
            }
        }
        static void Logistics(Transform g,Compound c,Material yellow,Material[] boxes,Material beacon,Receipt r)
        {
            var cube=Builtin("Cube");
            // Jib crane: mast, slewing cab, long jib over the roof, counter-jib with weight, hook line.
            var parts=new List<(Mesh,Matrix4x4,int)>();
            parts.Add((cube,Matrix4x4.TRS(new Vector3(0,5.5f,0),Quaternion.identity,new Vector3(1.1f,11f,1.1f)),0));
            parts.Add((cube,Matrix4x4.TRS(new Vector3(0,11.4f,0),Quaternion.identity,new Vector3(1.8f,1.2f,1.8f)),0));
            parts.Add((cube,Matrix4x4.TRS(new Vector3(0,12.2f,4.2f),Quaternion.identity,new Vector3(.7f,.6f,9.6f)),0));
            parts.Add((cube,Matrix4x4.TRS(new Vector3(0,12.2f,-2.2f),Quaternion.identity,new Vector3(.7f,.6f,3.2f)),0));
            parts.Add((cube,Matrix4x4.TRS(new Vector3(0,11.5f,-3.2f),Quaternion.identity,new Vector3(1.6f,1.4f,1.4f)),1));
            parts.Add((cube,Matrix4x4.TRS(new Vector3(0,9.6f,7.6f),Quaternion.identity,new Vector3(.05f,4.6f,.05f)),1));
            parts.Add((cube,Matrix4x4.TRS(new Vector3(0,7.1f,7.6f),Quaternion.identity,new Vector3(.6f,.5f,.6f)),0));
            parts.Add((cube,Matrix4x4.TRS(new Vector3(0,13.0f,0),Quaternion.identity,new Vector3(.3f,1.0f,.3f)),0));
            var p=Spot(c,1.0f,1.0f,0,new Vector2(-1.5f,0f),"jib crane mast");
            // Jib points across the roof toward the block centre so the hook never leaves the roof octagon.
            float yaw=Mathf.Atan2(c.center.x-p.x,c.center.z-p.z)*Mathf.Rad2Deg;
            var crane=Part(g,"Rooftop jib crane",Combine("V15 rooftop jib crane",parts,2),new[]{yellow,boxes[0]},p,Quaternion.Euler(0,yaw,0),Vector3.one);
            var mc=crane.AddComponent<BoxCollider>();mc.center=new Vector3(0,6,0);mc.size=new Vector3(1.4f,12,1.4f);Record(r,c,crane);
            // Two short stacks of 6 m containers with ribbed doors: different colours per tier.
            var box=Container("V15 six metre container");
            Vector2[] pref={new Vector2(0f,5.6f),new Vector2(1.0f,-5.6f)};int[][] tiers={new[]{0,1,2},new[]{2,0}};
            for(int s=0;s<2;s++)
            {
                float yawS=s==0?90:84;var q=Spot(c,1.35f,3.2f,yawS,pref[s],"container stack "+(s+1));
                for(int t=0;t<tiers[s].Length;t++)
                {
                    var go=Part(g,"Container stack "+(s+1)+" tier "+(t+1),box,new[]{boxes[tiers[s][t]],yellow},q+Vector3.up*(t*2.6f),Quaternion.Euler(0,yawS+(t==1?4:0),0),Vector3.one);
                    var bc=go.AddComponent<BoxCollider>();bc.center=new Vector3(0,1.3f,0);bc.size=new Vector3(2.44f,2.6f,6.06f);Record(r,c,go);
                }
            }
        }
        static void Loading(Transform g,Compound c,Material shed,Material glass,Receipt r)
        {
            // North-light sawtooth: three sheds with steep glazed faces, a classic loading/fabrication hall silhouette.
            var mesh=Sawtooth("V15 sawtooth shed");
            float yaw=0;Vector3 first=Vector3.zero;bool found=false;
            foreach(float y in new[]{0f,180f})
            {
                try{first=Spot(c,3.1f,2.3f,y,new Vector2(0,5.4f),"sawtooth bank (yaw "+y+")");yaw=y;found=true;break;}
                catch(InvalidOperationException){}
            }
            if(!found)throw new InvalidOperationException("No free 6.2 x 4.6 m roof area for sawtooth bank on "+c.block+" radial="+failRadial+" miss="+failMiss+" height="+failHeight+" last="+lastHit);
            var rot=Quaternion.Euler(0,yaw,0);
            for(int i=0;i<2;i++)
            {
                var go=Part(g,"Sawtooth shed "+(i+1),mesh,new[]{shed,glass},first+rot*new Vector3(0,0,(i-.5f)*2.2f),rot,Vector3.one);
                var bc=go.AddComponent<BoxCollider>();bc.center=new Vector3(0,1.3f,0);bc.size=new Vector3(6.0f,2.6f,2.2f);Record(r,c,go);
            }
        }
        static GameObject Part(Transform parent,string name,Mesh mesh,Material[] mats,Vector3 pos,Quaternion rot,Vector3 scale)
        {
            var go=new GameObject(name);go.transform.SetParent(parent,false);go.transform.SetPositionAndRotation(pos,rot);go.transform.localScale=scale;go.isStatic=true;
            go.AddComponent<MeshFilter>().sharedMesh=mesh;var mr=go.AddComponent<MeshRenderer>();mr.sharedMaterials=mats.Take(mesh.subMeshCount).ToArray();
            mr.shadowCastingMode=ShadowCastingMode.On;mr.receiveShadows=true;return go;
        }
        static void Record(Receipt r,Compound c,GameObject go)
        {
            var b=go.GetComponent<Renderer>().bounds;var m=go.GetComponent<MeshFilter>().sharedMesh;
            r.features.Add(new Feature{compound=c.name,name=go.name,center=go.transform.position,boundsMin=b.min,boundsMax=b.max,
                triangles=Enumerable.Range(0,m.subMeshCount).Sum(i=>(int)m.GetIndexCount(i)/3),collider=go.GetComponent<Collider>()!=null});
        }
        static Mesh Builtin(string name){var go=GameObject.CreatePrimitive(name=="Cube"?PrimitiveType.Cube:PrimitiveType.Cylinder);var m=go.GetComponent<MeshFilter>().sharedMesh;UnityEngine.Object.DestroyImmediate(go);return m;}
        static void Strut(List<(Mesh,Matrix4x4,int)> parts,Mesh cube,Vector3 a,Vector3 b,float w,int sub)
        {
            Vector3 d=b-a;parts.Add((cube,Matrix4x4.TRS((a+b)*.5f,Quaternion.LookRotation(d.normalized,Mathf.Abs(d.normalized.y)>.95f?Vector3.forward:Vector3.up),new Vector3(w,w,d.magnitude)),sub));
        }
        static Mesh Combine(string name,List<(Mesh mesh,Matrix4x4 tx,int sub)> parts,int subCount)
        {
            var verts=new List<Vector3>();var norms=new List<Vector3>();var uvs=new List<Vector2>();var tris=new List<int>[subCount];
            for(int i=0;i<subCount;i++)tris[i]=new List<int>();
            foreach(var p in parts)
            {
                int o=verts.Count;var nm=p.tx.inverse.transpose;
                verts.AddRange(p.mesh.vertices.Select(v=>p.tx.MultiplyPoint3x4(v)));norms.AddRange(p.mesh.normals.Select(n=>nm.MultiplyVector(n).normalized));uvs.AddRange(p.mesh.uv);
                tris[p.sub].AddRange(p.mesh.triangles.Select(t=>t+o));
            }
            var m=new Mesh{name=name,indexFormat=verts.Count>65535?IndexFormat.UInt32:IndexFormat.UInt16};
            m.SetVertices(verts);m.SetNormals(norms);m.SetUVs(0,uvs);m.subMeshCount=subCount;for(int i=0;i<subCount;i++)m.SetTriangles(tris[i],i);m.RecalculateBounds();
            return SaveMesh(m);
        }
        static Mesh Tower(string name,Vector2[] profile,float wall,int sides)
        {
            var v=new List<Vector3>();var t0=new List<int>();var t1=new List<int>();
            void Quad(Vector3 a,Vector3 b,Vector3 c,Vector3 d,List<int> t,Vector3 hint){int s=v.Count;v.Add(a);v.Add(b);v.Add(c);v.Add(d);Wind(t,s,s+1,s+2,v,hint);Wind(t,s,s+2,s+3,v,hint);}
            Vector3 Out(Vector3 a,Vector3 b){var m=(a+b)*.5f;m.y=0;return m.normalized;}
            Vector3 P(Vector2 pr,int i,float inset){float a=i*Mathf.PI*2/sides;float rr=pr.x-inset;return new Vector3(Mathf.Sin(a)*rr,pr.y,Mathf.Cos(a)*rr);}
            for(int l=0;l<profile.Length-1;l++)for(int i=0;i<sides;i++)
            {
                var list=l>=profile.Length-2?t1:t0;
                Quad(P(profile[l],i,0),P(profile[l+1],i,0),P(profile[l+1],i+1,0),P(profile[l],i+1,0),list,Out(P(profile[l],i,0),P(profile[l],i+1,0)));         // outer
                Quad(P(profile[l],i+1,wall),P(profile[l+1],i+1,wall),P(profile[l+1],i,wall),P(profile[l],i,wall),t1,-Out(P(profile[l],i,0),P(profile[l],i+1,0))); // inner, sooty
            }
            var top=profile[profile.Length-1];
            for(int i=0;i<sides;i++)Quad(P(top,i,0),P(top,i,wall),P(top,i+1,wall),P(top,i+1,0),t1,Vector3.up);
            var m=new Mesh{name=name};m.SetVertices(v);m.subMeshCount=2;m.SetTriangles(t0,0);m.SetTriangles(t1,1);m.RecalculateNormals();m.RecalculateBounds();return SaveMesh(m);
        }
        static Mesh Dish(string name)
        {
            // Pedestal + yoke in submesh 0, shallow paraboloid reflector tilted 28 degrees up in submesh 1.
            var parts=new List<(Mesh,Matrix4x4,int)>();var cube=Builtin("Cube");
            parts.Add((cube,Matrix4x4.TRS(new Vector3(0,.8f,0),Quaternion.identity,new Vector3(.5f,1.6f,.5f)),0));
            parts.Add((cube,Matrix4x4.TRS(new Vector3(0,1.7f,-.1f),Quaternion.identity,new Vector3(1.0f,.3f,.4f)),0));
            var pm=Combine(name+" pedestal",parts,2);
            var v=new List<Vector3>();var t=new List<int>();int sides=24,rings=5;float R=1.35f,depth=.42f;
            var tilt=Matrix4x4.TRS(new Vector3(0,1.95f,.25f),Quaternion.Euler(-28,0,0),Vector3.one);
            for(int k=0;k<=rings;k++)for(int i=0;i<=sides;i++)
            {
                float rr=R*k/rings,a=i*Mathf.PI*2/sides;v.Add(tilt.MultiplyPoint3x4(new Vector3(Mathf.Cos(a)*rr,Mathf.Sin(a)*rr,depth*(rr/R)*(rr/R))));
            }
            int front=v.Count;for(int i=0;i<front;i++)v.Add(v[i]);
            for(int k=0;k<rings;k++)for(int i=0;i<sides;i++)
            {
                int a=k*(sides+1)+i,b=a+sides+1;
                t.AddRange(new[]{a,b,a+1,a+1,b,b+1});t.AddRange(new[]{front+a,front+a+1,front+b,front+a+1,front+b+1,front+b});
            }
            var m=new Mesh{name=name};
            var pv=pm.vertices.ToList();int off=pv.Count;pv.AddRange(v);m.SetVertices(pv);m.subMeshCount=2;
            m.SetTriangles(pm.GetTriangles(0),0);m.SetTriangles(t.Select(x=>x+off).ToList(),1);m.RecalculateNormals();m.RecalculateBounds();
            AssetDatabase.DeleteAsset(AssetDatabase.GetAssetPath(pm));return SaveMesh(m);
        }
        static Mesh Container(string name)
        {
            var parts=new List<(Mesh,Matrix4x4,int)>();var cube=Builtin("Cube");
            parts.Add((cube,Matrix4x4.TRS(new Vector3(0,1.3f,0),Quaternion.identity,new Vector3(2.44f,2.6f,6.06f)),0));
            for(int i=-5;i<=5;i++)foreach(float side in new[]{-1f,1f})
                parts.Add((cube,Matrix4x4.TRS(new Vector3(side*1.24f,1.3f,i*.52f),Quaternion.identity,new Vector3(.06f,2.4f,.12f)),0));
            foreach(float e in new[]{-1f,1f})parts.Add((cube,Matrix4x4.TRS(new Vector3(0,1.3f,e*3.05f),Quaternion.identity,new Vector3(2.2f,.14f,.06f)),1));
            return Combine(name,parts,2);
        }
        static Mesh Sawtooth(string name)
        {
            // One 6 m x 2.2 m shed: low back rising to a 2.6 m ridge, steep glazed north face, steel sides.
            var v=new List<Vector3>();var s0=new List<int>();var s1=new List<int>();
            void Q(Vector3 a,Vector3 b,Vector3 c,Vector3 d,List<int> t,Vector3 hint){int s=v.Count;v.Add(a);v.Add(b);v.Add(c);v.Add(d);Wind(t,s,s+1,s+2,v,hint);Wind(t,s,s+2,s+3,v,hint);}
            void T(Vector3 a,Vector3 b,Vector3 c,List<int> t,Vector3 hint){int s=v.Count;v.Add(a);v.Add(b);v.Add(c);Wind(t,s,s+1,s+2,v,hint);}
            float X=3.0f,Z=1.1f,H=2.6f;
            Vector3 bl=new Vector3(-X,0,-Z),br=new Vector3(X,0,-Z),fl=new Vector3(-X,0,Z),fr=new Vector3(X,0,Z),rl=new Vector3(-X,H,Z-.25f),rr=new Vector3(X,H,Z-.25f);
            Q(bl,rl,rr,br,s0,new Vector3(0,1,-.6f));   // sloped steel roof
            Q(fr,rr,rl,fl,s1,new Vector3(0,.1f,1));    // glazed face
            T(bl,fl,rl,s0,Vector3.left);T(br,rr,fr,s0,Vector3.right); // gables
            var m=new Mesh{name=name};m.SetVertices(v);m.subMeshCount=2;m.SetTriangles(s0,0);m.SetTriangles(s1,1);m.RecalculateNormals();m.RecalculateBounds();return SaveMesh(m);
        }
        // Unity front faces are clockwise seen from outside: order each triangle so its normal agrees with the hint.
        static void Wind(List<int> t,int a,int b,int c,List<Vector3> v,Vector3 hint)
        {
            if(Vector3.Dot(Vector3.Cross(v[b]-v[a],v[c]-v[a]),hint)>=0)t.AddRange(new[]{a,b,c});else t.AddRange(new[]{a,c,b});
        }
        static Mesh SaveMesh(Mesh m)
        {
            string path=AssetRoot+"/Meshes/"+m.name+".asset";var old=AssetDatabase.LoadAssetAtPath<Mesh>(path);
            if(old==null){AssetDatabase.CreateAsset(m,path);return m;}
            EditorUtility.CopySerialized(m,old);UnityEngine.Object.DestroyImmediate(m);EditorUtility.SetDirty(old);return old;
        }
        [MenuItem("Vesper Basin/Open distinct compounds candidate (v15)")]
        public static void Open() { if(EditorSceneManager.SaveCurrentModifiedScenesIfUserWantsTo())EditorSceneManager.OpenScene(ScenePath); }
    }
}
#endif

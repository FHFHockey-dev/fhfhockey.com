#if UNITY_EDITOR
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace VesperBasin.Editor
{
    /// <summary>
    /// Saved-scene v22 vs v23 comparison (structure of SprintV14-V22Validation). Proves the v23 change is only the new
    /// render-only live-battlefield root plus the sun light/transform (golden hour): every other object, transform,
    /// collider, HUD, rig and gameplay field is identical; route corridor and margins, compound ground and cover rays are
    /// identical; flyers stay well above the pilot and away from the practice range. Every saved scene v13-v22 is
    /// hash-checked unchanged. Read-only.
    /// </summary>
    public static class SprintV23Validation
    {
        const string TerrainPath=SprintV23.RootName;
        [Serializable] public class Check { public string name; public bool passed; public string detail; }
        [Serializable] public class Inventory { public string scene; public int renderers,enabledRenderers,colliders,enabledColliders,meshColliders,uniqueMaterials,textures; public long enabledTriangles; }
        [Serializable] public class Cover { public Vector3 origin; public float side,height,v13,v14; public string v13Hit,v14Hit; }
        [Serializable] public class Receipt
        {
            public string utc,v22SHA256,v23SHA256,failure; public bool passed; public int flyers,trimRenderers,sunFieldDiffs; public float minFlyerHeightAboveGround,minFlyerDistanceToRange; public List<string> protectedScenes=new List<string>(),sunDiffs=new List<string>();
            public List<Check> checks=new List<Check>();
            public Inventory v22,v23;
            public int corridorSamples,corridorDifferences,marginSamples,marginTerrainDifferences,marginOtherDifferences,coverSamples,coverChanged,groundSamples,groundDifferences,features,featuresInside;
            public float maxMarginTerrainDelta,maxEmergentRise; public int marginTerrainEmergent;
            public List<Cover> coverChanges=new List<Cover>();
            public List<string> differences=new List<string>();
            public string method="Opens saved v22 then v23 in the Editor (no Play Mode, no saves). Objects are matched by name path plus occurrence ordinal so added roots cannot mask changes. Serialized fields are compared through SerializedProperty values, object references by scene path or asset path. Collision uses edit-mode Physics raycasts against saved colliders; route corridor = v13 route profile at +/-5.4 m (8.8 m deck plus margin), margin band = 5.4-12 m; cover = horizontal rays at 1.0 m and 2.5 m above the route surface out to 25 m; compound ground = downward rays every 1 m within 8 m around each roof footprint, outside it.";
        }
        static readonly Vector3[] Route={new Vector3(-18,.35f,8),new Vector3(-18,5.35f,28),new Vector3(-10,10.35f,46),new Vector3(-2,14.35f,64),new Vector3(-2,14.35f,72)};
        public static void Validate()
        {
            var receipt=new Receipt{utc=DateTime.UtcNow.ToString("o")};
            try
            {
                var scenes=Directory.GetFiles("Assets/MapPrototype/Scenes","VesperBasin_v*.unity").Select(p=>p.Replace('\\','/')).Where(p=>p!=SprintV23.ScenePath).OrderBy(p=>p).ToArray();
                var hashesBefore=scenes.Select(SprintV13Capture.Hash).ToArray();
                for(int i2=0;i2<scenes.Length;i2++)receipt.protectedScenes.Add(Path.GetFileName(scenes[i2])+" "+hashesBefore[i2]);
                receipt.v22SHA256=SprintV13Capture.Hash(SprintV23.SourceScene);receipt.v23SHA256=SprintV13Capture.Hash(SprintV23.ScenePath);
                var expected=new Dictionary<string,string>{{"VesperBasin_v13_RadarAscent.unity","077bd43b9bcaccd51a68e5d353b23cb2c701c7003c8eb21ea3c46c5ddd89aa80"},{"VesperBasin_v14_StrataAscent.unity","450e21bf020bb2f579cfb468b1589909ea7ca43430be64e1dd31deb5333ec80a"},
                    {"VesperBasin_v15_DistinctCompounds.unity","c5389bcadfe4e0b98003a82be080b547969a8d79b92b2842e03feef086973841"},{"VesperBasin_v16_PlayerHud.unity","31115d60fafbf4718672224b23e0a6d47b667a7872e52290d1973c3047193ee5"},
                    {"VesperBasin_v17_IndustrialDeck.unity","8ff8531db0a73e4d24262f042b3bd2e2bd68c30abc09a96238a9b46cc9771765"},{"VesperBasin_v18_RimSkyline.unity","e2ec09d62780cecd391b7b8628049610ba2de5838157c8baf6959d5070812e47"},
                    {"VesperBasin_v19_ReadableRange.unity","cdc906504c75e1d155f652c5941853602d937036686eaac42e8fd08b4abd80a5"},{"VesperBasin_v20_EnergyIdentity.unity","a83f9047c70d8f8784b003865d0fd3f325cb38a575822c19f900193913dd4d74"},
                    {"VesperBasin_v21_CockpitViewPrototype.unity","cceb75bca2b0f83f3bcbf3ccb5d0a228944205934ac75b4160346614a53e8e42"},{"VesperBasin_v22_ConceptLayer.unity","cfb821944a0bb1e2376a5aa27613e5613142088330ca8f974863795b46d85c41"}};
                Add(receipt,"v13-v22 scene hashes match their receipts/handoffs",expected.All(kv=>File.Exists("Assets/MapPrototype/Scenes/"+kv.Key)&&SprintV13Capture.Hash("Assets/MapPrototype/Scenes/"+kv.Key)==kv.Value),expected.Count+" scenes");
                Add(receipt,"v23 is a separate saved scene built from TJ-accepted v22",receipt.v23SHA256!=receipt.v22SHA256&&receipt.v22SHA256==SprintV23.SourceSHA256,receipt.v23SHA256);
                EditorSceneManager.OpenScene(SprintV23.SourceScene,OpenSceneMode.Single);
                var a=Snapshot(out receipt.v22);var aRoute=SampleRoute();var aGround=SampleCompoundGround();
                EditorSceneManager.OpenScene(SprintV23.ScenePath,OpenSceneMode.Single);
                var b=Snapshot(out receipt.v23);var bRoute=SampleRoute();var bGround=SampleCompoundGround();
                CheckLive(receipt);
                var outside=a.Keys.Where(k=>!InTerrain(k)).ToList();
                var missing=outside.Where(k=>!b.ContainsKey(k)).ToList();var extra=b.Keys.Where(k=>!InTerrain(k)&&!a.ContainsKey(k)).ToList();
                Add(receipt,"every object outside the new live-battlefield root exists in both scenes",missing.Count==0&&extra.Count==0,"missing="+missing.Count+" extra="+extra.Count+" "+string.Join(";",missing.Concat(extra).Take(8)));
                int objectDiffs=0,fieldDiffs=0,rockSlotOnly=0;
                foreach(var k in outside.Where(b.ContainsKey))
                {
                    var x=a[k];var y=b[k];
                    bool isSun=k.StartsWith("Prototype sun#")||k.Contains("/Prototype sun#");
                    if(x.header!=y.header&&isSun){receipt.sunDiffs.Add("transform/header");}
                    else if(x.header!=y.header){objectDiffs++;Diff(receipt,k+" header "+x.header+" -> "+y.header);}
                    foreach(var f in x.fields)
                    {
                        y.fields.TryGetValue(f.Key,out var other);
                        if(other==f.Value)continue;
                        if(isSun){receipt.sunFieldDiffs++;if(receipt.sunDiffs.Count<20)receipt.sunDiffs.Add(f.Key+": "+f.Value+" -> "+other);continue;}
                        
                        fieldDiffs++;Diff(receipt,k+" "+f.Key+": "+f.Value+" -> "+other);
                    }
                    foreach(var f in y.fields.Keys.Where(z=>!x.fields.ContainsKey(z))){fieldDiffs++;Diff(receipt,k+" new field "+f);}
                }
                Add(receipt,"all transforms, active states and component lists outside the new root are identical",objectDiffs==0,"differences="+objectDiffs);
                Add(receipt,"all serialized fields outside the new root are identical except the sun light/transform",fieldDiffs==0&&receipt.sunFieldDiffs>0&&receipt.sunFieldDiffs<=12,"other differences="+fieldDiffs+", sun fields="+receipt.sunFieldDiffs);
                Add(receipt,"gameplay components (pilot, weapon, targets, capture zones, recovery, cockpit readout) retained",
                    new[]{"QuestPilotControls","QuestPracticeWeapon","PracticeTarget","CaptureZone","CaptureZoneVisuals","CanyonFallRecovery","CaptureCockpitReadout","QuestCockpitRig"}
                    .All(t=>Count(a,t)==Count(b,t))&&new[]{"QuestPilotControls","QuestPracticeWeapon","PracticeTarget","CaptureZone"}.All(t=>Count(b,t)>0),string.Join(",",new[]{"QuestPilotControls","QuestPracticeWeapon","PracticeTarget","CaptureZone"}.Select(t=>t+"="+Count(b,t))));
                Add(receipt,"player HUD, deck, v19 targets, v20 art, v22 beacons/lanes/rivers, rig and all labels are untouched",Count(a,"TextMesh")==Count(b,"TextMesh")&&Count(b,"V16PlayerHud")==1&&Count(a,"V22YawBillboard")==Count(b,"V22YawBillboard")&&Count(a,"V19TargetReadout")==Count(b,"V19TargetReadout")&&fieldDiffs==0,"TextMesh="+Count(b,"TextMesh"));
                var added=b.Where(kv=>InTerrain(kv.Key)).ToList();
                Add(receipt,"live-battlefield root adds renderers only (no colliders)",added.Count(kv=>kv.Value.header.Contains("MeshRenderer"))>=15&&added.All(kv=>!kv.Value.header.Contains("Collider")),"objects="+added.Count);
                Add(receipt,"live-battlefield meshes/materials live only in SprintAssets/v23",added.SelectMany(kv=>kv.Value.fields).Where(f=>f.Value.StartsWith("asset:Assets/")&&!f.Value.Contains(".cs:")&&!f.Value.Contains("World labels.mat")).All(f=>f.Value.Contains("SprintAssets/v23/")),"");
                // Collision: route corridor must be identical; margins may differ only on regenerated terrain.
                for(int i=0;i<aRoute.Count;i++)
                {
                    var p=aRoute[i];var q=bRoute[i];bool corridor=Mathf.Abs(p.offset)<=5.4f;
                    bool same=p.hit==q.hit&&(p.hit=="none"||Mathf.Abs(p.y-q.y)<.01f);
                    if(corridor){receipt.corridorSamples++;if(!same){receipt.corridorDifferences++;Diff(receipt,"corridor "+p.point+" "+p.hit+"@"+p.y+" -> "+q.hit+"@"+q.y);}}
                    else
                    {
                        receipt.marginSamples++;if(same)continue;
                        if(p.hit.StartsWith(TerrainPath)&&q.hit.StartsWith(TerrainPath)){receipt.marginTerrainDifferences++;receipt.maxMarginTerrainDelta=Mathf.Max(receipt.maxMarginTerrainDelta,Mathf.Abs(p.y-q.y));}
                        else if(q.hit.StartsWith(TerrainPath)&&!p.hit.StartsWith(TerrainPath)&&q.y>p.y){receipt.marginTerrainEmergent++;receipt.maxEmergentRise=Mathf.Max(receipt.maxEmergentRise,q.y-p.y);Diff(receipt,"terrain now above inherited ground "+p.point+" "+p.hit+"@"+p.y+" -> "+q.hit+"@"+q.y);}
                        else {receipt.marginOtherDifferences++;Diff(receipt,"margin "+p.point+" "+p.hit+"@"+p.y+" -> "+q.hit+"@"+q.y);}
                    }
                }
                Add(receipt,"route corridor samples hit saved collision in both scenes",aRoute.Where(x=>Mathf.Abs(x.offset)<=5.4f).Count(x=>x.hit!="none")>=.9f*receipt.corridorSamples,"");
                Add(receipt,"route corridor collision surface identical (same collider path and height within 1 cm)",receipt.corridorDifferences==0&&receipt.corridorSamples>100,"samples="+receipt.corridorSamples);
                Add(receipt,"route margin (5.4-12 m) collision surface identical",receipt.marginTerrainDifferences+receipt.marginOtherDifferences+receipt.marginTerrainEmergent==0,"samples="+receipt.marginSamples);
                for(int i=0;i<aGround.Count;i++){receipt.groundSamples++;if(aGround[i]!=bGround[i]){receipt.groundDifferences++;Diff(receipt,"compound ground "+aGround[i]+" -> "+bGround[i]);}}
                Add(receipt,"ground and paths around every compound are identical (outside roof footprints)",receipt.groundDifferences==0&&receipt.groundSamples>500,"samples="+receipt.groundSamples);
                // Lateral cover from the route centreline: reported, and must not move closer than 4.4 m (deck half-width).
                EditorSceneManager.OpenScene(SprintV23.SourceScene,OpenSceneMode.Single);var ca=SampleCover();
                EditorSceneManager.OpenScene(SprintV23.ScenePath,OpenSceneMode.Single);var cb=SampleCover();
                bool coverSafe=true;
                for(int i=0;i<ca.Count;i++)
                {
                    receipt.coverSamples++;var c=ca[i];c.v14=cb[i].v13;c.v14Hit=cb[i].v13Hit;
                    if(Mathf.Abs(c.v13-c.v14)>.05f||c.v13Hit!=c.v14Hit){receipt.coverChanged++;if(receipt.coverChanges.Count<60)receipt.coverChanges.Add(c);}
                    if(c.v14<4.4f&&Mathf.Abs(c.v13-c.v14)>.05f)coverSafe=false;
                }
                Add(receipt,"all lateral cover rays along the route are identical",receipt.coverChanged==0&&coverSafe,"changedRays="+receipt.coverChanged+"/"+receipt.coverSamples);
                Add(receipt,"every saved scene unchanged by validation",scenes.Select(SprintV13Capture.Hash).SequenceEqual(hashesBefore)&&receipt.v23SHA256==SprintV13Capture.Hash(SprintV23.ScenePath),"");
                receipt.passed=receipt.checks.All(c=>c.passed);
            }
            catch(Exception e){receipt.failure=e.ToString();receipt.passed=false;}
            File.WriteAllText(Path.Combine(SprintV23.Evidence,"saved-v23-validation.json"),JsonUtility.ToJson(receipt,true));
            Debug.Log("VESPER_V23_VALIDATION "+receipt.passed+" checks="+receipt.checks.Count(c=>c.passed)+"/"+receipt.checks.Count);
            if(!receipt.passed)throw new InvalidOperationException("v23 validation failed "+receipt.failure);
        }
        static void Add(Receipt r,string name,bool ok,string detail)=>r.checks.Add(new Check{name=name,passed=ok,detail=detail});
        static void Diff(Receipt r,string s){if(r.differences.Count<120)r.differences.Add(s);}
        static bool InTerrain(string key)=>key==TerrainPath+"#0"||key.StartsWith(TerrainPath+"/",StringComparison.Ordinal);
        static int Count(Dictionary<string,Obj> s,string type)=>s.Values.Sum(o=>o.header.Split('|').Count(t=>t==type));
        static readonly string[] Blocks={"Northeast service block","Northwest comms block","Southeast logistics block","Southwest loading block"};
        class Obj { public string header; public Dictionary<string,string> fields=new Dictionary<string,string>(); }
        static Dictionary<string,Obj> Snapshot(out Inventory inv)
        {
            var scene=SceneManager.GetActiveScene();inv=new Inventory{scene=scene.path};
            var map=new Dictionary<string,Obj>();var seen=new Dictionary<string,int>();
            var mats=new HashSet<Material>();var texs=new HashSet<Texture>();
            foreach(var t in scene.GetRootGameObjects().SelectMany(g=>g.GetComponentsInChildren<Transform>(true)))
            {
                string path=PathOf(t);seen.TryGetValue(path,out int n);seen[path]=n+1;string key=path+"#"+n;
                var comps=t.GetComponents<Component>();
                var o=new Obj{header=t.gameObject.activeSelf+"|"+t.gameObject.layer+"|"+t.tag+"|"+V(t.localPosition)+V(t.localEulerAngles)+V(t.localScale)+"|"+string.Join("|",comps.Select(c=>c?c.GetType().Name:"missing"))};
                for(int ci=0;ci<comps.Length;ci++)
                {
                    var c=comps[ci];if(c==null||c is Transform)continue;
                    var so=new SerializedObject(c);var it=so.GetIterator();
                    while(it.Next(true))
                    {
                        // Object references are compared by path above; their raw file/path IDs differ per loaded scene file.
                        if(it.propertyPath.EndsWith(".m_FileID",StringComparison.Ordinal)||it.propertyPath.EndsWith(".m_PathID",StringComparison.Ordinal))continue;
                        if(it.propertyPath=="m_GameObject"||it.propertyPath.StartsWith("m_PrefabInstance")||it.propertyPath.StartsWith("m_CorrespondingSourceObject")||it.propertyPath.StartsWith("m_PrefabAsset"))continue;
                        string value=Value(it);if(value!=null)o.fields[ci+":"+c.GetType().Name+"."+it.propertyPath]=value;
                    }
                }
                map[key]=o;
                if(t.TryGetComponent<Renderer>(out var r))
                {
                    inv.renderers++;bool on=r.enabled&&t.gameObject.activeInHierarchy;if(on)inv.enabledRenderers++;
                    if(on&&t.TryGetComponent<MeshFilter>(out var mf)&&mf.sharedMesh)for(int s=0;s<mf.sharedMesh.subMeshCount;s++)inv.enabledTriangles+=mf.sharedMesh.GetIndexCount(s)/3;
                    foreach(var m in r.sharedMaterials)if(m){mats.Add(m);foreach(var id in m.GetTexturePropertyNameIDs()){var tx=m.GetTexture(id);if(tx)texs.Add(tx);}}
                }
                foreach(var col in t.GetComponents<Collider>()){inv.colliders++;if(col.enabled&&t.gameObject.activeInHierarchy)inv.enabledColliders++;if(col is MeshCollider)inv.meshColliders++;}
            }
            inv.uniqueMaterials=mats.Count;inv.textures=texs.Count;return map;
        }
        static string PathOf(Transform t)=>t.parent==null?t.name:PathOf(t.parent)+"/"+t.name;
        static string V(Vector3 v)=>"("+v.x.ToString("F4")+","+v.y.ToString("F4")+","+v.z.ToString("F4")+")";
        static string Value(SerializedProperty p)
        {
            switch(p.propertyType)
            {
                case SerializedPropertyType.ObjectReference:
                    var o=p.objectReferenceValue;if(o==null)return "null";
                    string asset=AssetDatabase.GetAssetPath(o);if(!string.IsNullOrEmpty(asset))return "asset:"+asset+":"+o.name;
                    if(o is Component c)return "scene:"+PathOf(c.transform)+":"+c.GetType().Name;
                    if(o is GameObject g)return "scene:"+PathOf(g.transform);
                    return "object:"+o.GetType().Name+":"+o.name;
                case SerializedPropertyType.Generic: return null;
                case SerializedPropertyType.Float: return p.floatValue.ToString("R");
                case SerializedPropertyType.Integer: case SerializedPropertyType.LayerMask: case SerializedPropertyType.Enum: case SerializedPropertyType.ArraySize: case SerializedPropertyType.Character: return p.longValue.ToString();
                case SerializedPropertyType.Boolean: return p.boolValue.ToString();
                case SerializedPropertyType.String: return p.stringValue;
                case SerializedPropertyType.Color: return p.colorValue.ToString("F4");
                case SerializedPropertyType.Vector2: case SerializedPropertyType.Vector3: case SerializedPropertyType.Vector4: case SerializedPropertyType.Quaternion: case SerializedPropertyType.Rect: case SerializedPropertyType.Bounds:
                    return null; // children (x/y/z...) are visited individually as Float
                default: return p.propertyType.ToString();
            }
        }
        static void CheckLive(Receipt receipt)
        {
            var root=GameObject.Find(SprintV23.RootName);var rs=root.GetComponentsInChildren<Renderer>(true);
            var flyers=root.GetComponentsInChildren<V23Orbit>(true);receipt.flyers=flyers.Length;float minH=999,minRange=999;
            var range=UnityEngine.Object.FindObjectsByType<PracticeTarget>(FindObjectsSortMode.None).Select(t=>t.transform.position).ToArray();
            foreach(var f in flyers)
            {
                var so=new SerializedObject(f);Vector3 c=so.FindProperty("centre").vector3Value;float r=so.FindProperty("radius").floatValue,h=so.FindProperty("height").floatValue,bob=so.FindProperty("bobMetres").floatValue;
                for(int k=0;k<36;k++)
                {
                    float a=k*10*Mathf.Deg2Rad;var p=c+new Vector3(Mathf.Cos(a)*r,h-bob,Mathf.Sin(a)*r);
                    float g=Physics.Raycast(new Vector3(p.x,200,p.z),Vector3.down,out var hit,400,Physics.DefaultRaycastLayers,QueryTriggerInteraction.Ignore)?hit.point.y:0;
                    minH=Mathf.Min(minH,p.y-g);foreach(var t in range)minRange=Mathf.Min(minRange,Vector2.Distance(new Vector2(p.x,p.z),new Vector2(t.x,t.z)));
                }
            }
            receipt.minFlyerHeightAboveGround=minH;receipt.minFlyerDistanceToRange=minRange;
            receipt.trimRenderers=root.transform.Find("Faction base trims").GetComponentsInChildren<Renderer>().Length;
            Add(receipt,"11 flyers whose full orbits stay >= 12 m above the surface below and >= 30 m from the practice range",flyers.Length==11&&minH>=12f&&minRange>=30f,"min height "+minH.ToString("F1")+" m, min range distance "+minRange.ToString("F1")+" m");
            Add(receipt,"faction trims exist for both bases and the live-battlefield root casts no shadows",receipt.trimRenderers==2&&rs.All(r=>r.shadowCastingMode==UnityEngine.Rendering.ShadowCastingMode.Off),"trim renderers="+receipt.trimRenderers);
            var sun=GameObject.Find("Prototype sun").GetComponent<Light>();
            Add(receipt,"golden-hour lighting applied (sun 21 deg elevation, warm colour; warm fog; v23 sky)",Mathf.Abs(Mathf.DeltaAngle(sun.transform.eulerAngles.x,21))<.5f&&sun.color.b<.6f&&RenderSettings.skybox!=null&&RenderSettings.skybox.name=="V23 golden hour sky","sun "+sun.transform.eulerAngles.ToString("F1"));
        }
        static Dictionary<string,Obj> Outside(Dictionary<string,Obj> s)=>s.Where(kv=>!InTerrain(kv.Key)).ToDictionary(kv=>kv.Key,kv=>kv.Value);
        static List<string> SampleCompoundGround()
        {
            Physics.SyncTransforms();var list=new List<string>();
            foreach(var name in Blocks)
            {
                var roof=GameObject.Find(name+" roof");var rb=roof.GetComponent<Renderer>().bounds;float r=Mathf.Max(rb.extents.x,rb.extents.z);
                for(float x=rb.center.x-r-8;x<=rb.center.x+r+8;x+=1f)for(float z=rb.center.z-r-8;z<=rb.center.z+r+8;z+=1f)
                {
                    if(Mathf.Abs(x-rb.center.x)<=rb.extents.x+.5f&&Mathf.Abs(z-rb.center.z)<=rb.extents.z+.5f)continue;
                    bool hit=Physics.Raycast(new Vector3(x,60,z),Vector3.down,out var h,120,Physics.DefaultRaycastLayers,QueryTriggerInteraction.Ignore);
                    list.Add(hit?PathOf(h.collider.transform)+"@"+h.point.y.ToString("F2"):"none");
                }
            }
            return list;
        }
        struct Sample { public Vector3 point; public float offset,y; public string hit; }
        static List<Sample> SampleRoute()
        {
            Physics.SyncTransforms();var list=new List<Sample>();
            for(int s=0;s<Route.Length-1;s++)
            {
                Vector3 a=Route[s],b=Route[s+1];Vector3 side=Vector3.Cross(Vector3.up,new Vector3(b.x-a.x,0,b.z-a.z).normalized);
                int steps=Mathf.CeilToInt(Vector2.Distance(new Vector2(a.x,a.z),new Vector2(b.x,b.z)));
                for(int i=0;i<steps;i++)for(float off=-12f;off<=12.01f;off+=1.2f)
                {
                    Vector3 p=Vector3.Lerp(a,b,i/(float)steps)+side*off;
                    var hits=Physics.RaycastAll(new Vector3(p.x,60,p.z),Vector3.down,120,Physics.DefaultRaycastLayers,QueryTriggerInteraction.Ignore);
                    var h=hits.OrderBy(x=>x.distance).FirstOrDefault();
                    list.Add(new Sample{point=p,offset=off,y=hits.Length==0?float.NaN:h.point.y,hit=hits.Length==0?"none":PathOf(h.collider.transform)});
                }
            }
            return list;
        }
        static List<Cover> SampleCover()
        {
            Physics.SyncTransforms();var list=new List<Cover>();
            for(int s=0;s<Route.Length-1;s++)
            {
                Vector3 a=Route[s],b=Route[s+1];Vector3 side=Vector3.Cross(Vector3.up,new Vector3(b.x-a.x,0,b.z-a.z).normalized);
                for(float t=0;t<1;t+=.2f)foreach(float dir in new[]{-1f,1f})foreach(float hgt in new[]{1f,2.5f})
                {
                    Vector3 o=Vector3.Lerp(a,b,t)+Vector3.up*hgt;
                    bool hit=Physics.Raycast(o,side*dir,out var h,25,Physics.DefaultRaycastLayers,QueryTriggerInteraction.Ignore);
                    list.Add(new Cover{origin=o,side=dir,height=hgt,v13=hit?h.distance:25,v13Hit=hit?PathOf(h.collider.transform):"none"});
                }
            }
            return list;
        }
    }
}
#endif

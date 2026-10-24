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
    /// Saved-scene v15 vs v16 comparison (structure of SprintV14/V15Validation). Proves the v16 change is confined to the
    /// new player-HUD subtree under the pilot and the enable flags of the original debug readout / target-label renderers;
    /// route corridor and margins, ground around the compounds and lateral cover are identical; the HUD is fully wired.
    /// Read-only for all scenes (hashes checked before/after).
    /// </summary>
    public static class SprintV16Validation
    {
        static string TerrainPath="(set from the saved v16 HUD)";
        [Serializable] public class Check { public string name; public bool passed; public string detail; }
        [Serializable] public class Inventory { public string scene; public int renderers,enabledRenderers,colliders,enabledColliders,meshColliders,uniqueMaterials,textures; public long enabledTriangles; }
        [Serializable] public class Cover { public Vector3 origin; public float side,height,v13,v14; public string v13Hit,v14Hit; }
        [Serializable] public class Receipt
        {
            public string utc,v13SHA256,v14SHA256,v15SHA256,v16SHA256,hudPath,failure; public bool passed; public int debugRendererFlags;
            public List<Check> checks=new List<Check>();
            public Inventory v15,v16;
            public int corridorSamples,corridorDifferences,marginSamples,marginTerrainDifferences,marginOtherDifferences,coverSamples,coverChanged,groundSamples,groundDifferences,features,featuresInside;
            public float maxMarginTerrainDelta,maxEmergentRise; public int marginTerrainEmergent;
            public List<Cover> coverChanges=new List<Cover>();
            public List<string> differences=new List<string>();
            public string method="Opens saved v15 then v16 in the Editor (no Play Mode, no saves). Objects are matched by name path plus occurrence ordinal so added roots cannot mask changes. Serialized fields are compared through SerializedProperty values, object references by scene path or asset path. Collision uses edit-mode Physics raycasts against saved colliders; route corridor = v13 route profile at +/-5.4 m (8.8 m deck plus margin), margin band = 5.4-12 m; cover = horizontal rays at 1.0 m and 2.5 m above the route surface out to 25 m; compound ground = downward rays every 1 m within 8 m around each roof footprint, outside it.";
        }
        static readonly Vector3[] Route={new Vector3(-18,.35f,8),new Vector3(-18,5.35f,28),new Vector3(-10,10.35f,46),new Vector3(-2,14.35f,64),new Vector3(-2,14.35f,72)};
        public static void Validate()
        {
            var receipt=new Receipt{utc=DateTime.UtcNow.ToString("o")};
            try
            {
                receipt.v13SHA256=SprintV13Capture.Hash(SprintV13.ScenePath);receipt.v14SHA256=SprintV13Capture.Hash(SprintV14.ScenePath);receipt.v15SHA256=SprintV13Capture.Hash(SprintV15.ScenePath);receipt.v16SHA256=SprintV13Capture.Hash(SprintV16.ScenePath);
                Add(receipt,"v13 scene hash matches the v13 handoff",receipt.v13SHA256=="077bd43b9bcaccd51a68e5d353b23cb2c701c7003c8eb21ea3c46c5ddd89aa80",receipt.v13SHA256);
                Add(receipt,"v14 scene hash matches the v14 receipt",receipt.v14SHA256=="450e21bf020bb2f579cfb468b1589909ea7ca43430be64e1dd31deb5333ec80a",receipt.v14SHA256);
                Add(receipt,"v15 scene hash matches the v15 receipt",receipt.v15SHA256=="c5389bcadfe4e0b98003a82be080b547969a8d79b92b2842e03feef086973841",receipt.v15SHA256);
                Add(receipt,"v16 is a separate saved scene",new[]{receipt.v13SHA256,receipt.v14SHA256,receipt.v15SHA256}.All(h=>h!=receipt.v16SHA256),receipt.v16SHA256);

                EditorSceneManager.OpenScene(SprintV16.ScenePath,OpenSceneMode.Single);
                var hudNow=UnityEngine.Object.FindFirstObjectByType<V16PlayerHud>();if(hudNow==null)throw new InvalidOperationException("v16 HUD missing");
                TerrainPath=PathOf(hudNow.transform);receipt.hudPath=TerrainPath;CheckHud(receipt);
                EditorSceneManager.OpenScene(SprintV15.ScenePath,OpenSceneMode.Single);
                var a=Snapshot(out receipt.v15);var aRoute=SampleRoute();var aGround=SampleCompoundGround();
                EditorSceneManager.OpenScene(SprintV16.ScenePath,OpenSceneMode.Single);
                var b=Snapshot(out receipt.v16);var bRoute=SampleRoute();var bGround=SampleCompoundGround();

                var outside=a.Keys.Where(k=>!InTerrain(k)).ToList();
                var missing=outside.Where(k=>!b.ContainsKey(k)).ToList();var extra=b.Keys.Where(k=>!InTerrain(k)&&!a.ContainsKey(k)).ToList();
                Add(receipt,"every object outside the new HUD subtree exists in both scenes",missing.Count==0&&extra.Count==0,"missing="+missing.Count+" extra="+extra.Count+" "+string.Join(";",missing.Concat(extra).Take(8)));
                int objectDiffs=0,fieldDiffs=0,rockSlotOnly=0;
                foreach(var k in outside.Where(b.ContainsKey))
                {
                    var x=a[k];var y=b[k];
                    if(x.header!=y.header){objectDiffs++;Diff(receipt,k+" header "+x.header+" -> "+y.header);}
                    foreach(var f in x.fields)
                    {
                        y.fields.TryGetValue(f.Key,out var other);
                        if(other==f.Value)continue;
                        if(IsDebugFlag(k,f.Key,f.Value,other)){rockSlotOnly++;continue;}
                        fieldDiffs++;Diff(receipt,k+" "+f.Key+": "+f.Value+" -> "+other);
                    }
                    foreach(var f in y.fields.Keys.Where(z=>!x.fields.ContainsKey(z))){fieldDiffs++;Diff(receipt,k+" new field "+f);}
                }
                Add(receipt,"transforms, active states and component lists outside the new HUD are identical",objectDiffs==0,"differences="+objectDiffs);
                Add(receipt,"all serialized fields outside the new HUD are identical except the 11 debug renderer enable flags",fieldDiffs==0&&rockSlotOnly==11,"other differences="+fieldDiffs+", debug renderer flags changed="+rockSlotOnly);
                Add(receipt,"gameplay components (pilot, weapon, targets, capture zones, recovery, cockpit readout) retained",
                    new[]{"QuestPilotControls","QuestPracticeWeapon","PracticeTarget","CaptureZone","CaptureZoneVisuals","CanyonFallRecovery","CaptureCockpitReadout","QuestCockpitRig"}
                    .All(t=>Count(a,t)==Count(b,t))&&new[]{"QuestPilotControls","QuestPracticeWeapon","PracticeTarget","CaptureZone"}.All(t=>Count(b,t)>0),string.Join(",",new[]{"QuestPilotControls","QuestPracticeWeapon","PracticeTarget","CaptureZone"}.Select(t=>t+"="+Count(b,t))));
                Add(receipt,"debug readout and target-label objects and scripts all retained (only renderer flags differ)",Count(a,"TextMesh")==Count(Outside(b),"TextMesh")&&Count(a,"CaptureCockpitReadout")==Count(b,"CaptureCockpitReadout")&&fieldDiffs==0,"TextMesh outside HUD="+Count(Outside(b),"TextMesh"));
                var added=b.Where(kv=>InTerrain(kv.Key)).ToList();
                Add(receipt,"HUD subtree adds no colliders (cannot affect movement, cover or shots)",added.Count>0&&added.All(kv=>!kv.Value.header.Contains("Collider")),"objects="+added.Count);
                Add(receipt,"new HUD materials live only in SprintAssets/v16 (font/label material reused)",added.SelectMany(kv=>kv.Value.fields).Where(f=>f.Value.StartsWith("asset:Assets/")&&f.Value.Contains(".mat:")).All(f=>f.Value.Contains("SprintAssets/v16/")||f.Value.Contains("World labels.mat")),"");
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
                EditorSceneManager.OpenScene(SprintV15.ScenePath,OpenSceneMode.Single);var ca=SampleCover();
                EditorSceneManager.OpenScene(SprintV16.ScenePath,OpenSceneMode.Single);var cb=SampleCover();
                bool coverSafe=true;
                for(int i=0;i<ca.Count;i++)
                {
                    receipt.coverSamples++;var c=ca[i];c.v14=cb[i].v13;c.v14Hit=cb[i].v13Hit;
                    if(Mathf.Abs(c.v13-c.v14)>.05f||c.v13Hit!=c.v14Hit){receipt.coverChanged++;if(receipt.coverChanges.Count<60)receipt.coverChanges.Add(c);}
                    if(c.v14<4.4f&&Mathf.Abs(c.v13-c.v14)>.05f)coverSafe=false;
                }
                Add(receipt,"all lateral cover rays along the route are identical",receipt.coverChanged==0&&coverSafe,"changedRays="+receipt.coverChanged+"/"+receipt.coverSamples);
                Add(receipt,"saved scenes unchanged by validation",receipt.v13SHA256==SprintV13Capture.Hash(SprintV13.ScenePath)&&receipt.v14SHA256==SprintV13Capture.Hash(SprintV14.ScenePath)&&receipt.v15SHA256==SprintV13Capture.Hash(SprintV15.ScenePath)&&receipt.v16SHA256==SprintV13Capture.Hash(SprintV16.ScenePath),"");
                receipt.passed=receipt.checks.All(c=>c.passed);
            }
            catch(Exception e){receipt.failure=e.ToString();receipt.passed=false;}
            File.WriteAllText(Path.Combine(SprintV16.Evidence,"saved-v16-validation.json"),JsonUtility.ToJson(receipt,true));
            Debug.Log("VESPER_V16_VALIDATION "+receipt.passed+" checks="+receipt.checks.Count(c=>c.passed)+"/"+receipt.checks.Count);
            if(!receipt.passed)throw new InvalidOperationException("v16 validation failed "+receipt.failure);
        }
        static void Add(Receipt r,string name,bool ok,string detail)=>r.checks.Add(new Check{name=name,passed=ok,detail=detail});
        static void Diff(Receipt r,string s){if(r.differences.Count<120)r.differences.Add(s);}
        static bool InTerrain(string key)=>key==TerrainPath+"#0"||key.StartsWith(TerrainPath+"/",StringComparison.Ordinal);
        static int Count(Dictionary<string,Obj> s,string type)=>s.Values.Sum(o=>o.header.Split('|').Count(t=>t==type));
        static readonly string[] Blocks={"Northeast service block","Northwest comms block","Southeast logistics block","Southwest loading block"};
        static Dictionary<string,Obj> Outside(Dictionary<string,Obj> s)=>s.Where(kv=>!InTerrain(kv.Key)).ToDictionary(kv=>kv.Key,kv=>kv.Value);
        static readonly HashSet<string> debugKeys=new HashSet<string>();
        static bool IsDebugFlag(string key,string field,string before,string after)=>debugKeys.Contains(key)&&field.EndsWith("Renderer.m_Enabled")&&before=="True"&&after=="False"; // SerializedProperty booleans print as True/False
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
        static void CheckHud(Receipt receipt)
        {
            var hud=UnityEngine.Object.FindFirstObjectByType<V16PlayerHud>();var so=new SerializedObject(hud);
            bool wired=new[]{"pilot","weapon","zone","objectiveLine","weaponLine","hintLine","progressPivot","progressFill"}.All(n=>so.FindProperty(n).objectReferenceValue!=null);
            Add(receipt,"player HUD is wired to the live pilot, weapon, zone, lines and progress bar",wired,"");
            Add(receipt,"saved presentation is player mode (debug flag off)",!so.FindProperty("debugMode").boolValue,"");
            var player=hud.PlayerRenderers;var debug=hud.DebugRenderers;
            Add(receipt,"all player HUD renderers enabled and all 11 debug renderers disabled in the saved scene",player.Length==7&&player.All(r=>r&&r.enabled)&&debug.Length==11&&debug.All(r=>r&&!r.enabled),"player="+player.Length+" debug="+debug.Length);
            debugKeys.Clear();foreach(var r in debug)debugKeys.Add(PathOf(r.transform)+"#0");
            receipt.debugRendererFlags=debug.Length;
            Add(receipt,"debug renderers are exactly the 8 cockpit readout panels/labels and the 3 target labels",debug.Count(r=>r.GetComponentInParent<CaptureCockpitReadout>()!=null)==8&&debug.Count(r=>r.GetComponentInParent<PracticeTarget>()!=null)==3&&debugKeys.Count==11,"");
        }
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

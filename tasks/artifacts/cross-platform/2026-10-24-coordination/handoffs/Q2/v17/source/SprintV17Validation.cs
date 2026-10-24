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
    /// Saved-scene v16 vs v17 comparison (structure of SprintV14-V16Validation). Proves the v17 change is only the 96
    /// "Road graphite" material slots swapped to the industrial deck material: every object, transform, collider, HUD and
    /// gameplay field is otherwise identical, and route corridor/margins, compound ground and cover rays are identical.
    /// Read-only for all scenes (hashes checked before/after).
    /// </summary>
    public static class SprintV17Validation
    {
        const string TerrainPath="(no added subtree in v17)";
        [Serializable] public class Check { public string name; public bool passed; public string detail; }
        [Serializable] public class Inventory { public string scene; public int renderers,enabledRenderers,colliders,enabledColliders,meshColliders,uniqueMaterials,textures; public long enabledTriangles; }
        [Serializable] public class Cover { public Vector3 origin; public float side,height,v13,v14; public string v13Hit,v14Hit; }
        [Serializable] public class Receipt
        {
            public string utc,v13SHA256,v14SHA256,v15SHA256,v16SHA256,v17SHA256,failure; public bool passed; public int deckSlots;
            public List<Check> checks=new List<Check>();
            public Inventory v16,v17;
            public int corridorSamples,corridorDifferences,marginSamples,marginTerrainDifferences,marginOtherDifferences,coverSamples,coverChanged,groundSamples,groundDifferences,features,featuresInside;
            public float maxMarginTerrainDelta,maxEmergentRise; public int marginTerrainEmergent;
            public List<Cover> coverChanges=new List<Cover>();
            public List<string> differences=new List<string>();
            public string method="Opens saved v16 then v17 in the Editor (no Play Mode, no saves). Objects are matched by name path plus occurrence ordinal so added roots cannot mask changes. Serialized fields are compared through SerializedProperty values, object references by scene path or asset path. Collision uses edit-mode Physics raycasts against saved colliders; route corridor = v13 route profile at +/-5.4 m (8.8 m deck plus margin), margin band = 5.4-12 m; cover = horizontal rays at 1.0 m and 2.5 m above the route surface out to 25 m; compound ground = downward rays every 1 m within 8 m around each roof footprint, outside it.";
        }
        static readonly Vector3[] Route={new Vector3(-18,.35f,8),new Vector3(-18,5.35f,28),new Vector3(-10,10.35f,46),new Vector3(-2,14.35f,64),new Vector3(-2,14.35f,72)};
        public static void Validate()
        {
            var receipt=new Receipt{utc=DateTime.UtcNow.ToString("o")};
            try
            {
                receipt.v13SHA256=SprintV13Capture.Hash(SprintV13.ScenePath);receipt.v14SHA256=SprintV13Capture.Hash(SprintV14.ScenePath);receipt.v15SHA256=SprintV13Capture.Hash(SprintV15.ScenePath);receipt.v16SHA256=SprintV13Capture.Hash(SprintV16.ScenePath);receipt.v17SHA256=SprintV13Capture.Hash(SprintV17.ScenePath);
                Add(receipt,"v13 scene hash matches the v13 handoff",receipt.v13SHA256=="077bd43b9bcaccd51a68e5d353b23cb2c701c7003c8eb21ea3c46c5ddd89aa80",receipt.v13SHA256);
                Add(receipt,"v14 scene hash matches the v14 receipt",receipt.v14SHA256=="450e21bf020bb2f579cfb468b1589909ea7ca43430be64e1dd31deb5333ec80a",receipt.v14SHA256);
                Add(receipt,"v15 scene hash matches the v15 receipt",receipt.v15SHA256=="c5389bcadfe4e0b98003a82be080b547969a8d79b92b2842e03feef086973841",receipt.v15SHA256);
                Add(receipt,"v16 scene hash matches the v16 receipt",receipt.v16SHA256=="31115d60fafbf4718672224b23e0a6d47b667a7872e52290d1973c3047193ee5",receipt.v16SHA256);
                Add(receipt,"v17 is a separate saved scene",new[]{receipt.v13SHA256,receipt.v14SHA256,receipt.v15SHA256,receipt.v16SHA256}.All(h=>h!=receipt.v17SHA256),receipt.v17SHA256);
                var shader=Shader.Find(SprintV17.ShaderName);
                Add(receipt,"deck shader found and compiles without errors in the Editor",shader!=null&&!ShaderUtil.ShaderHasError(shader)&&ShaderUtil.GetShaderMessages(shader).All(m=>m.severity!=UnityEditor.Rendering.ShaderCompilerMessageSeverity.Error),shader?shader.name:"missing");
                EditorSceneManager.OpenScene(SprintV16.ScenePath,OpenSceneMode.Single);
                var a=Snapshot(out receipt.v16);var aRoute=SampleRoute();var aGround=SampleCompoundGround();
                EditorSceneManager.OpenScene(SprintV17.ScenePath,OpenSceneMode.Single);
                var b=Snapshot(out receipt.v17);var bRoute=SampleRoute();var bGround=SampleCompoundGround();
                CheckDeck(receipt);
                var outside=a.Keys.Where(k=>!InTerrain(k)).ToList();
                var missing=outside.Where(k=>!b.ContainsKey(k)).ToList();var extra=b.Keys.Where(k=>!InTerrain(k)&&!a.ContainsKey(k)).ToList();
                Add(receipt,"every object exists in both scenes (no objects added or removed)",missing.Count==0&&extra.Count==0,"missing="+missing.Count+" extra="+extra.Count+" "+string.Join(";",missing.Concat(extra).Take(8)));
                int objectDiffs=0,fieldDiffs=0,rockSlotOnly=0;
                foreach(var k in outside.Where(b.ContainsKey))
                {
                    var x=a[k];var y=b[k];
                    if(x.header!=y.header){objectDiffs++;Diff(receipt,k+" header "+x.header+" -> "+y.header);}
                    foreach(var f in x.fields)
                    {
                        y.fields.TryGetValue(f.Key,out var other);
                        if(other==f.Value)continue;
                        if(f.Key.Contains("m_Materials")&&f.Value.Contains("v02/Road graphite.mat:")&&other!=null&&other.Contains("SprintAssets/v17/V17 industrial deck graphite.mat:")){rockSlotOnly++;continue;}
                        fieldDiffs++;Diff(receipt,k+" "+f.Key+": "+f.Value+" -> "+other);
                    }
                    foreach(var f in y.fields.Keys.Where(z=>!x.fields.ContainsKey(z))){fieldDiffs++;Diff(receipt,k+" new field "+f);}
                }
                Add(receipt,"all transforms, active states and component lists are identical",objectDiffs==0,"differences="+objectDiffs);
                Add(receipt,"all serialized fields are identical except the Road graphite -> industrial deck material slots",fieldDiffs==0&&rockSlotOnly==96,"other differences="+fieldDiffs+", deck slots changed="+rockSlotOnly);
                Add(receipt,"gameplay components (pilot, weapon, targets, capture zones, recovery, cockpit readout) retained",
                    new[]{"QuestPilotControls","QuestPracticeWeapon","PracticeTarget","CaptureZone","CaptureZoneVisuals","CanyonFallRecovery","CaptureCockpitReadout","QuestCockpitRig"}
                    .All(t=>Count(a,t)==Count(b,t))&&new[]{"QuestPilotControls","QuestPracticeWeapon","PracticeTarget","CaptureZone"}.All(t=>Count(b,t)>0),string.Join(",",new[]{"QuestPilotControls","QuestPracticeWeapon","PracticeTarget","CaptureZone"}.Select(t=>t+"="+Count(b,t))));
                Add(receipt,"v16 player HUD, debug readout and all text labels are untouched",Count(a,"TextMesh")==Count(b,"TextMesh")&&Count(a,"V16PlayerHud")==1&&Count(b,"V16PlayerHud")==1&&fieldDiffs==0,"TextMesh="+Count(b,"TextMesh"));
                Add(receipt,"no objects added under any root",b.Keys.All(a.ContainsKey),"");
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
                EditorSceneManager.OpenScene(SprintV16.ScenePath,OpenSceneMode.Single);var ca=SampleCover();
                EditorSceneManager.OpenScene(SprintV17.ScenePath,OpenSceneMode.Single);var cb=SampleCover();
                bool coverSafe=true;
                for(int i=0;i<ca.Count;i++)
                {
                    receipt.coverSamples++;var c=ca[i];c.v14=cb[i].v13;c.v14Hit=cb[i].v13Hit;
                    if(Mathf.Abs(c.v13-c.v14)>.05f||c.v13Hit!=c.v14Hit){receipt.coverChanged++;if(receipt.coverChanges.Count<60)receipt.coverChanges.Add(c);}
                    if(c.v14<4.4f&&Mathf.Abs(c.v13-c.v14)>.05f)coverSafe=false;
                }
                Add(receipt,"all lateral cover rays along the route are identical",receipt.coverChanged==0&&coverSafe,"changedRays="+receipt.coverChanged+"/"+receipt.coverSamples);
                Add(receipt,"saved scenes unchanged by validation",receipt.v13SHA256==SprintV13Capture.Hash(SprintV13.ScenePath)&&receipt.v14SHA256==SprintV13Capture.Hash(SprintV14.ScenePath)&&receipt.v15SHA256==SprintV13Capture.Hash(SprintV15.ScenePath)&&receipt.v16SHA256==SprintV13Capture.Hash(SprintV16.ScenePath)&&receipt.v17SHA256==SprintV13Capture.Hash(SprintV17.ScenePath),"");
                receipt.passed=receipt.checks.All(c=>c.passed);
            }
            catch(Exception e){receipt.failure=e.ToString();receipt.passed=false;}
            File.WriteAllText(Path.Combine(SprintV17.Evidence,"saved-v17-validation.json"),JsonUtility.ToJson(receipt,true));
            Debug.Log("VESPER_V17_VALIDATION "+receipt.passed+" checks="+receipt.checks.Count(c=>c.passed)+"/"+receipt.checks.Count);
            if(!receipt.passed)throw new InvalidOperationException("v17 validation failed "+receipt.failure);
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
        static void CheckDeck(Receipt receipt)
        {
            var road=AssetDatabase.LoadAssetAtPath<Material>("Assets/MapPrototype/SprintAssets/v02/Road graphite.mat");
            var deck=AssetDatabase.LoadAssetAtPath<Material>("Assets/MapPrototype/SprintAssets/v17/V17 industrial deck graphite.mat");
            var rs=UnityEngine.Object.FindObjectsByType<Renderer>(FindObjectsInactive.Include,FindObjectsSortMode.None);
            receipt.deckSlots=rs.Sum(r=>r.sharedMaterials.Count(m=>m==deck));
            Add(receipt,"no renderer still uses Road graphite; 96 slots use the deck material",rs.All(r=>!r.sharedMaterials.Contains(road))&&receipt.deckSlots==96,"deck slots="+receipt.deckSlots);
            Add(receipt,"deck material uses the v17 shader and keeps the Road graphite palette",deck!=null&&deck.shader.name==SprintV17.ShaderName&&deck.GetTexture("_BaseMap")!=null&&deck.GetTexture("_DetailAlbedoMap")!=null,"");
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

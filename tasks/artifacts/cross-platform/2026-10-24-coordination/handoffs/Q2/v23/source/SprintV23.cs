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
    /// v23 Live Battlefield (from TJ-accepted v22): one coherent pass on the next-largest concept gaps —
    ///  1. faction bases: emissive trim traced from each red/blue base structure's real top outline, and rear shield arcs
    ///     with pylons behind each base (outside the spawn view),
    ///  2. aerial life: animated drone swarms over E Drone Readiness and B Repair, two patrol craft circling the canyon,
    ///  3. golden-hour atmosphere: lower warm sun, warmer ambient and haze, new warm sky.
    /// Additions are render-only (no colliders, no shadows from the new root). Lighting changes only the sun light/transform
    /// and RenderSettings. Saves a NEW scene; v13-v22 scenes, Codex outputs, v12 and the main project are never written.
    /// </summary>
    public static class SprintV23
    {
        public const string SourceScene="Assets/MapPrototype/Scenes/VesperBasin_v22_ConceptLayer.unity";
        public const string SourceSHA256="cfb821944a0bb1e2376a5aa27613e5613142088330ca8f974863795b46d85c41";
        public const string ScenePath="Assets/MapPrototype/Scenes/VesperBasin_v23_LiveBattlefield.unity";
        public const string AssetRoot="Assets/MapPrototype/SprintAssets/v23";
        public const string Evidence="/Users/tim/Code/fhfhockey.com/tasks/artifacts/cross-platform/2026-10-24-coordination/handoffs/Q2/v23/evidence";
        public const string RootName="V23 Live battlefield";
        [Serializable] public class Receipt
        {
            public string scene,source,sourceSHA256,utc; public int renderers,colliders,triangles,trimStructures,trimSegments,flyers;
            public Vector3 sunEulerBefore,sunEulerAfter; public Color sunColorBefore,sunColorAfter,fogBefore,fogAfter; public float sunIntensityBefore,sunIntensityAfter,fogStartBefore,fogStartAfter,fogEndBefore,fogEndAfter;
            public List<string> trimmed=new List<string>();
            public string note="v22 preserved and read-only. v23 adds one render-only root (faction trims, shield arcs, flyers) and changes only the sun light/transform plus RenderSettings ambient/fog/skybox. No collider, gameplay, HUD, rig, eye or scale change. No Scout import, package, project-settings or main-project change.";
        }
        static Material Unlit(string name,Color c,bool transparent=false,Texture tex=null)
        {
            string path=AssetRoot+"/"+name+".mat";var m=AssetDatabase.LoadAssetAtPath<Material>(path);
            if(m==null){m=new Material(Shader.Find("Universal Render Pipeline/Unlit")){name=name};AssetDatabase.CreateAsset(m,path);}
            m.SetColor("_BaseColor",c);if(tex){m.SetTexture("_BaseMap",tex);}
            if(transparent)
            {
                m.SetFloat("_Surface",1);m.SetFloat("_Blend",0);m.SetFloat("_SrcBlend",(float)BlendMode.SrcAlpha);m.SetFloat("_DstBlend",(float)BlendMode.OneMinusSrcAlpha);
                m.SetFloat("_SrcBlendAlpha",1);m.SetFloat("_DstBlendAlpha",(float)BlendMode.OneMinusSrcAlpha);m.SetFloat("_ZWrite",0);m.SetFloat("_Cull",0);
                m.EnableKeyword("_SURFACE_TYPE_TRANSPARENT");m.renderQueue=(int)RenderQueue.Transparent;m.SetOverrideTag("RenderType","Transparent");
            }
            m.enableInstancing=true;EditorUtility.SetDirty(m);return m;
        }
        static Material Lit(string name,Color c,float smooth=.35f,float metal=.5f,Color? emission=null)
        {
            string path=AssetRoot+"/"+name+".mat";var m=AssetDatabase.LoadAssetAtPath<Material>(path);
            if(m==null){m=new Material(Shader.Find("Universal Render Pipeline/Lit")){name=name};AssetDatabase.CreateAsset(m,path);}
            m.SetColor("_BaseColor",c);m.SetFloat("_Smoothness",smooth);m.SetFloat("_Metallic",metal);
            if(emission.HasValue){m.EnableKeyword("_EMISSION");m.SetColor("_EmissionColor",emission.Value);m.globalIlluminationFlags=MaterialGlobalIlluminationFlags.None;}
            m.enableInstancing=true;EditorUtility.SetDirty(m);return m;
        }
        public static void BuildAndCapture(){Build();SprintV23Capture.Run();}
        public static void Build()
        {
            if(File.Exists(ScenePath))throw new InvalidOperationException("v23 scene already exists; refusing to overwrite "+ScenePath);
            if(SprintV13Capture.Hash(SourceScene)!=SourceSHA256)throw new InvalidOperationException("v22 source hash differs from the accepted receipt");
            var protectedScenes=Directory.GetFiles("Assets/MapPrototype/Scenes","VesperBasin_v*.unity").Select(p=>p.Replace('\\','/')).OrderBy(p=>p).ToArray();var before=protectedScenes.Select(SprintV13Capture.Hash).ToArray();
            Directory.CreateDirectory(AssetRoot+"/Meshes");Directory.CreateDirectory(Evidence);AssetDatabase.Refresh();
            var receipt=new Receipt{scene=ScenePath,source=SourceScene,sourceSHA256=SourceSHA256,utc=DateTime.UtcNow.ToString("o")};
            EditorSceneManager.OpenScene(SourceScene,OpenSceneMode.Single);Physics.SyncTransforms();
            var root=new GameObject(RootName).transform;
            FactionBases(root,receipt);
            Flyers(root,receipt);
            GoldenHour(receipt);
            foreach(var r in root.GetComponentsInChildren<Renderer>(true)){r.shadowCastingMode=ShadowCastingMode.Off;r.receiveShadows=false;}
            receipt.renderers=root.GetComponentsInChildren<Renderer>(true).Length;receipt.colliders=root.GetComponentsInChildren<Collider>(true).Length;
            receipt.triangles=root.GetComponentsInChildren<MeshFilter>(true).Where(f=>f.sharedMesh).Sum(f=>Enumerable.Range(0,f.sharedMesh.subMeshCount).Sum(i=>(int)f.sharedMesh.GetIndexCount(i)/3));
            if(receipt.colliders!=0)throw new InvalidOperationException("v23 must not add colliders");
            EditorSceneManager.SaveScene(UnityEngine.SceneManagement.SceneManager.GetActiveScene(),ScenePath,true);AssetDatabase.SaveAssets();
            if(!protectedScenes.Select(SprintV13Capture.Hash).SequenceEqual(before))throw new InvalidOperationException("an existing scene changed during the v23 build");
            File.WriteAllText(Path.Combine(Evidence,"v23-build.json"),JsonUtility.ToJson(receipt,true));
            Debug.Log("VESPER_V23_BUILT "+ScenePath+" renderers="+receipt.renderers+" trims="+receipt.trimSegments+" flyers="+receipt.flyers);
        }
        // ---------- 1. Faction bases ----------
        static void FactionBases(Transform root,Receipt receipt)
        {
            var red=Unlit("V23 red faction trim",new Color(1f,.18f,.14f));var blue=Unlit("V23 blue faction trim",new Color(.2f,.55f,1f));
            var trims=new Dictionary<bool,List<(Mesh,Matrix4x4,int)>>{{true,new List<(Mesh,Matrix4x4,int)>()},{false,new List<(Mesh,Matrix4x4,int)>()}};
            foreach(var r in UnityEngine.Object.FindObjectsByType<Renderer>(FindObjectsSortMode.None).OrderBy(x=>SprintV13Survey.Key(x.transform)))
            {
                bool isRed=r.sharedMaterials.Any(m=>m&&(m.name=="Red base armor"||m.name=="Red base enamel")),isBlue=r.sharedMaterials.Any(m=>m&&(m.name=="Blue base armor"||m.name=="Blue base enamel"));
                if(!(isRed||isBlue)||!r.enabled||!r.gameObject.activeInHierarchy)continue;var b=r.bounds;if(b.size.y<4f||Mathf.Abs(b.center.x)<80f)continue; // base structures only
                var mf=r.GetComponent<MeshFilter>();if(mf==null||mf.sharedMesh==null)continue;
                var top=mf.sharedMesh.vertices.Select(v=>r.transform.TransformPoint(v)).Where(p=>p.y>=b.max.y-.04f*b.size.y).ToList();
                var hull=Hull(top.Select(p=>new Vector2(p.x,p.z)).ToList());if(hull.Count<3)continue;
                float y=top.Max(p=>p.y)+.025f;var c=new Vector2(hull.Average(p=>p.x),hull.Average(p=>p.y));
                for(int i=0;i<hull.Count;i++)
                {
                    Vector2 a=hull[i],e=hull[(i+1)%hull.Count];if((e-a).magnitude<.4f)continue;
                    Vector2 out0=(a-c).normalized*.04f,out1=(e-c).normalized*.04f;Vector3 A=new Vector3(a.x+out0.x,y,a.y+out0.y),E=new Vector3(e.x+out1.x,y,e.y+out1.y);
                    trims[isRed].Add((Cube,Matrix4x4.TRS((A+E)*.5f,Quaternion.LookRotation((E-A).normalized,Vector3.up),new Vector3(.22f,.12f,(E-A).magnitude)),0));receipt.trimSegments++;
                }
                receipt.trimStructures++;receipt.trimmed.Add(SprintV13Survey.Key(r.transform));
            }
            var g=new GameObject("Faction base trims").transform;g.SetParent(root,false);
            foreach(var kv in trims)if(kv.Value.Count>0)Renderer(g,kv.Key?"Red faction trim":"Blue faction trim",Combine("V23 "+(kv.Key?"red":"blue")+" faction trim",kv.Value),kv.Key?red:blue);
            // Rear shield arcs: translucent hex-grid curtain behind each base, facing away from the battlefield.
            var grid=HexGridTexture();
            foreach(float side in new[]{-1f,1f})
            {
                bool isRed=side<0;Color fc=isRed?new Color(1f,.25f,.2f):new Color(.25f,.6f,1f);
                var shield=Unlit("V23 "+(isRed?"red":"blue")+" shield field",new Color(fc.r,fc.g,fc.b,.42f),true,grid);shield.SetTextureScale("_BaseMap",new Vector2(10,3));
                var pylonM=Lit("V23 "+(isRed?"red":"blue")+" shield pylon",new Color(.16f,.18f,.21f),.4f,.6f,new Color(fc.r*2.2f,fc.g*2.2f,fc.b*2.2f));
                Vector3 centre=new Vector3(side*104,0,0);float R=25f,H=15f;float facing=isRed?180f:0f; // outward
                var arcRoot=new GameObject((isRed?"Red":"Blue")+" rear shield arc").transform;arcRoot.SetParent(root,false);
                Renderer(arcRoot,"Shield field",Arc(isRed?"V23 red shield arc":"V23 blue shield arc",centre,R,H,facing,130f,-1.5f),shield);
                var pylons=new List<(Mesh,Matrix4x4,int)>();
                foreach(float da in new[]{-65f,-22f,22f,65f})
                {
                    float a=(facing+da)*Mathf.Deg2Rad;var p=centre+new Vector3(Mathf.Cos(a)*R,0,Mathf.Sin(a)*R);p.y=GroundY(p)-1.5f;
                    pylons.Add((Cube,Matrix4x4.TRS(p+Vector3.up*(H*.5f+1f),Quaternion.Euler(0,-(facing+da),0),new Vector3(1.1f,H+2.5f,1.1f)),0));
                    pylons.Add((Cube,Matrix4x4.TRS(p+Vector3.up*(H+2.6f),Quaternion.identity,new Vector3(1.8f,.6f,1.8f)),0));
                }
                Renderer(arcRoot,"Shield pylons",Combine("V23 "+(isRed?"red":"blue")+" shield pylons",pylons),pylonM);
            }
        }
        static Mesh Arc(string name,Vector3 c,float R,float H,float facingDeg,float spanDeg,float sink)
        {
            var v=new List<Vector3>();var uv=new List<Vector2>();var t=new List<int>();int n=40;
            for(int i=0;i<=n;i++)
            {
                float a=(facingDeg-spanDeg*.5f+spanDeg*i/n)*Mathf.Deg2Rad;var p=c+new Vector3(Mathf.Cos(a)*R,0,Mathf.Sin(a)*R);float gy=GroundY(p)+sink;
                v.Add(new Vector3(p.x,gy,p.z));v.Add(new Vector3(p.x,gy+H-sink,p.z));uv.Add(new Vector2(i/(float)n,0));uv.Add(new Vector2(i/(float)n,1));
                if(i<n){int k=i*2;t.AddRange(new[]{k,k+1,k+3,k,k+3,k+2});}
            }
            var m=new Mesh{name=name};m.SetVertices(v);m.SetUVs(0,uv);m.SetTriangles(t,0);m.RecalculateNormals();m.RecalculateBounds();return Save(m);
        }
        static Texture2D HexGridTexture()
        {
            string path=AssetRoot+"/V23 shield hex grid.asset";var old=AssetDatabase.LoadAssetAtPath<Texture2D>(path);
            // One tile holds 2 x 2 cells of a hex lattice (points at i + 0.5*(row odd), row*0.866), so it wraps seamlessly.
            const int W=128,H=111;var tex=new Texture2D(W,H,TextureFormat.RGBA32,true,true){name="V23 shield hex grid",wrapMode=TextureWrapMode.Repeat,filterMode=FilterMode.Trilinear};
            var px=new Color[W*H];
            for(int y=0;y<H;y++)for(int x=0;x<W;x++)
            {
                float u=x/(float)W*2f,v=y/(float)H*1.732f;float best=9,second=9;
                for(int j2=-1;j2<=2;j2++)for(int i2=-1;i2<=3;i2++)
                {
                    float d=Vector2.Distance(new Vector2(u,v),new Vector2(i2+((j2&1)==1?.5f:0f),j2*.866f));
                    if(d<best){second=best;best=d;}else if(d<second)second=d;
                }
                float edge=second-best;float a=edge<.07f?1f:Mathf.Lerp(.30f,.07f,Mathf.Clamp01(edge*2.5f));
                px[y*W+x]=new Color(1,1,1,a);
            }
            tex.SetPixels(px);tex.Apply(true,false);
            if(old==null){AssetDatabase.CreateAsset(tex,path);return tex;}EditorUtility.CopySerialized(tex,old);UnityEngine.Object.DestroyImmediate(tex);return old;
        }
        // ---------- 2. Aerial life ----------
        static void Flyers(Transform root,Receipt receipt)
        {
            var body=Lit("V23 flyer graphite",new Color(.14f,.16f,.19f),.45f,.6f);var violet=Lit("V23 drone violet lamp",new Color(.4f,.2f,.6f),.4f,0,new Color(2.4f,1.1f,3.4f));
            var cyan=Lit("V23 drone repair lamp",new Color(.15f,.4f,.6f),.4f,0,new Color(.6f,1.8f,2.6f));var hull=Lit("V23 patrol craft hull",new Color(.30f,.33f,.36f),.4f,.5f);
            var amber=Lit("V23 patrol craft lamps",new Color(.6f,.35f,.1f),.4f,0,new Color(3f,1.6f,.4f));
            var drone=DroneMesh();var craft=CraftMesh();
            var g=new GameObject("Aerial life").transform;g.SetParent(root,false);
            void Fly(string name,Mesh mesh,Material[] mats,Vector3 c,float r,float h,float speed,float phase,float scale)
            {
                var go=new GameObject(name);go.transform.SetParent(g,false);go.transform.localScale=Vector3.one*scale;
                go.AddComponent<MeshFilter>().sharedMesh=mesh;go.AddComponent<MeshRenderer>().sharedMaterials=mats;
                go.AddComponent<V23Orbit>().Configure(c,r,h,speed,phase);receipt.flyers++;
            }
            // Orbits are kept >= 12 m above every surface below and >= 30 m (horizontal) from the practice range.
            for(int i=0;i<6;i++)Fly("E drone "+(i+1),drone,new[]{body,violet},new Vector3(-54,0,-66),9f+(i%3)*4f,24f+(i%2)*6f,(i%2==0?22f:-18f),i*60f,1f);
            for(int i=0;i<3;i++)Fly("B repair drone "+(i+1),drone,new[]{body,cyan},new Vector3(56,0,7),8f+i*3f,26f+i*2f,16f,i*120f,1f);
            Fly("Patrol craft north",craft,new[]{hull,amber},new Vector3(40,0,30),80f,50f,-7f,30f,1f);
            Fly("Patrol craft south",craft,new[]{hull,amber},new Vector3(20,0,-10),60f,44f,8f,210f,1f);
        }
        static Mesh DroneMesh()
        {
            // Quad-rotor ~2.2 m span: graphite body + arms + rotor discs (sub 0), violet/cyan lamp eye and underglow (sub 1).
            var p=new List<(Mesh,Matrix4x4,int)>();
            p.Add((Cube,Matrix4x4.TRS(Vector3.zero,Quaternion.identity,new Vector3(.8f,.32f,1.1f)),0));
            foreach(var d in new[]{new Vector3(1,0,1),new Vector3(-1,0,1),new Vector3(1,0,-1),new Vector3(-1,0,-1)})
            {
                p.Add((Cube,Matrix4x4.TRS(d*.45f,Quaternion.LookRotation(d.normalized),new Vector3(.12f,.1f,1.1f)),0));
                p.Add((Cyl,Matrix4x4.TRS(d*.78f+Vector3.up*.12f,Quaternion.identity,new Vector3(.75f,.02f,.75f)),0));
            }
            p.Add((Cube,Matrix4x4.TRS(new Vector3(0,0,.56f),Quaternion.identity,new Vector3(.45f,.14f,.06f)),1));
            p.Add((Cube,Matrix4x4.TRS(new Vector3(0,-.17f,0),Quaternion.identity,new Vector3(.5f,.03f,.7f)),1));
            return Combine2("V23 recon drone",p);
        }
        static Mesh CraftMesh()
        {
            // VTOL patrol craft ~14 m: fuselage, cockpit, wings, twin engine nacelles, tail; amber nav lamps (sub 1).
            var p=new List<(Mesh,Matrix4x4,int)>();
            p.Add((Cube,Matrix4x4.TRS(Vector3.zero,Quaternion.identity,new Vector3(2.2f,1.8f,11f)),0));
            p.Add((Cube,Matrix4x4.TRS(new Vector3(0,.6f,5.2f),Quaternion.Euler(18,0,0),new Vector3(1.6f,1.1f,2.4f)),0));
            p.Add((Cube,Matrix4x4.TRS(new Vector3(0,.1f,-.5f),Quaternion.identity,new Vector3(13f,.3f,3.2f)),0));
            foreach(float s in new[]{-1f,1f})
            {
                p.Add((Cyl,Matrix4x4.TRS(new Vector3(s*6.2f,.2f,0),Quaternion.Euler(90,0,0),new Vector3(1.5f,2.4f,1.5f)),0));
                p.Add((Cube,Matrix4x4.TRS(new Vector3(s*6.6f,.2f,-.4f),Quaternion.identity,new Vector3(.3f,.3f,.3f)),1));
                p.Add((Cube,Matrix4x4.TRS(new Vector3(s*1.6f,1.6f,-4.8f),Quaternion.Euler(0,0,s*-18),new Vector3(.25f,2.4f,1.8f)),0));
            }
            p.Add((Cube,Matrix4x4.TRS(new Vector3(0,-.95f,1f),Quaternion.identity,new Vector3(.8f,.1f,4f)),1));
            return Combine2("V23 patrol craft",p);
        }
        // ---------- 3. Golden hour ----------
        static void GoldenHour(Receipt receipt)
        {
            var sun=GameObject.Find("Prototype sun").GetComponent<Light>();
            receipt.sunEulerBefore=sun.transform.eulerAngles;receipt.sunColorBefore=sun.color;receipt.sunIntensityBefore=sun.intensity;
            receipt.fogBefore=RenderSettings.fogColor;receipt.fogStartBefore=RenderSettings.fogStartDistance;receipt.fogEndBefore=RenderSettings.fogEndDistance;
            // Sun in the west-south-west: behind the eastward spawn view (no sun in the pilot's face; targets front-lit).
            sun.transform.rotation=Quaternion.Euler(21,68,0);sun.color=new Color(1f,.76f,.52f);sun.intensity=2.3f;
            RenderSettings.ambientMode=AmbientMode.Trilight;
            RenderSettings.ambientSkyColor=new Color(.36f,.42f,.54f);RenderSettings.ambientEquatorColor=new Color(.36f,.29f,.25f);RenderSettings.ambientGroundColor=new Color(.19f,.12f,.08f);
            RenderSettings.fog=true;RenderSettings.fogMode=FogMode.Linear;RenderSettings.fogColor=new Color(.80f,.62f,.50f);RenderSettings.fogStartDistance=150;RenderSettings.fogEndDistance=540;
            string path=AssetRoot+"/V23 golden hour sky.mat";var sky=AssetDatabase.LoadAssetAtPath<Material>(path);
            if(sky==null){sky=new Material(Shader.Find("Skybox/Procedural")){name="V23 golden hour sky"};AssetDatabase.CreateAsset(sky,path);}
            sky.SetColor("_SkyTint",new Color(.46f,.50f,.60f));sky.SetColor("_GroundColor",new Color(.42f,.30f,.22f));sky.SetFloat("_AtmosphereThickness",.95f);sky.SetFloat("_Exposure",1.08f);sky.SetFloat("_SunSize",.03f);EditorUtility.SetDirty(sky);
            RenderSettings.skybox=sky;RenderSettings.sun=sun;
            receipt.sunEulerAfter=sun.transform.eulerAngles;receipt.sunColorAfter=sun.color;receipt.sunIntensityAfter=sun.intensity;
            receipt.fogAfter=RenderSettings.fogColor;receipt.fogStartAfter=RenderSettings.fogStartDistance;receipt.fogEndAfter=RenderSettings.fogEndDistance;
        }
        // ---------- helpers ----------
        static float GroundY(Vector3 p)
        {
            var hits=Physics.RaycastAll(new Vector3(p.x,80,p.z),Vector3.down,200,Physics.DefaultRaycastLayers,QueryTriggerInteraction.Ignore).OrderBy(h=>h.distance).ToArray();
            return hits.Length>0?hits[0].point.y:0;
        }
        static List<Vector2> Hull(List<Vector2> pts)
        {
            pts=pts.Distinct().OrderBy(p=>p.x).ThenBy(p=>p.y).ToList();if(pts.Count<3)return pts;
            float Cross(Vector2 o,Vector2 a,Vector2 b)=>(a.x-o.x)*(b.y-o.y)-(a.y-o.y)*(b.x-o.x);
            var lower=new List<Vector2>();foreach(var p in pts){while(lower.Count>=2&&Cross(lower[lower.Count-2],lower[lower.Count-1],p)<=0)lower.RemoveAt(lower.Count-1);lower.Add(p);}
            var upper=new List<Vector2>();for(int i=pts.Count-1;i>=0;i--){var p=pts[i];while(upper.Count>=2&&Cross(upper[upper.Count-2],upper[upper.Count-1],p)<=0)upper.RemoveAt(upper.Count-1);upper.Add(p);}
            lower.RemoveAt(lower.Count-1);upper.RemoveAt(upper.Count-1);lower.AddRange(upper);return lower;
        }
        static Mesh cube,cyl;static Mesh Cube=>cube??=Builtin(PrimitiveType.Cube);static Mesh Cyl=>cyl??=Builtin(PrimitiveType.Cylinder);
        static Mesh Builtin(PrimitiveType t){var go=GameObject.CreatePrimitive(t);var m=go.GetComponent<MeshFilter>().sharedMesh;UnityEngine.Object.DestroyImmediate(go);return m;}
        static void Renderer(Transform parent,string name,Mesh mesh,Material m)
        {
            var go=new GameObject(name);go.transform.SetParent(parent,false);go.isStatic=true;go.AddComponent<MeshFilter>().sharedMesh=mesh;go.AddComponent<MeshRenderer>().sharedMaterial=m;
        }
        static Mesh Combine(string name,List<(Mesh mesh,Matrix4x4 tx,int sub)> parts)=>CombineN(name,parts,1);
        static Mesh Combine2(string name,List<(Mesh mesh,Matrix4x4 tx,int sub)> parts)=>CombineN(name,parts,2);
        static Mesh CombineN(string name,List<(Mesh mesh,Matrix4x4 tx,int sub)> parts,int subs)
        {
            var v=new List<Vector3>();var n=new List<Vector3>();var t=new List<int>[subs];for(int i=0;i<subs;i++)t[i]=new List<int>();
            foreach(var p in parts){int o=v.Count;var nm=p.tx.inverse.transpose;v.AddRange(p.mesh.vertices.Select(x=>p.tx.MultiplyPoint3x4(x)));n.AddRange(p.mesh.normals.Select(x=>nm.MultiplyVector(x).normalized));t[p.sub].AddRange(p.mesh.triangles.Select(x=>x+o));}
            var m=new Mesh{name=name,indexFormat=v.Count>65535?IndexFormat.UInt32:IndexFormat.UInt16};m.SetVertices(v);m.SetNormals(n);m.subMeshCount=subs;for(int i=0;i<subs;i++)m.SetTriangles(t[i],i);m.RecalculateBounds();return Save(m);
        }
        static Mesh Save(Mesh m)
        {
            string path=AssetRoot+"/Meshes/"+m.name+".asset";var old=AssetDatabase.LoadAssetAtPath<Mesh>(path);
            if(old==null){AssetDatabase.CreateAsset(m,path);return m;}EditorUtility.CopySerialized(m,old);UnityEngine.Object.DestroyImmediate(m);return old;
        }
        [MenuItem("Vesper Basin/Open live battlefield candidate (v23)")]
        public static void Open() { if(EditorSceneManager.SaveCurrentModifiedScenesIfUserWantsTo())EditorSceneManager.OpenScene(ScenePath); }
    }
}
#endif

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
    /// v18 Rim Skyline: opens the saved v17 scene and adds a distant industrial skyline on the canyon-rim mesas
    /// (refinery stacks with aviation lights, tank farms, cooling towers, derricks and sawtooth halls), giving the
    /// sky-heavy player-height views a far depth layer like the concepts' industrial horizon. Every cluster sits on a
    /// rim top found by raycasting the saved terrain, 150+ m from the playable outpost, with no colliders and no shadows;
    /// clusters are combined into one renderer each. Saves a NEW scene; v17-v13, v12 and the main project are never written.
    /// </summary>
    public static class SprintV18
    {
        public const string ScenePath="Assets/MapPrototype/Scenes/VesperBasin_v18_RimSkyline.unity";
        public const string AssetRoot="Assets/MapPrototype/SprintAssets/v18";
        public const string Evidence="/Users/tim/Code/fhfhockey.com/tasks/artifacts/cross-platform/2026-10-24-coordination/handoffs/Q2/v18/evidence";
        public const string RootName="V18 Rim industrial skyline";
        [Serializable] public class Cluster { public string name,kind; public Vector3 centre; public float baseY,spreadY,minDistanceToPlay,height; public int triangles,parts; }
        [Serializable] public class Receipt
        {
            public string scene,source,utc; public int clusters,renderers,colliders,triangles; public List<Cluster> placed=new List<Cluster>(); public List<string> skipped=new List<string>();
            public string note="v17 preserved and read-only. v18 adds one root of distant rim clusters only (no colliders, shadows off). No existing object, material, collider, HUD or gameplay change. No Scout import, package, project-settings or main-project change.";
        }
        // Planned sites on the near rim ridges, chosen for player-height sightlines: north behind the ascent (kept clear of
        // the artillery at x~0), east down the spawn road, south behind the radar descent view, west behind the spawn.
        struct Site { public string name,kind; public Vector2 xz; public float yaw,scale; }
        // (sites are copied per build, so the flat-top search never mutates the plan)
        static readonly Site[] Sites={
            new Site{name="North-west refinery",kind="refinery",xz=new Vector2(-150,200),yaw=14,scale=1f},
            new Site{name="North-east tank farm",kind="tanks",xz=new Vector2(95,205),yaw=-12,scale=1f},
            new Site{name="East cooling works",kind="cooling",xz=new Vector2(205,-30),yaw=90,scale=1.1f},
            new Site{name="East derrick yard",kind="derricks",xz=new Vector2(210,55),yaw=80,scale=1f},
            new Site{name="South fabrication halls",kind="halls",xz=new Vector2(-30,-160),yaw=178,scale=1f},
            new Site{name="South-east refinery",kind="refinery",xz=new Vector2(135,-160),yaw=190,scale=.9f},
            new Site{name="West stack line",kind="derricks",xz=new Vector2(-200,-60),yaw=-90,scale=.9f}};
        static Material Lit(string name,Color c,float smooth=.25f,float metal=.3f,Color? emission=null)
        {
            string path=AssetRoot+"/"+name+".mat";var m=AssetDatabase.LoadAssetAtPath<Material>(path);
            if(m==null){m=new Material(Shader.Find("Universal Render Pipeline/Lit")){name=name};AssetDatabase.CreateAsset(m,path);}
            m.SetColor("_BaseColor",c);m.SetFloat("_Smoothness",smooth);m.SetFloat("_Metallic",metal);m.enableInstancing=true;
            if(emission.HasValue){m.EnableKeyword("_EMISSION");m.SetColor("_EmissionColor",emission.Value);m.globalIlluminationFlags=MaterialGlobalIlluminationFlags.None;}
            EditorUtility.SetDirty(m);return m;
        }
        public static void BuildAndCapture(){Build();SprintV18Capture.Run();}
        public static void Build()
        {
            if(File.Exists(ScenePath))throw new InvalidOperationException("v18 scene already exists; refusing to overwrite "+ScenePath);
            var protectedScenes=new[]{SprintV13.ScenePath,SprintV14.ScenePath,SprintV15.ScenePath,SprintV16.ScenePath,SprintV17.ScenePath};var before=protectedScenes.Select(SprintV13Capture.Hash).ToArray();
            Directory.CreateDirectory(AssetRoot+"/Meshes");Directory.CreateDirectory(Evidence);AssetDatabase.Refresh();
            var receipt=new Receipt{scene=ScenePath,source=SprintV17.ScenePath,utc=DateTime.UtcNow.ToString("o")};
            // 0 dark steel, 1 oxide, 2 concrete, 3 aviation red (emissive), 4 sodium window strips (emissive)
            var mats=new[]{Lit("V18 rim dark steel",new Color(.16f,.18f,.21f),.3f,.5f),Lit("V18 rim oxide plate",new Color(.34f,.19f,.13f),.25f,.35f),
                Lit("V18 rim weathered concrete",new Color(.52f,.50f,.47f),.1f,0),Lit("V18 rim aviation red",new Color(.7f,.06f,.04f),.4f,0,new Color(3.2f,.25f,.1f)),
                Lit("V18 rim sodium windows",new Color(.35f,.25f,.1f),.5f,0,new Color(1.4f,.75f,.25f))};
            EditorSceneManager.OpenScene(SprintV17.ScenePath,OpenSceneMode.Single);Physics.SyncTransforms();
            // Playable extent for the distance check: the v12 playable islands that carry every road, plaza and route.
            var islands=GameObject.Find("Grounded outpost islands");if(islands==null)throw new InvalidOperationException("Missing playable islands");
            var play=islands.GetComponent<Renderer>().bounds;
            var root=new GameObject(RootName).transform;
            foreach(var planned in Sites)
            {
                var site=planned;
            {
                var parts=new List<(Mesh,Matrix4x4,int)>();float height=0;
                // Nearest flat-enough rim top within 30 m of the planned site (deterministic spiral), else skip and record.
                float baseY=0,spread=999;Vector2 at=site.xz;bool found=false;
                for(float ring=0;ring<=30&&!found;ring+=5)for(int k=0;k<(ring==0?1:12)&&!found;k++)
                {
                    var c=site.xz+new Vector2(Mathf.Cos(k*Mathf.PI/6),Mathf.Sin(k*Mathf.PI/6))*ring;
                    if(Ground(c,out float y,out float sp)&&sp<=6f){baseY=y;spread=sp;at=c;found=true;}
                }
                if(!found){receipt.skipped.Add(site.name+": no rim top flatter than 6 m within 30 m");continue;}
                site.xz=at;
                var rnd=new System.Random(site.name.GetHashCode()&0x7fffffff);
                switch(site.kind)
                {
                    case "refinery":height=Refinery(parts,rnd);break;
                    case "tanks":height=Tanks(parts,rnd);break;
                    case "cooling":height=Cooling(parts,rnd);break;
                    case "derricks":height=Derricks(parts,rnd);break;
                    case "halls":height=Halls(parts,rnd);break;
                }
                // Sink 1.5 m so feet never float on the faceted rim; one combined renderer per cluster.
                var tx=Matrix4x4.TRS(new Vector3(site.xz.x,baseY-1.5f,site.xz.y),Quaternion.Euler(0,site.yaw,0),Vector3.one*site.scale);
                var mesh=Combine("V18 "+site.name,parts.Select(p=>(p.Item1,tx*p.Item2,p.Item3)).ToList(),mats.Length);
                var go=new GameObject(site.name);go.transform.SetParent(root,false);go.isStatic=true;
                go.AddComponent<MeshFilter>().sharedMesh=mesh;var mr=go.AddComponent<MeshRenderer>();mr.sharedMaterials=mats;
                mr.shadowCastingMode=ShadowCastingMode.Off;mr.receiveShadows=false;
                var b=mr.bounds;float dist=DistanceXZ(play,b);
                receipt.placed.Add(new Cluster{name=site.name,kind=site.kind,centre=new Vector3(site.xz.x,baseY,site.xz.y),baseY=baseY,spreadY=spread,minDistanceToPlay=dist,height=height*site.scale,
                    triangles=Enumerable.Range(0,mesh.subMeshCount).Sum(i=>(int)mesh.GetIndexCount(i)/3),parts=parts.Count});
            }
            }
            receipt.clusters=receipt.placed.Count;receipt.renderers=root.GetComponentsInChildren<Renderer>(true).Length;receipt.colliders=root.GetComponentsInChildren<Collider>(true).Length;receipt.triangles=receipt.placed.Sum(c=>c.triangles);
            EditorSceneManager.SaveScene(UnityEngine.SceneManagement.SceneManager.GetActiveScene(),ScenePath,true);AssetDatabase.SaveAssets();
            if(!protectedScenes.Select(SprintV13Capture.Hash).SequenceEqual(before))throw new InvalidOperationException("v13-v17 scene changed during v18 build");
            File.WriteAllText(Path.Combine(Evidence,"v18-build.json"),JsonUtility.ToJson(receipt,true));
            Debug.Log("VESPER_V18_BUILT "+ScenePath+" clusters="+receipt.clusters+" skipped="+receipt.skipped.Count);
        }
        static float DistanceXZ(Bounds a,Bounds b)
        {
            float dx=Mathf.Max(0,Mathf.Max(a.min.x-b.max.x,b.min.x-a.max.x)),dz=Mathf.Max(0,Mathf.Max(a.min.z-b.max.z,b.min.z-a.max.z));return Mathf.Sqrt(dx*dx+dz*dz);
        }
        // Rim top under a 40 m site: median first-hit height on saved terrain and the spread of those hits.
        static bool Ground(Vector2 xz,out float y,out float spread)
        {
            var hs=new List<float>();
            for(float dx=-20;dx<=20;dx+=5)for(float dz=-20;dz<=20;dz+=5)
                if(Physics.Raycast(new Vector3(xz.x+dx,300,xz.y+dz),Vector3.down,out var h,400,Physics.DefaultRaycastLayers,QueryTriggerInteraction.Ignore))hs.Add(h.point.y);
            hs.Sort();y=hs.Count>0?hs[hs.Count/2]:0;spread=hs.Count>0?hs[hs.Count*9/10]-hs[hs.Count/10]:999;return hs.Count>=60;
        }
        static Mesh cube,cyl;
        static Mesh Cube=>cube??=Builtin(PrimitiveType.Cube);
        static Mesh Cyl=>cyl??=Builtin(PrimitiveType.Cylinder);
        static Mesh Builtin(PrimitiveType t){var go=GameObject.CreatePrimitive(t);var m=go.GetComponent<MeshFilter>().sharedMesh;UnityEngine.Object.DestroyImmediate(go);return m;}
        static void Box(List<(Mesh,Matrix4x4,int)> p,Vector3 c,Vector3 s,int m,float yaw=0)=>p.Add((Cube,Matrix4x4.TRS(c,Quaternion.Euler(0,yaw,0),s),m));
        static void Column(List<(Mesh,Matrix4x4,int)> p,Vector3 foot,float r,float h,int m)=>p.Add((Cyl,Matrix4x4.TRS(foot+Vector3.up*h*.5f,Quaternion.identity,new Vector3(2*r,h*.5f,2*r)),m));
        static void Strut(List<(Mesh,Matrix4x4,int)> p,Vector3 a,Vector3 b,float w,int m)
        {
            Vector3 d=b-a;p.Add((Cube,Matrix4x4.TRS((a+b)*.5f,Quaternion.LookRotation(d.normalized,Mathf.Abs(d.normalized.y)>.95f?Vector3.forward:Vector3.up),new Vector3(w,w,d.magnitude)),m));
        }
        static void Stack(List<(Mesh,Matrix4x4,int)> p,Vector3 foot,float r,float h)
        {
            Column(p,foot,r*1.25f,3,0);Column(p,foot,r,h,2);
            for(float y=h*.25f;y<h;y+=h*.25f)Column(p,foot+Vector3.up*y,r*1.06f,.8f,1); // oxide bands
            Column(p,foot+Vector3.up*(h-1.2f),r*1.08f,1.4f,0);Box(p,foot+Vector3.up*(h+.6f),new Vector3(.9f,.9f,.9f),3); // cap + aviation light
        }
        static void Lattice(List<(Mesh,Matrix4x4,int)> p,Vector3 foot,float H,float B,float T)
        {
            Vector3 Leg(int k,float y){float s=Mathf.Lerp(B,T,y/H);return foot+new Vector3((k&1)==0?-s:s,y,(k&2)==0?-s:s);}
            for(int k=0;k<4;k++)Strut(p,Leg(k,0),Leg(k,H),.45f,0);
            int[] ring={0,1,3,2};float step=H/8;
            for(float y=step;y<H;y+=step)for(int k=0;k<4;k++){int a=ring[k],b=ring[(k+1)%4];Strut(p,Leg(a,y),Leg(b,y),.25f,0);Strut(p,Leg(a,y-step),Leg(b,y),.2f,0);}
            Box(p,foot+Vector3.up*(H+.5f),Vector3.one*1.1f,3);
        }
        static float Refinery(List<(Mesh,Matrix4x4,int)> p,System.Random r)
        {
            float[] h={52,44,38,30};float[] x={-12,-3,6,14};
            for(int i=0;i<4;i++)Stack(p,new Vector3(x[i],0,(float)(r.NextDouble()*6-3)),2.2f-i*.25f,h[i]);
            Lattice(p,new Vector3(-22,0,4),34,2.4f,.8f); // flare derrick
            Box(p,new Vector3(0,5,-10),new Vector3(40,10,9),0);Box(p,new Vector3(0,7.5f,-14.6f),new Vector3(36,1.2f,.2f),4); // process hall + lit strip
            for(int i=0;i<6;i++)Strut(p,new Vector3(-20+i*7,12,-6),new Vector3(-20+i*7,12,6),.9f,1); // pipe rack
            Strut(p,new Vector3(-22,12,0),new Vector3(20,12,0),1.1f,1);
            return 53;
        }
        static float Tanks(List<(Mesh,Matrix4x4,int)> p,System.Random r)
        {
            for(int i=0;i<6;i++)
            {
                float x=-24+(i%3)*22,z=(i/3)*20-10,rad=6.5f+(float)r.NextDouble()*2.5f,h=9+(float)r.NextDouble()*5;
                Column(p,new Vector3(x,0,z),rad,h,2);Column(p,new Vector3(x,h,z),rad*.92f,1.2f,0);Column(p,new Vector3(x,h*.5f,z),rad*1.02f,.8f,1);
            }
            Stack(p,new Vector3(34,0,0),2,40);Lattice(p,new Vector3(-38,0,0),28,2,.7f);
            Strut(p,new Vector3(-30,6,0),new Vector3(30,6,0),1.2f,1);
            return 40;
        }
        static float Cooling(List<(Mesh,Matrix4x4,int)> p,System.Random r)
        {
            var tower=SprintV18Lathe.Tower(AssetRoot+"/Meshes","V18 rim cooling tower");
            float[] x={-20,8,30};float[] s={1f,.85f,.7f};
            for(int i=0;i<3;i++)p.Add((tower,Matrix4x4.TRS(new Vector3(x[i],0,(float)(r.NextDouble()*8-4)),Quaternion.identity,Vector3.one*s[i]*4.2f),2));
            Box(p,new Vector3(4,6,-24),new Vector3(46,12,10),0);Box(p,new Vector3(4,9,-29.1f),new Vector3(42,1.2f,.2f),4);
            Stack(p,new Vector3(-42,0,-18),1.8f,36);
            return 36;
        }
        static float Derricks(List<(Mesh,Matrix4x4,int)> p,System.Random r)
        {
            float[] x={-28,-6,16,36};float[] h={42,30,48,26};
            for(int i=0;i<4;i++)Lattice(p,new Vector3(x[i],0,(float)(r.NextDouble()*10-5)),h[i],3.2f,.9f);
            Box(p,new Vector3(4,4,14),new Vector3(56,8,8),1);Box(p,new Vector3(4,6,18.1f),new Vector3(50,1,.2f),4);
            Stack(p,new Vector3(50,0,8),1.6f,34);
            return 48;
        }
        static float Halls(List<(Mesh,Matrix4x4,int)> p,System.Random r)
        {
            for(int k=0;k<3;k++)
            {
                float z=-18+k*18;Box(p,new Vector3(0,6,z),new Vector3(64,12,14),k==1?1:0);
                for(int s=0;s<6;s++)
                {
                    float x=-27+s*10.8f;
                    // north-light sawtooth: sloped roof plate plus lit glazing strip
                    p.Add((Cube,Matrix4x4.TRS(new Vector3(x,13.6f,z),Quaternion.Euler(28,0,0),new Vector3(10,.4f,8)),0));
                    Box(p,new Vector3(x,14.2f,z+3.4f),new Vector3(10,2.6f,.3f),4);
                }
            }
            Stack(p,new Vector3(40,0,0),2.4f,46);Stack(p,new Vector3(46,0,12),1.8f,34);Lattice(p,new Vector3(-42,0,10),30,2.2f,.8f);
            return 46;
        }
        static Mesh Combine(string name,List<(Mesh mesh,Matrix4x4 tx,int sub)> parts,int subCount)
        {
            var verts=new List<Vector3>();var norms=new List<Vector3>();var tris=new List<int>[subCount];for(int i=0;i<subCount;i++)tris[i]=new List<int>();
            foreach(var p in parts)
            {
                int o=verts.Count;var nm=p.tx.inverse.transpose;
                verts.AddRange(p.mesh.vertices.Select(v=>p.tx.MultiplyPoint3x4(v)));norms.AddRange(p.mesh.normals.Select(n=>nm.MultiplyVector(n).normalized));
                tris[p.sub].AddRange(p.mesh.triangles.Select(t=>t+o));
            }
            var m=new Mesh{name=name,indexFormat=verts.Count>65535?IndexFormat.UInt32:IndexFormat.UInt16};
            m.SetVertices(verts);m.SetNormals(norms);m.subMeshCount=subCount;for(int i=0;i<subCount;i++)m.SetTriangles(tris[i],i);m.RecalculateBounds();
            string path=AssetRoot+"/Meshes/"+name+".asset";var old=AssetDatabase.LoadAssetAtPath<Mesh>(path);
            if(old==null){AssetDatabase.CreateAsset(m,path);return m;}
            EditorUtility.CopySerialized(m,old);UnityEngine.Object.DestroyImmediate(m);EditorUtility.SetDirty(old);return old;
        }
        [MenuItem("Vesper Basin/Open rim skyline candidate (v18)")]
        public static void Open() { if(EditorSceneManager.SaveCurrentModifiedScenesIfUserWantsTo())EditorSceneManager.OpenScene(ScenePath); }
    }
    /// <summary>Hyperbolic cooling-tower lathe (outer wall + inner wall + rim), outward-wound; unit scale ~8.4 m tall.</summary>
    static class SprintV18Lathe
    {
        public static Mesh Tower(string folder,string name)
        {
            var profile=new[]{new Vector2(3.0f,0),new Vector2(2.55f,2.2f),new Vector2(2.2f,4.6f),new Vector2(2.15f,5.6f),new Vector2(2.3f,7.2f),new Vector2(2.45f,8.4f)};
            const int sides=24;const float wall=.18f;var v=new List<Vector3>();var t=new List<int>();
            Vector3 P(Vector2 pr,int i,float inset){float a=i*Mathf.PI*2/sides;float rr=pr.x-inset;return new Vector3(Mathf.Sin(a)*rr,pr.y,Mathf.Cos(a)*rr);}
            void Quad(Vector3 a,Vector3 b,Vector3 c,Vector3 d,Vector3 hint){int s=v.Count;v.Add(a);v.Add(b);v.Add(c);v.Add(d);W(s,s+1,s+2,hint);W(s,s+2,s+3,hint);}
            void W(int a,int b,int c,Vector3 hint){if(Vector3.Dot(Vector3.Cross(v[b]-v[a],v[c]-v[a]),hint)>=0)t.AddRange(new[]{a,b,c});else t.AddRange(new[]{a,c,b});}
            Vector3 Out(Vector3 a,Vector3 b){var m=(a+b)*.5f;m.y=0;return m.normalized;}
            for(int l=0;l<profile.Length-1;l++)for(int i=0;i<sides;i++)
            {
                Quad(P(profile[l],i,0),P(profile[l+1],i,0),P(profile[l+1],i+1,0),P(profile[l],i+1,0),Out(P(profile[l],i,0),P(profile[l],i+1,0)));
                Quad(P(profile[l],i+1,wall),P(profile[l+1],i+1,wall),P(profile[l+1],i,wall),P(profile[l],i,wall),-Out(P(profile[l],i,0),P(profile[l],i+1,0)));
            }
            var top=profile[profile.Length-1];for(int i=0;i<sides;i++)Quad(P(top,i,0),P(top,i,wall),P(top,i+1,wall),P(top,i+1,0),Vector3.up);
            var m=new Mesh{name=name};m.SetVertices(v);m.SetTriangles(t,0);m.RecalculateNormals();m.RecalculateBounds();
            string path=folder+"/"+name+".asset";var old=AssetDatabase.LoadAssetAtPath<Mesh>(path);
            if(old==null){AssetDatabase.CreateAsset(m,path);return m;}
            EditorUtility.CopySerialized(m,old);UnityEngine.Object.DestroyImmediate(m);EditorUtility.SetDirty(old);return old;
        }
    }
}
#endif

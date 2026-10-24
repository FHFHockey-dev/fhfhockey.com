#if UNITY_EDITOR
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;

namespace VesperBasin.Editor
{
    /// <summary>
    /// v17 Industrial Deck: opens the saved v16 scene and replaces the single flat "Road graphite" colour (roads, plazas,
    /// pads, foundations and block roofs) with a world-space industrial deck material, then saves a NEW scene.
    /// Material slots only: no mesh, transform, collider, gameplay or HUD change. v16-v13 scenes and assets, v12 and the
    /// main project are never written.
    /// </summary>
    public static class SprintV17
    {
        public const string ScenePath="Assets/MapPrototype/Scenes/VesperBasin_v17_IndustrialDeck.unity";
        public const string AssetRoot="Assets/MapPrototype/SprintAssets/v17";
        public const string Evidence="/Users/tim/Code/fhfhockey.com/tasks/artifacts/cross-platform/2026-10-24-coordination/handoffs/Q2/v17/evidence";
        public const string ShaderName="VesperBasin/V17 Industrial Deck";
        const float TileMetres=16f,WearMetres=97f,Encode=.70f;
        [Serializable] public class Swap { public string renderer; public int slot; }
        [Serializable] public class Receipt
        {
            public string scene,source,utc,shader,material; public bool shaderHasErrors; public int swappedRenderers,swappedSlots;
            public List<Swap> swaps=new List<Swap>();
            public string note="v16 preserved and read-only. v17 swaps every 'Road graphite' material slot to one world-space industrial deck material (running-bond 4 m slabs with joints, per-slab tone, aggregate, service hatches and drain grates, large-scale sand drift and oil wear; kerb faces shaded). Same tint as Road graphite. No other change. No Scout import, package, project-settings or main-project change.";
        }
        public static void BuildAndCapture(){Build();SprintV17Capture.Run();}
        public static void Build()
        {
            if(File.Exists(ScenePath))throw new InvalidOperationException("v17 scene already exists; refusing to overwrite "+ScenePath);
            var protectedScenes=new[]{SprintV13.ScenePath,SprintV14.ScenePath,SprintV15.ScenePath,SprintV16.ScenePath};var before=protectedScenes.Select(SprintV13Capture.Hash).ToArray();
            var shader=Shader.Find(ShaderName);if(shader==null)throw new InvalidOperationException("Missing shader "+ShaderName);
            var receipt=new Receipt{scene=ScenePath,source=SprintV16.ScenePath,utc=DateTime.UtcNow.ToString("o"),shader=ShaderName,shaderHasErrors=ShaderUtil.ShaderHasError(shader)};
            if(receipt.shaderHasErrors)throw new InvalidOperationException("Deck shader has compile errors");
            Directory.CreateDirectory(AssetRoot);Directory.CreateDirectory(Evidence);AssetDatabase.Refresh();
            var road=AssetDatabase.LoadAssetAtPath<Material>("Assets/MapPrototype/SprintAssets/v02/Road graphite.mat");
            if(road==null)throw new InvalidOperationException("Missing Road graphite");
            var deck=DeckMaterial(road,shader);receipt.material=AssetDatabase.GetAssetPath(deck);
            EditorSceneManager.OpenScene(SprintV16.ScenePath,OpenSceneMode.Single);
            foreach(var r in UnityEngine.Object.FindObjectsByType<Renderer>(FindObjectsInactive.Include,FindObjectsSortMode.None).OrderBy(x=>SprintV13Survey.Key(x.transform)))
            {
                var mats=r.sharedMaterials;bool changed=false;
                for(int i=0;i<mats.Length;i++)if(mats[i]==road){mats[i]=deck;changed=true;receipt.swappedSlots++;receipt.swaps.Add(new Swap{renderer=SprintV13Survey.Key(r.transform),slot=i});}
                if(changed){r.sharedMaterials=mats;receipt.swappedRenderers++;}
            }
            EditorSceneManager.SaveScene(UnityEngine.SceneManagement.SceneManager.GetActiveScene(),ScenePath,true);AssetDatabase.SaveAssets();
            if(!protectedScenes.Select(SprintV13Capture.Hash).SequenceEqual(before))throw new InvalidOperationException("v13-v16 scene changed during v17 build");
            File.WriteAllText(Path.Combine(Evidence,"v17-build.json"),JsonUtility.ToJson(receipt,true));
            Debug.Log("VESPER_V17_BUILT "+ScenePath+" renderers="+receipt.swappedRenderers+" slots="+receipt.swappedSlots);
        }
        static Color Decode(Color gammaTint,float encode){var l=gammaTint.linear;return new Color(l.r/encode,l.g/encode,l.b/encode,1).gamma;}
        static Color Linear(float r,float g,float b)=>new Color(r,g,b,1).gamma; // shader receives these exact linear values
        static Material DeckMaterial(Material road,Shader shader)
        {
            string path=AssetRoot+"/V17 industrial deck graphite.mat";var m=AssetDatabase.LoadAssetAtPath<Material>(path);
            if(m==null){m=new Material(shader){name="V17 industrial deck graphite"};AssetDatabase.CreateAsset(m,path);}
            m.SetColor("_BaseColor",Decode(road.GetColor("_BaseColor"),Encode));
            m.SetColor("_SpecColor",Linear(.48f,.74f,0)); // drift strength, kerb-face shade (linear)
            m.SetColor("_EmissionColor",Linear(.20f,.125f,.072f)); // drift sand colour (linear), shader-only; _EMISSION stays off
            m.SetTexture("_BaseMap",DeckTexture());m.SetTextureScale("_BaseMap",new Vector2(1f/TileMetres,1f/TileMetres));m.SetTextureOffset("_BaseMap",new Vector2(.13f,.29f));
            m.SetTexture("_DetailAlbedoMap",WearTexture());m.SetTextureScale("_DetailAlbedoMap",new Vector2(1f/WearMetres,1f/WearMetres));
            m.SetFloat("_Smoothness",road.HasProperty("_Smoothness")?road.GetFloat("_Smoothness"):.2f);m.SetFloat("_Metallic",0);m.enableInstancing=true;EditorUtility.SetDirty(m);return m;
        }
        static float Hash(int a,int b){uint h=unchecked((uint)a*374761393u+(uint)b*668265263u);h=unchecked((h^(h>>13))*1274126177u);h^=h>>16;return (h&65535u)/65535f;}
        static float Wave(float u,int k,float phase)=>Mathf.Sin(2*Mathf.PI*(k*u+phase));
        static Texture2D DeckTexture()
        {
            // 16 m tile, 64 px/m. Four 4 m rows of 4 m slabs in running bond; one row in four uses 2 m service strips.
            const int N=1024;const float PPM=N/16f;var px=new Color[N*N];
            for(int j=0;j<N;j++)for(int i=0;i<N;i++)
            {
                float x=i/PPM,z=j/PPM;int row=Mathf.FloorToInt(z/4);float zr=z-row*4;
                bool strip=row==2;float len=strip?2f:4f;float off=(row%2==1)?2f:0f;
                float xs=x+off;int col=Mathf.FloorToInt(xs/len)%Mathf.RoundToInt(16f/len);float xr=xs-Mathf.Floor(xs/len)*len;
                float edge=Mathf.Min(Mathf.Min(xr,len-xr),Mathf.Min(zr,4-zr));
                float tone=.80f+.40f*Hash(col+17,row*7+3);
                Color c=new Color(tone*(.99f+.03f*Hash(col,row)),tone,tone*(1.01f-.03f*Hash(row,col)),1);
                c*=.96f+.08f*Hash(i,j)+.03f*Wave(x/16f,11,.3f)*Wave(z/16f,7,.6f); // aggregate + faint trowel bands
                if(edge<.045f)c*=.45f;                       // expansion joint
                else if(edge<.11f)c*=1.07f;                  // worn arris either side of the joint
                // Service hatches (1.1 m, bolted) and drain grates (1.4 x .5 m) on chosen slabs, centred.
                float cx=xr-len*.5f,cz=zr-2f;float pick=Hash(col*31+5,row*13+11);
                if(!strip&&pick>.78f)
                {
                    float hx=Mathf.Abs(cx),hz=Mathf.Abs(cz);
                    if(Mathf.Max(hx,hz)<.55f){c*=1.18f;if(Mathf.Max(hx,hz)>.50f)c*=.45f;if(Mathf.Abs(hx-.42f)<.035f&&Mathf.Abs(hz-.42f)<.035f)c*=.55f;}
                }
                else if(!strip&&pick<.12f)
                {
                    if(Mathf.Abs(cx)<.7f&&Mathf.Abs(cz)<.25f){c*=.62f;if(Mathf.Repeat(cx+.7f,.1f)<.035f)c*=.4f;}
                }
                if(strip&&Mathf.Abs(zr-2f)<.06f)c*=.7f;      // service-strip channel
                px[j*N+i]=new Color(c.r*Encode,c.g*Encode,c.b*Encode,1);
            }
            return Save("V17 deck slabs",N,px);
        }
        static Texture2D WearTexture()
        {
            // rgb: oil/grime multiplier (<=1, stored directly); a: sand-drift coverage with soft, wind-elongated patches.
            const int N=256;var px=new Color[N*N];
            for(int j=0;j<N;j++)for(int i=0;i<N;i++)
            {
                float u=i/(float)N,v=j/(float)N;
                // Domain-warped sum of incommensurate periodic waves: irregular, sparse drifts instead of a regular camo grid.
                float wu=u+.07f*Wave(v,3,.31f)+.04f*Wave(u+v,5,.77f),wv=v+.07f*Wave(u,2,.58f)+.04f*Wave(u-v,7,.12f);
                float field=.5f+.18f*Wave(wu,1,.13f)*Wave(wv,2,.41f)+.14f*Wave(2*wu+wv,1,.67f)+.11f*Wave(wu-3*wv,1,.29f)+.08f*Wave(5*wu+2*wv,1,.83f)+.05f*Wave(7*wu-4*wv,1,.51f);
                float drift=Mathf.SmoothStep(0,1,Mathf.InverseLerp(.64f,.92f,field))*(.85f+.15f*Hash(i+3,j+7));
                float oil=Mathf.Clamp01(Wave(u,9,.21f)*Wave(v,7,.63f)*1.6f-.9f);
                float grime=.92f+.08f*Hash(i*5+1,j*3+2);
                float m=Mathf.Lerp(1,.55f,oil)*grime;
                px[j*N+i]=new Color(m,m,m*1.02f,drift);
            }
            return Save("V17 deck wear",N,px);
        }
        static Texture2D Save(string name,int n,Color[] px)
        {
            var tex=new Texture2D(n,n,TextureFormat.RGBA32,true,true){name=name,wrapMode=TextureWrapMode.Repeat,filterMode=FilterMode.Trilinear,anisoLevel=8};
            tex.SetPixels(px);tex.Apply(true,false);string path=AssetRoot+"/"+name+".asset";var old=AssetDatabase.LoadAssetAtPath<Texture2D>(path);
            if(old==null){AssetDatabase.CreateAsset(tex,path);return tex;}
            EditorUtility.CopySerialized(tex,old);UnityEngine.Object.DestroyImmediate(tex);EditorUtility.SetDirty(old);return old;
        }
        [MenuItem("Vesper Basin/Open industrial deck candidate (v17)")]
        public static void Open() { if(EditorSceneManager.SaveCurrentModifiedScenesIfUserWantsTo())EditorSceneManager.OpenScene(ScenePath); }
    }
}
#endif

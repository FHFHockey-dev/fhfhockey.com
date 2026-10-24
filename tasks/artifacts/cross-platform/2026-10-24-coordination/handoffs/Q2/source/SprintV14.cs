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
    /// v14 Strata Ascent: opens the saved v13 scene, regenerates only the v13 north-ascent terrain (stepped buttress
    /// tops, planar broken caps) and swaps canyon-rock materials to world-space strata materials, then saves a NEW
    /// scene. v13 scene/assets, v12 and the main project are never written. Debug/HUD objects are untouched.
    /// </summary>
    public static class SprintV14
    {
        public const string ScenePath="Assets/MapPrototype/Scenes/VesperBasin_v14_StrataAscent.unity";
        public const string AssetRoot="Assets/MapPrototype/SprintAssets/v14";
        public const string Evidence="/Users/tim/Code/fhfhockey.com/tasks/artifacts/cross-platform/2026-10-24-coordination/handoffs/Q2/evidence";
        public const string ShaderName="VesperBasin/V14 Strata Rock";
        const float StrataMetres=28f, StrataWidthMetres=46f, DustMetres=19f;
        // Textures are linear and store multiplier*Encode (RGBA32 clamps above 1); tints are divided back in linear space.
        const float StrataEncode=.70f, DustEncode=.82f;
        [Serializable] public class Swap { public string renderer,from,to; public int slot; }
        [Serializable] public class Receipt
        {
            public string scene,source,utc,shader; public bool shaderHasErrors;
            public int swappedRenderers,swappedSlots,strataMaterials,terrainRenderers,terrainColliders;
            public List<Swap> swaps=new List<Swap>();
            public string note="v13 preserved and read-only; v14 regenerates only 'V13 North Ascent/Terrain' (same placements/crops; stepped flat-topped buttresses, planar broken caps) and re-materials canyon rock renderers in the v14 scene. Colliders on inherited rock are not changed. Debug HUD/targets untouched. No Scout import, package, project-settings or main-project change.";
        }
        // Canyon rock materials replaced in v14 only (water, roads, structures, signs and HUD are excluded).
        static readonly string[] RockMaterials={
            "SprintAssets/v12/Terrain/01 Oxide shadow beds.mat","SprintAssets/v12/Terrain/02 Red sandstone.mat",
            "SprintAssets/v12/Terrain/03 Pale sediment seams.mat","SprintAssets/v12/Terrain/04 Sunworn sandstone caps.mat",
            "SprintAssets/v12/Terrain/05 Deep basin silt.mat","SprintAssets/v13/Terrain/01 Warm shaded sandstone.mat",
            "SprintAssets/v13/Terrain/02 Rust sediment.mat","SprintAssets/v13/Terrain/03 Dusty sandstone.mat",
            "SprintAssets/v13/Terrain/04 Pale exposed ledges.mat","SprintAssets/v13/Terrain/05 Oxide seams.mat",
            "SprintAssets/v13/Terrain/06 Weathered plateau caps.mat","SprintAssets/v02/Faceted canyon.mat",
            "SprintAssets/v02/Sandstone ground.mat","Materials/Canyon boundary.mat"};

        public static void BuildAndCapture() { Build(); SprintV14Capture.Run(); }
        public static void Build()
        {
            if(File.Exists(ScenePath))throw new InvalidOperationException("v14 scene already exists; refusing to overwrite "+ScenePath);
            string v13Hash=SprintV13Capture.Hash(SprintV13.ScenePath);
            var shader=Shader.Find(ShaderName);if(shader==null)throw new InvalidOperationException("Missing shader "+ShaderName);
            var receipt=new Receipt{scene=ScenePath,source=SprintV13.ScenePath,utc=DateTime.UtcNow.ToString("o"),shader=ShaderName,shaderHasErrors=ShaderUtil.ShaderHasError(shader)};
            if(receipt.shaderHasErrors)throw new InvalidOperationException("Strata shader has compile errors");
            Directory.CreateDirectory(AssetRoot+"/Terrain");Directory.CreateDirectory(Evidence);AssetDatabase.Refresh();
            var strata=StrataTexture();var dust=DustTexture();
            var map=new Dictionary<Material,Material>();
            foreach(var rel in RockMaterials)
            {
                var source=AssetDatabase.LoadAssetAtPath<Material>("Assets/MapPrototype/"+rel);
                if(source==null)throw new InvalidOperationException("Missing rock material "+rel);
                map[source]=StrataMaterial(source.name,source.GetColor("_BaseColor"),source.HasProperty("_Smoothness")?source.GetFloat("_Smoothness"):.12f,strata,dust,rel.Contains("basin silt"));
            }
            EditorSceneManager.OpenScene(SprintV13.ScenePath,OpenSceneMode.Single);
            var root=GameObject.Find(SprintV13.RootName);if(root==null)throw new InvalidOperationException("Missing "+SprintV13.RootName);
            var v13Terrain=new[]{"01 Warm shaded sandstone","02 Rust sediment","03 Dusty sandstone","04 Pale exposed ledges","05 Oxide seams","06 Weathered plateau caps"}
                .Select(n=>map[AssetDatabase.LoadAssetAtPath<Material>("Assets/MapPrototype/SprintAssets/v13/Terrain/"+n+".mat")]).ToArray();
            SprintV14Terrain.Build(root.transform,AssetRoot,v13Terrain);
            var terrain=root.transform.Find(SprintV14Terrain.ChildName);
            receipt.terrainRenderers=terrain.GetComponentsInChildren<Renderer>(true).Length;receipt.terrainColliders=terrain.GetComponentsInChildren<Collider>(true).Length;
            foreach(var r in UnityEngine.Object.FindObjectsByType<Renderer>(FindObjectsInactive.Include,FindObjectsSortMode.None).OrderBy(x=>SprintV13Survey.Key(x.transform)))
            {
                var mats=r.sharedMaterials;bool changed=false;
                for(int i=0;i<mats.Length;i++)
                {
                    if(mats[i]==null||!map.TryGetValue(mats[i],out var to))continue;
                    receipt.swaps.Add(new Swap{renderer=SprintV13Survey.Key(r.transform),slot=i,from=mats[i].name,to=AssetDatabase.GetAssetPath(to)});
                    mats[i]=to;changed=true;receipt.swappedSlots++;
                }
                if(changed){r.sharedMaterials=mats;receipt.swappedRenderers++;}
            }
            receipt.strataMaterials=map.Count;
            EditorSceneManager.SaveScene(UnityEngine.SceneManagement.SceneManager.GetActiveScene(),ScenePath,true);AssetDatabase.SaveAssets();
            if(SprintV13Capture.Hash(SprintV13.ScenePath)!=v13Hash)throw new InvalidOperationException("v13 scene changed during v14 build");
            File.WriteAllText(Path.Combine(Evidence,"v14-build.json"),JsonUtility.ToJson(receipt,true));
            Debug.Log("VESPER_V14_BUILT "+ScenePath+" swapped="+receipt.swappedRenderers);
        }
        static Material StrataMaterial(string name,Color tint,float smooth,Texture2D strata,Texture2D dust,bool basin)
        {
            string path=AssetRoot+"/V14 strata "+name+".mat";var mat=AssetDatabase.LoadAssetAtPath<Material>(path);
            if(mat==null){mat=new Material(Shader.Find(ShaderName)){name="V14 strata "+name};AssetDatabase.CreateAsset(mat,path);}
            // Wall tint keeps the inherited palette; plateaus drift toward pale wind-blown sand like the concept's caps.
            var plateau=basin?tint:Color.Lerp(tint,new Color(.78f,.60f,.43f),.38f);
            mat.SetColor("_BaseColor",Decode(tint,StrataEncode));mat.SetColor("_SpecColor",Decode(plateau,DustEncode));
            mat.SetTexture("_BaseMap",strata);mat.SetTextureScale("_BaseMap",new Vector2(1f/StrataWidthMetres,1f/StrataMetres));mat.SetTextureOffset("_BaseMap",new Vector2(0,.31f));
            mat.SetTexture("_DetailAlbedoMap",dust);mat.SetTextureScale("_DetailAlbedoMap",new Vector2(1f/DustMetres,1f/DustMetres));
            mat.SetFloat("_Smoothness",smooth);mat.SetFloat("_Metallic",0);mat.enableInstancing=true;EditorUtility.SetDirty(mat);return mat;
        }
        static Color Decode(Color gammaTint,float encode){var l=gammaTint.linear;return new Color(l.r/encode,l.g/encode,l.b/encode,1).gamma;}
        // Periodic helpers so both textures tile seamlessly in U and V.
        static float Wave(float u,int k,float phase)=>Mathf.Sin(2*Mathf.PI*(k*u+phase));
        static float Hash(int a,int b){uint h=unchecked((uint)a*374761393u+(uint)b*668265263u);h=unchecked((h^(h>>13))*1274126177u);h^=h>>16;return (h&65535u)/65535f;}
        static Texture2D StrataTexture()
        {
            const int W=256,H=512;
            // Bed sequence over one 28 m repeat: thickness (fraction), tone and hue drift. Thin dark seams separate beds;
            // a few pale resistant ledges and deep oxide bands give the layered canyon read of the Vesper Basin concept.
            var rng=new System.Random(1407);var beds=new List<(float top,Color c)>();float y=0;
            Color[] palette={new Color(1.04f,.97f,.92f),new Color(.86f,.80f,.78f),new Color(1.16f,1.08f,.98f),new Color(.93f,.84f,.80f),
                new Color(1.28f,1.20f,1.10f),new Color(.74f,.66f,.64f),new Color(1.08f,.94f,.86f)};
            while(y<1f)
            {
                float t=(float)(.022+.085*rng.NextDouble());int k=rng.Next(palette.Length);
                if(rng.NextDouble()<.18)t*=.35f; // thin interbeds
                y=Mathf.Min(1f,y+t);beds.Add((y,palette[k]));
            }
            var tex=Texture("V14 sandstone strata bands",W,H);var px=new Color[W*H];
            for(int j=0;j<H;j++)for(int i=0;i<W;i++)
            {
                float u=i/(float)W,v=j/(float)H;
                // Bed boundaries wander slightly with u (cross-bedding) while remaining periodic.
                float vv=v+.006f*Wave(u,2,.13f)+.004f*Wave(u,5,.71f);vv-=Mathf.Floor(vv);
                int b=0;while(b<beds.Count-1&&vv>beds[b].top)b++;
                float bottom=b==0?beds[beds.Count-1].top-1f:beds[b-1].top;float top=beds[b].top;
                float inBed=Mathf.InverseLerp(bottom,top,vv);
                Color c=beds[b].c;
                float seam=Mathf.Min(inBed,1-inBed)*(top-bottom)*H; // pixels from nearest boundary
                if(seam<1.6f)c*=.70f+.12f*(seam/1.6f);
                else if(inBed>.82f)c*=1.06f; // lit lip at the top of each bed
                // Vertical desert-varnish streaks and fine grain.
                float streak=Mathf.Pow(Mathf.Max(0,.5f+.5f*Wave(u,7,.2f)*Wave(u,3,.55f)),3)*(.6f+.4f*Wave(v,3,.4f));
                c*=1-.16f*streak;
                c*=.95f+.07f*Hash(i,j)+.03f*Wave(u,23,.37f)*Wave(v,41,.11f);
                px[j*W+i]=new Color(c.r*StrataEncode,c.g*StrataEncode,c.b*StrataEncode,1);
            }
            return Save(tex,px,AssetRoot+"/V14 sandstone strata bands.asset");
        }
        static Texture2D DustTexture()
        {
            const int N=256;var tex=Texture("V14 plateau dust",N,N);var px=new Color[N*N];
            for(int j=0;j<N;j++)for(int i=0;i<N;i++)
            {
                float u=i/(float)N,v=j/(float)N;
                float patches=.5f+.25f*Wave(u,2,.1f)*Wave(v,3,.6f)+.25f*Wave(u+v,4,.33f);
                float ripple=.5f+.5f*Wave(u*.8f+v*.6f,17,.2f);
                float value=.90f+.12f*patches+.03f*ripple+.06f*(Hash(i,j)-.5f);
                if(Hash(i*7+3,j*5+1)>.985f)value*=.78f; // pebble speckle
                px[j*N+i]=new Color(value*1.01f*DustEncode,value*DustEncode,value*.97f*DustEncode,1);
            }
            return Save(tex,px,AssetRoot+"/V14 plateau dust.asset");
        }
        static Texture2D Texture(string name,int w,int h)=>new Texture2D(w,h,TextureFormat.RGBA32,true,true){name=name,wrapMode=TextureWrapMode.Repeat,filterMode=FilterMode.Trilinear,anisoLevel=4};
        static Texture2D Save(Texture2D tex,Color[] px,string path)
        {
            tex.SetPixels(px);tex.Apply(true,false);
            var old=AssetDatabase.LoadAssetAtPath<Texture2D>(path);
            if(old==null){AssetDatabase.CreateAsset(tex,path);return tex;}
            EditorUtility.CopySerialized(tex,old);UnityEngine.Object.DestroyImmediate(tex);EditorUtility.SetDirty(old);return old;
        }
        [MenuItem("Vesper Basin/Open strata ascent candidate (v14)")]
        public static void Open() { if(EditorSceneManager.SaveCurrentModifiedScenesIfUserWantsTo())EditorSceneManager.OpenScene(ScenePath); }
    }
}
#endif

#if UNITY_EDITOR
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

namespace VesperBasin.Editor
{
    /// <summary>
    /// Read-only, occlusion-correct screen coverage by material family. For each camera the scene is rendered normally,
    /// then once per family with that family's material slots swapped to flat magenta unlit; pixels that change are the
    /// family's visible share. Sky = pixels no family changes. Pilot/HUD, targets and text are hidden (env view).
    /// Used to rank remaining concept gaps by visible area; nothing is saved.
    /// </summary>
    public static class SprintV23Coverage
    {
        [Serializable] public class Share { public string family; public float fraction,luminanceStdDev; }
        [Serializable] public class ViewResult { public string view,scene; public bool playerHeight; public List<Share> shares=new List<Share>(); }
        [Serializable] public class Receipt { public string utc,scene,method="Occlusion-correct material-family masks via magenta slot swaps; 480x270 renders, threshold 0.10 summed RGB difference; env view (pilot, targets, text hidden).";public List<ViewResult> views=new List<ViewResult>(); public List<Share> overviewMean=new List<Share>(),playerHeightMean=new List<Share>(); }
        static readonly string[] Families={"road deck (v17 industrial deck)","canyon rock (v14 strata)","structures and props","water (v20 teal / v22 river)","v23 bases, shields and flyers"};
        static int FamilyOf(Material m)
        {
            if(m==null)return -1;string n=m.name;
            if(n=="Road graphite"||n=="V17 industrial deck graphite")return 0;
            if(n.StartsWith("V14 strata ",StringComparison.Ordinal))return 1;
            if(n=="06 Deep teal water"||n=="07 Teal current ribbons"||n.StartsWith("V22 canyon river",StringComparison.Ordinal))return 3;
            if(n.StartsWith("V23 ",StringComparison.Ordinal))return 4;
            return 2;
        }
        public static void RunBoth(){Run(SprintV23.SourceScene,"v22-coverage.json");Run(SprintV23.ScenePath,"v23-coverage.json");}
        public static void Run(string scene,string file)
        {
            var receipt=new Receipt{utc=DateTime.UtcNow.ToString("o"),scene=scene};string hash=SprintV13Capture.Hash(scene);bool oldAsync=ShaderUtil.allowAsyncCompilation;
            EditorSceneManager.OpenScene(scene,OpenSceneMode.Single);ShaderUtil.allowAsyncCompilation=false;
            var pilot=UnityEngine.Object.FindFirstObjectByType<QuestPilotControls>();var cam=pilot.GetComponentInChildren<Camera>();
            float h=cam.transform.position.y-pilot.transform.position.y+pilot.GetComponent<CharacterController>().skinWidth;
            var hide=new HashSet<Renderer>(pilot.GetComponentsInChildren<Renderer>(true));
            foreach(var t in UnityEngine.Object.FindObjectsByType<PracticeTarget>(FindObjectsSortMode.None))foreach(var r in t.GetComponentsInChildren<Renderer>(true))hide.Add(r);
            foreach(var t in UnityEngine.Object.FindObjectsByType<TextMesh>(FindObjectsSortMode.None)){var r=t.GetComponent<Renderer>();if(r)hide.Add(r);}
            var hidden=hide.Where(r=>r.enabled).ToArray();foreach(var r in hidden)r.enabled=false;
            var magenta=new Material(Shader.Find("Universal Render Pipeline/Unlit"));magenta.SetColor("_BaseColor",Color.magenta);
            var all=UnityEngine.Object.FindObjectsByType<Renderer>(FindObjectsSortMode.None).Where(r=>r.enabled&&r.gameObject.activeInHierarchy).ToArray();
            var saved=all.ToDictionary(r=>r,r=>r.sharedMaterials);
            SprintV13Capture.View V(string n,Vector3 p,Vector3 t,float fov=72)=>new SprintV13Capture.View{name=n,position=p,target=t,fov=fov};
            var views=new List<(SprintV13Capture.View v,bool player)>{
                (V("route-overview",new Vector3(105,90,-70),new Vector3(0,12,62),55),false),
                (V("compounds-overview",new Vector3(0,72,-98),new Vector3(0,4,2),58),false),
                (V("basin-overview-west",new Vector3(-150,70,-40),new Vector3(-20,0,20),55),false),
                (V("spawn-cockpit",cam.transform.position,cam.transform.position+cam.transform.forward*60,cam.fieldOfView),true),
                (V("lower-approach",new Vector3(-18,.35f+h,8),new Vector3(-10,13,60)),true),
                (V("middle-ascent",new Vector3(-14,7.85f+h,37),new Vector3(-2,22,82)),true),
                (V("radar-to-energy",new Vector3(-2,14.35f+h,65),new Vector3(-12,3,10)),true),
                (V("radar-to-artillery",new Vector3(7,14.35f+h,68),new Vector3(0,34,126)),true),
                (V("a-plaza-to-se-logistics",new Vector3(8,.35f+h,-8),new Vector3(38,8,-30)),true),
                (V("a-plaza-to-ne-service",new Vector3(14,.35f+h,-2),new Vector3(32,10,31)),true),
                (V("spawn-road-east",new Vector3(-80,.35f+h,0),new Vector3(-20,2,0)),true)};
            try
            {
                foreach(var (v,player) in views)
                {
                    var baseImg=Render(cam,v);var changedAny=new bool[baseImg.Length];var res=new ViewResult{view=v.name,scene=scene,playerHeight=player};
                    for(int f=0;f<Families.Length;f++)
                    {
                        foreach(var r in all){var m=saved[r];r.sharedMaterials=m.Select(x=>FamilyOf(x)==f?magenta:x).ToArray();}
                        var img=Render(cam,v);int n=0;
                        double sum=0,sq=0;
                        for(int i=0;i<img.Length;i++){var a=baseImg[i];var b=img[i];if(Mathf.Abs(a.r-b.r)+Mathf.Abs(a.g-b.g)+Mathf.Abs(a.b-b.b)>.10f){n++;changedAny[i]=true;float y=.2126f*a.r+.7152f*a.g+.0722f*a.b;sum+=y;sq+=y*y;}}
                        float sd=n>1?(float)Math.Sqrt(Math.Max(0,sq/n-(sum/n)*(sum/n))):0; // spread of the family's own visible pixels (texture/tone variety)
                        res.shares.Add(new Share{family=Families[f],fraction=n/(float)img.Length,luminanceStdDev=sd});
                        foreach(var r in all)r.sharedMaterials=saved[r];
                    }
                    res.shares.Add(new Share{family="sky / background",fraction=changedAny.Count(x=>!x)/(float)changedAny.Length});
                    receipt.views.Add(res);
                }
                foreach(var (list,flag) in new[]{(receipt.overviewMean,false),(receipt.playerHeightMean,true)})
                    foreach(var fam in receipt.views[0].shares.Select(s=>s.family))
                        list.Add(new Share{family=fam,fraction=receipt.views.Where(x=>x.playerHeight==flag).Average(x=>x.shares.First(s=>s.family==fam).fraction),luminanceStdDev=receipt.views.Where(x=>x.playerHeight==flag).Average(x=>x.shares.First(s=>s.family==fam).luminanceStdDev)});
            }
            finally{foreach(var r in all)if(r)r.sharedMaterials=saved[r];foreach(var r in hidden)if(r)r.enabled=true;ShaderUtil.allowAsyncCompilation=oldAsync;UnityEngine.Object.DestroyImmediate(magenta);}
            if(SprintV13Capture.Hash(scene)!=hash)throw new InvalidOperationException("scene changed during coverage");
            File.WriteAllText(Path.Combine(SprintV23.Evidence,file),JsonUtility.ToJson(receipt,true));Debug.Log("VESPER_V23_COVERAGE "+scene);
        }
        static Color[] Render(Camera source,SprintV13Capture.View view)
        {
            const int w=480,h=270;var holder=new GameObject("Temporary v23 coverage camera");var camera=holder.AddComponent<Camera>();var prev=RenderTexture.active;RenderTexture rt=null;Texture2D img=null;
            try
            {
                camera.CopyFrom(source);camera.enabled=false;camera.tag="Untagged";camera.stereoTargetEye=StereoTargetEyeMask.None;
                holder.transform.SetPositionAndRotation(view.position,Quaternion.LookRotation(view.target-view.position,Vector3.up));camera.fieldOfView=view.fov;camera.farClipPlane=600;camera.aspect=(float)w/h;
                rt=RenderTexture.GetTemporary(w,h,24,RenderTextureFormat.ARGB32);camera.targetTexture=rt;var req=new UniversalRenderPipeline.SingleCameraRequest{destination=rt};
                for(int i=0;i<2;i++)if(RenderPipeline.SupportsRenderRequest(camera,req))RenderPipeline.SubmitRenderRequest(camera,req);else camera.Render();
                RenderTexture.active=rt;img=new Texture2D(w,h,TextureFormat.RGB24,false);img.ReadPixels(new Rect(0,0,w,h),0,0);img.Apply();return img.GetPixels();
            }
            finally{RenderTexture.active=prev;camera.targetTexture=null;if(rt)RenderTexture.ReleaseTemporary(rt);if(img)UnityEngine.Object.DestroyImmediate(img);UnityEngine.Object.DestroyImmediate(holder);}
        }
    }
}
#endif

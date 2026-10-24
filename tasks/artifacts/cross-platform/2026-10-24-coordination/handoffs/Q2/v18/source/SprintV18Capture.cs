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
    /// <summary>Matched v17/v18 Editor mono renders from identical cameras (method of SprintV15/V17Capture), weighted to
    /// player-height sightlines toward the canyon rim, plus overviews and the v16 player-HUD cockpit view. Read-only.</summary>
    public static class SprintV18Capture
    {
        public static readonly string Images=Path.Combine(Path.GetDirectoryName(SprintV18.Evidence),"images");
        [Serializable] public class Shot { public string scene,file,sha256; public SprintV13Capture.View camera; public bool cleanEnvironment; public int hiddenRenderers; }
        [Serializable] public class Receipt
        {
            public string utc,failure,v17SHA256,v18SHA256; public bool passed,savedScenesUnchanged; public float viewHeightOverSurface;
            public string method="Matched 1920x1080 Editor mono renders (URP SingleCameraRequest, two submissions, synchronous shader compilation, 600 m far clip) from identical cameras. Player-height views use the saved pilot eye offset plus controller skin above the A plaza / route surfaces. Clean images temporarily disable pilot/target renderers and TextMesh debug labels only. Not a headset, stereo or performance capture.";
            public List<Shot> images=new List<Shot>();
        }
        static List<SprintV13Capture.View> Views(float h,Camera source)
        {
            SprintV13Capture.View V(string n,Vector3 p,Vector3 t,float fov=72)=>new SprintV13Capture.View{name=n,position=p,target=t,fov=fov};
            return new List<SprintV13Capture.View>{
                V("route-overview",new Vector3(105,90,-70),new Vector3(0,12,62),55),
                V("compounds-overview",new Vector3(0,72,-98),new Vector3(0,4,2),58),
                V("basin-overview-west",new Vector3(-150,70,-40),new Vector3(-20,0,20),55),
                V("lower-approach",new Vector3(-18,.35f+h,8),new Vector3(-10,13,60)),
                V("middle-ascent",new Vector3(-14,7.85f+h,37),new Vector3(-2,22,82)),
                V("radar-to-artillery",new Vector3(7,14.35f+h,68),new Vector3(0,34,126)),
                V("radar-to-energy",new Vector3(-2,14.35f+h,65),new Vector3(-12,3,10)),
                V("spawn-road-east",new Vector3(-80,.35f+h,0),new Vector3(-20,2,0)),
                V("a-plaza-to-ne-service",new Vector3(14,.35f+h,-2),new Vector3(32,10,31)),
                V("a-plaza-to-se-logistics",new Vector3(8,.35f+h,-8),new Vector3(38,8,-30)),
                V("south-road-west",new Vector3(40,.35f+h,-56),new Vector3(-20,1,-60)),
                V("original-spawn",source.transform.position,source.transform.position+source.transform.forward*60,source.fieldOfView)
            };
        }
        public static void Run() => Run(new[]{SprintV17.ScenePath,SprintV18.ScenePath},new[]{"v17-before","v18-after"},"v18-matched-captures.json",true);
        static void Run(string[] scenes,string[] prefixes,string receiptName,bool debugSpawn)
        {
            var receipt=new Receipt{utc=DateTime.UtcNow.ToString("o")};bool oldAsync=ShaderUtil.allowAsyncCompilation;
            var before=scenes.Select(SprintV13Capture.Hash).ToArray();int expected=0;
            try
            {
                Directory.CreateDirectory(Images);
                receipt.v17SHA256=SprintV13Capture.Hash(SprintV17.ScenePath);if(File.Exists(SprintV18.ScenePath))receipt.v18SHA256=SprintV13Capture.Hash(SprintV18.ScenePath);
                EditorSceneManager.OpenScene(scenes[0]);var pilot=UnityEngine.Object.FindFirstObjectByType<QuestPilotControls>();var source=pilot.GetComponentInChildren<Camera>();
                float h=receipt.viewHeightOverSurface=source.transform.position.y-pilot.transform.position.y+pilot.GetComponent<CharacterController>().skinWidth;
                var views=Views(h,source);
                ShaderUtil.allowAsyncCompilation=false;
                for(int s=0;s<scenes.Length;s++)
                {
                    EditorSceneManager.OpenScene(scenes[s]);pilot=UnityEngine.Object.FindFirstObjectByType<QuestPilotControls>();source=pilot.GetComponentInChildren<Camera>();
                    var hidden=DebugRenderers(pilot).Where(x=>x.enabled).ToArray();
                    foreach(var r in hidden)r.enabled=false;
                    try { foreach(var view in views){Render(receipt,scenes[s],prefixes[s],source,view,true,hidden.Length);expected++;} }
                    finally { foreach(var r in hidden)if(r)r.enabled=true; }
                    if(debugSpawn){Render(receipt,scenes[s],prefixes[s],source,views.Last(),false,0);expected++;}
                }
                receipt.savedScenesUnchanged=scenes.Select(SprintV13Capture.Hash).SequenceEqual(before);
                receipt.passed=receipt.savedScenesUnchanged&&receipt.images.Count==expected;
            }
            catch(Exception e){receipt.failure=e.ToString();}
            finally {ShaderUtil.allowAsyncCompilation=oldAsync;}
            File.WriteAllText(Path.Combine(SprintV18.Evidence,receiptName),JsonUtility.ToJson(receipt,true));
            if(!receipt.passed)throw new InvalidOperationException("v18 captures failed: "+receipt.failure);
            Debug.Log("VESPER_V18_CAPTURES_PASS images="+receipt.images.Count);
        }
        static IEnumerable<Renderer> DebugRenderers(QuestPilotControls pilot)
        {
            var found=new HashSet<Renderer>(pilot.GetComponentsInChildren<Renderer>(true));
            foreach(var target in UnityEngine.Object.FindObjectsByType<PracticeTarget>(FindObjectsSortMode.None))foreach(var r in target.GetComponentsInChildren<Renderer>(true))found.Add(r);
            foreach(var text in UnityEngine.Object.FindObjectsByType<TextMesh>(FindObjectsSortMode.None)){var r=text.GetComponent<Renderer>();if(r)found.Add(r);}
            return found;
        }
        static void Render(Receipt receipt,string scene,string prefix,Camera source,SprintV13Capture.View view,bool clean,int hidden)
        {
            const int width=1920,height=1080;
            var holder=new GameObject("Temporary v18 review camera");var camera=holder.AddComponent<Camera>();var previous=RenderTexture.active;
            RenderTexture rt=null;Texture2D image=null;
            try
            {
                camera.CopyFrom(source);camera.enabled=false;camera.tag="Untagged";camera.stereoTargetEye=StereoTargetEyeMask.None;
                holder.transform.SetPositionAndRotation(view.position,Quaternion.LookRotation(view.target-view.position,Vector3.up));
                camera.orthographic=false;camera.fieldOfView=view.fov;camera.farClipPlane=600;camera.aspect=(float)width/height;
                rt=RenderTexture.GetTemporary(width,height,24,RenderTextureFormat.ARGB32);camera.targetTexture=rt;
                var request=new UniversalRenderPipeline.SingleCameraRequest{destination=rt};
                for(int i=0;i<2;i++)if(RenderPipeline.SupportsRenderRequest(camera,request))RenderPipeline.SubmitRenderRequest(camera,request);else camera.Render();
                RenderTexture.active=rt;image=new Texture2D(width,height,TextureFormat.RGB24,false);image.ReadPixels(new Rect(0,0,width,height),0,0);image.Apply();
                string file=prefix+"-"+view.name+(clean?"-clean":"-debug")+".png";string path=Path.Combine(Images,file);File.WriteAllBytes(path,image.EncodeToPNG());
                receipt.images.Add(new Shot{scene=scene,file="images/"+file,sha256=SprintV13Capture.Hash(path),camera=view,cleanEnvironment=clean,hiddenRenderers=hidden});
            }
            finally {RenderTexture.active=previous;camera.targetTexture=null;if(rt)RenderTexture.ReleaseTemporary(rt);if(image)UnityEngine.Object.DestroyImmediate(image);UnityEngine.Object.DestroyImmediate(holder);}
        }
    }
}
#endif

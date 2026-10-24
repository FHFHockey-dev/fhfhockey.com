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
    /// <summary>Matched v14/v15 Editor mono renders from identical cameras (method of SprintV13/V14Capture), focused on
    /// the four octagonal compounds plus the v13/v14 route viewpoints. Read-only for every scene.</summary>
    public static class SprintV15Capture
    {
        public static readonly string Images=Path.Combine(Path.GetDirectoryName(SprintV15.Evidence),"images");
        [Serializable] public class Shot { public string scene,file,sha256; public SprintV13Capture.View camera; public bool cleanEnvironment; public int hiddenRenderers; }
        [Serializable] public class Receipt
        {
            public string utc,failure,v14SHA256,v15SHA256; public bool passed,savedScenesUnchanged; public float viewHeightOverSurface;
            public string method="Matched 1920x1080 Editor mono renders (URP SingleCameraRequest, two submissions, synchronous shader compilation, 600 m far clip) from identical cameras. Player-height views use the saved pilot eye offset plus controller skin above the A plaza / route surfaces. Clean images temporarily disable pilot/target renderers and TextMesh debug labels only. Not a headset, stereo or performance capture.";
            public List<Shot> images=new List<Shot>();
        }
        static List<SprintV13Capture.View> Views(float h,Camera source)
        {
            SprintV13Capture.View V(string n,Vector3 p,Vector3 t,float fov=72)=>new SprintV13Capture.View{name=n,position=p,target=t,fov=fov};
            return new List<SprintV13Capture.View>{
                V("compounds-overview",new Vector3(0,72,-98),new Vector3(0,4,2),58),
                V("a-plaza-to-ne-service",new Vector3(14,.35f+h,-2),new Vector3(32,10,31)),
                V("a-plaza-to-nw-comms",new Vector3(-14,.35f+h,-2),new Vector3(-46,8,29)),
                V("a-plaza-to-se-logistics",new Vector3(8,.35f+h,-8),new Vector3(38,8,-30)),
                V("a-plaza-to-sw-loading",new Vector3(-8,.35f+h,-8),new Vector3(-29,7,-31)),
                V("ne-service-close",new Vector3(56,26,8),new Vector3(32,11,31),55),
                V("nw-comms-close",new Vector3(-70,24,6),new Vector3(-46,9,29),55),
                V("se-logistics-close",new Vector3(62,24,-54),new Vector3(38,8,-30),55),
                V("sw-loading-close",new Vector3(-53,22,-55),new Vector3(-29,7,-31),55),
                // v13/v14 route viewpoints kept so the ascent is re-checked against the same cameras.
                V("route-overview",new Vector3(105,90,-70),new Vector3(0,12,62),55),
                V("radar-to-energy",new Vector3(-2,14.35f+h,65),new Vector3(-12,3,10)),
                V("original-spawn",source.transform.position,source.transform.position+source.transform.forward*60,source.fieldOfView)
            };
        }
        /// <summary>v14-only renders used to design the v15 variation before any v15 scene exists.</summary>
        public static void Preview() => Run(new[]{SprintV14.ScenePath},new[]{"v14-preview"},"v15-preview-captures.json",false);
        public static void RunMatched() => Run(new[]{SprintV14.ScenePath,SprintV15.ScenePath},new[]{"v14-before","v15-after"},"v15-matched-captures.json",true);
        static void Run(string[] scenes,string[] prefixes,string receiptName,bool debugSpawn)
        {
            var receipt=new Receipt{utc=DateTime.UtcNow.ToString("o")};bool oldAsync=ShaderUtil.allowAsyncCompilation;
            var before=scenes.Select(SprintV13Capture.Hash).ToArray();int expected=0;
            try
            {
                Directory.CreateDirectory(Images);
                receipt.v14SHA256=SprintV13Capture.Hash(SprintV14.ScenePath);if(File.Exists(SprintV15.ScenePath))receipt.v15SHA256=SprintV13Capture.Hash(SprintV15.ScenePath);
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
            File.WriteAllText(Path.Combine(SprintV15.Evidence,receiptName),JsonUtility.ToJson(receipt,true));
            if(!receipt.passed)throw new InvalidOperationException("v15 captures failed: "+receipt.failure);
            Debug.Log("VESPER_V15_CAPTURES_PASS images="+receipt.images.Count);
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
            var holder=new GameObject("Temporary v15 review camera");var camera=holder.AddComponent<Camera>();var previous=RenderTexture.active;
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

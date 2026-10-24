#if UNITY_EDITOR
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Unity.Profiling;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

namespace VesperBasin.Editor
{
    /// <summary>Matched v13/v14 Editor mono renders from identical cameras. Same method as SprintV13Capture, plus
    /// close views of the changed rock and per-render ProfilerRecorder render counters where the Editor reports them.</summary>
    public static class SprintV14Capture
    {
        public static readonly string Images=Path.Combine(Path.GetDirectoryName(SprintV14.Evidence),"images");
        [Serializable] public class Stats { public bool available; public long batches,drawCalls,setPassCalls,triangles,vertices; }
        [Serializable] public class Shot { public string scene,file,sha256; public SprintV13Capture.View camera; public bool cleanEnvironment; public int hiddenRenderers; public Stats stats; }
        [Serializable] public class Receipt
        {
            public string utc,failure,v13SHA256,v14SHA256; public bool passed,savedScenesUnchanged; public float viewHeightOverSurface;
            public string method="Matched 1920x1080 Editor mono renders (URP SingleCameraRequest, two submissions, synchronous shader compilation, 600 m far clip) of the saved v13 and v14 scenes from identical cameras. Player-height views use the saved pilot eye offset plus controller skin above route surfaces. Clean images temporarily disable pilot/target renderers and TextMesh debug labels only; debug images show the actual spawn presentation. Render counters come from Unity ProfilerRecorder around the review camera render; stats.available=false means the Editor reported no counters for that batch-mode offscreen render (zeros are not measurements). Any counters are Editor desktop figures, not Quest headset frame cost.";
            public List<Shot> images=new List<Shot>();
        }
        public static void Run()
        {
            var receipt=new Receipt{utc=DateTime.UtcNow.ToString("o")};bool oldAsync=ShaderUtil.allowAsyncCompilation;
            try
            {
                Directory.CreateDirectory(Images);
                receipt.v13SHA256=SprintV13Capture.Hash(SprintV13.ScenePath);receipt.v14SHA256=SprintV13Capture.Hash(SprintV14.ScenePath);
                EditorSceneManager.OpenScene(SprintV13.ScenePath);var pilot=UnityEngine.Object.FindFirstObjectByType<QuestPilotControls>();var source=pilot.GetComponentInChildren<Camera>();
                float h=receipt.viewHeightOverSurface=source.transform.position.y-pilot.transform.position.y+pilot.GetComponent<CharacterController>().skinWidth;
                var views=new List<SprintV13Capture.View>{
                    // v13 handoff viewpoints (identical parameters).
                    new SprintV13Capture.View{name="lower-approach",position=new Vector3(-18,.35f+h,8),target=new Vector3(-10,13,60)},
                    new SprintV13Capture.View{name="middle-ascent",position=new Vector3(-14,7.85f+h,37),target=new Vector3(-2,22,82)},
                    new SprintV13Capture.View{name="radar-to-artillery",position=new Vector3(7,14.35f+h,68),target=new Vector3(0,34,126)},
                    new SprintV13Capture.View{name="radar-to-energy",position=new Vector3(-2,14.35f+h,65),target=new Vector3(-12,3,10)},
                    new SprintV13Capture.View{name="route-overview",position=new Vector3(105,90,-70),target=new Vector3(0,12,62),fov=55},
                    new SprintV13Capture.View{name="original-spawn",position=source.transform.position,target=source.transform.position+source.transform.forward*60,fov=source.fieldOfView},
                    // v14 close views of the changed throat buttresses/caps and inherited strata, at route player height.
                    new SprintV13Capture.View{name="throat-east-close",position=new Vector3(-14,7.85f+h,37),target=new Vector3(10,6,33)},
                    new SprintV13Capture.View{name="throat-west-close",position=new Vector3(-12,10.35f+h,46),target=new Vector3(-32,7,27)},
                    new SprintV13Capture.View{name="descent-landing",position=new Vector3(-10,10.35f+h,46),target=new Vector3(-18,2,8)},
                    new SprintV13Capture.View{name="basin-overview-west",position=new Vector3(-150,70,-40),target=new Vector3(-20,0,20),fov=55}
                };
                ShaderUtil.allowAsyncCompilation=false;
                foreach(var scene in new[]{SprintV13.ScenePath,SprintV14.ScenePath})
                {
                    EditorSceneManager.OpenScene(scene);pilot=UnityEngine.Object.FindFirstObjectByType<QuestPilotControls>();source=pilot.GetComponentInChildren<Camera>();
                    string prefix=scene==SprintV13.ScenePath?"v13-before":"v14-after";
                    var hidden=DebugRenderers(pilot).Where(x=>x.enabled).ToArray();
                    foreach(var r in hidden)r.enabled=false;
                    try { foreach(var view in views)Render(receipt,scene,prefix,source,view,true,hidden.Length); }
                    finally { foreach(var r in hidden)if(r)r.enabled=true; }
                    Render(receipt,scene,prefix,source,views.First(v=>v.name=="original-spawn"),false,0);
                }
                receipt.savedScenesUnchanged=receipt.v13SHA256==SprintV13Capture.Hash(SprintV13.ScenePath)&&receipt.v14SHA256==SprintV13Capture.Hash(SprintV14.ScenePath);
                receipt.passed=receipt.savedScenesUnchanged&&receipt.images.Count==2*(views.Count+1);
            }
            catch(Exception e){receipt.failure=e.ToString();}
            finally {ShaderUtil.allowAsyncCompilation=oldAsync;}
            File.WriteAllText(Path.Combine(SprintV14.Evidence,"v14-matched-captures.json"),JsonUtility.ToJson(receipt,true));
            if(!receipt.passed)throw new InvalidOperationException("v14 captures failed: "+receipt.failure);
            Debug.Log("VESPER_V14_MATCHED_CAPTURES_PASS images="+receipt.images.Count);
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
            var holder=new GameObject("Temporary v14 review camera");var camera=holder.AddComponent<Camera>();var previous=RenderTexture.active;
            RenderTexture rt=null;Texture2D image=null;
            var recorders=new[]{"Batches Count","Draw Calls Count","SetPass Calls Count","Triangles Count","Vertices Count"}
                .Select(n=>ProfilerRecorder.StartNew(ProfilerCategory.Render,n)).ToArray();
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
                var stats=new Stats{available=recorders.Any(r=>r.Valid&&r.LastValue>0),batches=recorders[0].LastValue,drawCalls=recorders[1].LastValue,setPassCalls=recorders[2].LastValue,triangles=recorders[3].LastValue,vertices=recorders[4].LastValue};
                receipt.images.Add(new Shot{scene=scene,file="images/"+file,sha256=SprintV13Capture.Hash(path),camera=view,cleanEnvironment=clean,hiddenRenderers=hidden,stats=stats});
            }
            finally
            {
                foreach(var r in recorders)r.Dispose();
                RenderTexture.active=previous;camera.targetTexture=null;if(rt)RenderTexture.ReleaseTemporary(rt);if(image)UnityEngine.Object.DestroyImmediate(image);UnityEngine.Object.DestroyImmediate(holder);
            }
        }
    }
}
#endif

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
    /// <summary>Matched v22/v23 Editor mono renders from identical cameras (method of SprintV15-V18Capture): overviews,
    /// player-height views toward every objective and along lanes, and the saved spawn with the player HUD. v22 beacon
    /// icons are yaw-turned toward each review camera exactly as V22YawBillboard does at runtime, then restored. Read-only.</summary>
    public static class SprintV23Capture
    {
        public static readonly string Images=Path.Combine(Path.GetDirectoryName(SprintV23.Evidence),"images");
        [Serializable] public class Shot { public string scene,file,sha256; public SprintV13Capture.View camera; public bool cleanEnvironment; public int hiddenRenderers; }
        [Serializable] public class Receipt
        {
            public string utc,failure,v22SHA256,v23SHA256; public bool passed,savedScenesUnchanged; public float viewHeightOverSurface;
            public string method="Matched 1920x1080 Editor mono renders (URP SingleCameraRequest, two submissions, synchronous shader compilation, 600 m far clip) from identical cameras. Player-height views use the saved pilot eye offset plus controller skin above the A plaza / route surfaces. Clean images temporarily disable pilot/HUD renderers, practice targets and their state labels only; world signs and beacon letters stay visible in both scenes. Not a headset, stereo or performance capture.";
            public List<Shot> images=new List<Shot>();
        }
        static List<SprintV13Capture.View> Views(float h,Camera source)
        {
            SprintV13Capture.View V(string n,Vector3 p,Vector3 t,float fov=72)=>new SprintV13Capture.View{name=n,position=p,target=t,fov=fov};
            return new List<SprintV13Capture.View>{
                V("route-overview",new Vector3(105,90,-70),new Vector3(0,12,62),55),
                V("compounds-overview",new Vector3(0,72,-98),new Vector3(0,4,2),58),
                V("basin-overview-west",new Vector3(-150,70,-40),new Vector3(-20,0,20),55),
                V("high-plan-oblique",new Vector3(0,150,-120),new Vector3(0,0,0),55),
                V("spawn-road-east",new Vector3(-80,.35f+h,0),new Vector3(-20,2,0)),
                V("a-plaza-to-b-repair",new Vector3(10,.35f+h,-4),new Vector3(56,6,7)),
                V("a-plaza-to-se-logistics",new Vector3(8,.35f+h,-8),new Vector3(38,8,-30)),
                V("south-road-to-d",new Vector3(25,.35f+h,-58),new Vector3(55,6,-64)),
                V("south-road-to-e",new Vector3(-25,.35f+h,-58),new Vector3(-54,6,-66)),
                V("lower-approach",new Vector3(-18,.35f+h,8),new Vector3(-10,13,60)),
                V("radar-to-energy",new Vector3(-2,14.35f+h,65),new Vector3(-12,3,10)),
                V("blue-base-road-west",new Vector3(85,.35f+h,0),new Vector3(20,2,0)),
                V("red-base-rear-oblique",new Vector3(-60,40,-55),new Vector3(-108,6,0),55),
                V("blue-base-rear-oblique",new Vector3(60,40,55),new Vector3(108,6,0),55),
                V("e-drone-sky",new Vector3(-30,.35f+h,-50),new Vector3(-54,22,-66)),
                V("original-spawn",source.transform.position,source.transform.position+source.transform.forward*60,source.fieldOfView)
            };
        }
        public static void Run() => Run(new[]{SprintV23.SourceScene,SprintV23.ScenePath},new[]{"v22-before","v23-after"},"v23-matched-captures.json",true);
        static void Run(string[] scenes,string[] prefixes,string receiptName,bool debugSpawn)
        {
            var receipt=new Receipt{utc=DateTime.UtcNow.ToString("o")};bool oldAsync=ShaderUtil.allowAsyncCompilation;
            var before=scenes.Select(SprintV13Capture.Hash).ToArray();int expected=0;
            try
            {
                Directory.CreateDirectory(Images);
                receipt.v22SHA256=SprintV13Capture.Hash(SprintV23.SourceScene);if(File.Exists(SprintV23.ScenePath))receipt.v23SHA256=SprintV13Capture.Hash(SprintV23.ScenePath);
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
            File.WriteAllText(Path.Combine(SprintV23.Evidence,receiptName),JsonUtility.ToJson(receipt,true));
            if(!receipt.passed)throw new InvalidOperationException("v23 captures failed: "+receipt.failure);
            Debug.Log("VESPER_V23_CAPTURES_PASS images="+receipt.images.Count);
        }
        static IEnumerable<Renderer> DebugRenderers(QuestPilotControls pilot)
        {
            var found=new HashSet<Renderer>(pilot.GetComponentsInChildren<Renderer>(true));
            foreach(var target in UnityEngine.Object.FindObjectsByType<PracticeTarget>(FindObjectsSortMode.None))foreach(var r in target.GetComponentsInChildren<Renderer>(true))found.Add(r);
            // v22 convention (both scenes): hide only pilot/HUD and target state labels; world signs and beacon letters are presentation.
            foreach(var text in UnityEngine.Object.FindObjectsByType<TextMesh>(FindObjectsSortMode.None)){var r=text.GetComponent<Renderer>();if(r&&text.GetComponentInParent<PracticeTarget>()!=null)found.Add(r);}
            return found;
        }
        static readonly Dictionary<V22YawBillboard,Quaternion> billboards=new Dictionary<V22YawBillboard,Quaternion>();
        static void Render(Receipt receipt,string scene,string prefix,Camera source,SprintV13Capture.View view,bool clean,int hidden)
        {
            const int width=1920,height=1080;
            var holder=new GameObject("Temporary v23 review camera");var camera=holder.AddComponent<Camera>();var previous=RenderTexture.active;
            RenderTexture rt=null;Texture2D image=null;
            try
            {
                camera.CopyFrom(source);camera.enabled=false;camera.tag="Untagged";camera.stereoTargetEye=StereoTargetEyeMask.None;
                holder.transform.SetPositionAndRotation(view.position,Quaternion.LookRotation(view.target-view.position,Vector3.up));
                foreach(var b in UnityEngine.Object.FindObjectsByType<V22YawBillboard>(FindObjectsSortMode.None))
                {
                    if(!billboards.ContainsKey(b))billboards[b]=b.transform.rotation;
                    Vector3 d=b.transform.position-view.position;d.y=0;if(d.sqrMagnitude>1e-4f)b.transform.rotation=Quaternion.LookRotation(d.normalized,Vector3.up);
                }
                camera.orthographic=false;camera.fieldOfView=view.fov;camera.farClipPlane=600;camera.aspect=(float)width/height;
                rt=RenderTexture.GetTemporary(width,height,24,RenderTextureFormat.ARGB32);camera.targetTexture=rt;
                var request=new UniversalRenderPipeline.SingleCameraRequest{destination=rt};
                for(int i=0;i<2;i++)if(RenderPipeline.SupportsRenderRequest(camera,request))RenderPipeline.SubmitRenderRequest(camera,request);else camera.Render();
                RenderTexture.active=rt;image=new Texture2D(width,height,TextureFormat.RGB24,false);image.ReadPixels(new Rect(0,0,width,height),0,0);image.Apply();
                string file=prefix+"-"+view.name+(clean?"-clean":"-debug")+".png";string path=Path.Combine(Images,file);File.WriteAllBytes(path,image.EncodeToPNG());
                receipt.images.Add(new Shot{scene=scene,file="images/"+file,sha256=SprintV13Capture.Hash(path),camera=view,cleanEnvironment=clean,hiddenRenderers=hidden});
            }
            finally {foreach(var kv in billboards)if(kv.Key)kv.Key.transform.rotation=kv.Value;billboards.Clear();RenderTexture.active=previous;camera.targetTexture=null;if(rt)RenderTexture.ReleaseTemporary(rt);if(image)UnityEngine.Object.DestroyImmediate(image);UnityEngine.Object.DestroyImmediate(holder);}
        }
    }
}
#endif

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
    /// Matched v15/v16 cockpit captures from the saved pilot camera at the spawn and three route stations. Each station
    /// is rendered in three presentations: env (pilot, targets and text hidden, as earlier clean shots), player (the
    /// scene as saved: v15 debug panels, v16 player HUD) and debug (debug instrumentation shown; for v16 via
    /// V16PlayerHud.SetDebugMode). Route stations temporarily move the pilot in Edit Mode; nothing is saved and scene
    /// hashes are checked. Editor mono renders, not headset or stereo evidence.
    /// </summary>
    public static class SprintV16Capture
    {
        public static readonly string Images=Path.Combine(Path.GetDirectoryName(SprintV16.Evidence),"images");
        [Serializable] public class Station { public string name; public Vector3 feet,lookAt; }
        [Serializable] public class Shot { public string scene,file,sha256,station,presentation; public Vector3 cameraPosition,cameraEuler; public int hiddenRenderers; }
        [Serializable] public class Receipt
        {
            public string utc,failure,v15SHA256,v16SHA256; public bool passed,savedScenesUnchanged;
            public string method="1600x900 Editor mono renders (URP SingleCameraRequest, two submissions, synchronous shaders) through a copy of the saved pilot camera. Spawn uses the saved pilot pose; route stations place the pilot at the v13 route waypoints (plus the probe's 0.2 m setup lift) facing the listed point, in Edit Mode only. Same stations and camera parameters for v15 and v16.";
            public List<Station> stations=new List<Station>(); public List<Shot> images=new List<Shot>();
        }
        static readonly Station[] Stations={
            new Station{name="spawn"},
            new Station{name="lower-approach",feet=new Vector3(-18,.55f,8),lookAt=new Vector3(-18,5,28)},
            new Station{name="middle-ascent",feet=new Vector3(-10,10.55f,46),lookAt=new Vector3(-2,14,64)},
            new Station{name="radar-arrival-descent",feet=new Vector3(-2,14.55f,66),lookAt=new Vector3(-10,10,46)}};
        public static void Run()
        {
            var receipt=new Receipt{utc=DateTime.UtcNow.ToString("o"),stations=Stations.ToList()};bool oldAsync=ShaderUtil.allowAsyncCompilation;
            var scenes=new[]{SprintV15.ScenePath,SprintV16.ScenePath};var before=scenes.Select(SprintV13Capture.Hash).ToArray();
            try
            {
                Directory.CreateDirectory(Images);receipt.v15SHA256=before[0];receipt.v16SHA256=before[1];ShaderUtil.allowAsyncCompilation=false;
                foreach(var scene in scenes)
                {
                    EditorSceneManager.OpenScene(scene,OpenSceneMode.Single);
                    string prefix=scene==SprintV15.ScenePath?"v15-before":"v16-after";
                    var pilot=UnityEngine.Object.FindFirstObjectByType<QuestPilotControls>();var cam=pilot.GetComponentInChildren<Camera>();var hud=UnityEngine.Object.FindFirstObjectByType<V16PlayerHud>();
                    Vector3 savedPos=pilot.transform.position;Quaternion savedRot=pilot.transform.rotation;
                    foreach(var st in Stations)
                    {
                        if(st.name!="spawn")
                        {
                            var d=st.lookAt-st.feet;d.y=0;pilot.transform.SetPositionAndRotation(st.feet,Quaternion.LookRotation(d.normalized,Vector3.up));
                        }
                        else pilot.transform.SetPositionAndRotation(savedPos,savedRot);
                        // env: everything on the pilot plus targets and text labels hidden.
                        var env=new HashSet<Renderer>(pilot.GetComponentsInChildren<Renderer>(true));
                        foreach(var t in UnityEngine.Object.FindObjectsByType<PracticeTarget>(FindObjectsSortMode.None))foreach(var r in t.GetComponentsInChildren<Renderer>(true))env.Add(r);
                        foreach(var t in UnityEngine.Object.FindObjectsByType<TextMesh>(FindObjectsSortMode.None)){var r=t.GetComponent<Renderer>();if(r)env.Add(r);}
                        var envOn=env.Where(r=>r.enabled).ToArray();foreach(var r in envOn)r.enabled=false;
                        try{Render(receipt,scene,prefix,st.name,"env",cam,envOn.Length);}finally{foreach(var r in envOn)r.enabled=true;}
                        Render(receipt,scene,prefix,st.name,"player",cam,0);
                        if(hud!=null)
                        {
                            hud.SetDebugMode(true);
                            try{Render(receipt,scene,prefix,st.name,"debug",cam,0);}finally{hud.SetDebugMode(false);}
                        }
                        else Render(receipt,scene,prefix,st.name,"debug",cam,0);
                    }
                    pilot.transform.SetPositionAndRotation(savedPos,savedRot);
                }
                receipt.savedScenesUnchanged=scenes.Select(SprintV13Capture.Hash).SequenceEqual(before);
                receipt.passed=receipt.savedScenesUnchanged&&receipt.images.Count==scenes.Length*Stations.Length*3;
            }
            catch(Exception e){receipt.failure=e.ToString();}
            finally{ShaderUtil.allowAsyncCompilation=oldAsync;}
            File.WriteAllText(Path.Combine(SprintV16.Evidence,"v16-matched-captures.json"),JsonUtility.ToJson(receipt,true));
            if(!receipt.passed)throw new InvalidOperationException("v16 captures failed: "+receipt.failure);
            Debug.Log("VESPER_V16_CAPTURES_PASS images="+receipt.images.Count);
        }
        static void Render(Receipt receipt,string scene,string prefix,string station,string presentation,Camera source,int hidden)
        {
            const int width=1600,height=900;
            var holder=new GameObject("Temporary v16 cockpit camera");var camera=holder.AddComponent<Camera>();var previous=RenderTexture.active;
            RenderTexture rt=null;Texture2D image=null;
            try
            {
                camera.CopyFrom(source);camera.enabled=false;camera.tag="Untagged";camera.stereoTargetEye=StereoTargetEyeMask.None;
                holder.transform.SetPositionAndRotation(source.transform.position,source.transform.rotation);camera.aspect=(float)width/height;
                rt=RenderTexture.GetTemporary(width,height,24,RenderTextureFormat.ARGB32);camera.targetTexture=rt;
                var request=new UniversalRenderPipeline.SingleCameraRequest{destination=rt};
                for(int i=0;i<2;i++)if(RenderPipeline.SupportsRenderRequest(camera,request))RenderPipeline.SubmitRenderRequest(camera,request);else camera.Render();
                RenderTexture.active=rt;image=new Texture2D(width,height,TextureFormat.RGB24,false);image.ReadPixels(new Rect(0,0,width,height),0,0);image.Apply();
                string file=prefix+"-cockpit-"+station+"-"+presentation+".png";string path=Path.Combine(Images,file);File.WriteAllBytes(path,image.EncodeToPNG());
                receipt.images.Add(new Shot{scene=scene,file="images/"+file,sha256=SprintV13Capture.Hash(path),station=station,presentation=presentation,cameraPosition=camera.transform.position,cameraEuler=camera.transform.eulerAngles,hiddenRenderers=hidden});
            }
            finally{RenderTexture.active=previous;camera.targetTexture=null;if(rt)RenderTexture.ReleaseTemporary(rt);if(image)UnityEngine.Object.DestroyImmediate(image);UnityEngine.Object.DestroyImmediate(holder);}
        }
    }
}
#endif

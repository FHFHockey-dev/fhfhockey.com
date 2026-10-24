#if UNITY_EDITOR
using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.InputSystem.LowLevel;
using UnityEngine.InputSystem.XR;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;
using UnityEngine.SceneManagement;
using UnityEngine.XR.OpenXR.Features.Interactions;

namespace VesperBasin
{
    /// <summary>
    /// v16 player-HUD Play Mode probe on the saved v16 scene. Checks: saved player mode, debug instrumentation still live
    /// while hidden, debug toggle both ways (API and desktop F3), objective/progress/target/weapon/hint bindings through a
    /// real capture of A (one setup warp into the zone, then the real CaptureZone/actor simulation), and VR comfort
    /// geometry measured from the live pilot camera (angles, distance, glyph angular height, inside the proxy radius).
    /// Target state changes use PracticeTarget.ApplyHit directly: this probe tests the HUD binding, not firing (firing is
    /// covered by the reused practice-evidence probe). Desktop mono only; no headset legibility or comfort claim.
    /// </summary>
    public sealed class SprintV16HudProbe : MonoBehaviour
    {
        [Serializable] public sealed class CheckResult { public string name; public bool passed; public float measured; public string detail; }
        [Serializable] public sealed class Image { public string file,state; public string objective,weapon,hint; }
        [Serializable] public sealed class Receipt
        {
            public string runId,scene,utc,failure; public bool passed,realPlayMode,cleanupComplete;
            public float maxHorizontalDegrees,minDownDegrees,maxDownDegrees,minDistance,maxDistance,minGlyphDegrees,hudMaxRadiusFromPilot,proxyRadius;
            public List<CheckResult> checks=new List<CheckResult>(); public List<string> runtimeErrors=new List<string>(); public List<Image> images=new List<Image>();
            public string method="Saved v16 scene in Play Mode with virtual XRHMD + Oculus Touch + keyboard devices (as the v13 probes). Angles are from the live pilot camera to every corner of every player-HUD renderer's local bounds; glyph angular height uses the line's local bounds of the string 'ENERGY'. One setup warp places the pilot inside capture zone A; the zone then captures through its own simulation. Target damage is applied directly to test HUD binding only. Mono 1600x900 renders.";
        }
        public static string Output, RunId; public static Action Finished;
        readonly Receipt receipt=new Receipt();
        QuestPilotControls pilot; QuestPracticeWeapon weapon; V16PlayerHud hud; CaptureCockpitReadout readout; CaptureZone zone; Camera cam;
        XRHMD hmd; OculusTouchControllerProfile.OculusTouchController right, left; Keyboard keyboard, previousKeyboard;
        InputSettings settings; InputSettings.BackgroundBehavior background; InputSettings.EditorInputBehaviorInPlayMode editorInput; InputSettings.UpdateMode updateMode;
        float captureDelta,timeScale; bool runInBackground,savedSettings,savedTime,completing;
        void Check(string name,bool ok,float measured=0,string detail="")=>receipt.checks.Add(new CheckResult{name=name,passed=ok,measured=measured,detail=detail});
        IEnumerator Start()
        {
            DontDestroyOnLoad(gameObject);
            receipt.runId=RunId;receipt.utc=DateTime.UtcNow.ToString("o");receipt.scene=SceneManager.GetActiveScene().path;receipt.realPlayMode=Application.isPlaying;
            Application.logMessageReceived+=OnLog;
            var stack=new Stack<IEnumerator>();stack.Push(Run());
            while(stack.Count>0)
            {
                object current=null;Exception failure=null;bool next=false;
                try{next=stack.Peek().MoveNext();if(next)current=stack.Peek().Current;}catch(Exception e){failure=e;}
                if(failure!=null){receipt.failure=failure.ToString();Check("probe completed without exception",false);break;}
                if(!next){stack.Pop();continue;}
                if(current is IEnumerator nested){stack.Push(nested);continue;}
                yield return current;
            }
            Complete();
        }
        IEnumerator Run()
        {
            pilot=FindFirstObjectByType<QuestPilotControls>();weapon=FindFirstObjectByType<QuestPracticeWeapon>();hud=FindFirstObjectByType<V16PlayerHud>();readout=FindFirstObjectByType<CaptureCockpitReadout>();
            zone=FindFirstObjectByType<CaptureZone>();
            if(pilot==null||weapon==null||hud==null||readout==null||zone==null)throw new InvalidOperationException("Expected saved v16 pilot, weapon, player HUD, debug readout and zone");
            cam=pilot.GetComponentInChildren<Camera>();
            settings=InputSystem.settings;background=settings.backgroundBehavior;editorInput=settings.editorInputBehaviorInPlayMode;updateMode=settings.updateMode;savedSettings=true;
            captureDelta=Time.captureDeltaTime;timeScale=Time.timeScale;runInBackground=Application.runInBackground;savedTime=true;
            settings.backgroundBehavior=InputSettings.BackgroundBehavior.IgnoreFocus;settings.editorInputBehaviorInPlayMode=InputSettings.EditorInputBehaviorInPlayMode.AllDeviceInputAlwaysGoesToGameView;
            settings.updateMode=InputSettings.UpdateMode.ProcessEventsInDynamicUpdate;Time.captureDeltaTime=1f/60f;Application.runInBackground=true;
            previousKeyboard=Keyboard.current;keyboard=InputSystem.AddDevice<Keyboard>();keyboard.MakeCurrent();
            InputSystem.RegisterLayout<OculusTouchControllerProfile.OculusTouchController>();
            right=InputSystem.AddDevice<OculusTouchControllerProfile.OculusTouchController>();InputSystem.SetDeviceUsage(right,CommonUsages.RightHand);
            left=InputSystem.AddDevice<OculusTouchControllerProfile.OculusTouchController>();InputSystem.SetDeviceUsage(left,CommonUsages.LeftHand);
            hmd=InputSystem.AddDevice<XRHMD>();
            pilot.SendMessage("OnApplicationFocus",true);pilot.SendMessage("OnApplicationPause",false);weapon.SendMessage("OnApplicationFocus",true);weapon.SendMessage("OnApplicationPause",false);
            Set(hmd.isTracked,1f);InputSystem.QueueDeltaStateEvent(hmd.trackingState,3);InputSystem.QueueDeltaStateEvent(hmd.centerEyePosition,Vector3.zero);
            InputSystem.QueueDeltaStateEvent(hmd.centerEyeRotation,Quaternion.identity);Set(right.triggerPressed,0f);InputSystem.Update();
            yield return Frames(20);

            Check("saved scene starts in player mode",!hud.DebugMode&&hud.PlayerRenderers.All(r=>r.enabled)&&hud.DebugRenderers.All(r=>!r.enabled),hud.PlayerRenderers.Length,"debug renderers "+hud.DebugRenderers.Length);
            Check("objective line shows A neutral",hud.ObjectiveText.Contains("ENERGY")&&hud.ObjectiveText.Contains("NEUTRAL"),0,hud.ObjectiveText);
            Check("weapon line shows all targets and ready",hud.WeaponText.Contains("TARGETS 3/3")&&hud.WeaponText.Contains("READY"),0,hud.WeaponText);
            Check("controls hint visible at start",hud.HintText.Contains("FIRE"),0,hud.HintText);
            Check("hidden debug instrumentation keeps updating",readout.Text.Contains("NEUTRAL")&&weapon.Text.Contains("PRACTICE 0/3"),0,readout.Text+" | "+weapon.Text);
            Measure();
            Capture("v16-play-start-player","start");

            hud.SetDebugMode(true);yield return Frames(2);
            Check("debug mode (API) restores every debug panel and hides the player HUD",hud.DebugRenderers.All(r=>r.enabled)&&hud.PlayerRenderers.All(r=>!r.enabled));
            Capture("v16-play-start-debug","start debug");
            hud.SetDebugMode(false);yield return Frames(2);
            Check("player mode (API) restores the player HUD",hud.PlayerRenderers.Where(r=>!r.name.Contains("hint")).All(r=>r.enabled)&&hud.DebugRenderers.All(r=>!r.enabled));
            // Key events are queued and left for the player loop's own input update, so wasPressedThisFrame is seen in Update.
            InputSystem.QueueStateEvent(keyboard,new KeyboardState(Key.F3));yield return Frames(2);
            InputSystem.QueueStateEvent(keyboard,new KeyboardState());yield return Frames(2);
            bool f3On=hud.DebugMode&&hud.DebugRenderers.All(r=>r.enabled);
            InputSystem.QueueStateEvent(keyboard,new KeyboardState(Key.F3));yield return Frames(2);
            InputSystem.QueueStateEvent(keyboard,new KeyboardState());yield return Frames(2);
            Check("desktop F3 toggles debug on and back off",f3On&&!hud.DebugMode&&hud.DebugRenderers.All(r=>!r.enabled));

            var targets=FindObjectsByType<PracticeTarget>(FindObjectsSortMode.None).OrderBy(t=>t.name).ToArray();
            for(int i=0;i<targets[0].HitsRequired;i++)targets[0].ApplyHit();
            yield return Frames(3);
            Check("target count follows disabled targets",hud.WeaponText.Contains("TARGETS 2/3"),0,hud.WeaponText);

            // One setup warp into zone A; then the zone's own simulation captures.
            var cc=pilot.GetComponent<CharacterController>();cc.enabled=false;pilot.transform.position=zone.transform.position+Vector3.up*.6f;cc.enabled=true;Physics.SyncTransforms();
            int frames=0;while(zone.State==CaptureZone.ZoneState.Neutral&&frames++<240)yield return null;
            yield return Frames(90);
            Check("objective shows capturing with percentage and a growing bar",hud.ObjectiveText.Contains("CAPTURING")&&hud.ObjectiveText.Contains("%")&&hud.ProgressScale>.05f,hud.ProgressScale,hud.ObjectiveText);
            Capture("v16-play-capturing-player","capturing");
            frames=0;while(zone.State!=CaptureZone.ZoneState.Captured&&frames++<1200)yield return null;
            yield return Frames(3);
            Check("objective shows captured with a full bar",hud.ObjectiveText.Contains("CAPTURED")&&hud.ProgressScale>.98f,hud.ProgressScale,hud.ObjectiveText);
            Check("hidden debug readout also reports captured",readout.Text.Contains("CAPTURED"),0,readout.Text);
            while(Time.timeSinceLevelLoad<12.6f)yield return null;
            yield return Frames(2);
            Check("controls hint has timed out after its window",hud.HintText=="",Time.timeSinceLevelLoad,hud.HintText);
            foreach(var t in targets.Skip(1))for(int i=0;i<t.HitsRequired;i++)t.ApplyHit();
            yield return Frames(3);
            Check("range clear state and reset hint appear",hud.WeaponText.Contains("TARGETS 0/3")&&hud.WeaponText.Contains("RANGE CLEAR")&&hud.HintText.Contains("RESET"),0,hud.WeaponText+" | "+hud.HintText);
            Capture("v16-play-range-clear-player","range clear");
            hud.SetDebugMode(true);yield return Frames(2);Capture("v16-play-range-clear-debug","range clear debug");hud.SetDebugMode(false);yield return Frames(2);
        }
        void Measure()
        {
            Vector3 eye=cam.transform.position;Vector3 fwd=cam.transform.forward;fwd.y=0;fwd.Normalize();Vector3 rightV=Vector3.Cross(Vector3.up,fwd);
            float maxH=0,minDown=999,maxDown=0,minD=999,maxD=0,maxR=0;
            foreach(var r in hud.PlayerRenderers)
            {
                var lb=r.localBounds;
                for(int k=0;k<8;k++)
                {
                    Vector3 local=lb.center+Vector3.Scale(lb.extents,new Vector3((k&1)==0?-1:1,(k&2)==0?-1:1,(k&4)==0?-1:1));
                    Vector3 p=r.transform.TransformPoint(local);Vector3 d=p-eye;
                    float h=Mathf.Atan2(Vector3.Dot(d,rightV),Vector3.Dot(d,fwd))*Mathf.Rad2Deg;
                    float down=-Mathf.Atan2(d.y,new Vector2(Vector3.Dot(d,rightV),Vector3.Dot(d,fwd)).magnitude)*Mathf.Rad2Deg;
                    maxH=Mathf.Max(maxH,Mathf.Abs(h));minDown=Mathf.Min(minDown,down);maxDown=Mathf.Max(maxDown,down);minD=Mathf.Min(minD,d.magnitude);maxD=Mathf.Max(maxD,d.magnitude);
                    Vector3 fromPilot=p-pilot.transform.position;maxR=Mathf.Max(maxR,new Vector2(fromPilot.x,fromPilot.z).magnitude);
                }
            }
            float minGlyph=999;
            foreach(var line in hud.GetComponentsInChildren<TextMesh>(true))
            {
                string old=line.text;line.text="ENERGY";var r=line.GetComponent<MeshRenderer>();
                float hgt=r.localBounds.size.y*line.transform.lossyScale.y,dist=Vector3.Distance(eye,r.transform.TransformPoint(r.localBounds.center));
                minGlyph=Mathf.Min(minGlyph,2*Mathf.Atan2(hgt*.5f,dist)*Mathf.Rad2Deg);line.text=old;
            }
            var cc=pilot.GetComponent<CharacterController>();
            receipt.maxHorizontalDegrees=maxH;receipt.minDownDegrees=minDown;receipt.maxDownDegrees=maxDown;receipt.minDistance=minD;receipt.maxDistance=maxD;receipt.minGlyphDegrees=minGlyph;
            receipt.hudMaxRadiusFromPilot=maxR;receipt.proxyRadius=cc.radius*Mathf.Max(pilot.transform.lossyScale.x,pilot.transform.lossyScale.z);
            Check("HUD stays within +/-15 degrees horizontally (no edge-of-view text)",maxH<=15f,maxH);
            Check("HUD sits 8-30 degrees below the eye line",minDown>=8f&&maxDown<=30f,maxDown,"min "+minDown.ToString("F1"));
            Check("HUD is 0.8-1.3 m from the eye (comfortable focus distance band for this prototype)",minD>=.8f&&maxD<=1.3f,maxD,"min "+minD.ToString("F2"));
            Check("smallest glyph (hint) subtends at least 1.2 degrees",minGlyph>=1.2f,minGlyph);
            Check("HUD stays inside the pilot proxy radius so walls cannot cut it",maxR<receipt.proxyRadius,maxR,"radius "+receipt.proxyRadius.ToString("F2"));
        }
        void Capture(string name,string state)
        {
            const int width=1600,height=900;Directory.CreateDirectory(Output);
            var holder=new GameObject("Temporary v16 HUD camera");var camera=holder.AddComponent<Camera>();var previous=RenderTexture.active;bool async=ShaderUtil.allowAsyncCompilation;
            RenderTexture rt=null;Texture2D tex=null;
            try
            {
                ShaderUtil.allowAsyncCompilation=false;camera.CopyFrom(cam);camera.enabled=false;camera.tag="Untagged";
                holder.transform.SetPositionAndRotation(cam.transform.position,cam.transform.rotation);camera.aspect=(float)width/height;camera.stereoTargetEye=StereoTargetEyeMask.None;
                rt=RenderTexture.GetTemporary(width,height,24,RenderTextureFormat.ARGB32);camera.targetTexture=rt;
                var request=new UniversalRenderPipeline.SingleCameraRequest{destination=rt};
                for(int i=0;i<2;i++)if(RenderPipeline.SupportsRenderRequest(camera,request))RenderPipeline.SubmitRenderRequest(camera,request);else camera.Render();
                RenderTexture.active=rt;tex=new Texture2D(width,height,TextureFormat.RGB24,false);tex.ReadPixels(new Rect(0,0,width,height),0,0);tex.Apply();
                File.WriteAllBytes(Path.Combine(Output,name+".png"),tex.EncodeToPNG());
                receipt.images.Add(new Image{file=name+".png",state=state,objective=hud.ObjectiveText,weapon=hud.WeaponText,hint=hud.HintText});
            }
            finally{RenderTexture.active=previous;camera.targetTexture=null;ShaderUtil.allowAsyncCompilation=async;if(rt)RenderTexture.ReleaseTemporary(rt);if(tex)Destroy(tex);Destroy(holder);}
        }
        static IEnumerator Frames(int n){for(int i=0;i<n;i++)yield return null;}
        static void Set<T>(InputControl<T> control,T value) where T:struct
        {
            using(StateEvent.From(control.device,out var evt)){control.WriteValueIntoEvent(value,evt);InputSystem.QueueEvent(evt);}
            InputSystem.Update();
        }
        void OnLog(string c,string s,LogType t){if(t==LogType.Error||t==LogType.Exception||t==LogType.Assert)receipt.runtimeErrors.Add(c+"\n"+s);}
        void OnDestroy()=>Cleanup();
        void Cleanup()
        {
            Application.logMessageReceived-=OnLog;
            foreach(var d in new InputDevice[]{hmd,right,left,keyboard})if(d!=null&&d.added)InputSystem.RemoveDevice(d);
            if(savedSettings){settings.backgroundBehavior=background;settings.editorInputBehaviorInPlayMode=editorInput;settings.updateMode=updateMode;savedSettings=false;}
            if(savedTime){Time.captureDeltaTime=captureDelta;Time.timeScale=timeScale;Application.runInBackground=runInBackground;savedTime=false;}
            if(previousKeyboard!=null&&previousKeyboard.added)previousKeyboard.MakeCurrent();
            receipt.cleanupComplete=true;
        }
        void Complete()
        {
            if(completing)return;completing=true;
            try
            {
                Cleanup();
                receipt.passed=receipt.cleanupComplete&&string.IsNullOrEmpty(receipt.failure)&&receipt.runtimeErrors.Count==0&&receipt.checks.Count>0&&receipt.checks.All(c=>c.passed);
                Directory.CreateDirectory(Output);File.WriteAllText(Path.Combine(Output,"qa-v16-hud.json"),JsonUtility.ToJson(receipt,true));
                Debug.Log("VESPER_V16_HUD "+receipt.passed+" checks="+receipt.checks.Count);
            }
            catch(Exception e){Debug.LogError("Unable to finalize v16 HUD QA: "+e);}
            finally{Finished?.Invoke();}
        }
    }
}
#endif

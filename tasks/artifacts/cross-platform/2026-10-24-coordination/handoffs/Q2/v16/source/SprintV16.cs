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
    /// v16 Player HUD: opens the saved v15 scene, adds a compact cockpit-anchored player HUD (V16PlayerHud) beside the
    /// existing debug readouts and saves a NEW scene in player mode (debug panel and target-label renderers disabled,
    /// GameObjects and scripts untouched so their text keeps updating). Debug mode restores them at runtime.
    /// v15/v14/v13 scenes and assets, v12 and the main project are never written.
    /// </summary>
    public static class SprintV16
    {
        public const string ScenePath="Assets/MapPrototype/Scenes/VesperBasin_v16_PlayerHud.unity";
        public const string AssetRoot="Assets/MapPrototype/SprintAssets/v16";
        public const string Evidence="/Users/tim/Code/fhfhockey.com/tasks/artifacts/cross-platform/2026-10-24-coordination/handoffs/Q2/v16/evidence";
        public const string HudName="V16 player HUD";
        // Comfort layout: ~1 m ahead of the cockpit eye and ~19 degrees below it, inside the proxy radius (walls cannot
        // cut it), panel narrow enough to stay within about +/-15 degrees horizontally; glyphs about 1.3-1.9 degrees tall. Body-anchored, not head-locked.
        public const float Distance=.92f,Drop=.32f,PanelWidth=.46f,PanelHeight=.165f;
        public const float ObjectiveHeight=.031f,WeaponHeight=.027f,HintHeight=.021f;
        [Serializable] public class Line { public string name,longestText; public float characterSize,measuredHeight,measuredWidth; public bool fitted; }
        [Serializable] public class Receipt
        {
            public string scene,source,utc,hudPath; public Vector3 eyeLocal,hudLocal,hudEuler; public float proxyRadius,hudMaxHorizontalRadius;
            public List<Line> lines=new List<Line>(); public List<string> playerRenderers=new List<string>(),debugRenderers=new List<string>(),nearViewRenderers=new List<string>();
            public string note="v15 preserved and read-only. v16 adds one HUD subtree under the pilot proxy and saves the original debug readout + target-label renderers disabled (player mode). No gameplay, collider or other object change. Debug mode (Inspector flag, F3, or V16PlayerHud.SetDebugMode) swaps back. No Scout import, package, project-settings or main-project change.";
        }
        static Material Unlit(string name,Color c)
        {
            string path=AssetRoot+"/"+name+".mat";var m=AssetDatabase.LoadAssetAtPath<Material>(path);
            if(m==null){m=new Material(Shader.Find("Universal Render Pipeline/Unlit")){name=name};AssetDatabase.CreateAsset(m,path);}
            m.SetColor("_BaseColor",c);m.enableInstancing=true;EditorUtility.SetDirty(m);return m;
        }
        public static void BuildAndCapture(){Build();SprintV16Capture.Run();}
        public static void Build()
        {
            if(File.Exists(ScenePath))throw new InvalidOperationException("v16 scene already exists; refusing to overwrite "+ScenePath);
            var protectedScenes=new[]{SprintV13.ScenePath,SprintV14.ScenePath,SprintV15.ScenePath};var before=protectedScenes.Select(SprintV13Capture.Hash).ToArray();
            Directory.CreateDirectory(AssetRoot);Directory.CreateDirectory(Evidence);AssetDatabase.Refresh();
            var receipt=new Receipt{scene=ScenePath,source=SprintV15.ScenePath,utc=DateTime.UtcNow.ToString("o")};
            var backing=Unlit("V16 HUD backing",new Color(.035f,.05f,.065f));var accent=Unlit("V16 HUD accent",new Color(.96f,.70f,.15f));
            var track=Unlit("V16 HUD progress track",new Color(.13f,.17f,.20f));var fill=Unlit("V16 HUD progress fill",Color.white);

            EditorSceneManager.OpenScene(SprintV15.ScenePath,OpenSceneMode.Single);
            var pilot=UnityEngine.Object.FindFirstObjectByType<QuestPilotControls>();var weapon=UnityEngine.Object.FindFirstObjectByType<QuestPracticeWeapon>();
            var readout=UnityEngine.Object.FindFirstObjectByType<CaptureCockpitReadout>();
            var zone=(CaptureZone)new SerializedObject(readout).FindProperty("zone").objectReferenceValue;
            if(pilot==null||weapon==null||readout==null||zone==null)throw new InvalidOperationException("Expected saved pilot, weapon, cockpit readout and zone");
            var proxy=pilot.transform;var cam=pilot.GetComponentInChildren<Camera>();
            Vector3 eye=proxy.InverseTransformPoint(cam.transform.position);receipt.eyeLocal=eye;
            var cc=pilot.GetComponent<CharacterController>();receipt.proxyRadius=cc!=null?cc.radius*Mathf.Max(proxy.lossyScale.x,proxy.lossyScale.z):0;

            var root=new GameObject(HudName).transform;root.SetParent(proxy,false);
            root.localPosition=eye+new Vector3(0,-Drop,Distance);
            root.localRotation=Quaternion.Euler(Mathf.Atan2(Drop,Distance)*Mathf.Rad2Deg,0,0);
            receipt.hudLocal=root.localPosition;receipt.hudEuler=root.localEulerAngles;
            Quad("HUD backing",root,new Vector3(0,0,.004f),new Vector3(PanelWidth,PanelHeight,1),backing);
            Quad("HUD accent rule",root,new Vector3(0,PanelHeight*.5f-.003f,.003f),new Vector3(PanelWidth,.004f,1),accent);
            Quad("HUD progress track",root,new Vector3(0,.016f,.002f),new Vector3(.34f,.012f,1),track);
            var pivot=new GameObject("HUD progress pivot").transform;pivot.SetParent(root,false);pivot.localPosition=new Vector3(-.17f,.016f,.001f);pivot.localScale=new Vector3(.0001f,.012f,1);
            var fillR=Quad("HUD progress fill",pivot,new Vector3(.5f,0,0),Vector3.one,fill);

            TextMesh template=UnityEngine.Object.FindObjectsByType<TextMesh>(FindObjectsSortMode.InstanceID).FirstOrDefault(t=>t.GetComponent<WorldLabelDepth>()!=null);
            if(template==null)throw new InvalidOperationException("Expected a depth-tested world label to copy font and material from");
            var objective=Label(root,"HUD objective line",new Vector3(0,.050f,-.002f),ObjectiveHeight,"A ENERGY   CAPTURING 100%","A ENERGY   NEUTRAL",template,receipt);
            var weaponLine=Label(root,"HUD weapon line",new Vector3(0,-.020f,-.002f),WeaponHeight,"TARGETS 3/3   RELEASE TRIGGER","TARGETS 3/3   READY",template,receipt);
            var hint=Label(root,"HUD controls hint",new Vector3(0,-.058f,-.002f),HintHeight,"TRIGGER / SPACE  FIRE   STICK / WASD  MOVE","TRIGGER / SPACE  FIRE   STICK / WASD  MOVE",template,receipt);
            objective.color=new Color(.96f,.70f,.15f);hint.color=new Color(.62f,.70f,.74f);

            var hud=root.gameObject.AddComponent<V16PlayerHud>();
            var playerRenderers=root.GetComponentsInChildren<Renderer>(true);
            var debugRenderers=readout.GetComponentsInChildren<Renderer>(true).ToList();
            foreach(var t in UnityEngine.Object.FindObjectsByType<PracticeTarget>(FindObjectsSortMode.None).OrderBy(x=>x.name))
            {
                var label=(TextMesh)new SerializedObject(t).FindProperty("label").objectReferenceValue;if(label!=null)debugRenderers.Add(label.GetComponent<Renderer>());
            }
            var so=new SerializedObject(hud);
            so.FindProperty("pilot").objectReferenceValue=pilot;so.FindProperty("weapon").objectReferenceValue=weapon;so.FindProperty("zone").objectReferenceValue=zone;
            so.FindProperty("objectiveLine").objectReferenceValue=objective;so.FindProperty("weaponLine").objectReferenceValue=weaponLine;so.FindProperty("hintLine").objectReferenceValue=hint;
            so.FindProperty("progressPivot").objectReferenceValue=pivot;so.FindProperty("progressFill").objectReferenceValue=fillR;
            SetArray(so.FindProperty("playerRenderers"),playerRenderers);so.FindProperty("progressWidth").floatValue=.34f;so.FindProperty("progressHeight").floatValue=.012f;SetArray(so.FindProperty("debugRenderers"),debugRenderers.ToArray());
            so.FindProperty("debugMode").boolValue=false;so.ApplyModifiedPropertiesWithoutUndo();
            // Saved presentation state = player mode. Only renderer enable flags change on the debug objects.
            foreach(var r in debugRenderers)r.enabled=false;foreach(var r in playerRenderers){r.enabled=true;r.shadowCastingMode=ShadowCastingMode.Off;r.receiveShadows=false;}
            receipt.playerRenderers=playerRenderers.Select(r=>SprintV13Survey.Key(r.transform)).ToList();receipt.debugRenderers=debugRenderers.Select(r=>SprintV13Survey.Key(r.transform)).ToList();
            foreach(var r in playerRenderers)
            {
                Vector3 c=r.bounds.center-proxy.position,e=r.bounds.extents;
                receipt.hudMaxHorizontalRadius=Mathf.Max(receipt.hudMaxHorizontalRadius,new Vector2(Mathf.Abs(c.x)+e.x,Mathf.Abs(c.z)+e.z).magnitude);
            }
            receipt.hudPath=SprintV13Survey.Key(root);
            // Diagnostic only: what fills the lower spawn view (renderers within 8 m in front of the cockpit eye).
            var planes=GeometryUtility.CalculateFrustumPlanes(cam);
            foreach(var r in UnityEngine.Object.FindObjectsByType<Renderer>(FindObjectsSortMode.None))
                if(r.enabled&&r.gameObject.activeInHierarchy&&!r.transform.IsChildOf(proxy)&&GeometryUtility.TestPlanesAABB(planes,r.bounds)&&r.bounds.SqrDistance(cam.transform.position)<64)
                    receipt.nearViewRenderers.Add(SprintV13Survey.Key(r.transform)+" "+string.Join(",",r.sharedMaterials.Where(m=>m).Select(m=>m.name))+" min="+r.bounds.min.ToString("F2")+" max="+r.bounds.max.ToString("F2"));
            EditorSceneManager.SaveScene(UnityEngine.SceneManagement.SceneManager.GetActiveScene(),ScenePath,true);AssetDatabase.SaveAssets();
            if(!protectedScenes.Select(SprintV13Capture.Hash).SequenceEqual(before))throw new InvalidOperationException("v13/v14/v15 scene changed during v16 build");
            File.WriteAllText(Path.Combine(Evidence,"v16-build.json"),JsonUtility.ToJson(receipt,true));
            Debug.Log("VESPER_V16_BUILT "+ScenePath+" player="+playerRenderers.Length+" debug="+debugRenderers.Count);
        }
        static void SetArray(SerializedProperty p,Renderer[] items){p.arraySize=items.Length;for(int i=0;i<items.Length;i++)p.GetArrayElementAtIndex(i).objectReferenceValue=items[i];}
        static Renderer Quad(string name,Transform parent,Vector3 pos,Vector3 scale,Material m)
        {
            var q=GameObject.CreatePrimitive(PrimitiveType.Quad);q.name=name;UnityEngine.Object.DestroyImmediate(q.GetComponent<Collider>());
            q.transform.SetParent(parent,false);q.transform.localPosition=pos;q.transform.localScale=scale;var r=q.GetComponent<Renderer>();r.sharedMaterial=m;return r;
        }
        // Glyph size from measured mesh bounds (as v09), then shrunk if the longest expected string would overflow the panel.
        static TextMesh Label(Transform parent,string name,Vector3 pos,float height,string longest,string initial,TextMesh template,Receipt receipt)
        {
            var holder=new GameObject(name);holder.transform.SetParent(parent,false);holder.transform.localPosition=pos;
            var label=holder.AddComponent<TextMesh>();label.font=template.font;label.fontSize=64;label.anchor=TextAnchor.MiddleCenter;label.alignment=TextAlignment.Center;label.color=new Color(.92f,.95f,.97f);
            var r=holder.GetComponent<MeshRenderer>();r.sharedMaterial=template.GetComponent<MeshRenderer>().sharedMaterial;holder.AddComponent<WorldLabelDepth>();
            var line=new Line{name=name,longestText=longest};
            label.characterSize=.01f;label.text="ENERGY";float h=r.localBounds.size.y*holder.transform.lossyScale.y; // local: unaffected by the panel tilt
            label.characterSize=h>1e-4f?.01f*height/h:.0035f;line.fitted=h>1e-4f;
            label.text=longest;float w=Vector3.Scale(r.localBounds.size,holder.transform.lossyScale).x;
            if(line.fitted&&w>PanelWidth-.03f){label.characterSize*= (PanelWidth-.03f)/w;}
            line.characterSize=label.characterSize;label.text="ENERGY";line.measuredHeight=r.localBounds.size.y*holder.transform.lossyScale.y;label.text=longest;line.measuredWidth=Vector3.Scale(r.localBounds.size,holder.transform.lossyScale).x;
            receipt.lines.Add(line);label.text=initial;return label;
        }
        [MenuItem("Vesper Basin/Open player HUD candidate (v16)")]
        public static void Open() { if(EditorSceneManager.SaveCurrentModifiedScenesIfUserWantsTo())EditorSceneManager.OpenScene(ScenePath); }
    }
}
#endif

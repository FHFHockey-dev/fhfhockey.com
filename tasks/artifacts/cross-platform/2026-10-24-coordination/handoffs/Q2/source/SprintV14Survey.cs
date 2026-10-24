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
    /// <summary>Read-only renderer/material inventory of a saved scene. Writes JSON only to the Q2 lane evidence folder.</summary>
    public static class SprintV14Survey
    {
        [Serializable] public class Row { public string path,mesh,meshAsset; public bool active,enabled,hasCollider; public string collider; public int triangles; public string[] materials; public Vector3 boundsMin,boundsMax; }
        [Serializable] public class Mat { public string name,path,shader; public Color color; public int renderers; }
        [Serializable] public class Report { public string scene,utc,pipeline,renderer; public int renderers,enabledRenderers,triangles; public List<Mat> materials=new List<Mat>(); public List<Row> rows=new List<Row>(); }
        public static void Run() => Write(SprintV13.ScenePath,"v13-survey.json");
        public static void Write(string scene,string file)
        {
            EditorSceneManager.OpenScene(scene,OpenSceneMode.Single);
            var report=new Report{scene=scene,utc=DateTime.UtcNow.ToString("o")};
            var rp=GraphicsSettings.currentRenderPipeline;report.pipeline=rp?AssetDatabase.GetAssetPath(rp):"none";
            var counts=new Dictionary<Material,int>();
            foreach(var r in UnityEngine.Object.FindObjectsByType<Renderer>(FindObjectsInactive.Include,FindObjectsSortMode.None).OrderBy(x=>SprintV13Survey.Key(x.transform)))
            {
                var mf=r.GetComponent<MeshFilter>();var mesh=mf?mf.sharedMesh:null;var col=r.GetComponent<Collider>();
                var row=new Row{path=SprintV13Survey.Key(r.transform),active=r.gameObject.activeInHierarchy,enabled=r.enabled,mesh=mesh?mesh.name:"",
                    meshAsset=mesh?AssetDatabase.GetAssetPath(mesh):"",hasCollider=col,collider=col?col.GetType().Name+(col.enabled?"":"(disabled)"):"",
                    triangles=mesh?(int)Enumerable.Range(0,mesh.subMeshCount).Sum(i=>(long)mesh.GetIndexCount(i)/3):0,
                    materials=r.sharedMaterials.Select(m=>m?m.name:"null").ToArray(),boundsMin=r.bounds.min,boundsMax=r.bounds.max};
                report.rows.Add(row);report.renderers++;if(r.enabled&&row.active){report.enabledRenderers++;report.triangles+=row.triangles;}
                foreach(var m in r.sharedMaterials)if(m){counts.TryGetValue(m,out int n);counts[m]=n+1;}
            }
            foreach(var kv in counts.OrderBy(k=>k.Key.name))
                report.materials.Add(new Mat{name=kv.Key.name,path=AssetDatabase.GetAssetPath(kv.Key),shader=kv.Key.shader.name,
                    color=kv.Key.HasProperty("_BaseColor")?kv.Key.GetColor("_BaseColor"):Color.clear,renderers=kv.Value});
            Directory.CreateDirectory(SprintV14.Evidence);
            File.WriteAllText(Path.Combine(SprintV14.Evidence,file),JsonUtility.ToJson(report,true));
            Debug.Log("VESPER_V14_SURVEY "+scene+" renderers="+report.renderers);
        }
    }
}
#endif

#if UNITY_EDITOR
using System;
using System.IO;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;

namespace VesperBasin.Editor
{
    [InitializeOnLoad]
    public static class SprintV18HudRunner
    {
        public const string Output = SprintV18.Evidence;
        public const string Scene = SprintV18.ScenePath;
        private const string Key = "VesperV18Hud.";
        static SprintV18HudRunner()
        {
            EditorApplication.playModeStateChanged += OnMode;
            EditorApplication.update += Watchdog;
        }
        public static void Run()
        {
            if (EditorApplication.isPlayingOrWillChangePlaymode) throw new InvalidOperationException("QA must start in Edit Mode");
            Directory.CreateDirectory(Output);
            var path = Path.Combine(Output, "qa-v16-hud.json");
            if (File.Exists(path)) File.Delete(path);
            SessionState.SetString(Key + "run", Guid.NewGuid().ToString("N"));
            SessionState.SetString(Key + "start", DateTime.UtcNow.Ticks.ToString());
            SessionState.SetBool(Key + "active", true);
            SessionState.SetBool(Key + "failed", false);
            try
            {
                EditorSceneManager.OpenScene(Scene);
                EditorApplication.isPlaying = true;
            }
            catch (Exception error) { Fail("Runner startup: " + error); }
        }
        private static void OnMode(PlayModeStateChange state)
        {
            if (!SessionState.GetBool(Key + "active", false)) return;
            if (state == PlayModeStateChange.EnteredPlayMode)
            {
                SprintV16HudProbe.Output = Output;
                SprintV16HudProbe.RunId = SessionState.GetString(Key + "run", "");
                SprintV16HudProbe.Finished = () => EditorApplication.isPlaying = false;
                new GameObject("Temporary v18 player HUD verification").AddComponent<SprintV16HudProbe>();
            }
            if (state == PlayModeStateChange.EnteredEditMode) Complete();
        }
        private static void Watchdog()
        {
            if (!SessionState.GetBool(Key + "active", false)) return;
            if (!long.TryParse(SessionState.GetString(Key + "start", "0"), out long ticks) ||
                (DateTime.UtcNow - new DateTime(ticks, DateTimeKind.Utc)).TotalSeconds > 180)
            {
                if (SessionState.GetBool(Key + "failed", false))
                {
                    // The first watchdog pass requests a normal Play Mode exit for OnDestroy cleanup.
                    if (Application.isBatchMode) EditorApplication.Exit(2);
                    else SessionState.SetBool(Key + "active", false);
                }
                else Fail("Runner watchdog exceeded 180 seconds");
            }
        }
        private static void Fail(string reason)
        {
            SessionState.SetBool(Key + "failed", true);
            // Give Play Mode cleanup up to another ten seconds before forcing batch exit.
            SessionState.SetString(Key + "start", DateTime.UtcNow.AddSeconds(-170).Ticks.ToString());
            try
            {
                var receipt = new SprintV16HudProbe.Receipt {
                    runId = SessionState.GetString(Key + "run", ""), scene = Scene,
                    utc = DateTime.UtcNow.ToString("o"), passed = false, failure = reason
                };
                File.WriteAllText(Path.Combine(Output, "qa-v16-hud.json"), JsonUtility.ToJson(receipt, true));
            }
            finally
            {
                Debug.LogError("VESPER_V18_HUD " + reason);
                if (EditorApplication.isPlayingOrWillChangePlaymode) EditorApplication.isPlaying = false;
                else Complete();
            }
        }
        private static void Complete()
        {
            bool passed = false;
            try
            {
                var path = Path.Combine(Output, "qa-v16-hud.json");
                var receipt = File.Exists(path) ? JsonUtility.FromJson<SprintV16HudProbe.Receipt>(File.ReadAllText(path)) : null;
                passed = !SessionState.GetBool(Key + "failed", false) && receipt != null && receipt.passed &&
                    receipt.cleanupComplete && receipt.realPlayMode && receipt.runId == SessionState.GetString(Key + "run", "");
            }
            catch (Exception error) { Debug.LogError("Unable to read v16 HUD QA receipt: " + error); }
            finally
            {
                SessionState.SetBool(Key + "active", false);
                if (Application.isBatchMode) EditorApplication.Exit(passed ? 0 : 2);
            }
        }
    }
}
#endif

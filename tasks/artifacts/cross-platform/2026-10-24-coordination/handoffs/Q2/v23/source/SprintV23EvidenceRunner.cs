#if UNITY_EDITOR
using System;
using System.IO;
using System.Security.Cryptography;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;

namespace VesperBasin.Editor
{
    [InitializeOnLoad]
    public static class SprintV23EvidenceRunner
    {
        public const string Output = SprintV23.Evidence;
        public const string Scene = SprintV23.ScenePath;
        private const string Key = "VesperV23Evidence.";
        static SprintV23EvidenceRunner()
        {
            EditorApplication.playModeStateChanged += OnMode;
            EditorApplication.update += Watchdog;
        }
        public static void Run()
        {
            if (EditorApplication.isPlayingOrWillChangePlaymode) throw new InvalidOperationException("Evidence must start in Edit Mode");
            Directory.CreateDirectory(Output);
            var path = Path.Combine(Output, "v13-visual-evidence.json");
            if (File.Exists(path)) File.Delete(path);
            SessionState.SetString(Key + "run", Guid.NewGuid().ToString("N"));
            SessionState.SetString(Key + "start", DateTime.UtcNow.Ticks.ToString());
            SessionState.SetBool(Key + "active", true);
            SessionState.SetBool(Key + "failed", false);
            try
            {
                SessionState.SetString(Key + "sceneHash", HashScene());
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
                SprintV13PracticeEvidenceProbe.Output = Output;
                SprintV13PracticeEvidenceProbe.RunId = SessionState.GetString(Key + "run", "");
                SprintV13PracticeEvidenceProbe.Finished = () => EditorApplication.isPlaying = false;
                new GameObject("Temporary v23 visual evidence").AddComponent<SprintV13PracticeEvidenceProbe>();
            }
            if (state == PlayModeStateChange.EnteredEditMode) Complete();
        }
        private static void Watchdog()
        {
            if (!SessionState.GetBool(Key + "active", false)) return;
            if (!long.TryParse(SessionState.GetString(Key + "start", "0"), out long ticks) ||
                (DateTime.UtcNow - new DateTime(ticks, DateTimeKind.Utc)).TotalSeconds > 120)
            {
                if (SessionState.GetBool(Key + "failed", false))
                {
                    // The first watchdog pass requests a normal Play Mode exit for OnDestroy cleanup.
                    if (Application.isBatchMode) EditorApplication.Exit(2);
                    else SessionState.SetBool(Key + "active", false);
                }
                else Fail("Runner watchdog exceeded 120 seconds");
            }
        }
        private static void Fail(string reason)
        {
            SessionState.SetBool(Key + "failed", true);
            // Give Play Mode cleanup up to another ten seconds before forcing batch exit.
            SessionState.SetString(Key + "start", DateTime.UtcNow.AddSeconds(-110).Ticks.ToString());
            try
            {
                var receipt = new SprintV13PracticeEvidenceProbe.Receipt {
                    runId = SessionState.GetString(Key + "run", ""), scene = Scene,
                    utc = DateTime.UtcNow.ToString("o"), passed = false, failure = reason
                };
                File.WriteAllText(Path.Combine(Output, "v13-visual-evidence.json"), JsonUtility.ToJson(receipt, true));
            }
            finally
            {
                Debug.LogError("VESPER_V23_EVIDENCE " + reason);
                if (EditorApplication.isPlayingOrWillChangePlaymode) EditorApplication.isPlaying = false;
                else Complete();
            }
        }
        private static string HashScene()
        {
            using (var sha = SHA256.Create())
                return BitConverter.ToString(sha.ComputeHash(File.ReadAllBytes(Scene))).Replace("-", "").ToLowerInvariant();
        }
        private static void Complete()
        {
            bool passed = false;
            try
            {
                var path = Path.Combine(Output, "v13-visual-evidence.json");
                var receipt = File.Exists(path) ? JsonUtility.FromJson<SprintV13PracticeEvidenceProbe.Receipt>(File.ReadAllText(path)) : null;
                if (receipt != null)
                {
                    receipt.savedSceneBeforeSHA256 = SessionState.GetString(Key + "sceneHash", "");
                    receipt.savedSceneAfterSHA256 = HashScene();
                    receipt.savedSceneUnchanged = receipt.savedSceneBeforeSHA256 == receipt.savedSceneAfterSHA256;
                    File.WriteAllText(path, JsonUtility.ToJson(receipt, true));
                }
                passed = !SessionState.GetBool(Key + "failed", false) && receipt != null && receipt.passed &&
                    receipt.cleanupComplete && receipt.realPlayMode && receipt.savedSceneUnchanged && receipt.runId == SessionState.GetString(Key + "run", "");
            }
            catch (Exception error) { Debug.LogError("Unable to read v13 evidence receipt: " + error); }
            finally
            {
                SessionState.SetBool(Key + "active", false);
                if (Application.isBatchMode) EditorApplication.Exit(passed ? 0 : 2);
            }
        }
    }
}
#endif

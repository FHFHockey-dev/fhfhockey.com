using UnityEngine;
using UnityEngine.InputSystem;

namespace VesperBasin
{
    /// <summary>
    /// v16 cockpit-anchored player HUD. Shows only what a pilot needs: objective state and progress, targets left and
    /// weapon state, plus a short controls hint for the first seconds or while input must be released. Reads the same
    /// live components as the debug readouts and never writes gameplay state.
    /// The debug instrumentation stays in the scene: debug mode re-enables the original panels and target labels
    /// (Inspector flag applied on enable/Play Mode, F3 on desktop, or <see cref="SetDebugMode"/> from tools). Their scripts keep updating their
    /// text in both modes, so diagnosis and existing probes read the same values either way.
    /// </summary>
    public sealed class V16PlayerHud : MonoBehaviour
    {
        [SerializeField] private QuestPilotControls pilot;
        [SerializeField] private QuestPracticeWeapon weapon;
        [SerializeField] private CaptureZone zone;
        [SerializeField] private string zoneName = "A  ENERGY";
        [SerializeField] private TextMesh objectiveLine, weaponLine, hintLine;
        [SerializeField] private Transform progressPivot;
        [SerializeField] private Renderer progressFill;
        [SerializeField] private float progressWidth = .30f, progressHeight = .010f;
        [SerializeField, Min(0)] private float hintSeconds = 12f;
        [SerializeField] private bool debugMode;
        [SerializeField] private Renderer[] playerRenderers, debugRenderers;

        private static readonly int BaseColor = Shader.PropertyToID("_BaseColor");
        private static readonly Color Neutral = new Color(.96f, .70f, .15f), Captured = new Color(.30f, .82f, .48f),
            Contested = new Color(.92f, .32f, .24f), Text = new Color(.92f, .95f, .97f), Muted = new Color(.62f, .70f, .74f);
        private MaterialPropertyBlock block;
        private bool appliedMode, hasApplied;
        private float startedAt;

        public bool DebugMode => debugMode;
        public string ObjectiveText => objectiveLine != null ? objectiveLine.text : string.Empty;
        public string WeaponText => weaponLine != null ? weaponLine.text : string.Empty;
        public string HintText => hintLine != null && hintLine.GetComponent<Renderer>().enabled ? hintLine.text : string.Empty;
        public float ProgressScale => progressPivot != null ? progressPivot.localScale.x / Mathf.Max(progressWidth, 1e-4f) : 0;
        public Renderer[] PlayerRenderers => playerRenderers;
        public Renderer[] DebugRenderers => debugRenderers;

        public void SetDebugMode(bool on) { debugMode = on; Apply(); }

        private void OnEnable() { startedAt = Time.time; hasApplied = false; Apply(); }

        private void Apply()
        {
            if (hasApplied && appliedMode == debugMode) return;
            if (playerRenderers != null) foreach (var r in playerRenderers) if (r != null) r.enabled = !debugMode;
            if (debugRenderers != null) foreach (var r in debugRenderers) if (r != null) r.enabled = debugMode;
            appliedMode = debugMode; hasApplied = true;
        }

        private void Update()
        {
            var keyboard = Keyboard.current;
            if (keyboard != null && keyboard.f3Key.wasPressedThisFrame) debugMode = !debugMode;
            Apply();
            if (debugMode) return;
            WriteObjective();
            WriteWeapon();
            WriteHint();
        }

        private void WriteObjective()
        {
            if (zone == null) return;
            bool contested = zone.IsContested;
            string state = contested ? "CONTESTED" : zone.State == CaptureZone.ZoneState.Captured ? "CAPTURED" :
                zone.State == CaptureZone.ZoneState.Capturing ? "CAPTURING " + Mathf.RoundToInt(zone.Progress01 * 100) + "%" : "NEUTRAL";
            Color color = contested ? Contested : zone.State == CaptureZone.ZoneState.Captured ? Captured : Neutral;
            Set(objectiveLine, zoneName + "   " + state, color);
            if (progressPivot != null) progressPivot.localScale = new Vector3(Mathf.Max(progressWidth * zone.Progress01, .0001f), progressHeight, 1f);
            if (progressFill != null)
            {
                block ??= new MaterialPropertyBlock();
                progressFill.GetPropertyBlock(block);
                block.SetColor(BaseColor, color);
                progressFill.SetPropertyBlock(block);
            }
        }

        private void WriteWeapon()
        {
            if (weapon == null) return;
            int total = weapon.TargetCount, left = total - weapon.DisabledTargetCount;
            string state; Color color = Text;
            bool paused = pilot == null || pilot.SimulationHeld || Time.timeScale <= 0;
            if (pilot != null && pilot.RestartProgress > 0) { state = "RESETTING " + Mathf.RoundToInt(Mathf.Clamp01(pilot.RestartProgress) * 100) + "%"; color = Neutral; }
            else if (paused) { state = "PAUSED"; color = Muted; }
            else if (total > 0 && left == 0) { state = "RANGE CLEAR"; color = Captured; }
            else if (weapon.WaitingForFireRelease) { state = "RELEASE TRIGGER"; color = Muted; }
            else if (weapon.LastShotHitTarget && weapon.CooldownRemaining > 0) { state = "HIT"; color = Contested; }
            else state = "READY";
            Set(weaponLine, (total > 0 ? "TARGETS " + left + "/" + total + "   " : "") + state, color);
        }

        private void WriteHint()
        {
            if (hintLine == null) return;
            bool cleared = weapon != null && weapon.TargetCount > 0 && weapon.DisabledTargetCount == weapon.TargetCount;
            bool early = Time.time - startedAt < hintSeconds || (pilot != null && pilot.WaitingForNeutral);
            string text = cleared ? "HOLD B / R  RESET RANGE" : "TRIGGER / SPACE  FIRE   STICK / WASD  MOVE";
            var r = hintLine.GetComponent<Renderer>();
            bool show = cleared || early;
            if (r.enabled != show) r.enabled = show;
            Set(hintLine, text, Muted);
        }

        private static void Set(TextMesh line, string text, Color color)
        {
            if (line == null) return;
            if (line.text != text) line.text = text;
            if (line.color != color) line.color = color;
        }
    }
}

using UnityEngine;

namespace VesperBasin
{
    /// <summary>
    /// v23 ambient flyer: circles a fixed centre at constant altitude with a gentle bob, nose along the path, slight bank.
    /// Deterministic from its serialized phase; visual only (no collider, no gameplay state, no physics).
    /// </summary>
    public sealed class V23Orbit : MonoBehaviour
    {
        [SerializeField] private Vector3 centre;
        [SerializeField] private float radius = 20f, height = 25f, degreesPerSecond = 12f, phaseDegrees, bobMetres = .6f, bankDegrees = 10f;

        public void Configure(Vector3 c, float r, float h, float speed, float phase)
        {
            centre = c; radius = r; height = h; degreesPerSecond = speed; phaseDegrees = phase; Place(0f);
        }

        private void Update() => Place(Application.isPlaying ? Time.time : 0f);

        private void Place(float t)
        {
            float a = (phaseDegrees + degreesPerSecond * t) * Mathf.Deg2Rad;
            var p = centre + new Vector3(Mathf.Cos(a) * radius, height + Mathf.Sin(a * 3f) * bobMetres, Mathf.Sin(a) * radius);
            float dir = Mathf.Sign(degreesPerSecond == 0 ? 1 : degreesPerSecond);
            var tangent = new Vector3(-Mathf.Sin(a), 0, Mathf.Cos(a)) * dir;
            transform.SetPositionAndRotation(p, Quaternion.LookRotation(tangent, Vector3.up) * Quaternion.Euler(0, 0, -bankDegrees * dir));
        }
    }
}

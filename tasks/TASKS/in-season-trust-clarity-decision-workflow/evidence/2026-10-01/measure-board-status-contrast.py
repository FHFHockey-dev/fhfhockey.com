"""Compute WCAG text contrast from the saved browser samples; no network or writes outside this receipt."""
import json
import re
from pathlib import Path

root = Path(__file__).parent


def rgba(value):
    parts = [float(part) for part in re.findall(r"[\d.]+", value)]
    assert value.startswith(("rgb(", "rgba(")) and len(parts) in (3, 4), value
    return parts[:3], parts[3] if len(parts) == 4 else 1.0


def composite(front, alpha, back):
    return [alpha * f + (1 - alpha) * b for f, b in zip(front, back)]


def luminance(rgb):
    channels = [c / 255 for c in rgb]
    linear = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in channels]
    return sum(c * weight for c, weight in zip(linear, [0.2126, 0.7152, 0.0722]))


rows = []
for width in (1180, 390):
    data = json.loads((root / f"board-status-contrast-{width}.json").read_text())
    for sample in data["contrastSamples"]:
        layers = []
        for layer in sample["backgrounds"]:
            assert layer["image"] == "none" and float(layer["opacity"]) == 1, layer
            assert layer["filter"] == layer["backdropFilter"] == "none", layer
            assert layer["blendMode"] == "normal", layer
            assert all(layer[key]["content"] in ("none", "normal") for key in ("before", "after")), layer
            color, alpha = rgba(layer["color"])
            layers.append((color, alpha))
            if alpha == 1:
                break
        assert layers[-1][1] == 1, "No captured opaque backing surface"
        background = layers[-1][0]
        for color, alpha in reversed(layers[:-1]):
            background = composite(color, alpha, background)
        foreground, alpha = rgba(sample["foreground"])
        foreground = composite(foreground, alpha, background)
        light, dark = sorted([luminance(foreground), luminance(background)], reverse=True)
        ratio = (light + 0.05) / (dark + 0.05)
        size = float(sample["fontSize"].removesuffix("px"))
        threshold = 3 if size >= 24 or (size >= 14 * 96 / 72 and float(sample["fontWeight"]) >= 700) else 4.5
        rows.append({"width": width, "state": sample["state"], "text": sample["text"],
                     "foregroundRgb": foreground, "backgroundRgb": background,
                     "fontSize": sample["fontSize"], "fontWeight": sample["fontWeight"],
                     "ratio": ratio, "threshold": threshold, "passed": ratio >= threshold})
result = {"method": "WCAG 2.2 sRGB relative luminance; computed ancestor backgrounds alpha-composited to first opaque layer",
          "source": "https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html",
          "samples": rows, "allPassed": all(row["passed"] for row in rows),
          "limitations": ["Only captured Starter Board text states at 1180x844 and 390x844 in its rendered dark appearance.",
                          "No other surfaces, light appearance, focus indicators, icons, hover states or screen-reader speech certified."]}
(root / "board-status-contrast-measured.json").write_text(json.dumps(result, indent=2) + "\n")
print(f"{len(rows)} samples; minimum {min(row['ratio'] for row in rows):.6f}:1; allPassed={result['allPassed']}")

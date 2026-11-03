# Free Cartoonify feasibility

Feasible as deterministic local Canvas code in the existing bounded portrait pipeline. No paid API, external image upload, model request, runtime dependency, install or copied OpenCV implementation is needed. This would be a filter, not an AI redraw.

Proposed narrow prototype: alpha-aware edge-preserving smoothing; simplified tonal regions; restrained luminance-edge outlines; then the existing verified full-team color map. Start from the original reviewed cutout on every selection. Preserve every original alpha byte, dimensions, identity and player geometry. Bound processing at the existing two-million-pixel limit; release temporary canvases. Benchmark actual phone/card resolution before enabling; CPU time and peak memory have not been measured for a cartoon prototype.

Footprint now: zero added dependencies and zero new runtime code for Cartoonify. A prototype is deferred until the current data/category slice is frozen. Local implementation is within the existing card scope; software installation or external services are not authorized or required.

Official references: [OpenCV browser filters](https://opencv.org/blog/opencv-js-real-time-webcam-filters/) and [non-photorealistic rendering API](https://docs.opencv.org/4.x/df/dac/group__photo__render.html). Native C++/Python stylization documentation does not establish availability in a JavaScript build. No OpenCV.js build was loaded.

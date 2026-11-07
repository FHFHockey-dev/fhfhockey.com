# Genuine 5 px player outline — frozen checkpoint06

Local URL: http://127.0.0.1:3125/player-cards/compositions?checkpoint=outline06 . Detached loopback PID22758. Previous05 remains at /player-cards/compositions-05 and /player-cards/studio-05. No deployment; host shutdown can stop the server. KEEP-RUNTIME.json pins all startup inputs.

Seven owned source paths implement a real white alpha-contour ring using a linear-time Euclidean distance transform. It is5design pixels outward from the50%alpha contour, rasterized at2× with0.5design-pixel antialias coverage. All interior pixels >=128alpha are excluded; original RGB/alpha is unmodified. Wide holes remain open; narrow gaps may close as a genuine stroke normally does. No shadow, CSS filter or rectangular border. Alignment/padding/clip details in ALIGNMENT.md.

Player600/4/600/337.5 and logo840/-100/480/480 are unchanged. Ring frame594.5/-1.5/611/348.5 places its content exactly on the original player. Layer order: background→logo/fade→ring→player→existingcontext. Same embedded ring asset and hashes bind preview, PNG and manifest. Temporary canvases released; max2MP masks/cache2. No source asset mutation or dependency.

Passed28focused tests, scoped TypeScript/lint and5offline Chromium groups: native5px width, transparent padding, AA/holes, original portrait stage hashes/geometry, identical ring across RGB styles, landscape/square PNG/manifest/share fallback parity,390px phone, unavailable/GP safeguards and analytics parity. Fresh actual served URL screenshots/hash/pipeline/outline checks also passed,0external attempts/errors. Standalone ring and native card exports viewed. Served phone screenshot was generated and verified, but its final manual image read was interrupted; no claim otherwise.

Source copies, exact patch and pins in source-files/, source.patch, SOURCE-PINS.json and EVIDENCE.json. Scout independent acceptance pending. Statistics remain synthetic. The approved fresh NHL read remains stopped at PythonTLS first connection/0bytes; no retry in this slice. No Git/deploy/delete/shared auth/Tuesday/upload/new service actions.

# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: roster-schedule-optimizer.spec.ts >> streams A to B to C through successive conditional acquisitions and keeps expanded desktop layout
- Location: e2e/roster-schedule-optimizer.spec.ts:265:5

# Error details

```
Error: browserType.launch: Target page, context or browser has been closed
Browser logs:

<launching> /Users/tim/Library/Caches/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-mac-arm64/chrome-headless-shell --disable-field-trial-config --disable-background-networking --disable-background-timer-throttling --disable-backgrounding-occluded-windows --disable-back-forward-cache --disable-breakpad --disable-client-side-phishing-detection --disable-component-extensions-with-background-pages --disable-component-update --no-default-browser-check --disable-default-apps --disable-dev-shm-usage --disable-edgeupdater --disable-extensions --disable-features=AvoidUnnecessaryBeforeUnloadCheckSync,BoundaryEventDispatchTracksNodeRemoval,DestroyProfileOnBrowserClose,DialMediaRouteProvider,GlobalMediaControls,HttpsUpgrades,LensOverlay,MediaRouter,PaintHolding,ThirdPartyStoragePartitioning,Translate,AutoDeElevate,RenderDocument,OptimizationHints,msForceBrowserSignIn,msEdgeUpdateLaunchServicesPreferredVersion --enable-features=CDPScreenshotNewSurface --allow-pre-commit-input --disable-hang-monitor --disable-ipc-flooding-protection --disable-popup-blocking --disable-prompt-on-repost --disable-renderer-backgrounding --force-color-profile=srgb --metrics-recording-only --no-first-run --password-store=basic --use-mock-keychain --no-service-autorun --export-tagged-pdf --disable-search-engine-choice-screen --unsafely-disable-devtools-self-xss-warnings --edge-skip-compat-layer-relaunch --disable-infobars --disable-search-engine-choice-screen --disable-sync --enable-unsafe-swiftshader --headless --hide-scrollbars --mute-audio --blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4 --no-sandbox --user-data-dir=/var/folders/g2/b33dwc153kbd_vhg6cfbn8bm0000gn/T/playwright_chromiumdev_profile-UXUrVx --remote-debugging-pipe --no-startup-window
<launched> pid=66785
[pid=66785][err] [1107/212553.220143:ERROR:base/power_monitor/thermal_state_observer_mac.mm:140] ThermalStateObserverMac unable to register to power notifications. Result: 9
[pid=66785][err] [1107/212553.221450:ERROR:net/dns/dns_config_service_posix.cc:138] DNS config watch failed to start.
[pid=66785][err] [1107/212553.221789:FATAL:base/apple/mach_port_rendezvous_mac.cc:159] Check failed: kr == KERN_SUCCESS. bootstrap_check_in org.chromium.Chromium.MachPortRendezvousServer.66785: Permission denied (1100)
[pid=66785] <process did exit: exitCode=null, signal=SIGTRAP>
[pid=66785] starting temporary directories cleanup
Call log:
  - <launching> /Users/tim/Library/Caches/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-mac-arm64/chrome-headless-shell --disable-field-trial-config --disable-background-networking --disable-background-timer-throttling --disable-backgrounding-occluded-windows --disable-back-forward-cache --disable-breakpad --disable-client-side-phishing-detection --disable-component-extensions-with-background-pages --disable-component-update --no-default-browser-check --disable-default-apps --disable-dev-shm-usage --disable-edgeupdater --disable-extensions --disable-features=AvoidUnnecessaryBeforeUnloadCheckSync,BoundaryEventDispatchTracksNodeRemoval,DestroyProfileOnBrowserClose,DialMediaRouteProvider,GlobalMediaControls,HttpsUpgrades,LensOverlay,MediaRouter,PaintHolding,ThirdPartyStoragePartitioning,Translate,AutoDeElevate,RenderDocument,OptimizationHints,msForceBrowserSignIn,msEdgeUpdateLaunchServicesPreferredVersion --enable-features=CDPScreenshotNewSurface --allow-pre-commit-input --disable-hang-monitor --disable-ipc-flooding-protection --disable-popup-blocking --disable-prompt-on-repost --disable-renderer-backgrounding --force-color-profile=srgb --metrics-recording-only --no-first-run --password-store=basic --use-mock-keychain --no-service-autorun --export-tagged-pdf --disable-search-engine-choice-screen --unsafely-disable-devtools-self-xss-warnings --edge-skip-compat-layer-relaunch --disable-infobars --disable-search-engine-choice-screen --disable-sync --enable-unsafe-swiftshader --headless --hide-scrollbars --mute-audio --blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4 --no-sandbox --user-data-dir=/var/folders/g2/b33dwc153kbd_vhg6cfbn8bm0000gn/T/playwright_chromiumdev_profile-UXUrVx --remote-debugging-pipe --no-startup-window
  - <launched> pid=66785
  - [pid=66785][err] [1107/212553.220143:ERROR:base/power_monitor/thermal_state_observer_mac.mm:140] ThermalStateObserverMac unable to register to power notifications. Result: 9
  - [pid=66785][err] [1107/212553.221450:ERROR:net/dns/dns_config_service_posix.cc:138] DNS config watch failed to start.
  - [pid=66785][err] [1107/212553.221789:FATAL:base/apple/mach_port_rendezvous_mac.cc:159] Check failed: kr == KERN_SUCCESS. bootstrap_check_in org.chromium.Chromium.MachPortRendezvousServer.66785: Permission denied (1100)
  - [pid=66785] <process did exit: exitCode=null, signal=SIGTRAP>
  - [pid=66785] starting temporary directories cleanup
  - [pid=66785] <gracefully close start>
  - [pid=66785] <kill>
  - [pid=66785] <skipped force kill spawnedProcess.killed=false processClosed=true>
  - [pid=66785] finished temporary directories cleanup
  - [pid=66785] <gracefully close end>

```
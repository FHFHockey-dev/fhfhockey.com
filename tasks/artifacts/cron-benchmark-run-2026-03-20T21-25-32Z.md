# Cron Audit Benchmark Run

- Started: 2026-03-20T21:25:32.050Z
- Ended: 2026-03-20T23:30:03.938Z
- Duration: 124:31 (7471888 ms)
- Total jobs: 52
- Succeeded: 21
- Failed: 27
- Skipped: 4
- Slow jobs: 11

| # | Time | Job | Status | Action | Timer | Method | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 07:20 UTC | update-yahoo-matchup-dates | success | run | 00:01 | GET | HTTP 200 OK |
| 2 | 07:25 UTC | update-nst-gamelog | success | run | 00:34 | GET | Direct NST scraper with date iteration and enforced inter-request pacing. | Must be treated as a direct NST request-budget consumer. | Runtime depends on current resume point and backlog. | Direct NST job started with no prior NST wait requirement. | HTTP 200 OK |
| 3 | 07:30 UTC | update-all-wgo-skaters | success | run | 00:04 | GET | HTTP 200 OK |
| 4 | 07:35 UTC | update-all-wgo-goalies | success | run | 00:00 | GET | HTTP 200 OK |
| 5 | 07:40 UTC | update-all-wgo-skater-totals | success | run | 01:49 | GET | HTTP 200 OK |
| 6 | 07:45 UTC | update-shift-charts | skipped | skip | 00:00 | GET | STATUS: 404 NOT FOUND | Policy action: skip | Skipped by benchmark execution policy. |
| 7 | 07:45 UTC | update-rolling-player-averages | failure | run | 03:00 | GET | Broad rolling rebuild with concurrency knobs and large player scope. | Downstream FORGE and Start Chart freshness depend on this output. | HTTP 500 Internal Server Error | canceling statement due to statement timeout |
| 8 | 07:50 UTC | daily-refresh-player-unified-matview | success | run | 00:02 | SQL | Executed through Supabase execute_sql RPC. |
| 9 | 07:55 UTC | update-power-play-timeframes | success | run | 00:02 | GET | HTTP 200 OK |
| 10 | 08:00 UTC | update-line-combinations-all | success | run | 00:02 | GET | HTTP 200 OK |
| 11 | 08:05 UTC | update-team-yearly-summary | success | run | 00:01 | GET | HTTP 200 OK |
| 12 | 08:10 UTC | update-nst-tables-all | success | run | 11:05 | GET | NST table rebuild can run near the route budget on stale datasets. | Touches NST directly and should stay spaced from other NST jobs. | Observed runtime depends on latest ingested date and resume state. | Inserted 597s NST safety wait before execution. | HTTP 200 OK |
| 13 | 08:15 UTC | update-standings-details | success | run | 01:30 | GET | HTTP 200 OK |
| 14 | 08:20 UTC | update-all-wgo-goalie-totals | success | run | 00:02 | GET | HTTP 200 OK |
| 15 | 08:25 UTC | update-expected-goals | success | run | 01:27 | GET | HTTP 200 OK |
| 16 | 08:30 UTC | update-nst-goalies | failure | run | 17:00 | GET | fetch failed |
| 17 | 08:40 UTC | update-yahoo-players | success | run | 01:27 | GET | HTTP 200 OK |
| 18 | 08:45 UTC | update-nst-current-season | success | run | 13:42 | GET | Current-season NST scraper fans out over active-player mappings. | Consumes the direct NST request budget. | Inserted 813s NST safety wait before execution. | HTTP 200 OK |
| 19 | 08:50 UTC | update-wigo-table-stats | failure | run | 05:00 | GET | fetch failed |
| 20 | 08:55 UTC | sync-yahoo-players-to-sheet | skipped | mock_fallback | 00:00 | GET | Writes to Google Sheets and should not be benchmarked blindly in local/dev. | Prefer dry-run or mocked external side effects during audit execution. | Policy action: mock_fallback | Skipped direct side effect and recorded mock-fallback observation only. |
| 21 | 09:00 UTC | update-rolling-player-averages | failure | run | 05:00 | POST | Broad rolling rebuild with concurrency knobs and large player scope. | Downstream FORGE and Start Chart freshness depend on this output. | fetch failed |
| 22 | 09:05 UTC | daily-refresh-goalie-unified-matview | failure | run | 01:10 | SQL | Supabase execute_sql RPC failed. | <!DOCTYPE html>
<!--[if lt IE 7]> <html class="no-js ie6 oldie" lang="en-US"> <![endif]-->
<!--[if IE 7]>    <html class="no-js ie7 oldie" lang="en-US"> <![endif]-->
<!--[if IE 8]>    <html class="no-js ie8 oldie" lang="en-US"> <![endif]-->
<!--[if gt IE 8]><!--> <html class="no-js" lang="en-US"> <!--<![endif]-->
<head>


<title>fyhftlxokyjtpndbkfse.supabase.co | 520: Web server is returning an unknown error</title>
<meta charset="UTF-8" />
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta http-equiv="X-UA-Compatible" content="IE=Edge" />
<meta name="robots" content="noindex, nofollow" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<link rel="stylesheet" id="cf_styles-css" href="/cdn-cgi/styles/main.css" />


</head>
<body>
<div id="cf-wrapper">
    <div id="cf-error-details" class="p-0">
        <header class="mx-auto pt-10 lg:pt-6 lg:px-8 w-240 lg:w-full mb-8">
            <h1 class="inline-block sm:block sm:mb-2 font-light text-60 lg:text-4xl text-black-dark leading-tight mr-2">
              <span class="inline-block">Web server is returning an unknown error</span>
              <span class="code-label">Error code 520</span>
            </h1>
            <div>
               Visit <a href="https://www.cloudflare.com/5xx-error-landing?utm_source=errorcode_520&utm_campaign=fyhftlxokyjtpndbkfse.supabase.co" target="_blank" rel="noopener noreferrer">cloudflare.com</a> for more information.
            </div>
            <div class="mt-3">2026-03-20 22:28:40 UTC</div>
        </header>
        <div class="my-8 bg-gradient-gray">
            <div class="w-240 lg:w-full mx-auto">
                <div class="clearfix md:px-8">
                  
<div id="cf-browser-status" class=" relative w-1/3 md:w-full py-15 md:p-0 md:py-8 md:text-left md:border-solid md:border-0 md:border-b md:border-gray-400 overflow-hidden float-left md:float-none text-center">
  <div class="relative mb-10 md:m-0">
    
    <span class="cf-icon-browser block md:hidden h-20 bg-center bg-no-repeat"></span>
    <span class="cf-icon-ok w-12 h-12 absolute left-1/2 md:left-auto md:right-0 md:top-0 -ml-6 -bottom-4"></span>
    
  </div>
  <span class="md:block w-full truncate">You</span>
  <h3 class="md:inline-block mt-3 md:mt-0 text-2xl text-gray-600 font-light leading-1.3">
    
    Browser
    
  </h3>
  <span class="leading-1.3 text-2xl text-green-success">Working</span>
</div>

<div id="cf-cloudflare-status" class=" relative w-1/3 md:w-full py-15 md:p-0 md:py-8 md:text-left md:border-solid md:border-0 md:border-b md:border-gray-400 overflow-hidden float-left md:float-none text-center">
  <div class="relative mb-10 md:m-0">
    <a href="https://www.cloudflare.com/5xx-error-landing?utm_source=errorcode_520&utm_campaign=fyhftlxokyjtpndbkfse.supabase.co" target="_blank" rel="noopener noreferrer">
    <span class="cf-icon-cloud block md:hidden h-20 bg-center bg-no-repeat"></span>
    <span class="cf-icon-ok w-12 h-12 absolute left-1/2 md:left-auto md:right-0 md:top-0 -ml-6 -bottom-4"></span>
    </a>
  </div>
  <span class="md:block w-full truncate">Newark</span>
  <h3 class="md:inline-block mt-3 md:mt-0 text-2xl text-gray-600 font-light leading-1.3">
    <a href="https://www.cloudflare.com/5xx-error-landing?utm_source=errorcode_520&utm_campaign=fyhftlxokyjtpndbkfse.supabase.co" target="_blank" rel="noopener noreferrer">
    Cloudflare
    </a>
  </h3>
  <span class="leading-1.3 text-2xl text-green-success">Working</span>
</div>

<div id="cf-host-status" class="cf-error-source relative w-1/3 md:w-full py-15 md:p-0 md:py-8 md:text-left md:border-solid md:border-0 md:border-b md:border-gray-400 overflow-hidden float-left md:float-none text-center">
  <div class="relative mb-10 md:m-0">
    
    <span class="cf-icon-server block md:hidden h-20 bg-center bg-no-repeat"></span>
    <span class="cf-icon-error w-12 h-12 absolute left-1/2 md:left-auto md:right-0 md:top-0 -ml-6 -bottom-4"></span>
    
  </div>
  <span class="md:block w-full truncate">fyhftlxokyjtpndbkfse.supabase.co</span>
  <h3 class="md:inline-block mt-3 md:mt-0 text-2xl text-gray-600 font-light leading-1.3">
    
    Host
    
  </h3>
  <span class="leading-1.3 text-2xl text-red-error">Error</span>
</div>

                </div>
            </div>
        </div>

        <div class="w-240 lg:w-full mx-auto mb-8 lg:px-8">
            <div class="clearfix">
                <div class="w-1/2 md:w-full float-left pr-6 md:pb-10 md:pr-0 leading-relaxed">
                    <h2 class="text-3xl font-normal leading-1.3 mb-4">What happened?</h2>
                    <p>There is an unknown connection issue between Cloudflare and the origin web server. As a result, the web page can not be displayed.</p>
                </div>
                <div class="w-1/2 md:w-full float-left leading-relaxed">
                    <h2 class="text-3xl font-normal leading-1.3 mb-4">What can I do?</h2>
                          <h3 class="text-15 font-semibold mb-2">If you are a visitor of this website:</h3>
      <p class="mb-6">Please try again in a few minutes.</p>

      <h3 class="text-15 font-semibold mb-2">If you are the owner of this website:</h3>
      <p><span>There is an issue between Cloudflare's cache and your origin web server. Cloudflare monitors for these errors and automatically investigates the cause. To help support the investigation, you can pull the corresponding error log from your web server and submit it our support team.  Please include the Ray ID (which is at the bottom of this error page).</span> <a rel="noopener noreferrer" href="https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-5xx-errors/error-520/">Additional troubleshooting resources</a>.</p>
                </div>
            </div>
        </div>

        <div class="cf-error-footer cf-wrapper w-240 lg:w-full py-10 sm:py-4 sm:px-8 mx-auto text-center sm:text-left border-solid border-0 border-t border-gray-300">
  <p class="text-13">
    <span class="cf-footer-item sm:block sm:mb-1">Cloudflare Ray ID: <strong class="font-semibold">9df824fdc71541c0</strong></span>
    <span class="cf-footer-separator sm:hidden">&bull;</span>
    <span id="cf-footer-item-ip" class="cf-footer-item hidden sm:block sm:mb-1">
      Your IP:
      <button type="button" id="cf-footer-ip-reveal" class="cf-footer-ip-reveal-btn">Click to reveal</button>
      <span class="hidden" id="cf-footer-ip">68.81.5.53</span>
      <span class="cf-footer-separator sm:hidden">&bull;</span>
    </span>
    <span class="cf-footer-item sm:block sm:mb-1"><span>Performance &amp; security by</span> <a rel="noopener noreferrer" href="https://www.cloudflare.com/5xx-error-landing?utm_source=errorcode_520&utm_campaign=fyhftlxokyjtpndbkfse.supabase.co" id="brand_link" target="_blank">Cloudflare</a></span>
    
  </p>
  <script>(function(){function d(){var b=a.getElementById("cf-footer-item-ip"),c=a.getElementById("cf-footer-ip-reveal");b&&"classList"in b&&(b.classList.remove("hidden"),c.addEventListener("click",function(){c.classList.add("hidden");a.getElementById("cf-footer-ip").classList.remove("hidden")}))}var a=document;document.addEventListener&&a.addEventListener("DOMContentLoaded",d)})();</script>
</div><!-- /.error-footer -->


    </div>
</div>
</body>
</html>
 |
| 23 | 09:10 UTC | update-team-ctpi-daily | success | run | 00:19 | GET | HTTP 200 OK |
| 24 | 09:12 UTC | update-team-sos | success | run | 00:03 | GET | HTTP 200 OK |
| 25 | 09:15 UTC | update-team-power-ratings | success | run | 00:01 | GET | HTTP 200 OK |
| 26 | 09:20 UTC | update-team-power-ratings-new | success | run | 00:01 | GET | HTTP 200 OK |
| 27 | 09:30 UTC | update-goalie-projections-v2 | success | run | 00:10 | POST | Runtime varies with how far behind goalie_start_projections currently is. | The route resumes from latest existing state rather than a direct target window. | HTTP 200 OK |
| 28 | 09:35 UTC | update-wgo-teams | success | run | 00:21 | GET | HTTP 200 OK |
| 29 | 09:40 UTC | update-start-chart-projections | failure | run | 05:01 | POST | fetch failed |
| 30 | 09:45 UTC | ingest-projection-inputs | failure | run | 05:01 | POST | Recent-game ingest reads multiple upstream tables under a timeout budget. | Chunking and resumability make runtime depend on backlog and data state. | HTTP 500 Internal Server Error | TypeError: fetch failed |
| 31 | 09:50 UTC | build-forge-derived-v2 | failure | run | 05:01 | POST | UTC (after rolling averages + goalie starts) | Runs multiple derived-table builders in one request under a 4.5-minute budget. | FORGE projection freshness depends directly on this stage completing. | fetch failed |
| 32 | 09:55 UTC | update-nst-team-daily | failure | run | 05:01 | GET | fetch failed |
| 33 | 10:00 UTC | daily-refresh-matview | failure | run | 03:00 | SQL | Supabase execute_sql RPC failed. | <!DOCTYPE html>
<!--[if lt IE 7]> <html class="no-js ie6 oldie" lang="en-US"> <![endif]-->
<!--[if IE 7]>    <html class="no-js ie7 oldie" lang="en-US"> <![endif]-->
<!--[if IE 8]>    <html class="no-js ie8 oldie" lang="en-US"> <![endif]-->
<!--[if gt IE 8]><!--> <html class="no-js" lang="en-US"> <!--<![endif]-->
<head>


<title>fyhftlxokyjtpndbkfse.supabase.co | 522: Connection timed out</title>
<meta charset="UTF-8" />
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta http-equiv="X-UA-Compatible" content="IE=Edge" />
<meta name="robots" content="noindex, nofollow" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<link rel="stylesheet" id="cf_styles-css" href="/cdn-cgi/styles/main.css" />


</head>
<body>
<div id="cf-wrapper">
    <div id="cf-error-details" class="p-0">
        <header class="mx-auto pt-10 lg:pt-6 lg:px-8 w-240 lg:w-full mb-8">
            <h1 class="inline-block sm:block sm:mb-2 font-light text-60 lg:text-4xl text-black-dark leading-tight mr-2">
              <span class="inline-block">Connection timed out</span>
              <span class="code-label">Error code 522</span>
            </h1>
            <div>
               Visit <a href="https://www.cloudflare.com/5xx-error-landing?utm_source=errorcode_522&utm_campaign=fyhftlxokyjtpndbkfse.supabase.co" target="_blank" rel="noopener noreferrer">cloudflare.com</a> for more information.
            </div>
            <div class="mt-3">2026-03-20 22:52:42 UTC</div>
        </header>
        <div class="my-8 bg-gradient-gray">
            <div class="w-240 lg:w-full mx-auto">
                <div class="clearfix md:px-8">
                  
<div id="cf-browser-status" class=" relative w-1/3 md:w-full py-15 md:p-0 md:py-8 md:text-left md:border-solid md:border-0 md:border-b md:border-gray-400 overflow-hidden float-left md:float-none text-center">
  <div class="relative mb-10 md:m-0">
    
    <span class="cf-icon-browser block md:hidden h-20 bg-center bg-no-repeat"></span>
    <span class="cf-icon-ok w-12 h-12 absolute left-1/2 md:left-auto md:right-0 md:top-0 -ml-6 -bottom-4"></span>
    
  </div>
  <span class="md:block w-full truncate">You</span>
  <h3 class="md:inline-block mt-3 md:mt-0 text-2xl text-gray-600 font-light leading-1.3">
    
    Browser
    
  </h3>
  <span class="leading-1.3 text-2xl text-green-success">Working</span>
</div>

<div id="cf-cloudflare-status" class=" relative w-1/3 md:w-full py-15 md:p-0 md:py-8 md:text-left md:border-solid md:border-0 md:border-b md:border-gray-400 overflow-hidden float-left md:float-none text-center">
  <div class="relative mb-10 md:m-0">
    <a href="https://www.cloudflare.com/5xx-error-landing?utm_source=errorcode_522&utm_campaign=fyhftlxokyjtpndbkfse.supabase.co" target="_blank" rel="noopener noreferrer">
    <span class="cf-icon-cloud block md:hidden h-20 bg-center bg-no-repeat"></span>
    <span class="cf-icon-ok w-12 h-12 absolute left-1/2 md:left-auto md:right-0 md:top-0 -ml-6 -bottom-4"></span>
    </a>
  </div>
  <span class="md:block w-full truncate">Newark</span>
  <h3 class="md:inline-block mt-3 md:mt-0 text-2xl text-gray-600 font-light leading-1.3">
    <a href="https://www.cloudflare.com/5xx-error-landing?utm_source=errorcode_522&utm_campaign=fyhftlxokyjtpndbkfse.supabase.co" target="_blank" rel="noopener noreferrer">
    Cloudflare
    </a>
  </h3>
  <span class="leading-1.3 text-2xl text-green-success">Working</span>
</div>

<div id="cf-host-status" class="cf-error-source relative w-1/3 md:w-full py-15 md:p-0 md:py-8 md:text-left md:border-solid md:border-0 md:border-b md:border-gray-400 overflow-hidden float-left md:float-none text-center">
  <div class="relative mb-10 md:m-0">
    
    <span class="cf-icon-server block md:hidden h-20 bg-center bg-no-repeat"></span>
    <span class="cf-icon-error w-12 h-12 absolute left-1/2 md:left-auto md:right-0 md:top-0 -ml-6 -bottom-4"></span>
    
  </div>
  <span class="md:block w-full truncate">fyhftlxokyjtpndbkfse.supabase.co</span>
  <h3 class="md:inline-block mt-3 md:mt-0 text-2xl text-gray-600 font-light leading-1.3">
    
    Host
    
  </h3>
  <span class="leading-1.3 text-2xl text-red-error">Error</span>
</div>

                </div>
            </div>
        </div>

        <div class="w-240 lg:w-full mx-auto mb-8 lg:px-8">
            <div class="clearfix">
                <div class="w-1/2 md:w-full float-left pr-6 md:pb-10 md:pr-0 leading-relaxed">
                    <h2 class="text-3xl font-normal leading-1.3 mb-4">What happened?</h2>
                    <p>The initial connection between Cloudflare's network and the origin web server timed out. As a result, the web page can not be displayed.</p>
                </div>
                <div class="w-1/2 md:w-full float-left leading-relaxed">
                    <h2 class="text-3xl font-normal leading-1.3 mb-4">What can I do?</h2>
                          <h3 class="text-15 font-semibold mb-2">If you're a visitor of this website:</h3>
      <p class="mb-6">Please try again in a few minutes.</p>

      <h3 class="text-15 font-semibold mb-2">If you're the owner of this website:</h3>
      <p>Please refer to the <a rel="noopener noreferrer" href="https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-5xx-errors/error-522/">Error 522</a> article:</p>
      <ul class="ml-4">
        <li>Contact your hosting provider; let them know your web server is not completing requests.</li>
        <li>Make sure your origin allows <a rel="noopener noreferrer" href="https://www.cloudflare.com/ips/">all Cloudflare IP ranges</a>.</li>
      </ul>
                </div>
            </div>
        </div>

        <div class="cf-error-footer cf-wrapper w-240 lg:w-full py-10 sm:py-4 sm:px-8 mx-auto text-center sm:text-left border-solid border-0 border-t border-gray-300">
  <p class="text-13">
    <span class="cf-footer-item sm:block sm:mb-1">Cloudflare Ray ID: <strong class="font-semibold">9df84586146e8465</strong></span>
    <span class="cf-footer-separator sm:hidden">&bull;</span>
    <span id="cf-footer-item-ip" class="cf-footer-item hidden sm:block sm:mb-1">
      Your IP:
      <button type="button" id="cf-footer-ip-reveal" class="cf-footer-ip-reveal-btn">Click to reveal</button>
      <span class="hidden" id="cf-footer-ip">68.81.5.53</span>
      <span class="cf-footer-separator sm:hidden">&bull;</span>
    </span>
    <span class="cf-footer-item sm:block sm:mb-1"><span>Performance &amp; security by</span> <a rel="noopener noreferrer" href="https://www.cloudflare.com/5xx-error-landing?utm_source=errorcode_522&utm_campaign=fyhftlxokyjtpndbkfse.supabase.co" id="brand_link" target="_blank">Cloudflare</a></span>
    
  </p>
  <script>(function(){function d(){var b=a.getElementById("cf-footer-item-ip"),c=a.getElementById("cf-footer-ip-reveal");b&&"classList"in b&&(b.classList.remove("hidden"),c.addEventListener("click",function(){c.classList.add("hidden");a.getElementById("cf-footer-ip").classList.remove("hidden")}))}var a=document;document.addEventListener&&a.addEventListener("DOMContentLoaded",d)})();</script>
</div><!-- /.error-footer -->


    </div>
</div>
</body>
</html>
 |
| 34 | 10:05 UTC | run-forge-projection-v2 | failure | run | 03:00 | POST | UTC (after derived tables are built) | Projection run is preflight-gated and likely to overrun when upstream data lags. | This is the core downstream FORGE job for dashboard freshness. | HTTP 500 Internal Server Error | <!DOCTYPE html>
<!--[if lt IE 7]> <html class="no-js ie6 oldie" lang="en-US"> <![endif]-->
<!--[if IE 7]>    <html class="no-js ie7 oldie" lang="en-US"> <![endif]-->
<!--[if IE 8]>    <html class="no-js ie8 oldie" lang="en-US"> <![endif]--… |
| 35 | 10:15 UTC | refresh-team-power-ratings-daily | failure | run | 03:00 | SQL | Supabase execute_sql RPC failed. | <!DOCTYPE html>
<!--[if lt IE 7]> <html class="no-js ie6 oldie" lang="en-US"> <![endif]-->
<!--[if IE 7]>    <html class="no-js ie7 oldie" lang="en-US"> <![endif]-->
<!--[if IE 8]>    <html class="no-js ie8 oldie" lang="en-US"> <![endif]-->
<!--[if gt IE 8]><!--> <html class="no-js" lang="en-US"> <!--<![endif]-->
<head>


<title>fyhftlxokyjtpndbkfse.supabase.co | 522: Connection timed out</title>
<meta charset="UTF-8" />
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta http-equiv="X-UA-Compatible" content="IE=Edge" />
<meta name="robots" content="noindex, nofollow" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<link rel="stylesheet" id="cf_styles-css" href="/cdn-cgi/styles/main.css" />


</head>
<body>
<div id="cf-wrapper">
    <div id="cf-error-details" class="p-0">
        <header class="mx-auto pt-10 lg:pt-6 lg:px-8 w-240 lg:w-full mb-8">
            <h1 class="inline-block sm:block sm:mb-2 font-light text-60 lg:text-4xl text-black-dark leading-tight mr-2">
              <span class="inline-block">Connection timed out</span>
              <span class="code-label">Error code 522</span>
            </h1>
            <div>
               Visit <a href="https://www.cloudflare.com/5xx-error-landing?utm_source=errorcode_522&utm_campaign=fyhftlxokyjtpndbkfse.supabase.co" target="_blank" rel="noopener noreferrer">cloudflare.com</a> for more information.
            </div>
            <div class="mt-3">2026-03-20 22:58:42 UTC</div>
        </header>
        <div class="my-8 bg-gradient-gray">
            <div class="w-240 lg:w-full mx-auto">
                <div class="clearfix md:px-8">
                  
<div id="cf-browser-status" class=" relative w-1/3 md:w-full py-15 md:p-0 md:py-8 md:text-left md:border-solid md:border-0 md:border-b md:border-gray-400 overflow-hidden float-left md:float-none text-center">
  <div class="relative mb-10 md:m-0">
    
    <span class="cf-icon-browser block md:hidden h-20 bg-center bg-no-repeat"></span>
    <span class="cf-icon-ok w-12 h-12 absolute left-1/2 md:left-auto md:right-0 md:top-0 -ml-6 -bottom-4"></span>
    
  </div>
  <span class="md:block w-full truncate">You</span>
  <h3 class="md:inline-block mt-3 md:mt-0 text-2xl text-gray-600 font-light leading-1.3">
    
    Browser
    
  </h3>
  <span class="leading-1.3 text-2xl text-green-success">Working</span>
</div>

<div id="cf-cloudflare-status" class=" relative w-1/3 md:w-full py-15 md:p-0 md:py-8 md:text-left md:border-solid md:border-0 md:border-b md:border-gray-400 overflow-hidden float-left md:float-none text-center">
  <div class="relative mb-10 md:m-0">
    <a href="https://www.cloudflare.com/5xx-error-landing?utm_source=errorcode_522&utm_campaign=fyhftlxokyjtpndbkfse.supabase.co" target="_blank" rel="noopener noreferrer">
    <span class="cf-icon-cloud block md:hidden h-20 bg-center bg-no-repeat"></span>
    <span class="cf-icon-ok w-12 h-12 absolute left-1/2 md:left-auto md:right-0 md:top-0 -ml-6 -bottom-4"></span>
    </a>
  </div>
  <span class="md:block w-full truncate">Newark</span>
  <h3 class="md:inline-block mt-3 md:mt-0 text-2xl text-gray-600 font-light leading-1.3">
    <a href="https://www.cloudflare.com/5xx-error-landing?utm_source=errorcode_522&utm_campaign=fyhftlxokyjtpndbkfse.supabase.co" target="_blank" rel="noopener noreferrer">
    Cloudflare
    </a>
  </h3>
  <span class="leading-1.3 text-2xl text-green-success">Working</span>
</div>

<div id="cf-host-status" class="cf-error-source relative w-1/3 md:w-full py-15 md:p-0 md:py-8 md:text-left md:border-solid md:border-0 md:border-b md:border-gray-400 overflow-hidden float-left md:float-none text-center">
  <div class="relative mb-10 md:m-0">
    
    <span class="cf-icon-server block md:hidden h-20 bg-center bg-no-repeat"></span>
    <span class="cf-icon-error w-12 h-12 absolute left-1/2 md:left-auto md:right-0 md:top-0 -ml-6 -bottom-4"></span>
    
  </div>
  <span class="md:block w-full truncate">fyhftlxokyjtpndbkfse.supabase.co</span>
  <h3 class="md:inline-block mt-3 md:mt-0 text-2xl text-gray-600 font-light leading-1.3">
    
    Host
    
  </h3>
  <span class="leading-1.3 text-2xl text-red-error">Error</span>
</div>

                </div>
            </div>
        </div>

        <div class="w-240 lg:w-full mx-auto mb-8 lg:px-8">
            <div class="clearfix">
                <div class="w-1/2 md:w-full float-left pr-6 md:pb-10 md:pr-0 leading-relaxed">
                    <h2 class="text-3xl font-normal leading-1.3 mb-4">What happened?</h2>
                    <p>The initial connection between Cloudflare's network and the origin web server timed out. As a result, the web page can not be displayed.</p>
                </div>
                <div class="w-1/2 md:w-full float-left leading-relaxed">
                    <h2 class="text-3xl font-normal leading-1.3 mb-4">What can I do?</h2>
                          <h3 class="text-15 font-semibold mb-2">If you're a visitor of this website:</h3>
      <p class="mb-6">Please try again in a few minutes.</p>

      <h3 class="text-15 font-semibold mb-2">If you're the owner of this website:</h3>
      <p>Please refer to the <a rel="noopener noreferrer" href="https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-5xx-errors/error-522/">Error 522</a> article:</p>
      <ul class="ml-4">
        <li>Contact your hosting provider; let them know your web server is not completing requests.</li>
        <li>Make sure your origin allows <a rel="noopener noreferrer" href="https://www.cloudflare.com/ips/">all Cloudflare IP ranges</a>.</li>
      </ul>
                </div>
            </div>
        </div>

        <div class="cf-error-footer cf-wrapper w-240 lg:w-full py-10 sm:py-4 sm:px-8 mx-auto text-center sm:text-left border-solid border-0 border-t border-gray-300">
  <p class="text-13">
    <span class="cf-footer-item sm:block sm:mb-1">Cloudflare Ray ID: <strong class="font-semibold">9df84e5407525930</strong></span>
    <span class="cf-footer-separator sm:hidden">&bull;</span>
    <span id="cf-footer-item-ip" class="cf-footer-item hidden sm:block sm:mb-1">
      Your IP:
      <button type="button" id="cf-footer-ip-reveal" class="cf-footer-ip-reveal-btn">Click to reveal</button>
      <span class="hidden" id="cf-footer-ip">68.81.5.53</span>
      <span class="cf-footer-separator sm:hidden">&bull;</span>
    </span>
    <span class="cf-footer-item sm:block sm:mb-1"><span>Performance &amp; security by</span> <a rel="noopener noreferrer" href="https://www.cloudflare.com/5xx-error-landing?utm_source=errorcode_522&utm_campaign=fyhftlxokyjtpndbkfse.supabase.co" id="brand_link" target="_blank">Cloudflare</a></span>
    
  </p>
  <script>(function(){function d(){var b=a.getElementById("cf-footer-item-ip"),c=a.getElementById("cf-footer-ip-reveal");b&&"classList"in b&&(b.classList.remove("hidden"),c.addEventListener("click",function(){c.classList.add("hidden");a.getElementById("cf-footer-ip").classList.remove("hidden")}))}var a=document;document.addEventListener&&a.addEventListener("DOMContentLoaded",d)})();</script>
</div><!-- /.error-footer -->


    </div>
</div>
</body>
</html>
 |
| 36 | 10:20 UTC | update-season-stats-current-season | failure | run | 02:50 | GET | HTTP 500 Internal Server Error | An unexpected error occurred: Failed to determine latest processed game for goaliesGameStats in season 20252026: <!DOCTYPE html>
<!--[if lt IE 7]> <html class="no-js ie6 oldie" lang="en-US"> <![endif]-->
<!--[if IE 7]>    <html class="no-j… |
| 37 | 10:25 UTC | update-rolling-games-recent | failure | run | 00:00 | GET | HTTP 500 Internal Server Error | Error: require is not a function |
| 38 | 10:30 UTC | update-sko-stats-full-season | failure | run | 01:18 | GET | HTTP 400 Bad Request | Failed to process request. Reason: Failed to determine latest sko_skater_stats date for season 20252026: <!DOCTYPE html>
<!--[if lt IE 7]> <html class="no-js ie6 oldie" lang="en-US"> <![endif]-->
<!--[if IE 7]>    <html class="no-js ie7 ol… |
| 39 | 10:35 UTC | update-wgo-averages | failure | run | 00:38 | GET | HTTP 500 Internal Server Error | Failed to fetch data from nst_seasonal_on_ice_counts: <!DOCTYPE html>
<!--[if lt IE 7]> <html class="no-js ie6 oldie" lang="en-US"> <![endif]-->
<!--[if IE 7]>    <html class="no-js ie7 oldie" lang="en-US"> <![endif]-->
<!--[if IE 8]>    <… |
| 40 | 10:40 UTC | rebuild-sustainability-baselines | failure | run | 00:38 | GET | HTTP 500 Internal Server Error | Supabase query error on table=player_stats_unified select=player_id, player_name, position_code range=0-999: <!DOCTYPE html>
<!--[if lt IE 7]> <html class="no-js ie6 oldie" lang="en-US"> <![endif]-->
<!--[if IE 7]>    <html class="no-js ie… |
| 41 | 10:41 UTC | daily-refresh-player-totals-unified-matview | failure | run | 00:39 | SQL | Supabase execute_sql RPC failed. | <!DOCTYPE html>
<!--[if lt IE 7]> <html class="no-js ie6 oldie" lang="en-US"> <![endif]-->
<!--[if IE 7]>    <html class="no-js ie7 oldie" lang="en-US"> <![endif]-->
<!--[if IE 8]>    <html class="no-js ie8 oldie" lang="en-US"> <![endif]-->
<!--[if gt IE 8]><!--> <html class="no-js" lang="en-US"> <!--<![endif]-->
<head>


<title>fyhftlxokyjtpndbkfse.supabase.co | 522: Connection timed out</title>
<meta charset="UTF-8" />
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta http-equiv="X-UA-Compatible" content="IE=Edge" />
<meta name="robots" content="noindex, nofollow" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<link rel="stylesheet" id="cf_styles-css" href="/cdn-cgi/styles/main.css" />


</head>
<body>
<div id="cf-wrapper">
    <div id="cf-error-details" class="p-0">
        <header class="mx-auto pt-10 lg:pt-6 lg:px-8 w-240 lg:w-full mb-8">
            <h1 class="inline-block sm:block sm:mb-2 font-light text-60 lg:text-4xl text-black-dark leading-tight mr-2">
              <span class="inline-block">Connection timed out</span>
              <span class="code-label">Error code 522</span>
            </h1>
            <div>
               Visit <a href="https://www.cloudflare.com/5xx-error-landing?utm_source=errorcode_522&utm_campaign=fyhftlxokyjtpndbkfse.supabase.co" target="_blank" rel="noopener noreferrer">cloudflare.com</a> for more information.
            </div>
            <div class="mt-3">2026-03-20 23:04:48 UTC</div>
        </header>
        <div class="my-8 bg-gradient-gray">
            <div class="w-240 lg:w-full mx-auto">
                <div class="clearfix md:px-8">
                  
<div id="cf-browser-status" class=" relative w-1/3 md:w-full py-15 md:p-0 md:py-8 md:text-left md:border-solid md:border-0 md:border-b md:border-gray-400 overflow-hidden float-left md:float-none text-center">
  <div class="relative mb-10 md:m-0">
    
    <span class="cf-icon-browser block md:hidden h-20 bg-center bg-no-repeat"></span>
    <span class="cf-icon-ok w-12 h-12 absolute left-1/2 md:left-auto md:right-0 md:top-0 -ml-6 -bottom-4"></span>
    
  </div>
  <span class="md:block w-full truncate">You</span>
  <h3 class="md:inline-block mt-3 md:mt-0 text-2xl text-gray-600 font-light leading-1.3">
    
    Browser
    
  </h3>
  <span class="leading-1.3 text-2xl text-green-success">Working</span>
</div>

<div id="cf-cloudflare-status" class=" relative w-1/3 md:w-full py-15 md:p-0 md:py-8 md:text-left md:border-solid md:border-0 md:border-b md:border-gray-400 overflow-hidden float-left md:float-none text-center">
  <div class="relative mb-10 md:m-0">
    <a href="https://www.cloudflare.com/5xx-error-landing?utm_source=errorcode_522&utm_campaign=fyhftlxokyjtpndbkfse.supabase.co" target="_blank" rel="noopener noreferrer">
    <span class="cf-icon-cloud block md:hidden h-20 bg-center bg-no-repeat"></span>
    <span class="cf-icon-ok w-12 h-12 absolute left-1/2 md:left-auto md:right-0 md:top-0 -ml-6 -bottom-4"></span>
    </a>
  </div>
  <span class="md:block w-full truncate">Newark</span>
  <h3 class="md:inline-block mt-3 md:mt-0 text-2xl text-gray-600 font-light leading-1.3">
    <a href="https://www.cloudflare.com/5xx-error-landing?utm_source=errorcode_522&utm_campaign=fyhftlxokyjtpndbkfse.supabase.co" target="_blank" rel="noopener noreferrer">
    Cloudflare
    </a>
  </h3>
  <span class="leading-1.3 text-2xl text-green-success">Working</span>
</div>

<div id="cf-host-status" class="cf-error-source relative w-1/3 md:w-full py-15 md:p-0 md:py-8 md:text-left md:border-solid md:border-0 md:border-b md:border-gray-400 overflow-hidden float-left md:float-none text-center">
  <div class="relative mb-10 md:m-0">
    
    <span class="cf-icon-server block md:hidden h-20 bg-center bg-no-repeat"></span>
    <span class="cf-icon-error w-12 h-12 absolute left-1/2 md:left-auto md:right-0 md:top-0 -ml-6 -bottom-4"></span>
    
  </div>
  <span class="md:block w-full truncate">fyhftlxokyjtpndbkfse.supabase.co</span>
  <h3 class="md:inline-block mt-3 md:mt-0 text-2xl text-gray-600 font-light leading-1.3">
    
    Host
    
  </h3>
  <span class="leading-1.3 text-2xl text-red-error">Error</span>
</div>

                </div>
            </div>
        </div>

        <div class="w-240 lg:w-full mx-auto mb-8 lg:px-8">
            <div class="clearfix">
                <div class="w-1/2 md:w-full float-left pr-6 md:pb-10 md:pr-0 leading-relaxed">
                    <h2 class="text-3xl font-normal leading-1.3 mb-4">What happened?</h2>
                    <p>The initial connection between Cloudflare's network and the origin web server timed out. As a result, the web page can not be displayed.</p>
                </div>
                <div class="w-1/2 md:w-full float-left leading-relaxed">
                    <h2 class="text-3xl font-normal leading-1.3 mb-4">What can I do?</h2>
                          <h3 class="text-15 font-semibold mb-2">If you're a visitor of this website:</h3>
      <p class="mb-6">Please try again in a few minutes.</p>

      <h3 class="text-15 font-semibold mb-2">If you're the owner of this website:</h3>
      <p>Please refer to the <a rel="noopener noreferrer" href="https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-5xx-errors/error-522/">Error 522</a> article:</p>
      <ul class="ml-4">
        <li>Contact your hosting provider; let them know your web server is not completing requests.</li>
        <li>Make sure your origin allows <a rel="noopener noreferrer" href="https://www.cloudflare.com/ips/">all Cloudflare IP ranges</a>.</li>
      </ul>
                </div>
            </div>
        </div>

        <div class="cf-error-footer cf-wrapper w-240 lg:w-full py-10 sm:py-4 sm:px-8 mx-auto text-center sm:text-left border-solid border-0 border-t border-gray-300">
  <p class="text-13">
    <span class="cf-footer-item sm:block sm:mb-1">Cloudflare Ray ID: <strong class="font-semibold">9df85ab3f347b637</strong></span>
    <span class="cf-footer-separator sm:hidden">&bull;</span>
    <span id="cf-footer-item-ip" class="cf-footer-item hidden sm:block sm:mb-1">
      Your IP:
      <button type="button" id="cf-footer-ip-reveal" class="cf-footer-ip-reveal-btn">Click to reveal</button>
      <span class="hidden" id="cf-footer-ip">68.81.5.53</span>
      <span class="cf-footer-separator sm:hidden">&bull;</span>
    </span>
    <span class="cf-footer-item sm:block sm:mb-1"><span>Performance &amp; security by</span> <a rel="noopener noreferrer" href="https://www.cloudflare.com/5xx-error-landing?utm_source=errorcode_522&utm_campaign=fyhftlxokyjtpndbkfse.supabase.co" id="brand_link" target="_blank">Cloudflare</a></span>
    
  </p>
  <script>(function(){function d(){var b=a.getElementById("cf-footer-item-ip"),c=a.getElementById("cf-footer-ip-reveal");b&&"classList"in b&&(b.classList.remove("hidden"),c.addEventListener("click",function(){c.classList.add("hidden");a.getElementById("cf-footer-ip").classList.remove("hidden")}))}var a=document;document.addEventListener&&a.addEventListener("DOMContentLoaded",d)})();</script>
</div><!-- /.error-footer -->


    </div>
</div>
</body>
</html>
 |
| 42 | 10:42 UTC | rebuild-sustainability-priors | failure | run | 00:39 | GET | HTTP 500 Internal Server Error | <!DOCTYPE html>
<!--[if lt IE 7]> <html class="no-js ie6 oldie" lang="en-US"> <![endif]-->
<!--[if IE 7]>    <html class="no-js ie7 oldie" lang="en-US"> <![endif]-->
<!--[if IE 8]>    <html class="no-js ie8 oldie" lang="en-US"> <![endif]--… |
| 43 | 10:43 UTC | rebuild-sustainability-window-z | failure | run | 00:39 | GET | runAll mode loops windows across all baseline players. | May need offset-specific sequencing if full-run timing is unstable. | HTTP 500 Internal Server Error | <!DOCTYPE html>
<!--[if lt IE 7]> <html class="no-js ie6 oldie" lang="en-US"> <![endif]-->
<!--[if IE 7]>    <html class="no-js ie7 oldie" lang="en-US"> <![endif]-->
<!--[if IE 8]>    <html class="no-js ie8 oldie" lang="en-US"> <![endif]--… |
| 44 | 10:44 UTC | rebuild-sustainability-score | failure | run | 00:39 | GET | Score rebuild loops player baselines and window outputs before upsert. | A strong candidate for optimization or explicit sequential batching. | HTTP 500 Internal Server Error | <!DOCTYPE html>
<!--[if lt IE 7]> <html class="no-js ie6 oldie" lang="en-US"> <![endif]-->
<!--[if IE 7]>    <html class="no-js ie7 oldie" lang="en-US"> <![endif]-->
<!--[if IE 8]>    <html class="no-js ie8 oldie" lang="en-US"> <![endif]--… |
| 45 | 10:45 UTC | update-predictions-sko | failure | run | 00:39 | GET | HTTP 500 Internal Server Error | <!DOCTYPE html>
<!--[if lt IE 7]> <html class="no-js ie6 oldie" lang="en-US"> <![endif]-->
<!--[if IE 7]>    <html class="no-js ie7 oldie" lang="en-US"> <![endif]-->
<!--[if IE 8]>    <html class="no-js ie8 oldie" lang="en-US"> <![endif]--… |
| 46 | 10:46 UTC | rebuild-sustainability-trend-bands | failure | run | 00:38 | GET | Trend bands can expand over large per-player history slices. | May require audit-mode batching if runAll exceeds the cron budget. | HTTP 500 Internal Server Error | <!DOCTYPE html>
<!--[if lt IE 7]> <html class="no-js ie6 oldie" lang="en-US"> <![endif]-->
<!--[if IE 7]>    <html class="no-js ie7 oldie" lang="en-US"> <![endif]-->
<!--[if IE 8]>    <html class="no-js ie8 oldie" lang="en-US"> <![endif]--… |
| 47 | 10:50 UTC | update-nst-team-daily-incremental | failure | run | 05:01 | GET | fetch failed |
| 48 | 10:55 UTC | update-nst-team-stats-all | failure | run | 16:18 | GET | Inserted 900s NST safety wait before execution. | HTTP 500 Internal Server Error | Failed to upsert team statistics: Failed to scan existing dates for nst_team_all: <!DOCTYPE html>
<!--[if lt IE 7]> <html class="no-js ie6 oldie" lang="en-US"> <![endif]-->
<!--[if IE 7]>    <html class="no-js ie7 oldie" lang="en-US"> <![e… |
| 49 | 11:00 UTC | update-power-rankings | failure | run | 00:00 | GET | HTTP 500 Internal Server Error | Error: require is not a function |
| 50 | 11:30 UTC | run-projection-accuracy | failure | run | 00:39 | POST | HTTP 500 Internal Server Error | <!DOCTYPE html>
<!--[if lt IE 7]> <html class="no-js ie6 oldie" lang="en-US"> <![endif]-->
<!--[if IE 7]>    <html class="no-js ie7 oldie" lang="en-US"> <![endif]-->
<!--[if IE 8]>    <html class="no-js ie8 oldie" lang="en-US"> <![endif]--… |
| 51 | 13:00 UTC | daily-cron-report | skipped | observe_only | 00:00 | GET | Sends Resend email and is better observed in mocked-email or production-safe mode. | Should run last and should not be benchmarked as a normal local side-effect job. | Policy action: observe_only | Skipped unsafe local/dev side-effect route and recorded observation only. |
| 52 | 20:51 UTC | update-pbp | skipped | skip | 00:00 | GET | NOT WORKING | Policy action: skip | Skipped by benchmark execution policy. |

## Detailed Notes

### 1. update-yahoo-matchup-dates
- Schedule slot: 07:20 UTC
- Status: success
- Action: run
- Timer: 00:01 (1319 ms)
- Method: GET
- Route: /api/v1/db/update-yahoo-weeks?game_key=nhl
- Local policy: safe
- Reason: —
- Notes: HTTP 200 OK
- Summary: {"kind":"http","statusCode":200,"ok":true,"body":{"success":true,"message":"Upserted 24 week(s) for game_key=465"}}

### 2. update-nst-gamelog
- Schedule slot: 07:25 UTC
- Status: success
- Action: run
- Timer: 00:34 (34684 ms)
- Method: GET
- Route: /api/v1/db/update-nst-gamelog
- Local policy: caution
- Reason: —
- Notes: Direct NST scraper with date iteration and enforced inter-request pacing. | Must be treated as a direct NST request-budget consumer. | Runtime depends on current resume point and backlog. | Direct NST job started with no prior NST wait requirement. | HTTP 200 OK
- Summary: {"kind":"http","statusCode":200,"ok":true,"body":{"message":"Done"}}

### 3. update-all-wgo-skaters
- Schedule slot: 07:30 UTC
- Status: success
- Action: run
- Timer: 00:04 (4505 ms)
- Method: GET
- Route: /api/v1/db/update-wgo-skaters?action=all
- Local policy: safe
- Reason: —
- Notes: HTTP 200 OK
- Summary: {"kind":"http","statusCode":200,"ok":true,"body":{"success":true,"message":"All skater stats updated successfully. Processed 1 distinct dates with 0 total updates."}}

### 4. update-all-wgo-goalies
- Schedule slot: 07:35 UTC
- Status: success
- Action: run
- Timer: 00:00 (222 ms)
- Method: GET
- Route: /api/v1/db/update-wgo-goalies?action=all
- Local policy: safe
- Reason: —
- Notes: HTTP 200 OK
- Summary: {"kind":"http","statusCode":200,"ok":true,"body":{"success":true,"message":"Incremental update finished. Updated 0 goalie stats with 0 errors."}}

### 5. update-all-wgo-skater-totals
- Schedule slot: 07:40 UTC
- Status: success
- Action: run
- Timer: 01:49 (109172 ms)
- Method: GET
- Route: /api/v1/db/update-wgo-totals?season=current
- Local policy: safe
- Reason: —
- Notes: HTTP 200 OK
- Summary: {"kind":"http","statusCode":200,"ok":true,"body":{"success":true,"message":"Updated 890 players for current season 20252026."}}

### 6. update-shift-charts
- Schedule slot: 07:45 UTC
- Status: skipped
- Action: skip
- Timer: 00:00 (1 ms)
- Method: GET
- Route: /api/v1/db/update-shifts?action=all
- Local policy: skip
- Reason: Skipped by benchmark execution policy.
- Notes: STATUS: 404 NOT FOUND | Policy action: skip | Skipped by benchmark execution policy.
- Summary: {"kind":"policy","action":"skip"}

### 7. update-rolling-player-averages
- Schedule slot: 07:45 UTC
- Status: failure
- Action: run
- Timer: 03:00 (180406 ms)
- Method: GET
- Route: /api/v1/db/update-rolling-player-averages
- Local policy: safe
- Reason: canceling statement due to statement timeout
- Notes: Broad rolling rebuild with concurrency knobs and large player scope. | Downstream FORGE and Start Chart freshness depend on this output. | HTTP 500 Internal Server Error | canceling statement due to statement timeout
- Summary: {"kind":"http","statusCode":500,"ok":false,"body":{"message":"canceling statement due to statement timeout"}}

### 8. daily-refresh-player-unified-matview
- Schedule slot: 07:50 UTC
- Status: success
- Action: run
- Timer: 00:02 (2368 ms)
- Method: SQL
- Route: -- 07:50 UTC 'REFRESH MATERIALIZED VIEW player_stats_unified;'
- Local policy: safe
- Reason: —
- Notes: Executed through Supabase execute_sql RPC.
- Summary: {"kind":"sql","dataPreview":null}

### 9. update-power-play-timeframes
- Schedule slot: 07:55 UTC
- Status: success
- Action: run
- Timer: 00:02 (2709 ms)
- Method: GET
- Route: /api/v1/db/powerPlayTimeFrame?gameId=all
- Local policy: safe
- Reason: —
- Notes: HTTP 200 OK
- Summary: {"kind":"http","statusCode":200,"ok":true,"body":{"success":true,"message":"Successfully processed 0 games."}}

### 10. update-line-combinations-all
- Schedule slot: 08:00 UTC
- Status: success
- Action: run
- Timer: 00:02 (2857 ms)
- Method: GET
- Route: /api/v1/db/update-line-combinations
- Local policy: safe
- Reason: —
- Notes: HTTP 200 OK
- Summary: {"kind":"http","statusCode":200,"ok":true,"body":{"success":true,"message":"Recent current-season line combination data are up to date."}}

### 11. update-team-yearly-summary
- Schedule slot: 08:05 UTC
- Status: success
- Action: run
- Timer: 00:01 (1582 ms)
- Method: GET
- Route: /api/v1/db/update-team-yearly-summary
- Local policy: safe
- Reason: —
- Notes: HTTP 200 OK
- Summary: {"kind":"http","statusCode":200,"ok":true,"body":{"success":true,"message":"Successfully upserted team summary data for 1 seasons."}}

### 12. update-nst-tables-all
- Schedule slot: 08:10 UTC
- Status: success
- Action: run
- Timer: 11:05 (665252 ms)
- Method: GET
- Route: /api/Teams/nst-team-stats?date=all
- Local policy: caution
- Reason: —
- Notes: NST table rebuild can run near the route budget on stale datasets. | Touches NST directly and should stay spaced from other NST jobs. | Observed runtime depends on latest ingested date and resume state. | Inserted 597s NST safety wait before execution. | HTTP 200 OK
- Summary: {"kind":"http","statusCode":200,"ok":true,"body":{"success":true,"message":"NST team stats processed 1 date(s) in 68.8 seconds and stopped before the Vercel timeout."}}

### 13. update-standings-details
- Schedule slot: 08:15 UTC
- Status: success
- Action: run
- Timer: 01:30 (90707 ms)
- Method: GET
- Route: /api/v1/db/update-standings-details?date=all
- Local policy: safe
- Reason: —
- Notes: HTTP 200 OK
- Summary: {"kind":"http","statusCode":200,"ok":true,"body":{"success":true,"message":"Updated ALL dates for the current season."}}

### 14. update-all-wgo-goalie-totals
- Schedule slot: 08:20 UTC
- Status: success
- Action: run
- Timer: 00:02 (2328 ms)
- Method: GET
- Route: /api/v1/db/update-wgo-goalie-totals
- Local policy: safe
- Reason: —
- Notes: HTTP 200 OK
- Summary: {"kind":"http","statusCode":200,"ok":true,"body":{"success":true,"message":"Successfully refreshed (upserted) goalie season totals for season 20242025."}}

### 15. update-expected-goals
- Schedule slot: 08:25 UTC
- Status: success
- Action: run
- Timer: 01:27 (87011 ms)
- Method: GET
- Route: /api/v1/db/update-expected-goals?date=all
- Local policy: safe
- Reason: —
- Notes: HTTP 200 OK
- Summary: {"kind":"http","statusCode":200,"ok":true,"body":{"success":true,"message":"Expected goals for the entire season updated successfully."}}

### 16. update-nst-goalies
- Schedule slot: 08:30 UTC
- Status: failure
- Action: run
- Timer: 17:00 (1020932 ms)
- Method: GET
- Route: /api/v1/db/update-nst-goalies
- Local policy: safe
- Reason: fetch failed
- Notes: fetch failed
- Summary: null

### 17. update-yahoo-players
- Schedule slot: 08:40 UTC
- Status: success
- Action: run
- Timer: 01:27 (87057 ms)
- Method: GET
- Route: /api/v1/db/update-yahoo-players?gameId=465
- Local policy: safe
- Reason: —
- Notes: HTTP 200 OK
- Summary: {"kind":"http","statusCode":200,"ok":true,"body":{"success":true,"message":"Processed 1494 players via RPC."}}

### 18. update-nst-current-season
- Schedule slot: 08:45 UTC
- Status: success
- Action: run
- Timer: 13:42 (822260 ms)
- Method: GET
- Route: /api/v1/db/update-nst-current-season
- Local policy: caution
- Reason: —
- Notes: Current-season NST scraper fans out over active-player mappings. | Consumes the direct NST request budget. | Inserted 813s NST safety wait before execution. | HTTP 200 OK
- Summary: {"kind":"http","statusCode":200,"ok":true,"body":{"message":"Data fetching and upsertion initiated."}}

### 19. update-wigo-table-stats
- Schedule slot: 08:50 UTC
- Status: failure
- Action: run
- Timer: 05:00 (300977 ms)
- Method: GET
- Route: /api/v1/db/calculate-wigo-stats
- Local policy: safe
- Reason: fetch failed
- Notes: fetch failed
- Summary: null

### 20. sync-yahoo-players-to-sheet
- Schedule slot: 08:55 UTC
- Status: skipped
- Action: mock_fallback
- Timer: 00:00 (1 ms)
- Method: GET
- Route: /api/internal/sync-yahoo-players-to-sheet?gameId=465
- Local policy: skip
- Reason: Skipped direct side effect and recorded mock-fallback observation only.
- Notes: Writes to Google Sheets and should not be benchmarked blindly in local/dev. | Prefer dry-run or mocked external side effects during audit execution. | Policy action: mock_fallback | Skipped direct side effect and recorded mock-fallback observation only.
- Summary: {"kind":"policy","action":"mock_fallback"}

### 21. update-rolling-player-averages
- Schedule slot: 09:00 UTC
- Status: failure
- Action: run
- Timer: 05:00 (300972 ms)
- Method: POST
- Route: /api/v1/db/update-rolling-player-averages
- Local policy: safe
- Reason: fetch failed
- Notes: Broad rolling rebuild with concurrency knobs and large player scope. | Downstream FORGE and Start Chart freshness depend on this output. | fetch failed
- Summary: null

### 22. daily-refresh-goalie-unified-matview
- Schedule slot: 09:05 UTC
- Status: failure
- Action: run
- Timer: 01:10 (70678 ms)
- Method: SQL
- Route: -- 09:05 UTC 'REFRESH MATERIALIZED VIEW goalie_stats_unified;'
- Local policy: safe
- Reason: <!DOCTYPE html>
<!--[if lt IE 7]> <html class="no-js ie6 oldie" lang="en-US"> <![endif]-->
<!--[if IE 7]>    <html class="no-js ie7 oldie" lang="en-US"> <![endif]-->
<!--[if IE 8]>    <html class="no-js ie8 oldie" lang="en-US"> <![endif]-->
<!--[if gt IE 8]><!--> <html class="no-js" lang="en-US"> <!--<![endif]-->
<head>


<title>fyhftlxokyjtpndbkfse.supabase.co | 520: Web server is returning an unknown error</title>
<meta charset="UTF-8" />
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta http-equiv="X-UA-Compatible" content="IE=Edge" />
<meta name="robots" content="noindex, nofollow" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<link rel="stylesheet" id="cf_styles-css" href="/cdn-cgi/styles/main.css" />


</head>
<body>
<div id="cf-wrapper">
    <div id="cf-error-details" class="p-0">
        <header class="mx-auto pt-10 lg:pt-6 lg:px-8 w-240 lg:w-full mb-8">
            <h1 class="inline-block sm:block sm:mb-2 font-light text-60 lg:text-4xl text-black-dark leading-tight mr-2">
              <span class="inline-block">Web server is returning an unknown error</span>
              <span class="code-label">Error code 520</span>
            </h1>
            <div>
               Visit <a href="https://www.cloudflare.com/5xx-error-landing?utm_source=errorcode_520&utm_campaign=fyhftlxokyjtpndbkfse.supabase.co" target="_blank" rel="noopener noreferrer">cloudflare.com</a> for more information.
            </div>
            <div class="mt-3">2026-03-20 22:28:40 UTC</div>
        </header>
        <div class="my-8 bg-gradient-gray">
            <div class="w-240 lg:w-full mx-auto">
                <div class="clearfix md:px-8">
                  
<div id="cf-browser-status" class=" relative w-1/3 md:w-full py-15 md:p-0 md:py-8 md:text-left md:border-solid md:border-0 md:border-b md:border-gray-400 overflow-hidden float-left md:float-none text-center">
  <div class="relative mb-10 md:m-0">
    
    <span class="cf-icon-browser block md:hidden h-20 bg-center bg-no-repeat"></span>
    <span class="cf-icon-ok w-12 h-12 absolute left-1/2 md:left-auto md:right-0 md:top-0 -ml-6 -bottom-4"></span>
    
  </div>
  <span class="md:block w-full truncate">You</span>
  <h3 class="md:inline-block mt-3 md:mt-0 text-2xl text-gray-600 font-light leading-1.3">
    
    Browser
    
  </h3>
  <span class="leading-1.3 text-2xl text-green-success">Working</span>
</div>

<div id="cf-cloudflare-status" class=" relative w-1/3 md:w-full py-15 md:p-0 md:py-8 md:text-left md:border-solid md:border-0 md:border-b md:border-gray-400 overflow-hidden float-left md:float-none text-center">
  <div class="relative mb-10 md:m-0">
    <a href="https://www.cloudflare.com/5xx-error-landing?utm_source=errorcode_520&utm_campaign=fyhftlxokyjtpndbkfse.supabase.co" target="_blank" rel="noopener noreferrer">
    <span class="cf-icon-cloud block md:hidden h-20 bg-center bg-no-repeat"></span>
    <span class="cf-icon-ok w-12 h-12 absolute left-1/2 md:left-auto md:right-0 md:top-0 -ml-6 -bottom-4"></span>
    </a>
  </div>
  <span class="md:block w-full truncate">Newark</span>
  <h3 class="md:inline-block mt-3 md:mt-0 text-2xl text-gray-600 font-light leading-1.3">
    <a href="https://www.cloudflare.com/5xx-error-landing?utm_source=errorcode_520&utm_campaign=fyhftlxokyjtpndbkfse.supabase.co" target="_blank" rel="noopener noreferrer">
    Cloudflare
    </a>
  </h3>
  <span class="leading-1.3 text-2xl text-green-success">Working</span>
</div>

<div id="cf-host-status" class="cf-error-source relative w-1/3 md:w-full py-15 md:p-0 md:py-8 md:text-left md:border-solid md:border-0 md:border-b md:border-gray-400 overflow-hidden float-left md:float-none text-center">
  <div class="relative mb-10 md:m-0">
    
    <span class="cf-icon-server block md:hidden h-20 bg-center bg-no-repeat"></span>
    <span class="cf-icon-error w-12 h-12 absolute left-1/2 md:left-auto md:right-0 md:top-0 -ml-6 -bottom-4"></span>
    
  </div>
  <span class="md:block w-full truncate">fyhftlxokyjtpndbkfse.supabase.co</span>
  <h3 class="md:inline-block mt-3 md:mt-0 text-2xl text-gray-600 font-light leading-1.3">
    
    Host
    
  </h3>
  <span class="leading-1.3 text-2xl text-red-error">Error</span>
</div>

                </div>
            </div>
        </div>

        <div class="w-240 lg:w-full mx-auto mb-8 lg:px-8">
            <div class="clearfix">
                <div class="w-1/2 md:w-full float-left pr-6 md:pb-10 md:pr-0 leading-relaxed">
                    <h2 class="text-3xl font-normal leading-1.3 mb-4">What happened?</h2>
                    <p>There is an unknown connection issue between Cloudflare and the origin web server. As a result, the web page can not be displayed.</p>
                </div>
                <div class="w-1/2 md:w-full float-left leading-relaxed">
                    <h2 class="text-3xl font-normal leading-1.3 mb-4">What can I do?</h2>
                          <h3 class="text-15 font-semibold mb-2">If you are a visitor of this website:</h3>
      <p class="mb-6">Please try again in a few minutes.</p>

      <h3 class="text-15 font-semibold mb-2">If you are the owner of this website:</h3>
      <p><span>There is an issue between Cloudflare's cache and your origin web server. Cloudflare monitors for these errors and automatically investigates the cause. To help support the investigation, you can pull the corresponding error log from your web server and submit it our support team.  Please include the Ray ID (which is at the bottom of this error page).</span> <a rel="noopener noreferrer" href="https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-5xx-errors/error-520/">Additional troubleshooting resources</a>.</p>
                </div>
            </div>
        </div>

        <div class="cf-error-footer cf-wrapper w-240 lg:w-full py-10 sm:py-4 sm:px-8 mx-auto text-center sm:text-left border-solid border-0 border-t border-gray-300">
  <p class="text-13">
    <span class="cf-footer-item sm:block sm:mb-1">Cloudflare Ray ID: <strong class="font-semibold">9df824fdc71541c0</strong></span>
    <span class="cf-footer-separator sm:hidden">&bull;</span>
    <span id="cf-footer-item-ip" class="cf-footer-item hidden sm:block sm:mb-1">
      Your IP:
      <button type="button" id="cf-footer-ip-reveal" class="cf-footer-ip-reveal-btn">Click to reveal</button>
      <span class="hidden" id="cf-footer-ip">68.81.5.53</span>
      <span class="cf-footer-separator sm:hidden">&bull;</span>
    </span>
    <span class="cf-footer-item sm:block sm:mb-1"><span>Performance &amp; security by</span> <a rel="noopener noreferrer" href="https://www.cloudflare.com/5xx-error-landing?utm_source=errorcode_520&utm_campaign=fyhftlxokyjtpndbkfse.supabase.co" id="brand_link" target="_blank">Cloudflare</a></span>
    
  </p>
  <script>(function(){function d(){var b=a.getElementById("cf-footer-item-ip"),c=a.getElementById("cf-footer-ip-reveal");b&&"classList"in b&&(b.classList.remove("hidden"),c.addEventListener("click",function(){c.classList.add("hidden");a.getElementById("cf-footer-ip").classList.remove("hidden")}))}var a=document;document.addEventListener&&a.addEventListener("DOMContentLoaded",d)})();</script>
</div><!-- /.error-footer -->


    </div>
</div>
</body>
</html>

- Notes: Supabase execute_sql RPC failed. | <!DOCTYPE html>
<!--[if lt IE 7]> <html class="no-js ie6 oldie" lang="en-US"> <![endif]-->
<!--[if IE 7]>    <html class="no-js ie7 oldie" lang="en-US"> <![endif]-->
<!--[if IE 8]>    <html class="no-js ie8 oldie" lang="en-US"> <![endif]-->
<!--[if gt IE 8]><!--> <html class="no-js" lang="en-US"> <!--<![endif]-->
<head>


<title>fyhftlxokyjtpndbkfse.supabase.co | 520: Web server is returning an unknown error</title>
<meta charset="UTF-8" />
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta http-equiv="X-UA-Compatible" content="IE=Edge" />
<meta name="robots" content="noindex, nofollow" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<link rel="stylesheet" id="cf_styles-css" href="/cdn-cgi/styles/main.css" />


</head>
<body>
<div id="cf-wrapper">
    <div id="cf-error-details" class="p-0">
        <header class="mx-auto pt-10 lg:pt-6 lg:px-8 w-240 lg:w-full mb-8">
            <h1 class="inline-block sm:block sm:mb-2 font-light text-60 lg:text-4xl text-black-dark leading-tight mr-2">
              <span class="inline-block">Web server is returning an unknown error</span>
              <span class="code-label">Error code 520</span>
            </h1>
            <div>
               Visit <a href="https://www.cloudflare.com/5xx-error-landing?utm_source=errorcode_520&utm_campaign=fyhftlxokyjtpndbkfse.supabase.co" target="_blank" rel="noopener noreferrer">cloudflare.com</a> for more information.
            </div>
            <div class="mt-3">2026-03-20 22:28:40 UTC</div>
        </header>
        <div class="my-8 bg-gradient-gray">
            <div class="w-240 lg:w-full mx-auto">
                <div class="clearfix md:px-8">
                  
<div id="cf-browser-status" class=" relative w-1/3 md:w-full py-15 md:p-0 md:py-8 md:text-left md:border-solid md:border-0 md:border-b md:border-gray-400 overflow-hidden float-left md:float-none text-center">
  <div class="relative mb-10 md:m-0">
    
    <span class="cf-icon-browser block md:hidden h-20 bg-center bg-no-repeat"></span>
    <span class="cf-icon-ok w-12 h-12 absolute left-1/2 md:left-auto md:right-0 md:top-0 -ml-6 -bottom-4"></span>
    
  </div>
  <span class="md:block w-full truncate">You</span>
  <h3 class="md:inline-block mt-3 md:mt-0 text-2xl text-gray-600 font-light leading-1.3">
    
    Browser
    
  </h3>
  <span class="leading-1.3 text-2xl text-green-success">Working</span>
</div>

<div id="cf-cloudflare-status" class=" relative w-1/3 md:w-full py-15 md:p-0 md:py-8 md:text-left md:border-solid md:border-0 md:border-b md:border-gray-400 overflow-hidden float-left md:float-none text-center">
  <div class="relative mb-10 md:m-0">
    <a href="https://www.cloudflare.com/5xx-error-landing?utm_source=errorcode_520&utm_campaign=fyhftlxokyjtpndbkfse.supabase.co" target="_blank" rel="noopener noreferrer">
    <span class="cf-icon-cloud block md:hidden h-20 bg-center bg-no-repeat"></span>
    <span class="cf-icon-ok w-12 h-12 absolute left-1/2 md:left-auto md:right-0 md:top-0 -ml-6 -bottom-4"></span>
    </a>
  </div>
  <span class="md:block w-full truncate">Newark</span>
  <h3 class="md:inline-block mt-3 md:mt-0 text-2xl text-gray-600 font-light leading-1.3">
    <a href="https://www.cloudflare.com/5xx-error-landing?utm_source=errorcode_520&utm_campaign=fyhftlxokyjtpndbkfse.supabase.co" target="_blank" rel="noopener noreferrer">
    Cloudflare
    </a>
  </h3>
  <span class="leading-1.3 text-2xl text-green-success">Working</span>
</div>

<div id="cf-host-status" class="cf-error-source relative w-1/3 md:w-full py-15 md:p-0 md:py-8 md:text-left md:border-solid md:border-0 md:border-b md:border-gray-400 overflow-hidden float-left md:float-none text-center">
  <div class="relative mb-10 md:m-0">
    
    <span class="cf-icon-server block md:hidden h-20 bg-center bg-no-repeat"></span>
    <span class="cf-icon-error w-12 h-12 absolute left-1/2 md:left-auto md:right-0 md:top-0 -ml-6 -bottom-4"></span>
    
  </div>
  <span class="md:block w-full truncate">fyhftlxokyjtpndbkfse.supabase.co</span>
  <h3 class="md:inline-block mt-3 md:mt-0 text-2xl text-gray-600 font-light leading-1.3">
    
    Host
    
  </h3>
  <span class="leading-1.3 text-2xl text-red-error">Error</span>
</div>

                </div>
            </div>
        </div>

        <div class="w-240 lg:w-full mx-auto mb-8 lg:px-8">
            <div class="clearfix">
                <div class="w-1/2 md:w-full float-left pr-6 md:pb-10 md:pr-0 leading-relaxed">
                    <h2 class="text-3xl font-normal leading-1.3 mb-4">What happened?</h2>
                    <p>There is an unknown connection issue between Cloudflare and the origin web server. As a result, the web page can not be displayed.</p>
                </div>
                <div class="w-1/2 md:w-full float-left leading-relaxed">
                    <h2 class="text-3xl font-normal leading-1.3 mb-4">What can I do?</h2>
                          <h3 class="text-15 font-semibold mb-2">If you are a visitor of this website:</h3>
      <p class="mb-6">Please try again in a few minutes.</p>

      <h3 class="text-15 font-semibold mb-2">If you are the owner of this website:</h3>
      <p><span>There is an issue between Cloudflare's cache and your origin web server. Cloudflare monitors for these errors and automatically investigates the cause. To help support the investigation, you can pull the corresponding error log from your web server and submit it our support team.  Please include the Ray ID (which is at the bottom of this error page).</span> <a rel="noopener noreferrer" href="https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-5xx-errors/error-520/">Additional troubleshooting resources</a>.</p>
                </div>
            </div>
        </div>

        <div class="cf-error-footer cf-wrapper w-240 lg:w-full py-10 sm:py-4 sm:px-8 mx-auto text-center sm:text-left border-solid border-0 border-t border-gray-300">
  <p class="text-13">
    <span class="cf-footer-item sm:block sm:mb-1">Cloudflare Ray ID: <strong class="font-semibold">9df824fdc71541c0</strong></span>
    <span class="cf-footer-separator sm:hidden">&bull;</span>
    <span id="cf-footer-item-ip" class="cf-footer-item hidden sm:block sm:mb-1">
      Your IP:
      <button type="button" id="cf-footer-ip-reveal" class="cf-footer-ip-reveal-btn">Click to reveal</button>
      <span class="hidden" id="cf-footer-ip">68.81.5.53</span>
      <span class="cf-footer-separator sm:hidden">&bull;</span>
    </span>
    <span class="cf-footer-item sm:block sm:mb-1"><span>Performance &amp; security by</span> <a rel="noopener noreferrer" href="https://www.cloudflare.com/5xx-error-landing?utm_source=errorcode_520&utm_campaign=fyhftlxokyjtpndbkfse.supabase.co" id="brand_link" target="_blank">Cloudflare</a></span>
    
  </p>
  <script>(function(){function d(){var b=a.getElementById("cf-footer-item-ip"),c=a.getElementById("cf-footer-ip-reveal");b&&"classList"in b&&(b.classList.remove("hidden"),c.addEventListener("click",function(){c.classList.add("hidden");a.getElementById("cf-footer-ip").classList.remove("hidden")}))}var a=document;document.addEventListener&&a.addEventListener("DOMContentLoaded",d)})();</script>
</div><!-- /.error-footer -->


    </div>
</div>
</body>
</html>

- Summary: null

### 23. update-team-ctpi-daily
- Schedule slot: 09:10 UTC
- Status: success
- Action: run
- Timer: 00:19 (19116 ms)
- Method: GET
- Route: /api/v1/db/update-team-ctpi-daily
- Local policy: safe
- Reason: —
- Notes: HTTP 200 OK
- Summary: {"kind":"http","statusCode":200,"ok":true,"body":{"message":"CTPI daily processed","rowsUpserted":32}}

### 24. update-team-sos
- Schedule slot: 09:12 UTC
- Status: success
- Action: run
- Timer: 00:03 (3222 ms)
- Method: GET
- Route: /api/v1/db/update-team-sos
- Local policy: safe
- Reason: —
- Notes: HTTP 200 OK
- Summary: {"kind":"http","statusCode":200,"ok":true,"body":{"success":true,"message":"SOS updated","rowsUpserted":96,"failedRows":0}}

### 25. update-team-power-ratings
- Schedule slot: 09:15 UTC
- Status: success
- Action: run
- Timer: 00:01 (1946 ms)
- Method: GET
- Route: /api/v1/db/update-team-power-ratings
- Local policy: safe
- Reason: —
- Notes: HTTP 200 OK
- Summary: {"kind":"http","statusCode":200,"ok":true,"body":{"message":"Updated ratings"}}

### 26. update-team-power-ratings-new
- Schedule slot: 09:20 UTC
- Status: success
- Action: run
- Timer: 00:01 (1601 ms)
- Method: GET
- Route: /api/v1/db/update-team-power-ratings-new
- Local policy: safe
- Reason: —
- Notes: HTTP 200 OK
- Summary: {"kind":"http","statusCode":200,"ok":true,"body":{"message":"Updated ratings (new)"}}

### 27. update-goalie-projections-v2
- Schedule slot: 09:30 UTC
- Status: success
- Action: run
- Timer: 00:10 (10363 ms)
- Method: POST
- Route: /api/v1/db/update-goalie-projections-v2
- Local policy: caution
- Reason: —
- Notes: Runtime varies with how far behind goalie_start_projections currently is. | The route resumes from latest existing state rather than a direct target window. | HTTP 200 OK
- Summary: {"kind":"http","statusCode":200,"ok":true,"body":{"success":true,"message":"Updated projections. Total upserted: 349"}}

### 28. update-wgo-teams
- Schedule slot: 09:35 UTC
- Status: success
- Action: run
- Timer: 00:21 (21096 ms)
- Method: GET
- Route: /api/v1/db/run-fetch-wgo-data
- Local policy: safe
- Reason: —
- Notes: HTTP 200 OK
- Summary: {"kind":"http","statusCode":200,"ok":true,"body":{"message":"Data fetch/upsert complete."}}

### 29. update-start-chart-projections
- Schedule slot: 09:40 UTC
- Status: failure
- Action: run
- Timer: 05:01 (301062 ms)
- Method: POST
- Route: /api/v1/db/update-start-chart-projections
- Local policy: safe
- Reason: fetch failed
- Notes: fetch failed
- Summary: null

### 30. ingest-projection-inputs
- Schedule slot: 09:45 UTC
- Status: failure
- Action: run
- Timer: 05:01 (301124 ms)
- Method: POST
- Route: /api/v1/db/ingest-projection-inputs
- Local policy: caution
- Reason: TypeError: fetch failed
- Notes: Recent-game ingest reads multiple upstream tables under a timeout budget. | Chunking and resumability make runtime depend on backlog and data state. | HTTP 500 Internal Server Error | TypeError: fetch failed
- Summary: {"kind":"http","statusCode":500,"ok":false,"body":{"success":false,"error":"TypeError: fetch failed","timing":{"startedAt":"2026-03-20T22:34:38.623Z","endedAt":"2026-03-20T22:39:39.581Z","durationMs":300958,"timer":"05:00"}}}

### 31. build-forge-derived-v2
- Schedule slot: 09:50 UTC
- Status: failure
- Action: run
- Timer: 05:01 (301315 ms)
- Method: POST
- Route: /api/v1/db/build-projection-derived-v2
- Local policy: safe
- Reason: fetch failed
- Notes: UTC (after rolling averages + goalie starts) | Runs multiple derived-table builders in one request under a 4.5-minute budget. | FORGE projection freshness depends directly on this stage completing. | fetch failed
- Summary: null

### 32. update-nst-team-daily
- Schedule slot: 09:55 UTC
- Status: failure
- Action: run
- Timer: 05:01 (301106 ms)
- Method: GET
- Route: /api/v1/db/update-nst-team-daily
- Local policy: safe
- Reason: fetch failed
- Notes: fetch failed
- Summary: null

### 33. daily-refresh-matview
- Schedule slot: 10:00 UTC
- Status: failure
- Action: run
- Timer: 03:00 (180135 ms)
- Method: SQL
- Route: -- 10:00 UTC 'REFRESH MATERIALIZED VIEW yahoo_nhl_player_map_mat;'
- Local policy: safe
- Reason: <!DOCTYPE html>
<!--[if lt IE 7]> <html class="no-js ie6 oldie" lang="en-US"> <![endif]-->
<!--[if IE 7]>    <html class="no-js ie7 oldie" lang="en-US"> <![endif]-->
<!--[if IE 8]>    <html class="no-js ie8 oldie" lang="en-US"> <![endif]-->
<!--[if gt IE 8]><!--> <html class="no-js" lang="en-US"> <!--<![endif]-->
<head>


<title>fyhftlxokyjtpndbkfse.supabase.co | 522: Connection timed out</title>
<meta charset="UTF-8" />
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta http-equiv="X-UA-Compatible" content="IE=Edge" />
<meta name="robots" content="noindex, nofollow" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<link rel="stylesheet" id="cf_styles-css" href="/cdn-cgi/styles/main.css" />


</head>
<body>
<div id="cf-wrapper">
    <div id="cf-error-details" class="p-0">
        <header class="mx-auto pt-10 lg:pt-6 lg:px-8 w-240 lg:w-full mb-8">
            <h1 class="inline-block sm:block sm:mb-2 font-light text-60 lg:text-4xl text-black-dark leading-tight mr-2">
              <span class="inline-block">Connection timed out</span>
              <span class="code-label">Error code 522</span>
            </h1>
            <div>
               Visit <a href="https://www.cloudflare.com/5xx-error-landing?utm_source=errorcode_522&utm_campaign=fyhftlxokyjtpndbkfse.supabase.co" target="_blank" rel="noopener noreferrer">cloudflare.com</a> for more information.
            </div>
            <div class="mt-3">2026-03-20 22:52:42 UTC</div>
        </header>
        <div class="my-8 bg-gradient-gray">
            <div class="w-240 lg:w-full mx-auto">
                <div class="clearfix md:px-8">
                  
<div id="cf-browser-status" class=" relative w-1/3 md:w-full py-15 md:p-0 md:py-8 md:text-left md:border-solid md:border-0 md:border-b md:border-gray-400 overflow-hidden float-left md:float-none text-center">
  <div class="relative mb-10 md:m-0">
    
    <span class="cf-icon-browser block md:hidden h-20 bg-center bg-no-repeat"></span>
    <span class="cf-icon-ok w-12 h-12 absolute left-1/2 md:left-auto md:right-0 md:top-0 -ml-6 -bottom-4"></span>
    
  </div>
  <span class="md:block w-full truncate">You</span>
  <h3 class="md:inline-block mt-3 md:mt-0 text-2xl text-gray-600 font-light leading-1.3">
    
    Browser
    
  </h3>
  <span class="leading-1.3 text-2xl text-green-success">Working</span>
</div>

<div id="cf-cloudflare-status" class=" relative w-1/3 md:w-full py-15 md:p-0 md:py-8 md:text-left md:border-solid md:border-0 md:border-b md:border-gray-400 overflow-hidden float-left md:float-none text-center">
  <div class="relative mb-10 md:m-0">
    <a href="https://www.cloudflare.com/5xx-error-landing?utm_source=errorcode_522&utm_campaign=fyhftlxokyjtpndbkfse.supabase.co" target="_blank" rel="noopener noreferrer">
    <span class="cf-icon-cloud block md:hidden h-20 bg-center bg-no-repeat"></span>
    <span class="cf-icon-ok w-12 h-12 absolute left-1/2 md:left-auto md:right-0 md:top-0 -ml-6 -bottom-4"></span>
    </a>
  </div>
  <span class="md:block w-full truncate">Newark</span>
  <h3 class="md:inline-block mt-3 md:mt-0 text-2xl text-gray-600 font-light leading-1.3">
    <a href="https://www.cloudflare.com/5xx-error-landing?utm_source=errorcode_522&utm_campaign=fyhftlxokyjtpndbkfse.supabase.co" target="_blank" rel="noopener noreferrer">
    Cloudflare
    </a>
  </h3>
  <span class="leading-1.3 text-2xl text-green-success">Working</span>
</div>

<div id="cf-host-status" class="cf-error-source relative w-1/3 md:w-full py-15 md:p-0 md:py-8 md:text-left md:border-solid md:border-0 md:border-b md:border-gray-400 overflow-hidden float-left md:float-none text-center">
  <div class="relative mb-10 md:m-0">
    
    <span class="cf-icon-server block md:hidden h-20 bg-center bg-no-repeat"></span>
    <span class="cf-icon-error w-12 h-12 absolute left-1/2 md:left-auto md:right-0 md:top-0 -ml-6 -bottom-4"></span>
    
  </div>
  <span class="md:block w-full truncate">fyhftlxokyjtpndbkfse.supabase.co</span>
  <h3 class="md:inline-block mt-3 md:mt-0 text-2xl text-gray-600 font-light leading-1.3">
    
    Host
    
  </h3>
  <span class="leading-1.3 text-2xl text-red-error">Error</span>
</div>

                </div>
            </div>
        </div>

        <div class="w-240 lg:w-full mx-auto mb-8 lg:px-8">
            <div class="clearfix">
                <div class="w-1/2 md:w-full float-left pr-6 md:pb-10 md:pr-0 leading-relaxed">
                    <h2 class="text-3xl font-normal leading-1.3 mb-4">What happened?</h2>
                    <p>The initial connection between Cloudflare's network and the origin web server timed out. As a result, the web page can not be displayed.</p>
                </div>
                <div class="w-1/2 md:w-full float-left leading-relaxed">
                    <h2 class="text-3xl font-normal leading-1.3 mb-4">What can I do?</h2>
                          <h3 class="text-15 font-semibold mb-2">If you're a visitor of this website:</h3>
      <p class="mb-6">Please try again in a few minutes.</p>

      <h3 class="text-15 font-semibold mb-2">If you're the owner of this website:</h3>
      <p>Please refer to the <a rel="noopener noreferrer" href="https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-5xx-errors/error-522/">Error 522</a> article:</p>
      <ul class="ml-4">
        <li>Contact your hosting provider; let them know your web server is not completing requests.</li>
        <li>Make sure your origin allows <a rel="noopener noreferrer" href="https://www.cloudflare.com/ips/">all Cloudflare IP ranges</a>.</li>
      </ul>
                </div>
            </div>
        </div>

        <div class="cf-error-footer cf-wrapper w-240 lg:w-full py-10 sm:py-4 sm:px-8 mx-auto text-center sm:text-left border-solid border-0 border-t border-gray-300">
  <p class="text-13">
    <span class="cf-footer-item sm:block sm:mb-1">Cloudflare Ray ID: <strong class="font-semibold">9df84586146e8465</strong></span>
    <span class="cf-footer-separator sm:hidden">&bull;</span>
    <span id="cf-footer-item-ip" class="cf-footer-item hidden sm:block sm:mb-1">
      Your IP:
      <button type="button" id="cf-footer-ip-reveal" class="cf-footer-ip-reveal-btn">Click to reveal</button>
      <span class="hidden" id="cf-footer-ip">68.81.5.53</span>
      <span class="cf-footer-separator sm:hidden">&bull;</span>
    </span>
    <span class="cf-footer-item sm:block sm:mb-1"><span>Performance &amp; security by</span> <a rel="noopener noreferrer" href="https://www.cloudflare.com/5xx-error-landing?utm_source=errorcode_522&utm_campaign=fyhftlxokyjtpndbkfse.supabase.co" id="brand_link" target="_blank">Cloudflare</a></span>
    
  </p>
  <script>(function(){function d(){var b=a.getElementById("cf-footer-item-ip"),c=a.getElementById("cf-footer-ip-reveal");b&&"classList"in b&&(b.classList.remove("hidden"),c.addEventListener("click",function(){c.classList.add("hidden");a.getElementById("cf-footer-ip").classList.remove("hidden")}))}var a=document;document.addEventListener&&a.addEventListener("DOMContentLoaded",d)})();</script>
</div><!-- /.error-footer -->


    </div>
</div>
</body>
</html>

- Notes: Supabase execute_sql RPC failed. | <!DOCTYPE html>
<!--[if lt IE 7]> <html class="no-js ie6 oldie" lang="en-US"> <![endif]-->
<!--[if IE 7]>    <html class="no-js ie7 oldie" lang="en-US"> <![endif]-->
<!--[if IE 8]>    <html class="no-js ie8 oldie" lang="en-US"> <![endif]-->
<!--[if gt IE 8]><!--> <html class="no-js" lang="en-US"> <!--<![endif]-->
<head>


<title>fyhftlxokyjtpndbkfse.supabase.co | 522: Connection timed out</title>
<meta charset="UTF-8" />
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta http-equiv="X-UA-Compatible" content="IE=Edge" />
<meta name="robots" content="noindex, nofollow" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<link rel="stylesheet" id="cf_styles-css" href="/cdn-cgi/styles/main.css" />


</head>
<body>
<div id="cf-wrapper">
    <div id="cf-error-details" class="p-0">
        <header class="mx-auto pt-10 lg:pt-6 lg:px-8 w-240 lg:w-full mb-8">
            <h1 class="inline-block sm:block sm:mb-2 font-light text-60 lg:text-4xl text-black-dark leading-tight mr-2">
              <span class="inline-block">Connection timed out</span>
              <span class="code-label">Error code 522</span>
            </h1>
            <div>
               Visit <a href="https://www.cloudflare.com/5xx-error-landing?utm_source=errorcode_522&utm_campaign=fyhftlxokyjtpndbkfse.supabase.co" target="_blank" rel="noopener noreferrer">cloudflare.com</a> for more information.
            </div>
            <div class="mt-3">2026-03-20 22:52:42 UTC</div>
        </header>
        <div class="my-8 bg-gradient-gray">
            <div class="w-240 lg:w-full mx-auto">
                <div class="clearfix md:px-8">
                  
<div id="cf-browser-status" class=" relative w-1/3 md:w-full py-15 md:p-0 md:py-8 md:text-left md:border-solid md:border-0 md:border-b md:border-gray-400 overflow-hidden float-left md:float-none text-center">
  <div class="relative mb-10 md:m-0">
    
    <span class="cf-icon-browser block md:hidden h-20 bg-center bg-no-repeat"></span>
    <span class="cf-icon-ok w-12 h-12 absolute left-1/2 md:left-auto md:right-0 md:top-0 -ml-6 -bottom-4"></span>
    
  </div>
  <span class="md:block w-full truncate">You</span>
  <h3 class="md:inline-block mt-3 md:mt-0 text-2xl text-gray-600 font-light leading-1.3">
    
    Browser
    
  </h3>
  <span class="leading-1.3 text-2xl text-green-success">Working</span>
</div>

<div id="cf-cloudflare-status" class=" relative w-1/3 md:w-full py-15 md:p-0 md:py-8 md:text-left md:border-solid md:border-0 md:border-b md:border-gray-400 overflow-hidden float-left md:float-none text-center">
  <div class="relative mb-10 md:m-0">
    <a href="https://www.cloudflare.com/5xx-error-landing?utm_source=errorcode_522&utm_campaign=fyhftlxokyjtpndbkfse.supabase.co" target="_blank" rel="noopener noreferrer">
    <span class="cf-icon-cloud block md:hidden h-20 bg-center bg-no-repeat"></span>
    <span class="cf-icon-ok w-12 h-12 absolute left-1/2 md:left-auto md:right-0 md:top-0 -ml-6 -bottom-4"></span>
    </a>
  </div>
  <span class="md:block w-full truncate">Newark</span>
  <h3 class="md:inline-block mt-3 md:mt-0 text-2xl text-gray-600 font-light leading-1.3">
    <a href="https://www.cloudflare.com/5xx-error-landing?utm_source=errorcode_522&utm_campaign=fyhftlxokyjtpndbkfse.supabase.co" target="_blank" rel="noopener noreferrer">
    Cloudflare
    </a>
  </h3>
  <span class="leading-1.3 text-2xl text-green-success">Working</span>
</div>

<div id="cf-host-status" class="cf-error-source relative w-1/3 md:w-full py-15 md:p-0 md:py-8 md:text-left md:border-solid md:border-0 md:border-b md:border-gray-400 overflow-hidden float-left md:float-none text-center">
  <div class="relative mb-10 md:m-0">
    
    <span class="cf-icon-server block md:hidden h-20 bg-center bg-no-repeat"></span>
    <span class="cf-icon-error w-12 h-12 absolute left-1/2 md:left-auto md:right-0 md:top-0 -ml-6 -bottom-4"></span>
    
  </div>
  <span class="md:block w-full truncate">fyhftlxokyjtpndbkfse.supabase.co</span>
  <h3 class="md:inline-block mt-3 md:mt-0 text-2xl text-gray-600 font-light leading-1.3">
    
    Host
    
  </h3>
  <span class="leading-1.3 text-2xl text-red-error">Error</span>
</div>

                </div>
            </div>
        </div>

        <div class="w-240 lg:w-full mx-auto mb-8 lg:px-8">
            <div class="clearfix">
                <div class="w-1/2 md:w-full float-left pr-6 md:pb-10 md:pr-0 leading-relaxed">
                    <h2 class="text-3xl font-normal leading-1.3 mb-4">What happened?</h2>
                    <p>The initial connection between Cloudflare's network and the origin web server timed out. As a result, the web page can not be displayed.</p>
                </div>
                <div class="w-1/2 md:w-full float-left leading-relaxed">
                    <h2 class="text-3xl font-normal leading-1.3 mb-4">What can I do?</h2>
                          <h3 class="text-15 font-semibold mb-2">If you're a visitor of this website:</h3>
      <p class="mb-6">Please try again in a few minutes.</p>

      <h3 class="text-15 font-semibold mb-2">If you're the owner of this website:</h3>
      <p>Please refer to the <a rel="noopener noreferrer" href="https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-5xx-errors/error-522/">Error 522</a> article:</p>
      <ul class="ml-4">
        <li>Contact your hosting provider; let them know your web server is not completing requests.</li>
        <li>Make sure your origin allows <a rel="noopener noreferrer" href="https://www.cloudflare.com/ips/">all Cloudflare IP ranges</a>.</li>
      </ul>
                </div>
            </div>
        </div>

        <div class="cf-error-footer cf-wrapper w-240 lg:w-full py-10 sm:py-4 sm:px-8 mx-auto text-center sm:text-left border-solid border-0 border-t border-gray-300">
  <p class="text-13">
    <span class="cf-footer-item sm:block sm:mb-1">Cloudflare Ray ID: <strong class="font-semibold">9df84586146e8465</strong></span>
    <span class="cf-footer-separator sm:hidden">&bull;</span>
    <span id="cf-footer-item-ip" class="cf-footer-item hidden sm:block sm:mb-1">
      Your IP:
      <button type="button" id="cf-footer-ip-reveal" class="cf-footer-ip-reveal-btn">Click to reveal</button>
      <span class="hidden" id="cf-footer-ip">68.81.5.53</span>
      <span class="cf-footer-separator sm:hidden">&bull;</span>
    </span>
    <span class="cf-footer-item sm:block sm:mb-1"><span>Performance &amp; security by</span> <a rel="noopener noreferrer" href="https://www.cloudflare.com/5xx-error-landing?utm_source=errorcode_522&utm_campaign=fyhftlxokyjtpndbkfse.supabase.co" id="brand_link" target="_blank">Cloudflare</a></span>
    
  </p>
  <script>(function(){function d(){var b=a.getElementById("cf-footer-item-ip"),c=a.getElementById("cf-footer-ip-reveal");b&&"classList"in b&&(b.classList.remove("hidden"),c.addEventListener("click",function(){c.classList.add("hidden");a.getElementById("cf-footer-ip").classList.remove("hidden")}))}var a=document;document.addEventListener&&a.addEventListener("DOMContentLoaded",d)})();</script>
</div><!-- /.error-footer -->


    </div>
</div>
</body>
</html>

- Summary: null

### 34. run-forge-projection-v2
- Schedule slot: 10:05 UTC
- Status: failure
- Action: run
- Timer: 03:00 (180426 ms)
- Method: POST
- Route: /api/v1/db/run-projection-v2
- Local policy: safe
- Reason: <!DOCTYPE html>
<!--[if lt IE 7]> <html class="no-js ie6 oldie" lang="en-US"> <![endif]-->
<!--[if IE 7]>    <html class="no-js ie7 oldie" lang="en-US"> <![endif]-->
<!--[if IE 8]>    <html class="no-js ie8 oldie" lang="en-US"> <![endif]--…
- Notes: UTC (after derived tables are built) | Projection run is preflight-gated and likely to overrun when upstream data lags. | This is the core downstream FORGE job for dashboard freshness. | HTTP 500 Internal Server Error | <!DOCTYPE html>
<!--[if lt IE 7]> <html class="no-js ie6 oldie" lang="en-US"> <![endif]-->
<!--[if IE 7]>    <html class="no-js ie7 oldie" lang="en-US"> <![endif]-->
<!--[if IE 8]>    <html class="no-js ie8 oldie" lang="en-US"> <![endif]--…
- Summary: {"kind":"http","statusCode":500,"ok":false,"body":{"success":false,"error":"<!DOCTYPE html>\n<!--[if lt IE 7]> <html class=\"no-js ie6 oldie\" lang=\"en-US\"> <![endif]-->\n<!--[if IE 7]>    <html class=\"no-js ie7 oldie\" lang=\"en-US\"> <![endif]-->\n<!--[if IE 8]>    <html class=\"no-js ie8 oldie\" lang=\"en-US\"> <![endif]-->\n<!--[if gt IE 8]><!--> <html class=\"no-js\" lang=\"en-US\"> <!--<…

### 35. refresh-team-power-ratings-daily
- Schedule slot: 10:15 UTC
- Status: failure
- Action: run
- Timer: 03:00 (180200 ms)
- Method: SQL
- Route: -- 10:15 UTC $$ WITH s AS ( SELECT * FROM public.seasons ORDER BY id DESC LIMIT 1 ) SELECT public.refresh_team_power_ratings( (SELECT startDate FROM s), LEAST( (now() AT TIME ZONE…
- Local policy: safe
- Reason: <!DOCTYPE html>
<!--[if lt IE 7]> <html class="no-js ie6 oldie" lang="en-US"> <![endif]-->
<!--[if IE 7]>    <html class="no-js ie7 oldie" lang="en-US"> <![endif]-->
<!--[if IE 8]>    <html class="no-js ie8 oldie" lang="en-US"> <![endif]-->
<!--[if gt IE 8]><!--> <html class="no-js" lang="en-US"> <!--<![endif]-->
<head>


<title>fyhftlxokyjtpndbkfse.supabase.co | 522: Connection timed out</title>
<meta charset="UTF-8" />
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta http-equiv="X-UA-Compatible" content="IE=Edge" />
<meta name="robots" content="noindex, nofollow" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<link rel="stylesheet" id="cf_styles-css" href="/cdn-cgi/styles/main.css" />


</head>
<body>
<div id="cf-wrapper">
    <div id="cf-error-details" class="p-0">
        <header class="mx-auto pt-10 lg:pt-6 lg:px-8 w-240 lg:w-full mb-8">
            <h1 class="inline-block sm:block sm:mb-2 font-light text-60 lg:text-4xl text-black-dark leading-tight mr-2">
              <span class="inline-block">Connection timed out</span>
              <span class="code-label">Error code 522</span>
            </h1>
            <div>
               Visit <a href="https://www.cloudflare.com/5xx-error-landing?utm_source=errorcode_522&utm_campaign=fyhftlxokyjtpndbkfse.supabase.co" target="_blank" rel="noopener noreferrer">cloudflare.com</a> for more information.
            </div>
            <div class="mt-3">2026-03-20 22:58:42 UTC</div>
        </header>
        <div class="my-8 bg-gradient-gray">
            <div class="w-240 lg:w-full mx-auto">
                <div class="clearfix md:px-8">
                  
<div id="cf-browser-status" class=" relative w-1/3 md:w-full py-15 md:p-0 md:py-8 md:text-left md:border-solid md:border-0 md:border-b md:border-gray-400 overflow-hidden float-left md:float-none text-center">
  <div class="relative mb-10 md:m-0">
    
    <span class="cf-icon-browser block md:hidden h-20 bg-center bg-no-repeat"></span>
    <span class="cf-icon-ok w-12 h-12 absolute left-1/2 md:left-auto md:right-0 md:top-0 -ml-6 -bottom-4"></span>
    
  </div>
  <span class="md:block w-full truncate">You</span>
  <h3 class="md:inline-block mt-3 md:mt-0 text-2xl text-gray-600 font-light leading-1.3">
    
    Browser
    
  </h3>
  <span class="leading-1.3 text-2xl text-green-success">Working</span>
</div>

<div id="cf-cloudflare-status" class=" relative w-1/3 md:w-full py-15 md:p-0 md:py-8 md:text-left md:border-solid md:border-0 md:border-b md:border-gray-400 overflow-hidden float-left md:float-none text-center">
  <div class="relative mb-10 md:m-0">
    <a href="https://www.cloudflare.com/5xx-error-landing?utm_source=errorcode_522&utm_campaign=fyhftlxokyjtpndbkfse.supabase.co" target="_blank" rel="noopener noreferrer">
    <span class="cf-icon-cloud block md:hidden h-20 bg-center bg-no-repeat"></span>
    <span class="cf-icon-ok w-12 h-12 absolute left-1/2 md:left-auto md:right-0 md:top-0 -ml-6 -bottom-4"></span>
    </a>
  </div>
  <span class="md:block w-full truncate">Newark</span>
  <h3 class="md:inline-block mt-3 md:mt-0 text-2xl text-gray-600 font-light leading-1.3">
    <a href="https://www.cloudflare.com/5xx-error-landing?utm_source=errorcode_522&utm_campaign=fyhftlxokyjtpndbkfse.supabase.co" target="_blank" rel="noopener noreferrer">
    Cloudflare
    </a>
  </h3>
  <span class="leading-1.3 text-2xl text-green-success">Working</span>
</div>

<div id="cf-host-status" class="cf-error-source relative w-1/3 md:w-full py-15 md:p-0 md:py-8 md:text-left md:border-solid md:border-0 md:border-b md:border-gray-400 overflow-hidden float-left md:float-none text-center">
  <div class="relative mb-10 md:m-0">
    
    <span class="cf-icon-server block md:hidden h-20 bg-center bg-no-repeat"></span>
    <span class="cf-icon-error w-12 h-12 absolute left-1/2 md:left-auto md:right-0 md:top-0 -ml-6 -bottom-4"></span>
    
  </div>
  <span class="md:block w-full truncate">fyhftlxokyjtpndbkfse.supabase.co</span>
  <h3 class="md:inline-block mt-3 md:mt-0 text-2xl text-gray-600 font-light leading-1.3">
    
    Host
    
  </h3>
  <span class="leading-1.3 text-2xl text-red-error">Error</span>
</div>

                </div>
            </div>
        </div>

        <div class="w-240 lg:w-full mx-auto mb-8 lg:px-8">
            <div class="clearfix">
                <div class="w-1/2 md:w-full float-left pr-6 md:pb-10 md:pr-0 leading-relaxed">
                    <h2 class="text-3xl font-normal leading-1.3 mb-4">What happened?</h2>
                    <p>The initial connection between Cloudflare's network and the origin web server timed out. As a result, the web page can not be displayed.</p>
                </div>
                <div class="w-1/2 md:w-full float-left leading-relaxed">
                    <h2 class="text-3xl font-normal leading-1.3 mb-4">What can I do?</h2>
                          <h3 class="text-15 font-semibold mb-2">If you're a visitor of this website:</h3>
      <p class="mb-6">Please try again in a few minutes.</p>

      <h3 class="text-15 font-semibold mb-2">If you're the owner of this website:</h3>
      <p>Please refer to the <a rel="noopener noreferrer" href="https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-5xx-errors/error-522/">Error 522</a> article:</p>
      <ul class="ml-4">
        <li>Contact your hosting provider; let them know your web server is not completing requests.</li>
        <li>Make sure your origin allows <a rel="noopener noreferrer" href="https://www.cloudflare.com/ips/">all Cloudflare IP ranges</a>.</li>
      </ul>
                </div>
            </div>
        </div>

        <div class="cf-error-footer cf-wrapper w-240 lg:w-full py-10 sm:py-4 sm:px-8 mx-auto text-center sm:text-left border-solid border-0 border-t border-gray-300">
  <p class="text-13">
    <span class="cf-footer-item sm:block sm:mb-1">Cloudflare Ray ID: <strong class="font-semibold">9df84e5407525930</strong></span>
    <span class="cf-footer-separator sm:hidden">&bull;</span>
    <span id="cf-footer-item-ip" class="cf-footer-item hidden sm:block sm:mb-1">
      Your IP:
      <button type="button" id="cf-footer-ip-reveal" class="cf-footer-ip-reveal-btn">Click to reveal</button>
      <span class="hidden" id="cf-footer-ip">68.81.5.53</span>
      <span class="cf-footer-separator sm:hidden">&bull;</span>
    </span>
    <span class="cf-footer-item sm:block sm:mb-1"><span>Performance &amp; security by</span> <a rel="noopener noreferrer" href="https://www.cloudflare.com/5xx-error-landing?utm_source=errorcode_522&utm_campaign=fyhftlxokyjtpndbkfse.supabase.co" id="brand_link" target="_blank">Cloudflare</a></span>
    
  </p>
  <script>(function(){function d(){var b=a.getElementById("cf-footer-item-ip"),c=a.getElementById("cf-footer-ip-reveal");b&&"classList"in b&&(b.classList.remove("hidden"),c.addEventListener("click",function(){c.classList.add("hidden");a.getElementById("cf-footer-ip").classList.remove("hidden")}))}var a=document;document.addEventListener&&a.addEventListener("DOMContentLoaded",d)})();</script>
</div><!-- /.error-footer -->


    </div>
</div>
</body>
</html>

- Notes: Supabase execute_sql RPC failed. | <!DOCTYPE html>
<!--[if lt IE 7]> <html class="no-js ie6 oldie" lang="en-US"> <![endif]-->
<!--[if IE 7]>    <html class="no-js ie7 oldie" lang="en-US"> <![endif]-->
<!--[if IE 8]>    <html class="no-js ie8 oldie" lang="en-US"> <![endif]-->
<!--[if gt IE 8]><!--> <html class="no-js" lang="en-US"> <!--<![endif]-->
<head>


<title>fyhftlxokyjtpndbkfse.supabase.co | 522: Connection timed out</title>
<meta charset="UTF-8" />
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta http-equiv="X-UA-Compatible" content="IE=Edge" />
<meta name="robots" content="noindex, nofollow" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<link rel="stylesheet" id="cf_styles-css" href="/cdn-cgi/styles/main.css" />


</head>
<body>
<div id="cf-wrapper">
    <div id="cf-error-details" class="p-0">
        <header class="mx-auto pt-10 lg:pt-6 lg:px-8 w-240 lg:w-full mb-8">
            <h1 class="inline-block sm:block sm:mb-2 font-light text-60 lg:text-4xl text-black-dark leading-tight mr-2">
              <span class="inline-block">Connection timed out</span>
              <span class="code-label">Error code 522</span>
            </h1>
            <div>
               Visit <a href="https://www.cloudflare.com/5xx-error-landing?utm_source=errorcode_522&utm_campaign=fyhftlxokyjtpndbkfse.supabase.co" target="_blank" rel="noopener noreferrer">cloudflare.com</a> for more information.
            </div>
            <div class="mt-3">2026-03-20 22:58:42 UTC</div>
        </header>
        <div class="my-8 bg-gradient-gray">
            <div class="w-240 lg:w-full mx-auto">
                <div class="clearfix md:px-8">
                  
<div id="cf-browser-status" class=" relative w-1/3 md:w-full py-15 md:p-0 md:py-8 md:text-left md:border-solid md:border-0 md:border-b md:border-gray-400 overflow-hidden float-left md:float-none text-center">
  <div class="relative mb-10 md:m-0">
    
    <span class="cf-icon-browser block md:hidden h-20 bg-center bg-no-repeat"></span>
    <span class="cf-icon-ok w-12 h-12 absolute left-1/2 md:left-auto md:right-0 md:top-0 -ml-6 -bottom-4"></span>
    
  </div>
  <span class="md:block w-full truncate">You</span>
  <h3 class="md:inline-block mt-3 md:mt-0 text-2xl text-gray-600 font-light leading-1.3">
    
    Browser
    
  </h3>
  <span class="leading-1.3 text-2xl text-green-success">Working</span>
</div>

<div id="cf-cloudflare-status" class=" relative w-1/3 md:w-full py-15 md:p-0 md:py-8 md:text-left md:border-solid md:border-0 md:border-b md:border-gray-400 overflow-hidden float-left md:float-none text-center">
  <div class="relative mb-10 md:m-0">
    <a href="https://www.cloudflare.com/5xx-error-landing?utm_source=errorcode_522&utm_campaign=fyhftlxokyjtpndbkfse.supabase.co" target="_blank" rel="noopener noreferrer">
    <span class="cf-icon-cloud block md:hidden h-20 bg-center bg-no-repeat"></span>
    <span class="cf-icon-ok w-12 h-12 absolute left-1/2 md:left-auto md:right-0 md:top-0 -ml-6 -bottom-4"></span>
    </a>
  </div>
  <span class="md:block w-full truncate">Newark</span>
  <h3 class="md:inline-block mt-3 md:mt-0 text-2xl text-gray-600 font-light leading-1.3">
    <a href="https://www.cloudflare.com/5xx-error-landing?utm_source=errorcode_522&utm_campaign=fyhftlxokyjtpndbkfse.supabase.co" target="_blank" rel="noopener noreferrer">
    Cloudflare
    </a>
  </h3>
  <span class="leading-1.3 text-2xl text-green-success">Working</span>
</div>

<div id="cf-host-status" class="cf-error-source relative w-1/3 md:w-full py-15 md:p-0 md:py-8 md:text-left md:border-solid md:border-0 md:border-b md:border-gray-400 overflow-hidden float-left md:float-none text-center">
  <div class="relative mb-10 md:m-0">
    
    <span class="cf-icon-server block md:hidden h-20 bg-center bg-no-repeat"></span>
    <span class="cf-icon-error w-12 h-12 absolute left-1/2 md:left-auto md:right-0 md:top-0 -ml-6 -bottom-4"></span>
    
  </div>
  <span class="md:block w-full truncate">fyhftlxokyjtpndbkfse.supabase.co</span>
  <h3 class="md:inline-block mt-3 md:mt-0 text-2xl text-gray-600 font-light leading-1.3">
    
    Host
    
  </h3>
  <span class="leading-1.3 text-2xl text-red-error">Error</span>
</div>

                </div>
            </div>
        </div>

        <div class="w-240 lg:w-full mx-auto mb-8 lg:px-8">
            <div class="clearfix">
                <div class="w-1/2 md:w-full float-left pr-6 md:pb-10 md:pr-0 leading-relaxed">
                    <h2 class="text-3xl font-normal leading-1.3 mb-4">What happened?</h2>
                    <p>The initial connection between Cloudflare's network and the origin web server timed out. As a result, the web page can not be displayed.</p>
                </div>
                <div class="w-1/2 md:w-full float-left leading-relaxed">
                    <h2 class="text-3xl font-normal leading-1.3 mb-4">What can I do?</h2>
                          <h3 class="text-15 font-semibold mb-2">If you're a visitor of this website:</h3>
      <p class="mb-6">Please try again in a few minutes.</p>

      <h3 class="text-15 font-semibold mb-2">If you're the owner of this website:</h3>
      <p>Please refer to the <a rel="noopener noreferrer" href="https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-5xx-errors/error-522/">Error 522</a> article:</p>
      <ul class="ml-4">
        <li>Contact your hosting provider; let them know your web server is not completing requests.</li>
        <li>Make sure your origin allows <a rel="noopener noreferrer" href="https://www.cloudflare.com/ips/">all Cloudflare IP ranges</a>.</li>
      </ul>
                </div>
            </div>
        </div>

        <div class="cf-error-footer cf-wrapper w-240 lg:w-full py-10 sm:py-4 sm:px-8 mx-auto text-center sm:text-left border-solid border-0 border-t border-gray-300">
  <p class="text-13">
    <span class="cf-footer-item sm:block sm:mb-1">Cloudflare Ray ID: <strong class="font-semibold">9df84e5407525930</strong></span>
    <span class="cf-footer-separator sm:hidden">&bull;</span>
    <span id="cf-footer-item-ip" class="cf-footer-item hidden sm:block sm:mb-1">
      Your IP:
      <button type="button" id="cf-footer-ip-reveal" class="cf-footer-ip-reveal-btn">Click to reveal</button>
      <span class="hidden" id="cf-footer-ip">68.81.5.53</span>
      <span class="cf-footer-separator sm:hidden">&bull;</span>
    </span>
    <span class="cf-footer-item sm:block sm:mb-1"><span>Performance &amp; security by</span> <a rel="noopener noreferrer" href="https://www.cloudflare.com/5xx-error-landing?utm_source=errorcode_522&utm_campaign=fyhftlxokyjtpndbkfse.supabase.co" id="brand_link" target="_blank">Cloudflare</a></span>
    
  </p>
  <script>(function(){function d(){var b=a.getElementById("cf-footer-item-ip"),c=a.getElementById("cf-footer-ip-reveal");b&&"classList"in b&&(b.classList.remove("hidden"),c.addEventListener("click",function(){c.classList.add("hidden");a.getElementById("cf-footer-ip").classList.remove("hidden")}))}var a=document;document.addEventListener&&a.addEventListener("DOMContentLoaded",d)})();</script>
</div><!-- /.error-footer -->


    </div>
</div>
</body>
</html>

- Summary: null

### 36. update-season-stats-current-season
- Schedule slot: 10:20 UTC
- Status: failure
- Action: run
- Timer: 02:50 (170044 ms)
- Method: GET
- Route: /api/v1/db/update-season-stats
- Local policy: safe
- Reason: An unexpected error occurred: Failed to determine latest processed game for goaliesGameStats in season 20252026: <!DOCTYPE html>
<!--[if lt IE 7]> <html class="no-js ie6 oldie" lang="en-US"> <![endif]-->
<!--[if IE 7]>    <html class="no-j…
- Notes: HTTP 500 Internal Server Error | An unexpected error occurred: Failed to determine latest processed game for goaliesGameStats in season 20252026: <!DOCTYPE html>
<!--[if lt IE 7]> <html class="no-js ie6 oldie" lang="en-US"> <![endif]-->
<!--[if IE 7]>    <html class="no-j…
- Summary: {"kind":"http","statusCode":500,"ok":false,"body":{"success":false,"message":"An unexpected error occurred: Failed to determine latest processed game for goaliesGameStats in season 20252026: <!DOCTYPE html>\n<!--[if lt IE 7]> <html class=\"no-js ie6 oldie\" lang=\"en-US\"> <![endif]-->\n<!--[if IE 7]>    <html class=\"no-js ie7 oldie\" lang=\"en-US\"> <![endif]-->\n<!--[if IE 8]>    <html class=\…

### 37. update-rolling-games-recent
- Schedule slot: 10:25 UTC
- Status: failure
- Action: run
- Timer: 00:00 (167 ms)
- Method: GET
- Route: /api/v1/db/update-rolling-games?date=recent
- Local policy: safe
- Reason: Error: require is not a function
- Notes: HTTP 500 Internal Server Error | Error: require is not a function
- Summary: {"kind":"http","statusCode":500,"ok":false,"body":{"message":"Error: require is not a function"}}

### 38. update-sko-stats-full-season
- Schedule slot: 10:30 UTC
- Status: failure
- Action: run
- Timer: 01:18 (78700 ms)
- Method: GET
- Route: /api/v1/db/update-sko-stats
- Local policy: safe
- Reason: Failed to process request. Reason: Failed to determine latest sko_skater_stats date for season 20252026: <!DOCTYPE html>
<!--[if lt IE 7]> <html class="no-js ie6 oldie" lang="en-US"> <![endif]-->
<!--[if IE 7]>    <html class="no-js ie7 ol…
- Notes: HTTP 400 Bad Request | Failed to process request. Reason: Failed to determine latest sko_skater_stats date for season 20252026: <!DOCTYPE html>
<!--[if lt IE 7]> <html class="no-js ie6 oldie" lang="en-US"> <![endif]-->
<!--[if IE 7]>    <html class="no-js ie7 ol…
- Summary: {"kind":"http","statusCode":400,"ok":false,"body":{"success":false,"message":"Failed to process request. Reason: Failed to determine latest sko_skater_stats date for season 20252026: <!DOCTYPE html>\n<!--[if lt IE 7]> <html class=\"no-js ie6 oldie\" lang=\"en-US\"> <![endif]-->\n<!--[if IE 7]>    <html class=\"no-js ie7 oldie\" lang=\"en-US\"> <![endif]-->\n<!--[if IE 8]>    <html class=\"no-js i…

### 39. update-wgo-averages
- Schedule slot: 10:35 UTC
- Status: failure
- Action: run
- Timer: 00:38 (38950 ms)
- Method: GET
- Route: /api/v1/db/update-wgo-averages
- Local policy: safe
- Reason: Failed to fetch data from nst_seasonal_on_ice_counts: <!DOCTYPE html>
<!--[if lt IE 7]> <html class="no-js ie6 oldie" lang="en-US"> <![endif]-->
<!--[if IE 7]>    <html class="no-js ie7 oldie" lang="en-US"> <![endif]-->
<!--[if IE 8]>    <…
- Notes: HTTP 500 Internal Server Error | Failed to fetch data from nst_seasonal_on_ice_counts: <!DOCTYPE html>
<!--[if lt IE 7]> <html class="no-js ie6 oldie" lang="en-US"> <![endif]-->
<!--[if IE 7]>    <html class="no-js ie7 oldie" lang="en-US"> <![endif]-->
<!--[if IE 8]>    <…
- Summary: {"kind":"http","statusCode":500,"ok":false,"body":{"success":false,"message":"Failed to fetch data from nst_seasonal_on_ice_counts: <!DOCTYPE html>\n<!--[if lt IE 7]> <html class=\"no-js ie6 oldie\" lang=\"en-US\"> <![endif]-->\n<!--[if IE 7]>    <html class=\"no-js ie7 oldie\" lang=\"en-US\"> <![endif]-->\n<!--[if IE 8]>    <html class=\"no-js ie8 oldie\" lang=\"en-US\"> <![endif]-->\n<!--[if gt…

### 40. rebuild-sustainability-baselines
- Schedule slot: 10:40 UTC
- Status: failure
- Action: run
- Timer: 00:38 (38871 ms)
- Method: GET
- Route: /api/v1/db/sustainability/rebuild-baselines
- Local policy: safe
- Reason: Supabase query error on table=player_stats_unified select=player_id, player_name, position_code range=0-999: <!DOCTYPE html>
<!--[if lt IE 7]> <html class="no-js ie6 oldie" lang="en-US"> <![endif]-->
<!--[if IE 7]>    <html class="no-js ie…
- Notes: HTTP 500 Internal Server Error | Supabase query error on table=player_stats_unified select=player_id, player_name, position_code range=0-999: <!DOCTYPE html>
<!--[if lt IE 7]> <html class="no-js ie6 oldie" lang="en-US"> <![endif]-->
<!--[if IE 7]>    <html class="no-js ie…
- Summary: {"kind":"http","statusCode":500,"ok":false,"body":{"success":false,"message":"Supabase query error on table=player_stats_unified select=player_id, player_name, position_code range=0-999: <!DOCTYPE html>\n<!--[if lt IE 7]> <html class=\"no-js ie6 oldie\" lang=\"en-US\"> <![endif]-->\n<!--[if IE 7]>    <html class=\"no-js ie7 oldie\" lang=\"en-US\"> <![endif]-->\n<!--[if IE 8]>    <html class=\"no-…

### 41. daily-refresh-player-totals-unified-matview
- Schedule slot: 10:41 UTC
- Status: failure
- Action: run
- Timer: 00:39 (39140 ms)
- Method: SQL
- Route: -- 10:41 UTC 'REFRESH MATERIALIZED VIEW player_totals_unified;'
- Local policy: safe
- Reason: <!DOCTYPE html>
<!--[if lt IE 7]> <html class="no-js ie6 oldie" lang="en-US"> <![endif]-->
<!--[if IE 7]>    <html class="no-js ie7 oldie" lang="en-US"> <![endif]-->
<!--[if IE 8]>    <html class="no-js ie8 oldie" lang="en-US"> <![endif]-->
<!--[if gt IE 8]><!--> <html class="no-js" lang="en-US"> <!--<![endif]-->
<head>


<title>fyhftlxokyjtpndbkfse.supabase.co | 522: Connection timed out</title>
<meta charset="UTF-8" />
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta http-equiv="X-UA-Compatible" content="IE=Edge" />
<meta name="robots" content="noindex, nofollow" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<link rel="stylesheet" id="cf_styles-css" href="/cdn-cgi/styles/main.css" />


</head>
<body>
<div id="cf-wrapper">
    <div id="cf-error-details" class="p-0">
        <header class="mx-auto pt-10 lg:pt-6 lg:px-8 w-240 lg:w-full mb-8">
            <h1 class="inline-block sm:block sm:mb-2 font-light text-60 lg:text-4xl text-black-dark leading-tight mr-2">
              <span class="inline-block">Connection timed out</span>
              <span class="code-label">Error code 522</span>
            </h1>
            <div>
               Visit <a href="https://www.cloudflare.com/5xx-error-landing?utm_source=errorcode_522&utm_campaign=fyhftlxokyjtpndbkfse.supabase.co" target="_blank" rel="noopener noreferrer">cloudflare.com</a> for more information.
            </div>
            <div class="mt-3">2026-03-20 23:04:48 UTC</div>
        </header>
        <div class="my-8 bg-gradient-gray">
            <div class="w-240 lg:w-full mx-auto">
                <div class="clearfix md:px-8">
                  
<div id="cf-browser-status" class=" relative w-1/3 md:w-full py-15 md:p-0 md:py-8 md:text-left md:border-solid md:border-0 md:border-b md:border-gray-400 overflow-hidden float-left md:float-none text-center">
  <div class="relative mb-10 md:m-0">
    
    <span class="cf-icon-browser block md:hidden h-20 bg-center bg-no-repeat"></span>
    <span class="cf-icon-ok w-12 h-12 absolute left-1/2 md:left-auto md:right-0 md:top-0 -ml-6 -bottom-4"></span>
    
  </div>
  <span class="md:block w-full truncate">You</span>
  <h3 class="md:inline-block mt-3 md:mt-0 text-2xl text-gray-600 font-light leading-1.3">
    
    Browser
    
  </h3>
  <span class="leading-1.3 text-2xl text-green-success">Working</span>
</div>

<div id="cf-cloudflare-status" class=" relative w-1/3 md:w-full py-15 md:p-0 md:py-8 md:text-left md:border-solid md:border-0 md:border-b md:border-gray-400 overflow-hidden float-left md:float-none text-center">
  <div class="relative mb-10 md:m-0">
    <a href="https://www.cloudflare.com/5xx-error-landing?utm_source=errorcode_522&utm_campaign=fyhftlxokyjtpndbkfse.supabase.co" target="_blank" rel="noopener noreferrer">
    <span class="cf-icon-cloud block md:hidden h-20 bg-center bg-no-repeat"></span>
    <span class="cf-icon-ok w-12 h-12 absolute left-1/2 md:left-auto md:right-0 md:top-0 -ml-6 -bottom-4"></span>
    </a>
  </div>
  <span class="md:block w-full truncate">Newark</span>
  <h3 class="md:inline-block mt-3 md:mt-0 text-2xl text-gray-600 font-light leading-1.3">
    <a href="https://www.cloudflare.com/5xx-error-landing?utm_source=errorcode_522&utm_campaign=fyhftlxokyjtpndbkfse.supabase.co" target="_blank" rel="noopener noreferrer">
    Cloudflare
    </a>
  </h3>
  <span class="leading-1.3 text-2xl text-green-success">Working</span>
</div>

<div id="cf-host-status" class="cf-error-source relative w-1/3 md:w-full py-15 md:p-0 md:py-8 md:text-left md:border-solid md:border-0 md:border-b md:border-gray-400 overflow-hidden float-left md:float-none text-center">
  <div class="relative mb-10 md:m-0">
    
    <span class="cf-icon-server block md:hidden h-20 bg-center bg-no-repeat"></span>
    <span class="cf-icon-error w-12 h-12 absolute left-1/2 md:left-auto md:right-0 md:top-0 -ml-6 -bottom-4"></span>
    
  </div>
  <span class="md:block w-full truncate">fyhftlxokyjtpndbkfse.supabase.co</span>
  <h3 class="md:inline-block mt-3 md:mt-0 text-2xl text-gray-600 font-light leading-1.3">
    
    Host
    
  </h3>
  <span class="leading-1.3 text-2xl text-red-error">Error</span>
</div>

                </div>
            </div>
        </div>

        <div class="w-240 lg:w-full mx-auto mb-8 lg:px-8">
            <div class="clearfix">
                <div class="w-1/2 md:w-full float-left pr-6 md:pb-10 md:pr-0 leading-relaxed">
                    <h2 class="text-3xl font-normal leading-1.3 mb-4">What happened?</h2>
                    <p>The initial connection between Cloudflare's network and the origin web server timed out. As a result, the web page can not be displayed.</p>
                </div>
                <div class="w-1/2 md:w-full float-left leading-relaxed">
                    <h2 class="text-3xl font-normal leading-1.3 mb-4">What can I do?</h2>
                          <h3 class="text-15 font-semibold mb-2">If you're a visitor of this website:</h3>
      <p class="mb-6">Please try again in a few minutes.</p>

      <h3 class="text-15 font-semibold mb-2">If you're the owner of this website:</h3>
      <p>Please refer to the <a rel="noopener noreferrer" href="https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-5xx-errors/error-522/">Error 522</a> article:</p>
      <ul class="ml-4">
        <li>Contact your hosting provider; let them know your web server is not completing requests.</li>
        <li>Make sure your origin allows <a rel="noopener noreferrer" href="https://www.cloudflare.com/ips/">all Cloudflare IP ranges</a>.</li>
      </ul>
                </div>
            </div>
        </div>

        <div class="cf-error-footer cf-wrapper w-240 lg:w-full py-10 sm:py-4 sm:px-8 mx-auto text-center sm:text-left border-solid border-0 border-t border-gray-300">
  <p class="text-13">
    <span class="cf-footer-item sm:block sm:mb-1">Cloudflare Ray ID: <strong class="font-semibold">9df85ab3f347b637</strong></span>
    <span class="cf-footer-separator sm:hidden">&bull;</span>
    <span id="cf-footer-item-ip" class="cf-footer-item hidden sm:block sm:mb-1">
      Your IP:
      <button type="button" id="cf-footer-ip-reveal" class="cf-footer-ip-reveal-btn">Click to reveal</button>
      <span class="hidden" id="cf-footer-ip">68.81.5.53</span>
      <span class="cf-footer-separator sm:hidden">&bull;</span>
    </span>
    <span class="cf-footer-item sm:block sm:mb-1"><span>Performance &amp; security by</span> <a rel="noopener noreferrer" href="https://www.cloudflare.com/5xx-error-landing?utm_source=errorcode_522&utm_campaign=fyhftlxokyjtpndbkfse.supabase.co" id="brand_link" target="_blank">Cloudflare</a></span>
    
  </p>
  <script>(function(){function d(){var b=a.getElementById("cf-footer-item-ip"),c=a.getElementById("cf-footer-ip-reveal");b&&"classList"in b&&(b.classList.remove("hidden"),c.addEventListener("click",function(){c.classList.add("hidden");a.getElementById("cf-footer-ip").classList.remove("hidden")}))}var a=document;document.addEventListener&&a.addEventListener("DOMContentLoaded",d)})();</script>
</div><!-- /.error-footer -->


    </div>
</div>
</body>
</html>

- Notes: Supabase execute_sql RPC failed. | <!DOCTYPE html>
<!--[if lt IE 7]> <html class="no-js ie6 oldie" lang="en-US"> <![endif]-->
<!--[if IE 7]>    <html class="no-js ie7 oldie" lang="en-US"> <![endif]-->
<!--[if IE 8]>    <html class="no-js ie8 oldie" lang="en-US"> <![endif]-->
<!--[if gt IE 8]><!--> <html class="no-js" lang="en-US"> <!--<![endif]-->
<head>


<title>fyhftlxokyjtpndbkfse.supabase.co | 522: Connection timed out</title>
<meta charset="UTF-8" />
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta http-equiv="X-UA-Compatible" content="IE=Edge" />
<meta name="robots" content="noindex, nofollow" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<link rel="stylesheet" id="cf_styles-css" href="/cdn-cgi/styles/main.css" />


</head>
<body>
<div id="cf-wrapper">
    <div id="cf-error-details" class="p-0">
        <header class="mx-auto pt-10 lg:pt-6 lg:px-8 w-240 lg:w-full mb-8">
            <h1 class="inline-block sm:block sm:mb-2 font-light text-60 lg:text-4xl text-black-dark leading-tight mr-2">
              <span class="inline-block">Connection timed out</span>
              <span class="code-label">Error code 522</span>
            </h1>
            <div>
               Visit <a href="https://www.cloudflare.com/5xx-error-landing?utm_source=errorcode_522&utm_campaign=fyhftlxokyjtpndbkfse.supabase.co" target="_blank" rel="noopener noreferrer">cloudflare.com</a> for more information.
            </div>
            <div class="mt-3">2026-03-20 23:04:48 UTC</div>
        </header>
        <div class="my-8 bg-gradient-gray">
            <div class="w-240 lg:w-full mx-auto">
                <div class="clearfix md:px-8">
                  
<div id="cf-browser-status" class=" relative w-1/3 md:w-full py-15 md:p-0 md:py-8 md:text-left md:border-solid md:border-0 md:border-b md:border-gray-400 overflow-hidden float-left md:float-none text-center">
  <div class="relative mb-10 md:m-0">
    
    <span class="cf-icon-browser block md:hidden h-20 bg-center bg-no-repeat"></span>
    <span class="cf-icon-ok w-12 h-12 absolute left-1/2 md:left-auto md:right-0 md:top-0 -ml-6 -bottom-4"></span>
    
  </div>
  <span class="md:block w-full truncate">You</span>
  <h3 class="md:inline-block mt-3 md:mt-0 text-2xl text-gray-600 font-light leading-1.3">
    
    Browser
    
  </h3>
  <span class="leading-1.3 text-2xl text-green-success">Working</span>
</div>

<div id="cf-cloudflare-status" class=" relative w-1/3 md:w-full py-15 md:p-0 md:py-8 md:text-left md:border-solid md:border-0 md:border-b md:border-gray-400 overflow-hidden float-left md:float-none text-center">
  <div class="relative mb-10 md:m-0">
    <a href="https://www.cloudflare.com/5xx-error-landing?utm_source=errorcode_522&utm_campaign=fyhftlxokyjtpndbkfse.supabase.co" target="_blank" rel="noopener noreferrer">
    <span class="cf-icon-cloud block md:hidden h-20 bg-center bg-no-repeat"></span>
    <span class="cf-icon-ok w-12 h-12 absolute left-1/2 md:left-auto md:right-0 md:top-0 -ml-6 -bottom-4"></span>
    </a>
  </div>
  <span class="md:block w-full truncate">Newark</span>
  <h3 class="md:inline-block mt-3 md:mt-0 text-2xl text-gray-600 font-light leading-1.3">
    <a href="https://www.cloudflare.com/5xx-error-landing?utm_source=errorcode_522&utm_campaign=fyhftlxokyjtpndbkfse.supabase.co" target="_blank" rel="noopener noreferrer">
    Cloudflare
    </a>
  </h3>
  <span class="leading-1.3 text-2xl text-green-success">Working</span>
</div>

<div id="cf-host-status" class="cf-error-source relative w-1/3 md:w-full py-15 md:p-0 md:py-8 md:text-left md:border-solid md:border-0 md:border-b md:border-gray-400 overflow-hidden float-left md:float-none text-center">
  <div class="relative mb-10 md:m-0">
    
    <span class="cf-icon-server block md:hidden h-20 bg-center bg-no-repeat"></span>
    <span class="cf-icon-error w-12 h-12 absolute left-1/2 md:left-auto md:right-0 md:top-0 -ml-6 -bottom-4"></span>
    
  </div>
  <span class="md:block w-full truncate">fyhftlxokyjtpndbkfse.supabase.co</span>
  <h3 class="md:inline-block mt-3 md:mt-0 text-2xl text-gray-600 font-light leading-1.3">
    
    Host
    
  </h3>
  <span class="leading-1.3 text-2xl text-red-error">Error</span>
</div>

                </div>
            </div>
        </div>

        <div class="w-240 lg:w-full mx-auto mb-8 lg:px-8">
            <div class="clearfix">
                <div class="w-1/2 md:w-full float-left pr-6 md:pb-10 md:pr-0 leading-relaxed">
                    <h2 class="text-3xl font-normal leading-1.3 mb-4">What happened?</h2>
                    <p>The initial connection between Cloudflare's network and the origin web server timed out. As a result, the web page can not be displayed.</p>
                </div>
                <div class="w-1/2 md:w-full float-left leading-relaxed">
                    <h2 class="text-3xl font-normal leading-1.3 mb-4">What can I do?</h2>
                          <h3 class="text-15 font-semibold mb-2">If you're a visitor of this website:</h3>
      <p class="mb-6">Please try again in a few minutes.</p>

      <h3 class="text-15 font-semibold mb-2">If you're the owner of this website:</h3>
      <p>Please refer to the <a rel="noopener noreferrer" href="https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-5xx-errors/error-522/">Error 522</a> article:</p>
      <ul class="ml-4">
        <li>Contact your hosting provider; let them know your web server is not completing requests.</li>
        <li>Make sure your origin allows <a rel="noopener noreferrer" href="https://www.cloudflare.com/ips/">all Cloudflare IP ranges</a>.</li>
      </ul>
                </div>
            </div>
        </div>

        <div class="cf-error-footer cf-wrapper w-240 lg:w-full py-10 sm:py-4 sm:px-8 mx-auto text-center sm:text-left border-solid border-0 border-t border-gray-300">
  <p class="text-13">
    <span class="cf-footer-item sm:block sm:mb-1">Cloudflare Ray ID: <strong class="font-semibold">9df85ab3f347b637</strong></span>
    <span class="cf-footer-separator sm:hidden">&bull;</span>
    <span id="cf-footer-item-ip" class="cf-footer-item hidden sm:block sm:mb-1">
      Your IP:
      <button type="button" id="cf-footer-ip-reveal" class="cf-footer-ip-reveal-btn">Click to reveal</button>
      <span class="hidden" id="cf-footer-ip">68.81.5.53</span>
      <span class="cf-footer-separator sm:hidden">&bull;</span>
    </span>
    <span class="cf-footer-item sm:block sm:mb-1"><span>Performance &amp; security by</span> <a rel="noopener noreferrer" href="https://www.cloudflare.com/5xx-error-landing?utm_source=errorcode_522&utm_campaign=fyhftlxokyjtpndbkfse.supabase.co" id="brand_link" target="_blank">Cloudflare</a></span>
    
  </p>
  <script>(function(){function d(){var b=a.getElementById("cf-footer-item-ip"),c=a.getElementById("cf-footer-ip-reveal");b&&"classList"in b&&(b.classList.remove("hidden"),c.addEventListener("click",function(){c.classList.add("hidden");a.getElementById("cf-footer-ip").classList.remove("hidden")}))}var a=document;document.addEventListener&&a.addEventListener("DOMContentLoaded",d)})();</script>
</div><!-- /.error-footer -->


    </div>
</div>
</body>
</html>

- Summary: null

### 42. rebuild-sustainability-priors
- Schedule slot: 10:42 UTC
- Status: failure
- Action: run
- Timer: 00:39 (39230 ms)
- Method: GET
- Route: /api/v1/sustainability/rebuild-priors?season=current
- Local policy: safe
- Reason: <!DOCTYPE html>
<!--[if lt IE 7]> <html class="no-js ie6 oldie" lang="en-US"> <![endif]-->
<!--[if IE 7]>    <html class="no-js ie7 oldie" lang="en-US"> <![endif]-->
<!--[if IE 8]>    <html class="no-js ie8 oldie" lang="en-US"> <![endif]--…
- Notes: HTTP 500 Internal Server Error | <!DOCTYPE html>
<!--[if lt IE 7]> <html class="no-js ie6 oldie" lang="en-US"> <![endif]-->
<!--[if IE 7]>    <html class="no-js ie7 oldie" lang="en-US"> <![endif]-->
<!--[if IE 8]>    <html class="no-js ie8 oldie" lang="en-US"> <![endif]--…
- Summary: {"kind":"http","statusCode":500,"ok":false,"body":{"success":false,"message":"<!DOCTYPE html>\n<!--[if lt IE 7]> <html class=\"no-js ie6 oldie\" lang=\"en-US\"> <![endif]-->\n<!--[if IE 7]>    <html class=\"no-js ie7 oldie\" lang=\"en-US\"> <![endif]-->\n<!--[if IE 8]>    <html class=\"no-js ie8 oldie\" lang=\"en-US\"> <![endif]-->\n<!--[if gt IE 8]><!--> <html class=\"no-js\" lang=\"en-US\"> <!-…

### 43. rebuild-sustainability-window-z
- Schedule slot: 10:43 UTC
- Status: failure
- Action: run
- Timer: 00:39 (39427 ms)
- Method: GET
- Route: /api/v1/sustainability/rebuild-window-z?season=current&runAll=true
- Local policy: caution
- Reason: <!DOCTYPE html>
<!--[if lt IE 7]> <html class="no-js ie6 oldie" lang="en-US"> <![endif]-->
<!--[if IE 7]>    <html class="no-js ie7 oldie" lang="en-US"> <![endif]-->
<!--[if IE 8]>    <html class="no-js ie8 oldie" lang="en-US"> <![endif]--…
- Notes: runAll mode loops windows across all baseline players. | May need offset-specific sequencing if full-run timing is unstable. | HTTP 500 Internal Server Error | <!DOCTYPE html>
<!--[if lt IE 7]> <html class="no-js ie6 oldie" lang="en-US"> <![endif]-->
<!--[if IE 7]>    <html class="no-js ie7 oldie" lang="en-US"> <![endif]-->
<!--[if IE 8]>    <html class="no-js ie8 oldie" lang="en-US"> <![endif]--…
- Summary: {"kind":"http","statusCode":500,"ok":false,"body":{"success":false,"message":"<!DOCTYPE html>\n<!--[if lt IE 7]> <html class=\"no-js ie6 oldie\" lang=\"en-US\"> <![endif]-->\n<!--[if IE 7]>    <html class=\"no-js ie7 oldie\" lang=\"en-US\"> <![endif]-->\n<!--[if IE 8]>    <html class=\"no-js ie8 oldie\" lang=\"en-US\"> <![endif]-->\n<!--[if gt IE 8]><!--> <html class=\"no-js\" lang=\"en-US\"> <!-…

### 44. rebuild-sustainability-score
- Schedule slot: 10:44 UTC
- Status: failure
- Action: run
- Timer: 00:39 (39421 ms)
- Method: GET
- Route: /api/v1/sustainability/rebuild-score?season=current&runAll=true
- Local policy: caution
- Reason: <!DOCTYPE html>
<!--[if lt IE 7]> <html class="no-js ie6 oldie" lang="en-US"> <![endif]-->
<!--[if IE 7]>    <html class="no-js ie7 oldie" lang="en-US"> <![endif]-->
<!--[if IE 8]>    <html class="no-js ie8 oldie" lang="en-US"> <![endif]--…
- Notes: Score rebuild loops player baselines and window outputs before upsert. | A strong candidate for optimization or explicit sequential batching. | HTTP 500 Internal Server Error | <!DOCTYPE html>
<!--[if lt IE 7]> <html class="no-js ie6 oldie" lang="en-US"> <![endif]-->
<!--[if IE 7]>    <html class="no-js ie7 oldie" lang="en-US"> <![endif]-->
<!--[if IE 8]>    <html class="no-js ie8 oldie" lang="en-US"> <![endif]--…
- Summary: {"kind":"http","statusCode":500,"ok":false,"body":{"success":false,"message":"<!DOCTYPE html>\n<!--[if lt IE 7]> <html class=\"no-js ie6 oldie\" lang=\"en-US\"> <![endif]-->\n<!--[if IE 7]>    <html class=\"no-js ie7 oldie\" lang=\"en-US\"> <![endif]-->\n<!--[if IE 8]>    <html class=\"no-js ie8 oldie\" lang=\"en-US\"> <![endif]-->\n<!--[if gt IE 8]><!--> <html class=\"no-js\" lang=\"en-US\"> <!-…

### 45. update-predictions-sko
- Schedule slot: 10:45 UTC
- Status: failure
- Action: run
- Timer: 00:39 (39422 ms)
- Method: GET
- Route: /api/v1/ml/update-predictions-sko
- Local policy: safe
- Reason: <!DOCTYPE html>
<!--[if lt IE 7]> <html class="no-js ie6 oldie" lang="en-US"> <![endif]-->
<!--[if IE 7]>    <html class="no-js ie7 oldie" lang="en-US"> <![endif]-->
<!--[if IE 8]>    <html class="no-js ie8 oldie" lang="en-US"> <![endif]--…
- Notes: HTTP 500 Internal Server Error | <!DOCTYPE html>
<!--[if lt IE 7]> <html class="no-js ie6 oldie" lang="en-US"> <![endif]-->
<!--[if IE 7]>    <html class="no-js ie7 oldie" lang="en-US"> <![endif]-->
<!--[if IE 8]>    <html class="no-js ie8 oldie" lang="en-US"> <![endif]--…
- Summary: {"kind":"http","statusCode":500,"ok":false,"body":{"success":false,"message":"<!DOCTYPE html>\n<!--[if lt IE 7]> <html class=\"no-js ie6 oldie\" lang=\"en-US\"> <![endif]-->\n<!--[if IE 7]>    <html class=\"no-js ie7 oldie\" lang=\"en-US\"> <![endif]-->\n<!--[if IE 8]>    <html class=\"no-js ie8 oldie\" lang=\"en-US\"> <![endif]-->\n<!--[if gt IE 8]><!--> <html class=\"no-js\" lang=\"en-US\"> <!-…

### 46. rebuild-sustainability-trend-bands
- Schedule slot: 10:46 UTC
- Status: failure
- Action: run
- Timer: 00:38 (38911 ms)
- Method: GET
- Route: /api/v1/sustainability/rebuild-trend-bands?runAll=true
- Local policy: caution
- Reason: <!DOCTYPE html>
<!--[if lt IE 7]> <html class="no-js ie6 oldie" lang="en-US"> <![endif]-->
<!--[if IE 7]>    <html class="no-js ie7 oldie" lang="en-US"> <![endif]-->
<!--[if IE 8]>    <html class="no-js ie8 oldie" lang="en-US"> <![endif]--…
- Notes: Trend bands can expand over large per-player history slices. | May require audit-mode batching if runAll exceeds the cron budget. | HTTP 500 Internal Server Error | <!DOCTYPE html>
<!--[if lt IE 7]> <html class="no-js ie6 oldie" lang="en-US"> <![endif]-->
<!--[if IE 7]>    <html class="no-js ie7 oldie" lang="en-US"> <![endif]-->
<!--[if IE 8]>    <html class="no-js ie8 oldie" lang="en-US"> <![endif]--…
- Summary: {"kind":"http","statusCode":500,"ok":false,"body":{"success":false,"message":"<!DOCTYPE html>\n<!--[if lt IE 7]> <html class=\"no-js ie6 oldie\" lang=\"en-US\"> <![endif]-->\n<!--[if IE 7]>    <html class=\"no-js ie7 oldie\" lang=\"en-US\"> <![endif]-->\n<!--[if IE 8]>    <html class=\"no-js ie8 oldie\" lang=\"en-US\"> <![endif]-->\n<!--[if gt IE 8]><!--> <html class=\"no-js\" lang=\"en-US\"> <!-…

### 47. update-nst-team-daily-incremental
- Schedule slot: 10:50 UTC
- Status: failure
- Action: run
- Timer: 05:01 (301009 ms)
- Method: GET
- Route: /api/v1/db/update-nst-team-daily
- Local policy: safe
- Reason: fetch failed
- Notes: fetch failed
- Summary: null

### 48. update-nst-team-stats-all
- Schedule slot: 10:55 UTC
- Status: failure
- Action: run
- Timer: 16:18 (978677 ms)
- Method: GET
- Route: /api/Teams/nst-team-stats
- Local policy: safe
- Reason: Failed to upsert team statistics: Failed to scan existing dates for nst_team_all: <!DOCTYPE html>
<!--[if lt IE 7]> <html class="no-js ie6 oldie" lang="en-US"> <![endif]-->
<!--[if IE 7]>    <html class="no-js ie7 oldie" lang="en-US"> <![e…
- Notes: Inserted 900s NST safety wait before execution. | HTTP 500 Internal Server Error | Failed to upsert team statistics: Failed to scan existing dates for nst_team_all: <!DOCTYPE html>
<!--[if lt IE 7]> <html class="no-js ie6 oldie" lang="en-US"> <![endif]-->
<!--[if IE 7]>    <html class="no-js ie7 oldie" lang="en-US"> <![e…
- Summary: {"kind":"http","statusCode":500,"ok":false,"body":{"success":false,"message":"Failed to upsert team statistics: Failed to scan existing dates for nst_team_all: <!DOCTYPE html>\n<!--[if lt IE 7]> <html class=\"no-js ie6 oldie\" lang=\"en-US\"> <![endif]-->\n<!--[if IE 7]>    <html class=\"no-js ie7 oldie\" lang=\"en-US\"> <![endif]-->\n<!--[if IE 8]>    <html class=\"no-js ie8 oldie\" lang=\"en-US…

### 49. update-power-rankings
- Schedule slot: 11:00 UTC
- Status: failure
- Action: run
- Timer: 00:00 (192 ms)
- Method: GET
- Route: /api/v1/db/update-power-rankings
- Local policy: safe
- Reason: Error: require is not a function
- Notes: HTTP 500 Internal Server Error | Error: require is not a function
- Summary: {"kind":"http","statusCode":500,"ok":false,"body":{"message":"Error: require is not a function"}}

### 50. run-projection-accuracy
- Schedule slot: 11:30 UTC
- Status: failure
- Action: run
- Timer: 00:39 (39006 ms)
- Method: POST
- Route: /api/v1/db/run-projection-accuracy?projectionOffsetDays=0
- Local policy: safe
- Reason: <!DOCTYPE html>
<!--[if lt IE 7]> <html class="no-js ie6 oldie" lang="en-US"> <![endif]-->
<!--[if IE 7]>    <html class="no-js ie7 oldie" lang="en-US"> <![endif]-->
<!--[if IE 8]>    <html class="no-js ie8 oldie" lang="en-US"> <![endif]--…
- Notes: HTTP 500 Internal Server Error | <!DOCTYPE html>
<!--[if lt IE 7]> <html class="no-js ie6 oldie" lang="en-US"> <![endif]-->
<!--[if IE 7]>    <html class="no-js ie7 oldie" lang="en-US"> <![endif]-->
<!--[if IE 8]>    <html class="no-js ie8 oldie" lang="en-US"> <![endif]--…
- Summary: {"kind":"http","statusCode":500,"ok":false,"body":{"success":false,"error":"<!DOCTYPE html>\n<!--[if lt IE 7]> <html class=\"no-js ie6 oldie\" lang=\"en-US\"> <![endif]-->\n<!--[if IE 7]>    <html class=\"no-js ie7 oldie\" lang=\"en-US\"> <![endif]-->\n<!--[if IE 8]>    <html class=\"no-js ie8 oldie\" lang=\"en-US\"> <![endif]-->\n<!--[if gt IE 8]><!--> <html class=\"no-js\" lang=\"en-US\"> <!--<…

### 51. daily-cron-report
- Schedule slot: 13:00 UTC
- Status: skipped
- Action: observe_only
- Timer: 00:00 (0 ms)
- Method: GET
- Route: /api/v1/db/cron-report
- Local policy: skip
- Reason: Skipped unsafe local/dev side-effect route and recorded observation only.
- Notes: Sends Resend email and is better observed in mocked-email or production-safe mode. | Should run last and should not be benchmarked as a normal local side-effect job. | Policy action: observe_only | Skipped unsafe local/dev side-effect route and recorded observation only.
- Summary: {"kind":"policy","action":"observe_only"}

### 52. update-pbp
- Schedule slot: 20:51 UTC
- Status: skipped
- Action: skip
- Timer: 00:00 (0 ms)
- Method: GET
- Route: /api/v1/db/update-PbP?gameId=recent
- Local policy: skip
- Reason: Skipped by benchmark execution policy.
- Notes: NOT WORKING | Policy action: skip | Skipped by benchmark execution policy.
- Summary: {"kind":"policy","action":"skip"}


# Homepage Transaction Trends benchmark

- Start on octoberBranch at 789713fb5bc12a2bb1c62ab6bea676d4c30cf6a6. Own local before/after harness, seeded HTTP and Chromium evidence in tasks/artifacts/trends-parent-2026-11-18/benchmark.
- Pin original source through git show. Isolate unrelated home modules and all external services. Next measure cold and warm server work and browser usable rows.
- Built local Chromium + real handler integration and ran the five-sample original benchmark with the isolated PG15 instance seeded from 4,438 Yahoo players, 2,373 map rows and 74,332 history points. Compared the complete PG and memory-adapter payload hashes. Waiting for the candidate SQL/handler to run matched measurements.
- Final cache-miss/warm candidate passed all seven original digest and source-date checks, actual Chromium interaction and delayed/mobile checks. Candidate cache-cold HTTP 74.91 ms median, browser 130.2 ms, compared to 150.81 ms and 226.2 ms original. Added complementary five-pair fresh-process + restarted-Postgres first navigation measurement at Chef's request.
- Handoff complete. Five independent paired first-hit runs passed, exact sources retained in benchmark/fresh.json. Default first usable rows 247.8→163.7 ms; same-request handler 193.66→113.94 ms. All timing bounds and commands are in benchmark/README.md. No open benchmark checks or external calls.

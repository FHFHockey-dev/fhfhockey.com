  it.each([
    ["active", "2026-10-19T10:09:30.000Z", "stage_in_progress_elsewhere"],
    ["expired", "2026-10-19T10:04:00.000Z", "manual_review_required"],
    ["missing", null, "manual_review_required"],
  ])("does not mutate or reacquire an existing %s NST lease", async (_label, expires, expectedReason) => {
    seed("upstream_skater_sources", { status: "running", cursor_game_id: 7, lease_owner: "prior-owner", lease_expires_at: expires });
    const before = { ...stageRow() };
    const response = await invoke();
    expect(response.body.termination.reason).toBe(expectedReason);
    expect(stageRow()).toEqual(before);
    expect(pipelineStateRpc).not.toHaveBeenCalled();
    expect(updateNstGamelogMock).not.toHaveBeenCalled();
    expect(updateWgoSkatersMock).not.toHaveBeenCalled();
    expect([...pipelineStateRows.keys()].some(key => key.includes(":kill:"))).toBe(false);
  });

  it("fences a newer durable hold written after the fresh acquisition read", async () => {
    let intercept = true;
    vi.mocked(serverClient.from).mockImplementation(((table: string) => {
      const query = originalFrom(table as any);
      if (table === "projection_pipeline_state" && intercept) {
        const single = (query as any).maybeSingle;
        (query as any).maybeSingle = async () => {
          const snapshot = await single();
          if (intercept && snapshot.data?.operation_key === "upstream_skater_sources") {
            intercept = false;
            pipelineStateRows.set(stageKey("upstream_skater_sources"), { ...snapshot.data,
              revision: snapshot.data.revision + 1, status: "failed", last_error: "nst_persistence_unconfirmed" });
          }
          return snapshot;
        };
      }
      return query;
    }) as any);
    const response = await invoke();
    expect(response.body.termination.reason).toBe("stage_in_progress_elsewhere");
    expect(response.body.termination.detail).toContain("REVISION_MISMATCH");
    expect(stageRow()).toMatchObject({ revision: 2, last_error: "nst_persistence_unconfirmed" });
    expect(updateNstGamelogMock).not.toHaveBeenCalled();
    const next = await invoke();
    expect(next.body.termination).toMatchObject({ reason: "manual_review_required", resumeRequired: false });
    expect(updateNstGamelogMock).not.toHaveBeenCalled();
  });

  it("does not invoke NST after a committed acquisition returns a mismatched receipt", async () => {
    let corrupt = true;
    pipelineStateRpc.mockImplementation(async (name: string, args: any) => {
      const result = await originalRpc(name, args);
      if (corrupt && args.p_operation_key === "upstream_skater_sources" && args.p_transition === "acquire") {
        corrupt = false;
        return { ...result, data: [{ ...result.data[0], cursor_game_id: 99 }] };
      }
      return result;
    });
    const response = await invoke();
    expect(response.body.termination).toMatchObject({ reason: "state_error" });
    expect(updateNstGamelogMock).not.toHaveBeenCalled();
    expect(stageRow()).toMatchObject({ status: "running", cursor_game_id: 7 });
    vi.setSystemTime(new Date("2026-10-19T10:15:00.000Z"));
    const next = await invoke();
    expect(next.body.termination).toMatchObject({ reason: "manual_review_required", resumeRequired: false });
    expect(updateNstGamelogMock).not.toHaveBeenCalled();
  });

  it.each([true, false])("requires a durable handoff row when its acknowledgement was lost (committed=%s)", async committed => {
    pipelineStateRpc.mockImplementation(async (name: string, args: any) => {
      if (args.p_transition === "fail" && args.p_last_error === "stage_handoff") {
        if (committed) await originalRpc(name, args);
        return { data: null, error: { message: "handoff acknowledgement lost" } };
      }
      return originalRpc(name, args);
    });
    updateNstGamelogMock.mockImplementationOnce(partial("15"));
    const first = await invoke();
    expect(first.body.termination.reason).toBe("state_error");
    expect(stageRow()).toMatchObject({ cursor_game_id: 15, status: committed ? "failed" : "running" });
    expect(updateWgoSkatersMock).not.toHaveBeenCalled();
    vi.setSystemTime(new Date("2026-10-19T10:15:00.000Z"));
    const next = await invoke();
    if (committed) {
      expect(next.body.termination.state).toBe("completed");
      expect(updateNstGamelogMock).toHaveBeenCalledTimes(2);
      expect(updateNstGamelogMock.mock.calls[1][0].query.cursor).toBe("15");
      expect(updateWgoSkatersMock).toHaveBeenCalledTimes(1);
    } else {
      expect(next.body.termination).toMatchObject({ reason: "manual_review_required", resumeRequired: false });
      expect(updateNstGamelogMock).toHaveBeenCalledTimes(1);
      expect(updateWgoSkatersMock).not.toHaveBeenCalled();
    }
  });

  it("retains the normal bounded retry for an acknowledged non-ambiguous NST failure", async () => {
    updateNstGamelogMock.mockImplementation(async (_req: any, res: any) => res.status(503).json({ success: false, error: "provider rejected request" }));
    const first = await invoke();
    expect(first.body.termination).toMatchObject({ reason: "retry_on_next_invocation", resumeRequired: true });
    const second = await invoke();
    expect(second.body.termination).toMatchObject({ reason: "attempts_exhausted", resumeRequired: false });
    const third = await invoke();
    expect(third.body.termination).toMatchObject({ reason: "attempts_exhausted", resumeRequired: false });
    expect(updateNstGamelogMock).toHaveBeenCalledTimes(2);
    expect(updateWgoSkatersMock).not.toHaveBeenCalled();
  });
});

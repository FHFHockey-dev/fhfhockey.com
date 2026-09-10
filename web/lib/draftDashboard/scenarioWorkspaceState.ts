export type ScenarioWorkspaceState = Readonly<{
  mounted: boolean;
  open: boolean;
  candidateIds: readonly string[];
}>;

export const showScenarioWorkspace = (
  state: ScenarioWorkspaceState,
  candidateIds?: readonly string[],
): ScenarioWorkspaceState => ({
  mounted: true,
  open: true,
  candidateIds: candidateIds ? [...candidateIds] : state.candidateIds,
});

export const toggleScenarioWorkspace = (state: ScenarioWorkspaceState): ScenarioWorkspaceState => ({
  ...state,
  mounted: true,
  open: !state.open,
});

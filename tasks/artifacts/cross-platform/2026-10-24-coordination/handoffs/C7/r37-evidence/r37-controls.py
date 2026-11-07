import sys
src = open(sys.argv[1]).read()
extra = '''
// --- C7 R37 controls ---
it.each([401, 403])("C7: a %s refresh with a non-JSON body still hides the private lineup", async status => {
  const { alert } = await loadThenRefresh(async () => ({ ok: false, status, json: async () => { throw new SyntaxError("Unexpected token < in JSON"); } }));
  expect(alert.textContent).toBeTruthy();
  expect(screen.queryByText(/Private Center/)).toBeNull();
});
it("C7: a late 403 for an aborted (superseded) request never blanks the newer comparison", async () => {
  let releaseLate!: () => void;
  const late = new Promise<void>(resolve => { releaseLate = resolve; });
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(loaded())
    .mockImplementationOnce(async () => { await late; return { ok: false, status: 403, json: async () => ({ error: "Access could not be verified" }) }; })
    .mockResolvedValueOnce(loaded());
  vi.stubGlobal("fetch", fetchMock);
  render(<StarterBoardYahoo />);
  const refresh = () => fireEvent.click(screen.getByRole("button", { name: "Refresh today’s comparison", hidden: true }));
  refresh(); expect(await screen.findByText(/C: Private Center/)).toBeTruthy();
  refresh(); await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  // The button is disabled while busy; a third load supersedes via the component's own abort when triggered programmatically.
  const button = screen.getByRole("button", { name: /Refresh today|Loading Yahoo/, hidden: true }) as HTMLButtonElement;
  button.disabled = false; refresh();
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
  releaseLate();
  await new Promise(resolve => setTimeout(resolve, 20));
  expect(screen.getByText(/C: Private Center/)).toBeTruthy();
  expect(screen.queryByText("Access could not be verified")).toBeNull();
});
it("C7: a successful refresh in flight keeps the last comparison visible", async () => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const fetchMock = vi.fn().mockResolvedValueOnce(loaded()).mockImplementationOnce(async () => { await gate; return loaded(); });
  vi.stubGlobal("fetch", fetchMock);
  render(<StarterBoardYahoo />);
  const refresh = () => fireEvent.click(screen.getByRole("button", { name: "Refresh today’s comparison", hidden: true }));
  refresh(); expect(await screen.findByText(/C: Private Center/)).toBeTruthy();
  refresh(); await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  expect(screen.getByText(/C: Private Center/)).toBeTruthy();
  release(); await waitFor(() => expect(screen.getByText(/C: Private Center/)).toBeTruthy());
});
'''
open(sys.argv[2], "w").write(src + extra)

import type { MockPlayer } from "./contracts";

type Edge = { to: number; reverse: number; capacity: number };
/** Capacity matching groups interchangeable players and slots, keeping 40-team drafts bounded. */
export function feasibleRosters(
  teamCount: number,
  slotList: string[],
  held: { player: MockPlayer; seat: number }[],
  available: MockPlayer[],
  fits: (p: MockPlayer, slot: string) => boolean,
) {
  if (held.length + available.length < teamCount * slotList.length)
    return false;
  const graph: Edge[][] = [[], []],
    source = 0,
    sink = 1;
  const node = () => {
    graph.push([]);
    return graph.length - 1;
  };
  const edge = (from: number, to: number, capacity: number) => {
    graph[from].push({ to, reverse: graph[to].length, capacity });
    graph[to].push({ to: from, reverse: graph[from].length - 1, capacity: 0 });
  };
  const counts = new Map<string, number>();
  slotList.forEach((s) => counts.set(s, (counts.get(s) ?? 0) + 1));
  const destinations = Array.from({ length: teamCount }, (_, seat) =>
    [...counts].map(([slot, count]) => {
      const id = node();
      edge(id, sink, count);
      return { id, slot, seat };
    }),
  ).flat();
  function addGroups(input: { player: MockPlayer; seat: number }[]) {
    const groups = new Map<
      string,
      { player: MockPlayer; seat: number; count: number }
    >();
    input.forEach((item) => {
      const key = `${item.seat}:${[...item.player.positions].sort().join(",")}`;
      const group = groups.get(key);
      if (group) group.count++;
      else groups.set(key, { ...item, count: 1 });
    });
    groups.forEach((group) => {
      const id = node();
      edge(source, id, group.count);
      destinations.forEach((d) => {
        if (
          (group.seat < 0 || group.seat === d.seat) &&
          fits(group.player, d.slot)
        )
          edge(id, d.id, group.count);
      });
    });
  }
  function flow() {
    let total = 0;
    for (;;) {
      const level = new Array<number>(graph.length).fill(-1),
        queue = [source];
      level[source] = 0;
      for (let i = 0; i < queue.length; i++)
        for (const e of graph[queue[i]])
          if (e.capacity > 0 && level[e.to] < 0) {
            level[e.to] = level[queue[i]] + 1;
            queue.push(e.to);
          }
      if (level[sink] < 0) return total;
      const cursor = new Array<number>(graph.length).fill(0);
      const send = (at: number, capacity: number): number => {
        if (at === sink) return capacity;
        for (; cursor[at] < graph[at].length; cursor[at]++) {
          const e = graph[at][cursor[at]];
          if (e.capacity <= 0 || level[e.to] !== level[at] + 1) continue;
          const amount = send(e.to, Math.min(capacity, e.capacity));
          if (amount) {
            e.capacity -= amount;
            graph[e.to][e.reverse].capacity += amount;
            return amount;
          }
        }
        return 0;
      };
      let amount: number;
      while ((amount = send(source, Infinity)) > 0) total += amount;
    }
  }
  addGroups(held);
  if (flow() !== held.length) return false;
  addGroups(available.map((player) => ({ player, seat: -1 })));
  return flow() + held.length === teamCount * slotList.length;
}

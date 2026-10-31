import type { SharePostCardProps } from "lib/socialShare/modules/contract";
import { boardChange, ROLE_WATCH_COPY, roleSlotLabel, type RoleChange, type RoleWatchData, type RoleWatchRow, type RoleWatchSettings } from "lib/socialShare/modules/roleWatch";
import { formatSeconds, windowLabel } from "lib/socialShare/modules/whatChanged";
import { HeatTile } from "./GoalieBoards";
import { PostEmpty, PostTeamMark } from "./kit";
import { ChangeSide, RecentSpark } from "./WhatChangedCard";
import board from "./WhatChangedCard.module.scss";
import styles from "./RoleWatchCard.module.scss";

const BOARD_TEXT = { toi: { name: "TOI", strength: "all situations", other: "PP TOI" }, pp: { name: "PP TOI", strength: "power play", other: "TOI" } };

function OtherMeasure({ label, change }: { label: string; change: RoleChange }) {
  return <span className={board.tile} data-testid="group-tile" data-metric={label} data-direction={change.changeSeconds === null ? "none" : change.direction}>
    <small>{label}</small>
    <span className={board.tileValue}><b>{formatSeconds(change.recentSeconds)}</b><i>{formatSeconds(change.changeSeconds, true)}</i></span>
    <small>per game</small>
  </span>;
}

export default function RoleWatchCard({ data, logos }: SharePostCardProps<RoleWatchSettings, RoleWatchData>) {
  const recentLabel = windowLabel(data.window), { cohort } = data, text = BOARD_TEXT[data.board], change = boardChange(data.board), other = boardChange(data.board === "toi" ? "pp" : "toi");
  if (!data.risers.length && !data.fallers.length) return <PostEmpty>No {text.name} change meets the minimums: {cohort.compared} compared, {cohort.shortSample} short sample</PostEmpty>;
  const rows = [...data.risers, ...data.fallers], largest = Math.max(...rows.map(row => Math.abs(change(row).changeSeconds ?? 0)));
  const tiedAt = (side: readonly RoleWatchRow[]) => side[side.length - 1]?.rank;
  const legend = [
    ROLE_WATCH_COPY, `BASE = season before ${recentLabel}`, "Line = last 10 games",
    ...(rows.some(row => row.teamChange) ? ["† new team"] : []),
    ...(data.moreTied.up ? [`Up: ${data.moreTied.up} more tied at rank ${tiedAt(data.risers)}`] : []),
    ...(data.moreTied.down ? [`Down: ${data.moreTied.down} more tied at rank ${tiedAt(data.fallers)}`] : []),
  ].join(" · ");
  const renderRow = (row: RoleWatchRow) => <>
    <span className={board.rank}>{row.rank}</span>
    <span className={board.logo}>{row.team && <PostTeamMark team={row.team} logo={logos[row.team]} size={34} />}</span>
    <span className={board.ident}>
      <b>{row.name ?? `Player ${row.playerId}`}{row.teamChange ? " †" : ""}</b>
      <small>{formatSeconds(change(row).recentSeconds)} vs {formatSeconds(change(row).baselineSeconds)} BASE · {row.recentGames} vs {row.baselineGames} GP</small>
    </span>
    <HeatTile value={change(row).changeSeconds} text={formatSeconds(change(row).changeSeconds, true)} caption={`${text.name}/G`} largest={largest} />
    <div className={`${board.strip} ${styles.strip}`}>
      <span className={styles.role}>
        <span><small>Before</small> {row.before ? roleSlotLabel(row.before.role) : "No game before"}</span>
        <span><small>Latest</small> {roleSlotLabel(row.latest.role)}</span>
      </span>
      <OtherMeasure label={text.other} change={other(row)} />
      <RecentSpark series={row.series} recentFrom={row.recentFrom} recentLabel={recentLabel} />
    </div>
  </>;
  const sides = { rowKey: (row: RoleWatchRow) => row.playerId, renderRow };
  return <div className={board.card}>
    <p className={board.heading}>{text.name} per game, {text.strength} · {recentLabel} versus season before it · {formatSeconds(data.minimum)}+ change</p>
    <div className={board.boards}>
      <ChangeSide kind="up" rows={data.risers} empty={`No ${text.name} rise meets the minimum`} {...sides} />
      <ChangeSide kind="down" rows={data.fallers} empty={`No ${text.name} fall meets the minimum`} {...sides} />
    </div>
    <p className={board.note}>{legend}</p>
  </div>;
}

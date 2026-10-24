# Narrow CSV resolver contradiction check

Observed 2026-10-24T17:43:08.240080+00:00. Source full-file integrity SHA256 acade3b347f329a92e0aa096e01e3c3792e205c5d58b3a0d408c98728c3022bd.
Read only selected ranges below. Source unchanged during checks; no application import/edit/test, browser, network or Git action. Named-symbol search over this one file is partial structural evidence, not a whole-file audit.

Current source: web/components/DraftDashboard/ImportCsvModal.tsx

## Lines 240–285

```tsx
240:       id: number;
241:       fullName: string;
242:       position: string | null;
243:       lastName?: string | null;
244:       teamId?: number | null;
245:       teamAbbrev?: string | null;
246:     }>
247:   >([]);
248:   const [ambiguousChoices, setAmbiguousChoices] = useState<
249:     Record<string, number | "">
250:   >({}); // key: standardized name in preview, val: selected player id
251:   const [rejectedSuggestions, setRejectedSuggestions] = useState<Set<string>>(
252:     new Set(),
253:   );
254:   const [searchInputs, setSearchInputs] = useState<Record<string, string>>({});
255:   const [forceImportDespiteUnresolved, setForceImportDespiteUnresolved] =
256:     useState(false);
257:   const [requireFullMapping, setRequireFullMapping] = useState(false);
258:   const [collapseHeaderMapping, setCollapseHeaderMapping] = useState(false);
259:   const [collapseUnresolved, setCollapseUnresolved] = useState(false);
260:   const [collapseAmbiguities, setCollapseAmbiguities] = useState(false);
261:   const [manualSearchInputs, setManualSearchInputs] = useState<
262:     Record<string, string>
263:   >({});
264:   const previouslyFocusedRef = useRef<HTMLElement | null>(null);
265: 
266:   const resetImportState = useCallback(() => {
267:     setAllRows([]);
268:     setRawRows([]);
269:     setHeaders([]);
270:     setPlayerType("skater");
271:     setIsGoalieCsv(false);
272:     setPlayerHeader(null);
273:     setError(null);
274:     setIsParsing(false);
275:     setParseIssues([]);
276:     setSourceName("Custom CSV");
277:     setAmbiguousChoices({});
278:     setRejectedSuggestions(new Set());
279:     setSearchInputs({});
280:     setManualSearchInputs({});
281:     setForceImportDespiteUnresolved(false);
282:     setRequireFullMapping(false);
283:     setCollapseHeaderMapping(false);
284:     setCollapseUnresolved(false);
285:     setCollapseAmbiguities(false);
```

## Lines 705–765

```tsx
705:           canonicalName = standardizePlayerName(String(v ?? ""));
706:           out[h.standardized] = canonicalName;
707:         } else {
708:           out[h.standardized] = v as any;
709:         }
710:       });
711: 
712:       if (!canonicalName) {
713:         const fallback = standardizePlayerName(
714:           String(
715:             (row as any).Player_Name ||
716:               (row as any).player_name ||
717:               (row as any).Name ||
718:               "",
719:           ),
720:         );
721:         if (fallback) {
722:           canonicalName = fallback;
723:           (out as any).Player_Name = fallback;
724:         }
725:       }
726: 
727:       const trimmedName = canonicalName.trim();
728:       const stdKey = trimmedName ? stdName(trimmedName) : "";
729:       const manualChoice = trimmedName
730:         ? ambiguousChoices[trimmedName]
731:         : undefined;
732:       const csvTeamRaw =
733:         (out as any).Team_Abbreviation ??
734:         (out as any).Team ??
735:         (out as any).team_abbreviation ??
736:         (out as any).team;
737:       const csvTeamAbbrev =
738:         typeof csvTeamRaw === "string" && csvTeamRaw.trim() !== ""
739:           ? csvTeamRaw.trim().toUpperCase()
740:           : null;
741:       const csvTeamId = csvTeamAbbrev
742:         ? (TEAM_ID_BY_ABBREV.get(csvTeamAbbrev) ?? null)
743:         : null;
744: 
745:       let finalId: number | null = null;
746:       let method = "unresolved";
747:       let invalidOriginalId = false;
748: 
749:       if (typeof manualChoice === "number" && Number.isFinite(manualChoice)) {
750:         finalId = manualChoice;
751:         method = "manual";
752:         manualOverrides++;
753:         resolvedCount++;
754:       } else {
755:         let originalId: number | null = null;
756:         for (const key of playerIdKeys) {
757:           const rawVal = (out as any)[key];
758:           if (rawVal == null || rawVal === "") continue;
759:           const numeric = Number(rawVal);
760:           if (Number.isFinite(numeric)) {
761:             originalId = numeric;
762:             break;
763:           }
764:         }
765: 
```

## Lines 973–1008

```tsx
973:   // Auto-populate ambiguousChoices with exact single matches (unique fullName in DB)
974:   useEffect(() => {
975:     if (!mappedAllRows.length || !dbPlayers.length) return;
976:     const exactMap = new Map<string, number[]>(); // raw lowercase → ids
977:     const normalizedMap = new Map<string, number[]>(); // normalized → ids
978:     dbPlayers.forEach((p) => {
979:       const rawKey = p.fullName.toLowerCase();
980:       if (!exactMap.has(rawKey)) exactMap.set(rawKey, []);
981:       exactMap.get(rawKey)!.push(p.id);
982:       const normKey = normalizeForMatch(p.fullName);
983:       if (!normalizedMap.has(normKey)) normalizedMap.set(normKey, []);
984:       normalizedMap.get(normKey)!.push(p.id);
985:     });
986:     setAmbiguousChoices((prev) => {
987:       const next = { ...prev };
988:       mappedAllRows.forEach((row: any) => {
989:         const nm = String((row as any).Player_Name || "").trim();
990:         if (!nm || next[nm]) return;
991:         const rawIds = exactMap.get(nm.toLowerCase());
992:         if (rawIds && rawIds.length === 1) {
993:           next[nm] = rawIds[0];
994:           return;
995:         }
996:         // Normalized pass (handles punctuation / accents: J.T. → JT, K'Andre → k andre → k andre)
997:         const norm = normalizeForMatch(nm);
998:         const normIds = normalizedMap.get(norm);
999:         if (normIds && normIds.length === 1) {
1000:           next[nm] = normIds[0];
1001:         }
1002:       });
1003:       return next;
1004:     });
1005:   }, [mappedAllRows, dbPlayers]);
1006: 
1007:   // ---------- Fuzzy Matching Helpers ----------
1008:   const levenshtein = useCallback(
```

## Lines 1052–1077

```tsx
1052:   // Auto resolve perfect unique matches among ambiguous candidates (only if exactly one perfect score)
1053:   useEffect(() => {
1054:     setAmbiguousChoices((prev) => {
1055:       const next = { ...prev };
1056:       ambiguousWithSuggestions.forEach((r) => {
1057:         if (next[r.key]) return;
1058:         const perfect = r.candidates.filter((c) => c.score === 1);
1059:         if (perfect.length === 1) next[r.key] = perfect[0].id;
1060:       });
1061:       return next;
1062:     });
1063:   }, [ambiguousWithSuggestions]);
1064: 
1065:   const missingRequired = useMemo(() => {
1066:     const set = new Set(
1067:       headers.filter((h) => h.selected).map((h) => h.standardized),
1068:     );
1069:     if (set.has("Games_Played")) set.add("Games_Started_Goalie");
1070:     if (set.has("Games_Started_Goalie")) set.add("Games_Played");
1071:     return REQUIRED_COLUMNS.filter((r) => !set.has(r));
1072:   }, [headers, REQUIRED_COLUMNS]);
1073: 
1074:   const handleConfirm = () => {
1075:     if (missingRequired.length) {
1076:       setError(`Missing required columns: ${missingRequired.join(", ")}`);
1077:       return;
```

## Lines 1150–1208

```tsx
1150:   };
1151: 
1152:   const handleHeaderNameChange = (idx: number, value: string) => {
1153:     setHeaders((prev) =>
1154:       prev.map((h, i) => {
1155:         if (i !== idx) return h;
1156:         let nextStandardized = value.trim();
1157:         if (
1158:           !ALLOWED_COLUMNS.has(nextStandardized) &&
1159:           !REQUIRED_COLUMN_SET.has(nextStandardized)
1160:         ) {
1161:           nextStandardized = standardizeColumnName(value);
1162:         }
1163:         const classification = classifyColumn(nextStandardized);
1164:         const wasUnsupported = h.status === "unsupported";
1165:         const nextSelected =
1166:           classification.status === "required"
1167:             ? true
1168:             : classification.status === "supported"
1169:               ? true
1170:               : classification.status === "unsupported"
1171:                 ? wasUnsupported
1172:                   ? h.selected
1173:                   : false
1174:                 : h.selected;
1175:         return {
1176:           ...h,
1177:           standardized: nextStandardized,
1178:           status: classification.status,
1179:           selected: nextSelected,
1180:           error: classification.error,
1181:         };
1182:       }),
1183:     );
1184:   };
1185: 
1186:   const handleManualResolve = (name: string, playerId: number) => {
1187:     setAmbiguousChoices((prev) => ({ ...prev, [name]: playerId }));
1188:     const rec = rosterIndex.byId.get(playerId);
1189:     setManualSearchInputs((prev) => ({
1190:       ...prev,
1191:       [name]: rec?.fullName || prev[name] || "",
1192:     }));
1193:   };
1194: 
1195:   const handleManualClear = (name: string) => {
1196:     setAmbiguousChoices((prev) => {
1197:       const next = { ...prev };
1198:       if (Object.prototype.hasOwnProperty.call(next, name)) delete next[name];
1199:       return next;
1200:     });
1201:     setManualSearchInputs((prev) => {
1202:       const next = { ...prev };
1203:       if (Object.prototype.hasOwnProperty.call(next, name)) delete next[name];
1204:       return next;
1205:     });
1206:   };
1207: 
1208:   // ---- Derived hook values (must be before any early returns to preserve hook order) ----
```

## Lines 1518–1575

```tsx
1518:               {resolutionStats.totalRows > 0 && (
1519:                 <div
1520:                   style={{
1521:                     padding: "12px 16px",
1522:                     border: "1px solid #295644",
1523:                     borderRadius: 8,
1524:                     background: "rgba(41, 86, 68, 0.2)",
1525:                   }}
1526:                 >
1527:                   <h3 style={{ margin: "0 0 6px" }}>
1528:                     Name → ID Mapping Summary
1529:                   </h3>
1530:                   <p style={{ margin: 0, fontSize: 13 }}>
1531:                     Coverage: <strong>{coveragePercentDisplay}%</strong> (
1532:                     {mappedCount}/{resolutionStats.totalRows} rows mapped). ID
1533:                     matches: {resolutionStats.idMatched}, Name matches:{" "}
1534:                     {resolutionStats.nameMatched}
1535:                     {resolutionStats.fuzzyMatched > 0
1536:                       ? ` (fuzzy: ${resolutionStats.fuzzyMatched})`
1537:                       : ""}
1538:                     , Manual: {resolutionStats.manualOverrides}, Unresolved:{" "}
1539:                     {resolutionStats.unresolved}.
1540:                   </p>
1541:                   {resolutionStats.invalidIds > 0 && (
1542:                     <p
1543:                       style={{
1544:                         margin: "6px 0 0",
1545:                         fontSize: 12,
1546:                         color: "#ffb74d",
1547:                       }}
1548:                     >
1549:                       {resolutionStats.invalidIds} player_id value(s) not
1550:                       present in the roster were repaired via name matching.
1551:                     </p>
1552:                   )}
1553:                   {!localAllowFallback && hasUnresolvedRows && (
1554:                     <p
1555:                       style={{
1556:                         margin: "6px 0 0",
1557:                         fontSize: 12,
1558:                         color: "#ff8a80",
1559:                       }}
1560:                     >
1561:                       Name fallback is disabled. Unresolved rows will be ignored
1562:                       until mapped.
1563:                     </p>
1564:                   )}
1565:                 </div>
1566:               )}
1567:               {unresolvedNames.length > 0 && (
1568:                 <div>
1569:                   <div
1570:                     style={{
1571:                       display: "flex",
1572:                       justifyContent: "space-between",
1573:                       alignItems: "center",
1574:                       marginBottom: 6,
1575:                     }}
```

## Lines 1588–1678

```tsx
1588:                   {!collapseUnresolved && (
1589:                     <div
1590:                       style={{
1591:                         display: "flex",
1592:                         flexDirection: "column",
1593:                         gap: 12,
1594:                         maxHeight: 260,
1595:                         overflowY: "auto",
1596:                         paddingRight: 4,
1597:                       }}
1598:                     >
1599:                       {unresolvedNames.map((name) => {
1600:                         const searchValue = manualSearchInputs[name] ?? "";
1601:                         const normalized = searchValue.trim().toLowerCase();
1602:                         const baseSuggestions =
1603:                           rosterIndex.byStdName.get(stdName(name)) || [];
1604:                         const suggestionsMap = new Map<
1605:                           number,
1606:                           PlayerIndexRecord
1607:                         >();
1608:                         baseSuggestions.forEach((rec) =>
1609:                           suggestionsMap.set(rec.id, rec),
1610:                         );
1611:                         if (normalized.length >= 2) {
1612:                           dbPlayers
1613:                             .filter((p) =>
1614:                               p.fullName.toLowerCase().includes(normalized),
1615:                             )
1616:                             .slice(0, 12)
1617:                             .forEach((p) => {
1618:                               const rec =
1619:                                 rosterIndex.byId.get(p.id) ||
1620:                                 ({
1621:                                   id: p.id,
1622:                                   fullName: p.fullName,
1623:                                   position: p.position ?? null,
1624:                                   lastName: p.lastName ?? null,
1625:                                   teamId: p.teamId ?? null,
1626:                                   teamAbbrev: p.teamAbbrev ?? null,
1627:                                   std: stdName(p.fullName),
1628:                                 } as PlayerIndexRecord);
1629:                               suggestionsMap.set(rec.id, rec);
1630:                             });
1631:                         }
1632:                         const suggestionList = Array.from(
1633:                           suggestionsMap.values(),
1634:                         ).slice(0, 12);
1635:                         const selectedId = ambiguousChoices[name];
1636:                         const selectedPlayer =
1637:                           typeof selectedId === "number"
1638:                             ? rosterIndex.byId.get(selectedId)
1639:                             : undefined;
1640:                         return (
1641:                           <div
1642:                             key={name}
1643:                             style={{
1644:                               border: "1px solid #2f2f2f",
1645:                               borderRadius: 8,
1646:                               padding: "10px 12px",
1647:                               background: "rgba(255,255,255,0.03)",
1648:                             }}
1649:                           >
1650:                             <div
1651:                               style={{
1652:                                 display: "flex",
1653:                                 justifyContent: "space-between",
1654:                                 alignItems: "center",
1655:                                 gap: 8,
1656:                                 flexWrap: "wrap",
1657:                               }}
1658:                             >
1659:                               <strong>{name}</strong>
1660:                               {selectedPlayer && (
1661:                                 <span style={{ fontSize: 12, opacity: 0.8 }}>
1662:                                   Matched: {selectedPlayer.fullName}
1663:                                   {selectedPlayer.teamAbbrev
1664:                                     ? ` (${selectedPlayer.teamAbbrev}`
1665:                                     : ""}
1666:                                   {selectedPlayer.position
1667:                                     ? ` ${selectedPlayer.position})`
1668:                                     : selectedPlayer.teamAbbrev
1669:                                       ? ")"
1670:                                       : ""}
1671:                                 </span>
1672:                               )}
1673:                             </div>
1674:                             <div
1675:                               style={{
1676:                                 marginTop: 6,
1677:                                 display: "flex",
1678:                                 flexDirection: "column",
```


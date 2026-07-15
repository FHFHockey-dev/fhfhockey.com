import FantraxImportPanel, {
  type ManualImportPanelConfig,
} from "./FantraxImportPanel";

const ESPN_PANEL_CONFIG: ManualImportPanelConfig = {
  providerName: "ESPN",
  endpoint: "/api/v1/account/espn/import",
  panelId: "espn-import-title",
  accountLabelExample: "My ESPN leagues",
  description:
    "Import owner-supplied CSV or JSON without sharing ESPN credentials or browser cookies. Matching league/team keys update in place; omitted records are never deleted.",
};

export default function EspnImportPanel() {
  return <FantraxImportPanel config={ESPN_PANEL_CONFIG} />;
}

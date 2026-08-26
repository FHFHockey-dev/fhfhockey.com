import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

import styles from "./DraftDashboard.module.scss";

export const MOBILE_DRAFT_TABS = [
  { id: "setup", label: "Setup" },
  { id: "suggested", label: "Suggested" },
  { id: "players", label: "Players" },
  { id: "roster", label: "Roster" },
  { id: "board", label: "Board" },
] as const;

export type MobileDraftTab = (typeof MOBILE_DRAFT_TABS)[number]["id"];

export const MOBILE_DRAFT_TAB_STORAGE_KEY = "draftDashboard.mobileTab.v1";

export function useMobileDraftTab() {
  const [activeTab, setActiveTab] = useState<MobileDraftTab>("setup");
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const saved = window.sessionStorage.getItem(MOBILE_DRAFT_TAB_STORAGE_KEY);
    if (MOBILE_DRAFT_TABS.some((tab) => tab.id === saved)) {
      setActiveTab(saved as MobileDraftTab);
    }
    setInitialized(true);
  }, []);

  useEffect(() => {
    if (!initialized) return;
    window.sessionStorage.setItem(MOBILE_DRAFT_TAB_STORAGE_KEY, activeTab);
  }, [activeTab, initialized]);

  return [activeTab, setActiveTab] as const;
}

export default function MobileDraftTabs({
  activeTab,
  onChange,
}: {
  activeTab: MobileDraftTab;
  onChange: (tab: MobileDraftTab) => void;
}) {
  const tabListRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    let nextIndex = index;
    if (event.key === "ArrowRight") {
      nextIndex = (index + 1) % MOBILE_DRAFT_TABS.length;
    } else if (event.key === "ArrowLeft") {
      nextIndex =
        (index - 1 + MOBILE_DRAFT_TABS.length) % MOBILE_DRAFT_TABS.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = MOBILE_DRAFT_TABS.length - 1;
    } else {
      return;
    }
    event.preventDefault();
    const nextTab = MOBILE_DRAFT_TABS[nextIndex];
    onChange(nextTab.id);
    tabListRef.current
      ?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
      [nextIndex]?.focus();
  };

  return (
    <div
      ref={tabListRef}
      className={styles.mobileTabs}
      role="tablist"
      aria-label="Draft Dashboard workspace"
    >
      {MOBILE_DRAFT_TABS.map((tab, index) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          id={`mobile-draft-tab-${tab.id}`}
          aria-controls={`mobile-draft-panel-${tab.id}`}
          aria-selected={activeTab === tab.id}
          tabIndex={activeTab === tab.id ? 0 : -1}
          className={`${styles.mobileTab} ${activeTab === tab.id ? styles.mobileTabActive : ""}`}
          onClick={() => onChange(tab.id)}
          onKeyDown={(event) => handleKeyDown(event, index)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

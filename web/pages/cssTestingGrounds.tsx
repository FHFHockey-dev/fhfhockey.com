import type { CSSProperties } from "react";
import Head from "next/head";

import styles from "./cssTestingGrounds.module.scss";

type ShowcaseStatus = "review" | "approved" | "planned";

interface ShowcaseItem {
  id: string;
  title: string;
  family: string;
  status: ShowcaseStatus;
  notes: string;
}

interface ShowcaseSection {
  id: string;
  title: string;
  description: string;
  items: ShowcaseItem[];
}

const reviewQueue: ShowcaseItem[] = [
  {
    id: "new-review-slot",
    title: "Next Element Under Review",
    family: "Reserved top slot",
    status: "planned",
    notes:
      "When a new primitive is being reviewed, add it here first so it appears at the top of the sandbox."
  }
];

// Move any currently reviewed showcase section IDs here so they render near the top
// of the page without disturbing their long-term home further down.
const pinnedShowcaseSectionIds = ["controls"];

const showcaseSections: ShowcaseSection[] = [
  {
    id: "page-shells",
    title: "Page Shells And Headers",
    description:
      "Use this group to validate page-level hierarchy, header bands, subheaders, metadata rows, and section spacing before moving deeper into component primitives.",
    items: [
      {
        id: "dashboard-shell",
        title: "Dashboard shell",
        family: "Page shell",
        status: "planned",
        notes:
          "Primary reference for bento-style dashboards, page padding, and page title stack."
      },
      {
        id: "data-shell",
        title: "Data-page shell",
        family: "Page shell",
        status: "planned",
        notes:
          "Softer analytics shell for `underlying-stats`, tables, and chart-led pages."
      }
    ]
  },
  {
    id: "surfaces",
    title: "Panels, Cards, And States",
    description:
      "Use this group for standard panels, softened panels, spotlight cards, empty states, loading blocks, and alert/status surfaces.",
    items: [
      {
        id: "standard-panel",
        title: "Standard panel",
        family: "Panel",
        status: "planned",
        notes:
          "Canonical default shell for dashboard and table surfaces."
      },
      {
        id: "accent-card",
        title: "Left-accent card",
        family: "Card",
        status: "planned",
        notes:
          "Reference for recommendation cards, insight cards, and spotlight modules."
      },
      {
        id: "empty-state",
        title: "Empty state",
        family: "State block",
        status: "planned",
        notes:
          "Show empty, loading, and error states without replacing the parent panel shell."
      }
    ]
  },
  {
    id: "controls",
    title: "Controls And Inputs",
    description:
      "Use this group for buttons, segmented toggles, search inputs, selects, dropdown triggers, steppers, and compact filter rows.",
    items: [
      {
        id: "button-set",
        title: "Button set",
        family: "Controls",
        status: "planned",
        notes:
          "Primary, secondary, ghost, and compact dashboard buttons should be reviewed together."
      },
      {
        id: "segmented-toggle",
        title: "Segmented toggle",
        family: "Controls",
        status: "planned",
        notes:
          "Review active, hover, focus, and disabled states as one grouped control."
      },
      {
        id: "search-row",
        title: "Search and filter row",
        family: "Controls",
        status: "planned",
        notes:
          "Use this area to validate input density, dropdown sizing, and row wrapping behavior."
      }
    ]
  },
  {
    id: "data-display",
    title: "Tables And Charts",
    description:
      "Use this group for sticky-header tables, compact stat tables, chart frames, legends, and toolbar treatments.",
    items: [
      {
        id: "table-shell",
        title: "Analytics table",
        family: "Table",
        status: "planned",
        notes:
          "Review sticky headers, numeric alignment, density, row states, and empty rows."
      },
      {
        id: "chart-frame",
        title: "Chart frame",
        family: "Chart",
        status: "planned",
        notes:
          "Review chart container spacing, toolbar placement, legend treatment, and support notes."
      }
    ]
  }
];

const statusLabel: Record<ShowcaseStatus, string> = {
  review: "In review",
  approved: "Approved",
  planned: "Planned"
};

const statusColor: Record<ShowcaseStatus, string> = {
  review: "#ffc857",
  approved: "#00c896",
  planned: "#07aae2"
};

function renderGuideRefs(refs: string[]) {
  return (
    <div className={styles.guideRefs}>
      {refs.map((ref) => (
        <span key={ref} className={styles.guideRefChip}>
          {ref}
        </span>
      ))}
    </div>
  );
}

function renderShowcaseExamples(sectionId: string) {
  switch (sectionId) {
    case "page-shells":
      return (
        <div className={styles.exampleStack}>
          <div className={styles.exampleGridTwo}>
            <article className={styles.demoShell}>
              <header className={styles.demoPageHeader}>
                <div className={styles.demoTitleStack}>
                  <p className={styles.demoEyebrow}>Dashboard shell</p>
                  <h3 className={styles.demoHeading}>Draft Dashboard Layout</h3>
                  {renderGuideRefs(["6.1 Dashboard Pages", "6.3 Bento-Box Pages", "9.1 Page Shells"])}
                  <p className={styles.demoCopy}>
                    Compact title stack, metadata row, and a bento workspace with
                    a clear primary panel.
                  </p>
                </div>
                <div className={styles.demoMetaRow}>
                  <span className={styles.demoPill}>12-team</span>
                  <span className={styles.demoPill}>Snake</span>
                  <span className={styles.demoPill}>Live mock</span>
                </div>
              </header>

              <div className={styles.demoBento}>
                <article className={styles.demoPanel}>
                  <div className={styles.demoPanelHeader}>
                    <strong>Settings</strong>
                    <span>Compact controls</span>
                  </div>
                  <div className={styles.demoPanelBody}>
                    <div className={styles.demoMetricRow}>
                      <span>Format</span>
                      <strong>Head-to-Head</strong>
                    </div>
                    <div className={styles.demoMetricRow}>
                      <span>Rounds</span>
                      <strong>16</strong>
                    </div>
                  </div>
                </article>

                <article className={styles.demoPanelStrong}>
                  <div className={styles.demoPanelHeader}>
                    <strong>Primary workspace</strong>
                    <span>Emphasized center panel</span>
                  </div>
                  <div className={styles.demoPanelBody}>
                    <div className={styles.demoStatGrid}>
                      <div>
                        <span>Queue</span>
                        <strong>4 players</strong>
                      </div>
                      <div>
                        <span>Pick</span>
                        <strong>1.07</strong>
                      </div>
                      <div>
                        <span>Timer</span>
                        <strong>00:31</strong>
                      </div>
                    </div>
                  </div>
                </article>

                <article className={styles.demoPanel}>
                  <div className={styles.demoPanelHeader}>
                    <strong>Supporting rail</strong>
                    <span>Recommendations</span>
                  </div>
                  <div className={styles.demoPanelBody}>
                    <div className={styles.demoMetricRow}>
                      <span>Best value</span>
                      <strong>Skater A</strong>
                    </div>
                    <div className={styles.demoMetricRow}>
                      <span>Needs</span>
                      <strong>LW, D</strong>
                    </div>
                  </div>
                </article>
              </div>
            </article>

            <article className={styles.demoShellSoft}>
              <header className={styles.demoPageHeader}>
                <div className={styles.demoTitleStack}>
                  <p className={styles.demoEyebrow}>Data page shell</p>
                  <h3 className={styles.demoHeading}>Underlying Stats Surface</h3>
                  {renderGuideRefs(["6.2 Data Pages", "9.1 Page Shells", "10.1 Page Shell"])}
                  <p className={styles.demoCopy}>
                    Softer header treatment, tighter filters, and flatter panels
                    for analytics-first pages.
                  </p>
                </div>
                <div className={styles.demoMetaRow}>
                  <span className={styles.demoPill}>2025-26</span>
                  <span className={styles.demoPill}>Skaters</span>
                </div>
              </header>

              <div className={styles.demoFilterBar}>
                <input
                  className={styles.demoSearch}
                  type="search"
                  value="Connor McDavid"
                  readOnly
                  aria-label="Example search"
                />
                <select className={styles.demoSelect} aria-label="Example split">
                  <option>5v5 rate</option>
                </select>
                <select className={styles.demoSelect} aria-label="Example season">
                  <option>Last 30 days</option>
                </select>
              </div>

              <div className={styles.demoSectionHeader}>
                <div className={styles.demoTitleStack}>
                  <h4 className={styles.demoSubheading}>Section Header</h4>
                  <p className={styles.demoCopy}>
                    Standard pattern for sub-sections inside data and dashboard
                    pages.
                  </p>
                </div>
                <div className={styles.demoActionRow}>
                  <button className={styles.buttonGhost} type="button">
                    Export
                  </button>
                  <button className={styles.buttonPrimary} type="button">
                    Refresh
                  </button>
                </div>
              </div>
            </article>
          </div>
        </div>
      );
    case "surfaces":
      return (
        <div className={styles.exampleGridThree}>
          <article className={styles.demoPanel}>
            <div className={styles.demoPanelHeader}>
              <strong>Standard Panel</strong>
              <span>Default shell</span>
            </div>
            <div className={styles.demoPanelBody}>
              {renderGuideRefs(["9.2 Panels", "10.2 Standard Panel"])}
              <p className={styles.demoCopy}>
                Use this for most dashboard and table containers.
              </p>
              <div className={styles.demoStatGrid}>
                <div>
                  <span>Rows</span>
                  <strong>48</strong>
                </div>
                <div>
                  <span>Updated</span>
                  <strong>2 min ago</strong>
                </div>
              </div>
            </div>
          </article>

          <article className={styles.demoPanelSoft}>
            <div className={styles.demoPanelHeader}>
              <strong>Softened Data Panel</strong>
              <span>Flatter analytics shell</span>
            </div>
            <div className={styles.demoPanelBody}>
              {renderGuideRefs(["7.6 Data-Page Softened Treatment", "9.2 Panels", "10.3 Softened Data Panel"])}
              <p className={styles.demoCopy}>
                Use this when the data should carry the emphasis instead of the
                chrome.
              </p>
              <div className={styles.demoMetricRow}>
                <span>Filters</span>
                <strong>4 active</strong>
              </div>
            </div>
          </article>

          <article className={styles.demoAccentCard}>
            <div className={styles.demoPanelHeader}>
              <strong>Left-Accent Card</strong>
              <span>Spotlight / recommendation</span>
            </div>
            <div className={styles.demoPanelBody}>
              {renderGuideRefs(["9.3 Cards", "9.12 Recommendation Rails", "10.4 Left-Accent Card"])}
              <p className={styles.demoCopy}>
                Use the flat accent strip for recommendation rails and insight
                cards. Do not replace it with a full-card gradient.
              </p>
              <div className={styles.demoMetricRow}>
                <span>Recommendation</span>
                <strong>Prioritize PP1 exposure</strong>
              </div>
            </div>
          </article>

          <article className={styles.demoStateCard}>
            <div className={styles.demoPanelHeader}>
              <strong>Empty State</strong>
              <span>In-panel messaging</span>
            </div>
            {renderGuideRefs(["9.2 Panels", "10.10 Empty State"])}
            <div className={styles.demoEmptyState}>
              <strong>No matching players</strong>
              <p>
                Adjust your filters or search term. Keep empty states inside the
                parent shell.
              </p>
            </div>
          </article>

          <article className={styles.demoStateCard}>
            <div className={styles.demoPanelHeader}>
              <strong>Loading Banner</strong>
              <span>Transient page state</span>
            </div>
            {renderGuideRefs(["9.2 Panels", "12. Implementation Checklist For Codex"])}
            <div className={styles.demoLoadingBanner}>
              <span className={styles.demoLoadingDot} aria-hidden="true" />
              Refreshing player summary rows
            </div>
          </article>
        </div>
      );
    case "controls":
      return (
        <div className={styles.exampleGridThree}>
          <article className={styles.demoControlBlock}>
            <div className={styles.demoPanelHeader}>
              <strong>Buttons</strong>
              <span>GameGrid date/action controls</span>
            </div>
            {renderGuideRefs(["9.4 Buttons", "10.5 Primary Button"])}
            <div className={styles.buttonNavGroup}>
              <button className={styles.buttonNav} type="button">
                Prev week
              </button>
              <button className={styles.buttonNavActive} type="button">
                Current
              </button>
              <button className={styles.buttonNav} type="button">
                Next week
              </button>
            </div>
            <div className={styles.demoButtonRow}>
              <button className={styles.buttonPrimary} type="button">
                Refresh grid
              </button>
              <button className={styles.buttonSecondary} type="button">
                Save view
              </button>
              <button className={styles.buttonGhost} type="button">
                Reset
              </button>
            </div>
          </article>

          <article className={styles.demoControlBlock}>
            <div className={styles.demoPanelHeader}>
              <strong>Segmented Toggle</strong>
              <span>One grouped control</span>
            </div>
            {renderGuideRefs(["9.5 Segmented Toggles", "10.6 Segmented Toggle"])}
            <div className={styles.segmentRail} role="tablist" aria-label="Example toggle">
              <button className={styles.segment} type="button">
                Overview
              </button>
              <button
                className={`${styles.segment} ${styles.segmentActive}`}
                type="button"
              >
                Rates
              </button>
              <button className={styles.segment} type="button">
                Trends
              </button>
            </div>
          </article>

          <article className={styles.demoControlBlock}>
            <div className={styles.demoPanelHeader}>
              <strong>Search / Inputs</strong>
              <span>Compact filter row</span>
            </div>
            {renderGuideRefs(["9.6 Inputs And Selects", "9.7 Filter Bars And Control Rows", "10.7 Input / Select"])}
            <div className={styles.demoFilterBar}>
              <input
                className={styles.demoSearch}
                type="search"
                placeholder="Search players"
                aria-label="Example search input"
              />
              <select className={styles.demoSelect} aria-label="Example position">
                <option>Position</option>
                <option>Center</option>
                <option>Wing</option>
                <option>Defense</option>
              </select>
              <select className={styles.demoSelect} aria-label="Example team">
                <option>Team</option>
                <option>FLA</option>
                <option>EDM</option>
                <option>CAR</option>
              </select>
            </div>
            <div className={styles.demoInputRow}>
              <input
                className={styles.demoField}
                type="text"
                value="Minimum TOI"
                readOnly
                aria-label="Example text input"
              />
              <div className={styles.stepper}>
                <button className={styles.stepperButton} type="button">
                  -
                </button>
                <span className={styles.stepperValue}>12</span>
                <button className={styles.stepperButton} type="button">
                  +
                </button>
              </div>
              <div className={styles.demoDropdown}>
                <button
                  className={styles.dropdownTrigger}
                  type="button"
                  aria-expanded="true"
                  aria-haspopup="menu"
                >
                  <span>Actions</span>
                  <span className={styles.dropdownCaret} aria-hidden="true">
                    ▾
                  </span>
                </button>
                <div className={styles.dropdownMenu} role="menu" aria-label="Example actions menu">
                  <button className={styles.dropdownItem} type="button" role="menuitem">
                    Pin metric
                  </button>
                  <button className={styles.dropdownItem} type="button" role="menuitem">
                    Export CSV
                  </button>
                  <button className={styles.dropdownItem} type="button" role="menuitem">
                    Open detail
                  </button>
                  <button className={styles.dropdownItem} type="button" role="menuitem">
                    Compare to league
                  </button>
                  <button className={styles.dropdownItem} type="button" role="menuitem">
                    Add to watchlist
                  </button>
                </div>
              </div>
            </div>
          </article>
        </div>
      );
    case "data-display":
      return (
        <div className={styles.exampleGridTwo}>
          <article className={styles.demoTablePanel}>
            <div className={styles.demoPanelHeader}>
              <strong>Analytics Table</strong>
              <span>Sticky header, compact rows</span>
            </div>
            {renderGuideRefs(["6.4 Table-Heavy Pages", "9.9 Tables", "10.8 Table Shell"])}
            <div className={styles.tableWrap}>
              <table className={styles.demoTable}>
                <thead>
                  <tr>
                    <th>Player</th>
                    <th>Team</th>
                    <th className={styles.numericCell}>xGF/60</th>
                    <th className={styles.numericCell}>Shots/60</th>
                    <th className={styles.numericCell}>IPP</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className={styles.currentRow}>
                    <td>Connor McDavid</td>
                    <td>EDM</td>
                    <td className={styles.numericCell}>3.48</td>
                    <td className={styles.numericCell}>10.7</td>
                    <td className={styles.numericCell}>81.2%</td>
                  </tr>
                  <tr>
                    <td>Nikita Kucherov</td>
                    <td>TBL</td>
                    <td className={styles.numericCell}>3.19</td>
                    <td className={styles.numericCell}>9.8</td>
                    <td className={styles.numericCell}>78.6%</td>
                  </tr>
                  <tr>
                    <td>Cale Makar</td>
                    <td>COL</td>
                    <td className={styles.numericCell}>2.44</td>
                    <td className={styles.numericCell}>8.4</td>
                    <td className={styles.numericCell}>69.3%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </article>

          <article className={styles.demoChartPanel}>
            <div className={styles.demoPanelHeader}>
              <strong>Chart Frame</strong>
              <span>Toolbar + legend + notes</span>
            </div>
            {renderGuideRefs(["6.5 Chart Pages", "9.10 Chart Containers", "10.9 Chart Frame"])}
            <div className={styles.chartToolbar}>
              <button
                className={`${styles.toolbarChip} ${styles.toolbarChipActive}`}
                type="button"
              >
                30 days
              </button>
              <button className={styles.toolbarChip} type="button">
                Season
              </button>
              <button className={styles.toolbarChip} type="button">
                Per 60
              </button>
            </div>
            <div className={styles.chartFrame}>
              <div className={styles.chartGrid} aria-hidden="true" />
              <div className={styles.chartBars}>
                <span className={styles.chartBarShort} />
                <span className={styles.chartBarMid} />
                <span className={styles.chartBarTall} />
                <span className={styles.chartBarMid} />
                <span className={styles.chartBarShort} />
              </div>
            </div>
            <div className={styles.chartLegend}>
              <span className={styles.legendItem}>
                <span className={styles.legendSwatchPrimary} />
                Current sample
              </span>
              <span className={styles.legendItem}>
                <span className={styles.legendSwatchSecondary} />
                Baseline range
              </span>
            </div>
            <p className={styles.chartNote}>
              Chart notes belong inside the frame block, below the visualization.
            </p>
          </article>
        </div>
      );
    default:
      return null;
  }
}

const pinnedShowcaseSections = pinnedShowcaseSectionIds
  .map((sectionId) => showcaseSections.find((section) => section.id === sectionId))
  .filter((section): section is ShowcaseSection => Boolean(section));

export default function CssTestingGroundsPage() {
  return (
    <>
      <Head>
        <title>CSS Testing Grounds</title>
      </Head>

      <main className={styles.page}>
        <div className={styles.content}>
          <section className={styles.hero}>
            <p className={styles.eyebrow}>Style Sandbox</p>
            <h1 className={styles.title}>CSS Testing Grounds</h1>
            <p className={styles.heroCopy}>
              This page is the review surface for canonical UI primitives. New
              or revised showcase items should be inserted at the top of the
              page while they are under review, then retained or reorganized
              into their long-term section after approval.
            </p>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionTitleBlock}>
                <h2 className={styles.sectionTitle}>Review Queue</h2>
                <p className={styles.sectionDescription}>
                  Always place the active approval target here first.
                </p>
              </div>
              <span className={styles.queueBadge}>Top of page only</span>
            </div>

            <div className={styles.cardGrid}>
              {reviewQueue.map((item) => (
                <article
                  key={item.id}
                  className={styles.showcaseCard}
                  style={
                    { "--status-color": statusColor[item.status] } as CSSProperties
                  }
                >
                  <div className={styles.cardTop}>
                    <strong className={styles.cardTitle}>{item.title}</strong>
                    <span className={styles.cardStatus}>
                      {statusLabel[item.status]}
                    </span>
                  </div>
                  <p className={styles.cardFamily}>{item.family}</p>
                  <p className={styles.cardNotes}>{item.notes}</p>
                </article>
              ))}
            </div>
          </section>

          {pinnedShowcaseSections.length > 0 && (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <div className={styles.sectionTitleBlock}>
                  <h2 className={styles.sectionTitle}>Pinned Review Surface</h2>
                  <p className={styles.sectionDescription}>
                    Keep active review targets here while iterating, then leave
                    the canonical copy in its long-term section below.
                  </p>
                </div>
                <span className={styles.queueBadge}>Pinned to top</span>
              </div>

              {pinnedShowcaseSections.map((section) => (
                <div key={section.id} className={styles.pinnedBlock}>
                  <header className={styles.pinnedHeader}>
                    <div className={styles.sectionTitleBlock}>
                      <p className={styles.pinnedEyebrow}>Pinned from</p>
                      <h3 className={styles.sectionTitle}>{section.title}</h3>
                      <p className={styles.sectionDescription}>
                        {section.description}
                      </p>
                    </div>
                  </header>
                  {renderShowcaseExamples(section.id)}
                </div>
              ))}
            </section>
          )}

          {showcaseSections.map((section) => (
            <section key={section.id} className={styles.section}>
              <header className={styles.sectionTitleBlock}>
                <h2 className={styles.sectionTitle}>{section.title}</h2>
                {section.id === "page-shells" &&
                  renderGuideRefs(["6. Page Archetypes", "9.1 Page Shells", "10.1 Page Shell"])}
                {section.id === "surfaces" &&
                  renderGuideRefs(["7. Token System", "9.2 Panels", "9.3 Cards"])}
                {section.id === "controls" &&
                  renderGuideRefs(["9.4 Buttons", "9.5 Segmented Toggles", "9.6 Inputs And Selects", "9.7 Filter Bars And Control Rows"])}
                {section.id === "data-display" &&
                  renderGuideRefs(["6.4 Table-Heavy Pages", "6.5 Chart Pages", "9.9 Tables", "9.10 Chart Containers"])}
                <p className={styles.sectionDescription}>{section.description}</p>
              </header>

              {renderShowcaseExamples(section.id)}

              <div className={styles.cardGrid}>
                {section.items.map((item) => (
                  <article
                    key={item.id}
                    className={styles.showcaseCard}
                    style={
                      { "--status-color": statusColor[item.status] } as CSSProperties
                    }
                  >
                    <div className={styles.cardTop}>
                      <strong className={styles.cardTitle}>{item.title}</strong>
                      <span className={styles.cardStatus}>
                        {statusLabel[item.status]}
                      </span>
                    </div>
                    <p className={styles.cardFamily}>{item.family}</p>
                    <p className={styles.cardNotes}>{item.notes}</p>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>
    </>
  );
}

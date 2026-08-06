import type { Meta, StoryObj } from "@storybook/react";

import SustainabilityBadge from "components/sustainability/SustainabilityBadge";
import SustainabilitySparkline from "components/sustainability/SustainabilitySparkline";
import SustainabilityTooltip from "components/sustainability/SustainabilityTooltip";

function SustainabilityUiStory() {
  return (
    <div style={{ display: "grid", gap: 12, maxWidth: 520 }}>
      <SustainabilityBadge score={72.4} thresholds={{ lower: 40, upper: 60 }} />
      <SustainabilityBadge score={35.2} thresholds={{ lower: 40, upper: 60 }} status="provisional" />
      <SustainabilitySparkline points={[
        { snapshot_date: "2026-03-18", s_100: 42 },
        { snapshot_date: "2026-03-19", s_100: 55 },
        { snapshot_date: "2026-03-20", s_100: 61 }
      ]} />
      <SustainabilityTooltip components={[
        { metric: "Shooting %", contrib: -1.2, z_raw: 1.4, z_soft: 1.4, r: null, n: null }
      ]} />
    </div>
  );
}

const meta = {
  title: "Sustainability/Player signal",
  component: SustainabilityUiStory
} satisfies Meta<typeof SustainabilityUiStory>;

export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};

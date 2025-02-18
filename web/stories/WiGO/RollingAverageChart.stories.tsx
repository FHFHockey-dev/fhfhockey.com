import { Meta, StoryObj } from "@storybook/react";
import RollingAverageChart from "components/WiGO/GameScoreLineChart/RollingAverageChart";

const meta: Meta<typeof RollingAverageChart> = {
  component: RollingAverageChart,
};

export default meta;
type Story = StoryObj<typeof RollingAverageChart>;

export const Primary: Story = {
  args: {
    data: [
      100, 120, 130, 110, 150, 140, 160, 170, 180, 200, 220, 210, 240, 230, 250,
    ],
    windowSizes: [5, 10],
  },
};

export const CustomWindowSizes: Story = {
  args: {
    data: [
      100, 120, 130, 110, 150, 140, 160, 170, 180, 200, 220, 210, 240, 230, 250,
    ],
    windowSizes: [3, 7],
  },
};

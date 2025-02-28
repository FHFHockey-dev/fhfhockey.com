import { Meta, StoryObj } from "@storybook/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import GameScoreLineChart from "components/WiGO/GameScoreLineChart";

const queryClient = new QueryClient();

const meta: Meta<typeof GameScoreLineChart> = {
  component: GameScoreLineChart,
  decorators: (Story) => (
    <QueryClientProvider client={queryClient}>
      <div style={{ backgroundColor: "#202020" }}>{Story()}</div>
    </QueryClientProvider>
  ),
};

export default meta;
type Story = StoryObj<typeof GameScoreLineChart>;

export const Primary: Story = {
  args: {
    playerId: 8471675,
  },
};

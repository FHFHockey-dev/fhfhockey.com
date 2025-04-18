// components/WiGO/RollingAverageChart.tsx
import React, { useRef } from "react";
import { Chart } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement, // Make sure BarElement is registered if using bars
  Title,
  Tooltip,
  Legend, // Keep Legend registered if options might enable it
  Filler, // Keep Filler registered if datasets use fill
  LineController,
  BarController,
  ChartOptions,
  ChartData,
  ChartType // Import ChartType
} from "chart.js";

// Register Chart.js components (ensure all needed types are registered)
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  LineController,
  BarController
);

// Define props types for the simplified component
interface RollingAverageChartProps {
  chartType: ChartType; // e.g., 'bar' or 'line' as the base type
  chartData: ChartData<any, (number | null)[], string>; // Pass the whole data object
  chartOptions: ChartOptions<any>; // Pass the whole options object
}

// Simplified presentational component
const RollingAverageChart: React.FC<RollingAverageChartProps> = ({
  chartType,
  chartData,
  chartOptions
}) => {
  const chartRef = useRef<ChartJS | null>(null);

  // Basic validation
  if (!chartData || !chartOptions) {
    console.warn("RollingAverageChart missing chartData or chartOptions");
    return null; // Or render an error/placeholder
  }

  return (
    // The wrapping div with styles.chartCanvasContainer is now in the parent (GameScoreSection)
    // This component just renders the Chart.js canvas
    <Chart
      ref={chartRef}
      type={chartType} // Use the passed base type
      data={chartData}
      options={chartOptions}
    />
  );
};

export default RollingAverageChart;

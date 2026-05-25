import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { NumberFrequency } from '../api';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip);

interface Props {
  frequencies: NumberFrequency[];
}

export default function FrequencyChart({ frequencies }: Props) {
  const colorMap: Record<string, string> = {
    red: '#c0392b',
    black: '#2c3e50',
    green: '#27ae60',
  };

  const data = {
    labels: frequencies.map(f => f.number.toString()),
    datasets: [
      {
        data: frequencies.map(f => f.count),
        backgroundColor: frequencies.map(f => colorMap[f.color]),
        borderRadius: 2,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: any) => {
            const freq = frequencies[ctx.dataIndex];
            return `${freq.count}x (${freq.percentage}%)`;
          },
        },
      },
    },
    scales: {
      x: {
        ticks: { color: '#888', font: { size: 10 } },
        grid: { display: false },
      },
      y: {
        ticks: { color: '#888' },
        grid: { color: '#333' },
      },
    },
  };

  return (
    <div style={{ height: 250 }}>
      <Bar data={data} options={options} />
    </div>
  );
}

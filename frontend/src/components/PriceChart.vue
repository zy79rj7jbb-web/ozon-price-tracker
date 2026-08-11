<script setup>
import { computed } from "vue";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
} from "chart.js";
import { Line } from "vue-chartjs";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
);

const props = defineProps({
  chart: {
    type: Object,
    required: true,
  },

  target: {
    type: Object,
    default: null,
  },

  period: {
    type: String,
    default: "24h",
  },
});

const points = computed(() => props.chart.points);

const chartData = computed(() => {
  const measuredData = points.value.map((point) => {
    return point.measured ? point.price : null;
  });

  const lastKnownData = points.value.map((point, index) => {
    if (point.measured) {
      return point.price;
    }

    const previousPoint = points.value[index - 1];

    if (!previousPoint) {
      return null;
    }

    return point.price;
  });

  const datasets = [
    {
      label: "Цена",

      data: measuredData,

      borderColor: "#2563eb",
      backgroundColor: "#2563eb",

      borderWidth: 2,
      tension: 0.2,

      pointRadius: points.value.map((point) => (point.measured ? 4 : 0)),

      pointHoverRadius: 6,

      spanGaps: false,
    },

    {
      label: "Последняя известная",

      data: lastKnownData,

      borderColor: "#93c5fd",
      backgroundColor: "#93c5fd",

      borderWidth: 2,
      borderDash: [5, 5],
      tension: 0.2,

      pointRadius: 0,
      pointHoverRadius: 6,

      spanGaps: false,
    },
  ];

  if (props.target?.price != null) {
    datasets.push({
      label: "Целевая цена",

      data: points.value.map(() => props.target.price),

      borderColor: "#dc2626",
      borderWidth: 2,
      borderDash: [6, 6],

      pointRadius: 0,
      pointHoverRadius: 0,

      tension: 0,
    });
  }

  return {
    labels: points.value.map((point) => point.timestamp.slice(11, 16)),

    datasets,
  };
});
const priceRange = computed(() => {
  const prices = points.value
    .map((point) => point.price)
    .filter((price) => Number.isFinite(price));

  if (props.target?.price != null) {
    prices.push(props.target.price);
  }

  if (prices.length === 0) {
    return {
      min: undefined,
      max: undefined,
    };
  }

  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);

  const range = maxPrice - minPrice;

  const padding = range === 0 ? Math.max(minPrice * 0.05, 50) : range * 0.15;

  return {
    min: Math.floor(minPrice - padding),
    max: Math.ceil(maxPrice + padding),
  };
});

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,

  interaction: {
    intersect: false,
    mode: "index",
  },

  plugins: {
    legend: {
      display: true,

      position: "top",

      align: "start",

      labels: {
        color: "#374151",

        usePointStyle: true,

        pointStyle: "line",

        boxWidth: 32,

        boxHeight: 2,

        padding: 20,

        font: {
          size: 13,
        },
      },
    },

    tooltip: {
      callbacks: {
        title: (items) => {
          const index = items[0].dataIndex;
          const point = points.value[index];

          if (!point) {
            return "";
          }

          const date = new Date(point.timestamp.replace(" ", "T"));

          return date.toLocaleString("ru-RU", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });
        },

        label: (context) => {
          const index = context.dataIndex;
          const point = points.value[index];

          if (!point) {
            return "";
          }

          if (context.dataset.label === "Целевая цена") {
            return `Целевая цена: ${context.parsed.y} ₽`;
          }

          if (context.dataset.label === "Последняя известная") {
            return `Цена: ${point.price} ₽`;
          }

          return `Цена: ${point.price} ₽`;
        },

        afterLabel: (context) => {
          const index = context.dataIndex;
          const point = points.value[index];

          if (!point) {
            return "";
          }

          if (context.dataset.label === "Целевая цена") {
            return "";
          }

          if (context.dataset.label === "Последняя известная") {
            const measuredDate = new Date(point.measured_at.replace(" ", "T"));

            return [
              "Последняя известная цена",
              `Реально получена: ${measuredDate.toLocaleString("ru-RU", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}`,
            ];
          }

          return "Реальное измерение Ozon";
        },
      },
    },
  },

  scales: {
    x: {
      grid: {
        color: "#e5e7eb",
      },

      ticks: {
        color: "#6b7280",

        autoSkip: true,
        maxTicksLimit: 8,

        callback: function (value, index) {
          const timestamp = points.value[index]?.timestamp;

          if (!timestamp) {
            return "";
          }

          const date = new Date(timestamp.replace(" ", "T"));

          if (props.period === "24h") {
            return date.toLocaleTimeString("ru-RU", {
              hour: "2-digit",
              minute: "2-digit",
            });
          }

          if (props.period === "7d") {
            return date.toLocaleDateString("ru-RU", {
              day: "2-digit",
              month: "short",
            });
          }

          if (props.period === "30d") {
            return date.toLocaleDateString("ru-RU", {
              day: "2-digit",
              month: "short",
            });
          }

          return "";
        },
      },
    },

    y: {
      min: priceRange.value.min,
      max: priceRange.value.max,

      grid: {
        color: "#e5e7eb",
      },

      ticks: {
        color: "#6b7280",

        callback: (value) => `${value} ₽`,
      },
    },
  },
}));
</script>

<template>
  <div class="price-chart">
    <Line :data="chartData" :options="chartOptions" />
  </div>
</template>

<style scoped>
.price-chart {
  height: 360px;
  margin-top: 24px;
  padding: 20px;
  background: #ffffff;
  border-radius: 16px;
}
</style>

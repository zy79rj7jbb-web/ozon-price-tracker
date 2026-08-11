<script setup>
import { computed, ref } from "vue";
import PriceChart from "./PriceChart.vue";

const props = defineProps({
  productData: {
    type: Object,
    required: true,
  },
});

const emit = defineEmits(["back", "change-period"]);
const selectedPeriod = ref("24h");

const periodData = computed(() => {
  return props.productData.periods[selectedPeriod.value];
});

function changePeriod(period) {
  selectedPeriod.value = period;
  emit("change-period", period);
}
</script>

<template>
  <button @click="changePeriod('24h')">24 часа</button>

  <button @click="changePeriod('7d')">7 дней</button>

  <button @click="changePeriod('30d')">30 дней</button>
  <section>
    <h3>Статистика</h3>

    <p>
      Изменение:
      {{ periodData.change }} ₽
    </p>

    <p>
      Изменение:
      {{ periodData.change_percent }}%
    </p>

    <p>
      Минимум:
      {{ periodData.min_price }} ₽
    </p>

    <p>
      Средняя:
      {{ periodData.average_price }} ₽
    </p>

    <p>
      Максимум:
      {{ periodData.max_price }} ₽
    </p>

    <p>
      Измерений:
      {{ periodData.measurements }}
    </p>
  </section>
  <p>
    История:
    {{ periodData.history_status }}
  </p>
  <section>
    <button @click="$emit('back')">← Назад</button>

    <h2>{{ productData.product.name }}</h2>

    <p>Ozon ID: {{ productData.product.ozon_product_id }}</p>

    <h3>{{ productData.current.price }} ₽</h3>

    <p v-if="productData.current.timestamp">
      Последнее измерение:
      {{ productData.current.timestamp }}
    </p>

    <p v-if="productData.target.price">
      Целевая цена:
      {{ productData.target.price }} ₽
    </p>

    <p v-else>Целевая цена не задана</p>
    <PriceChart
      :chart="productData.chart"
      :target="productData.target"
      :period="selectedPeriod"
    />
  </section>
</template>

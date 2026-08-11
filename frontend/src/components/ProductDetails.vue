<script setup>
import { computed, ref } from "vue";
import PriceChart from "./PriceChart.vue";

const props = defineProps({
  productData: {
    type: Object,
    required: true,
  },
});

const emit = defineEmits(["back", "change-period", "target-updated"]);

const selectedPeriod = ref("24h");
const isEditingTarget = ref(false);
const targetPriceInput = ref("");
const isSavingTarget = ref(false);
const targetError = ref("");

const periodData = computed(() => {
  return props.productData.periods[selectedPeriod.value];
});

function changePeriod(period) {
  selectedPeriod.value = period;
  emit("change-period", period);
}

function startTargetEditing() {
  targetPriceInput.value = props.productData.target.price ?? "";
  targetError.value = "";
  isEditingTarget.value = true;
}

function cancelTargetEditing() {
  isEditingTarget.value = false;
  targetError.value = "";
}

async function saveTargetPrice() {
  targetError.value = "";

  const targetPrice =
    targetPriceInput.value === "" ? null : Number(targetPriceInput.value);

  if (
    targetPrice !== null &&
    (!Number.isInteger(targetPrice) || targetPrice <= 0)
  ) {
    targetError.value = "Целевая цена должна быть положительным целым числом";
    return;
  }

  try {
    isSavingTarget.value = true;

    const response = await fetch(
      `/api/products/${props.productData.product.id}/target-price`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          targetPrice,
        }),
      },
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Не удалось изменить целевую цену");
    }

    emit("target-updated", data.product);

    isEditingTarget.value = false;
  } catch (error) {
    targetError.value = error.message;
  } finally {
    isSavingTarget.value = false;
  }
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

    <div>
      <template v-if="!isEditingTarget">
        <p v-if="productData.target.price">
          Целевая цена:
          {{ productData.target.price }} ₽
        </p>

        <p v-else>Целевая цена не задана</p>

        <button @click="startTargetEditing">Изменить целевую цену</button>
      </template>

      <template v-else>
        <label>
          Целевая цена:
          <input v-model="targetPriceInput" type="number" min="1" step="1" />
          ₽
        </label>

        <button :disabled="isSavingTarget" @click="saveTargetPrice">
          {{ isSavingTarget ? "Сохранение..." : "Сохранить" }}
        </button>

        <button :disabled="isSavingTarget" @click="cancelTargetEditing">
          Отмена
        </button>

        <p v-if="targetError">
          {{ targetError }}
        </p>
      </template>
    </div>

    <PriceChart
      :chart="productData.chart"
      :target="productData.target"
      :period="selectedPeriod"
    />
  </section>
</template>

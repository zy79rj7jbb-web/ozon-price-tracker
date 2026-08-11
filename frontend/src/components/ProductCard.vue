<script setup>
defineProps({
  product: {
    type: Object,
    required: true,
  },
});

const emit = defineEmits(["open"]);
</script>
<template>
  <article class="product-card" @click="emit('open', product.id)">
    <h2>{{ product.name }}</h2>

    <p>ID: {{ product.id }}</p>
    <p v-if="product.current?.price != null">
      Текущая цена: {{ product.current.price }} ₽
    </p>

    <p v-else>Цена: нет данных</p>

    <p v-if="product.change?.difference != null">
      Изменение:
      <span v-if="product.change.difference > 0">
        +{{ product.change.difference }} ₽
      </span>

      <span v-else>{{ product.change.difference }} ₽</span>

      ({{ product.change.percent }}%)
    </p>

    <p v-else>Изменение: нет данных</p>

    <p v-if="product.target_price !== null">
      Цель: {{ product.target_price }} ₽
    </p>

    <p v-else>Целевая цена не задана</p>
  </article>
</template>

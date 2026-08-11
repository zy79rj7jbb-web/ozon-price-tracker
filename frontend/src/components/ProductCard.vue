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

    <p v-if="product.target_price">Цель: {{ product.target_price }} ₽</p>

    <p v-else>Целевая цена не задана</p>
  </article>
</template>

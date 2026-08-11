<script setup>
import ProductCard from "./ProductCard.vue";

defineProps({
  products: {
    type: Array,
    required: true,
  },
});

const emit = defineEmits(["open"]);
</script>

<template>
  <section>
    <ProductCard
      v-for="product in products"
      :key="product.id"
      :product="product"
      @open="emit('open', $event)"
    />
  </section>
</template>

<script setup>
import { onMounted, ref } from "vue";
import ProductList from "./components/ProductList.vue";
import ProductDetails from "./components/ProductDetails.vue";

const products = ref([]);
const loading = ref(true);
const error = ref(null);

const selectedProduct = ref(null);
const productLoading = ref(false);
const productError = ref(null);

async function openProduct(id) {
  productLoading.value = true;
  productError.value = null;

  try {
    const response = await fetch(`/api/products/${id}`);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    selectedProduct.value = await response.json();
  } catch (err) {
    productError.value = err.message;
  } finally {
    productLoading.value = false;
  }
}

function closeProduct() {
  selectedProduct.value = null;
}

function updateProduct(updatedProduct) {
  if (!selectedProduct.value) return;

  selectedProduct.value = {
    ...selectedProduct.value,
    product: {
      ...selectedProduct.value.product,
      target_price: updatedProduct.target_price,
      target_triggered: updatedProduct.target_triggered,
    },
    target: {
      ...selectedProduct.value.target,
      price: updatedProduct.target_price,
      triggered: Boolean(updatedProduct.target_triggered),
    },
  };
}

async function fetchProducts() {
  try {
    const response = await fetch("/api/products");

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    products.value = data.products;
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}

async function changeProductPeriod(period) {
  if (!selectedProduct.value) return;

  const hours = {
    "24h": 24,
    "7d": 168,
    "30d": 720,
  };

  const response = await fetch(
    `/api/products/${selectedProduct.value.product.id}?hours=${hours[period]}`,
  );
  const data = await response.json();

  selectedProduct.value = {
    ...selectedProduct.value,
    chart: data.chart,
  };
}

onMounted(fetchProducts);
</script>

<template>
  <main>
    <h1>Ozon Price Tracker</h1>

    <p v-if="loading">Загрузка...</p>

    <p v-else-if="error">Ошибка: {{ error }}</p>

    <template v-else-if="selectedProduct">
      <p v-if="productLoading">Загрузка товара...</p>

      <p v-else-if="productError">Ошибка: {{ productError }}</p>
      <ProductDetails
        v-if="selectedProduct"
        :product-data="selectedProduct"
        @back="selectedProduct = null"
        @change-period="changeProductPeriod"
        @target-updated="updateProduct"
      />
    </template>

    <template v-else>
      <p>Товаров: {{ products.length }}</p>

      <ProductList :products="products" @open="openProduct" />
    </template>
  </main>
</template>

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

const showAddProduct = ref(false);

const newProduct = ref({
  ozonProductId: "",
  name: "",
  targetPrice: "",
});

const addProductLoading = ref(false);
const addProductError = ref(null);

function resetAddProductForm() {
  newProduct.value = {
    ozonProductId: "",
    name: "",
    targetPrice: "",
  };

  addProductError.value = null;
}

async function addProduct() {
  addProductLoading.value = true;
  addProductError.value = null;

  try {
    const targetPrice =
      newProduct.value.targetPrice === ""
        ? null
        : Number(newProduct.value.targetPrice);

    const response = await fetch("/api/products", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ozonProductId: newProduct.value.ozonProductId.trim(),
        name: newProduct.value.name.trim(),
        targetPrice,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }

    products.value.push(data.product);

    showAddProduct.value = false;
    resetAddProductForm();
  } catch (err) {
    addProductError.value = err.message;
  } finally {
    addProductLoading.value = false;
  }
}

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

    <button
      v-if="!selectedProduct"
      type="button"
      @click="showAddProduct = !showAddProduct"
    >
      {{ showAddProduct ? "Отмена" : "Добавить товар" }}
    </button>

    <form
      v-if="showAddProduct && !selectedProduct"
      @submit.prevent="addProduct"
    >
      <h2>Добавить товар</h2>

      <div>
        <label for="ozonProductId">Ozon Product ID</label>

        <input
          id="ozonProductId"
          v-model="newProduct.ozonProductId"
          type="text"
          required
        />
      </div>

      <div>
        <label for="productName">Название</label>

        <input
          id="productName"
          v-model="newProduct.name"
          type="text"
          required
        />
      </div>

      <div>
        <label for="targetPrice">Целевая цена</label>

        <input
          id="targetPrice"
          v-model="newProduct.targetPrice"
          type="number"
          min="1"
          placeholder="Необязательно"
        />
      </div>

      <button type="submit" :disabled="addProductLoading">
        {{ addProductLoading ? "Добавление..." : "Добавить" }}
      </button>

      <p v-if="addProductError">Ошибка: {{ addProductError }}</p>
    </form>
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

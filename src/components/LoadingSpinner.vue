<template>
  <span class="loading-spinner" aria-hidden="true" />
</template>

<style scoped>
.loading-spinner {
  display: inline-block;
  width: 48px;
  height: 48px;
  box-sizing: border-box;
  border: 4px solid #dbeafe;
  border-top-color: #409eff;
  border-radius: 50%;
  animation: loading-spin 0.9s linear infinite;
}

@keyframes loading-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .loading-spinner {
    animation: none;
  }
}
</style>

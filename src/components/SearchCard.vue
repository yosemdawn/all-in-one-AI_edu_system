<template>
  <el-card class="search-card" shadow="never">
    <div class="search-content">
      <div class="search-form">
        <slot name="search-form" />
      </div>
      <div v-if="$slots.controls" class="search-controls">
        <slot name="controls" />
      </div>
    </div>
  </el-card>
</template>

<script setup lang="ts">
// 无需props，完全通过插槽控制内容
</script>

<style scoped>
.search-card {
  margin-bottom: 16px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #e4e7ed;
}

.search-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
}

.search-form {
  flex: 1;
  min-width: 0;
}

.search-controls {
  flex-shrink: 0;
}

/* 响应式适配 */
@media (max-width: 768px) {
  .search-content {
    flex-direction: column;
    gap: 16px;
    align-items: stretch;
  }

  .search-form {
    flex: none;
  }

  .search-controls {
    flex: none;
  }
}

/* 全局样式覆盖 */
:deep(.el-card__body) {
  padding: 8px 20px;
}

:deep(.el-form--inline .el-form-item) {
  margin-right: 16px;
  margin-bottom: 0;
}

:deep(.el-form-item__label) {
  font-size: 13px;
  color: #606266;
  font-weight: 500;
}

:deep(.el-input__wrapper) {
  border-radius: 6px;
}

:deep(.el-select .el-input__wrapper) {
  border-radius: 6px;
}

:deep(.el-button) {
  border-radius: 6px;
}

/* 移动端表单项堆叠 */
@media (max-width: 640px) {
  :deep(.el-form--inline .el-form-item) {
    display: block;
    margin-right: 0;
    margin-bottom: 12px;
  }

  :deep(.el-form--inline .el-form-item:last-child) {
    margin-bottom: 0;
  }
}
</style>

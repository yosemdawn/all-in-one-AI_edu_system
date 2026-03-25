<template>
  <div class="assignment-detail-tabs">
    <el-tabs v-model="activeTab" type="border-card" class="detail-tabs">
      <el-tab-pane name="submissions" class="tab-pane">
        <template #label>
          <div class="tab-label">
            <el-icon><User /></el-icon>
            <span>提交学生列表</span>
            <el-badge
              v-if="submissionStats"
              :value="submissionStats.totalSubmissions"
              class="tab-badge"
              :max="999"
            />
          </div>
        </template>

        <div class="tab-content">
          <!-- 搜索区域 -->
          <div class="search-section">
            <slot name="search" />
          </div>

          <!-- 表格区域 -->
          <div class="table-section">
            <slot name="table" />
          </div>

          <!-- 分页区域 -->
          <div class="pagination-section">
            <slot name="pagination" />
          </div>
        </div>
      </el-tab-pane>

      <!-- 预留其他Tab -->
      <!-- 
      <el-tab-pane name="analytics" label="数据分析" disabled>
        <div class="coming-soon">
          <el-empty description="功能开发中...">
            <template #image>
              <el-icon size="64" color="#c0c4cc"><DataAnalysis /></el-icon>
            </template>
          </el-empty>
        </div>
      </el-tab-pane>
      
      <el-tab-pane name="settings" label="作业设置" disabled>
        <div class="coming-soon">
          <el-empty description="功能开发中...">
            <template #image>
              <el-icon size="64" color="#c0c4cc"><Setting /></el-icon>
            </template>
          </el-empty>
        </div>
      </el-tab-pane>
      -->
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { User } from "@element-plus/icons-vue";

interface Props {
  submissionStats?: {
    totalSubmissions: number;
    reviewedSubmissions: number;
    pendingSubmissions: number;
    draftSubmissions: number;
  } | null;
}

defineProps<Props>();

// 当前激活的Tab
const activeTab = ref("submissions");

defineOptions({
  name: "AssignmentDetailTabs",
});
</script>

<style scoped>
.assignment-detail-tabs {
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.detail-tabs {
  border: none;
  box-shadow: none;
}

.detail-tabs :deep(.el-tabs__header) {
  margin: 0;
  background: #f8fafc;
  border-bottom: 1px solid #e5e7eb;
}

.detail-tabs :deep(.el-tabs__nav-wrap) {
  padding: 0 0;
}

.detail-tabs :deep(.el-tabs__item) {
  border: none;
  background: transparent;
  color: #6b7280;
  font-weight: 500;
  font-size: 15px;
  padding: 16px 20px;
  margin-right: 8px;
  border-radius: 8px 8px 0 0;
  transition: all 0.3s ease;
}

.detail-tabs :deep(.el-tabs__item:hover) {
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
}

.detail-tabs :deep(.el-tabs__item.is-active) {
  background: white;
  color: #3b82f6;
  font-weight: 600;
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.1);
}

.detail-tabs :deep(.el-tabs__active-bar) {
  display: none;
}

.detail-tabs :deep(.el-tabs__content) {
  padding: 0;
  min-height: 500px;
}

.tab-label {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tab-badge {
  margin-left: 4px;
}

.tab-badge :deep(.el-badge__content) {
  background: #3b82f6;
  border: none;
  font-weight: 600;
  font-size: 11px;
  min-width: 18px;
  height: 18px;
  line-height: 18px;
  border-radius: 9px;
}

.tab-content {
  padding: 16px 20px;
}

.search-section {
  background: #f8fafc;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
  border: 1px solid #e5e7eb;
}

.table-section {
  margin-bottom: 16px;
}

.pagination-section {
  display: flex;
  justify-content: flex-end;
  padding: 12px 0;
  border-top: 1px solid #f3f4f6;
}

.coming-soon {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  color: #9ca3af;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .detail-tabs :deep(.el-tabs__nav-wrap) {
    padding: 0 16px;
  }

  .detail-tabs :deep(.el-tabs__item) {
    padding: 12px 16px;
    font-size: 14px;
  }

  .tab-content {
    padding: 12px 16px;
  }

  .search-section {
    padding: 12px;
  }
}
</style>

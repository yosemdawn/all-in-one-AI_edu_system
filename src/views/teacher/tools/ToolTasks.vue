<template>
  <div class="tool-page">
    <PageHeader title="工具批改记录" description="查看客观题批分和批量作文检查的历史任务。">
      <template #actions>
        <el-button type="primary" :icon="DocumentChecked" @click="router.push('/teacher/tools/objective-grading')">
          客观题批分
        </el-button>
        <el-button :icon="EditPen" @click="router.push('/teacher/tools/essay-batch')">
          批量作文检查
        </el-button>
      </template>
    </PageHeader>

    <section class="panel">
      <div class="filters">
        <el-select v-model="query.type" clearable placeholder="任务类型" @change="loadTasks">
          <el-option label="客观题批分" value="objective_grading" />
          <el-option label="批量作文检查" value="essay_batch" />
        </el-select>
        <el-select v-model="query.status" clearable placeholder="任务状态" @change="loadTasks">
          <el-option label="排队中" value="queued" />
          <el-option label="处理中" value="processing" />
          <el-option label="已完成" value="completed" />
          <el-option label="部分失败" value="partial_failed" />
          <el-option label="失败" value="failed" />
          <el-option label="已取消" value="cancelled" />
        </el-select>
        <el-button :icon="Refresh" @click="loadTasks">刷新</el-button>
      </div>

      <el-table :data="tasks" border v-loading="loading">
        <el-table-column prop="title" label="任务名称" min-width="220" />
        <el-table-column label="类型" width="130">
          <template #default="{ row }">{{ taskTypeText(row.type) }}</template>
        </el-table-column>
        <el-table-column prop="className" label="班级" width="150" />
        <el-table-column label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="taskStatusType(row.status)">
              {{ taskStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="进度" width="180">
          <template #default="{ row }">
            <el-progress :percentage="progressPercent(row)" />
          </template>
        </el-table-column>
        <el-table-column prop="successCount" label="成功" width="80" />
        <el-table-column prop="failureCount" label="失败" width="80" />
        <el-table-column prop="createdAt" label="创建时间" width="180">
          <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="210" fixed="right">
          <template #default="{ row }">
            <el-button text type="primary" @click="openDetail(row)">详情</el-button>
            <el-button text @click="downloadResult(row.id)">导出</el-button>
            <el-button
              v-if="['queued', 'processing'].includes(row.status)"
              text
              type="danger"
              @click="handleCancel(row)"
            >
              取消
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination">
        <el-pagination
          layout="prev, pager, next, total"
          :total="total"
          :page-size="query.limit"
          v-model:current-page="query.page"
          @current-change="loadTasks"
        />
      </div>
    </section>

    <el-drawer v-model="detailVisible" size="70%" title="任务详情">
      <template v-if="selectedTask">
        <div class="detail-summary">
          <el-tag :type="taskStatusType(selectedTask.status)">
            {{ taskStatusText(selectedTask.status) }}
          </el-tag>
          <span>总数：{{ selectedTask.totalCount }}</span>
          <span>成功：{{ selectedTask.successCount }}</span>
          <span>失败：{{ selectedTask.failureCount }}</span>
          <span>平均分：{{ selectedTask.resultSummary?.averageScore ?? "-" }}</span>
        </div>
        <el-table :data="selectedTask.items" border>
          <el-table-column prop="fileName" label="文件" min-width="180" />
          <el-table-column prop="studentName" label="姓名" width="110" />
          <el-table-column prop="studentNumber" label="学号" width="120" />
          <el-table-column label="分数" width="90">
            <template #default="{ row }">{{ row.totalScore ?? row.score ?? "-" }}</template>
          </el-table-column>
          <el-table-column prop="summaryComment" label="总评" min-width="240" show-overflow-tooltip />
          <el-table-column prop="error" label="错误" min-width="200" />
        </el-table>
      </template>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { ElMessageBox } from "element-plus";
import { DocumentChecked, EditPen, Refresh } from "@element-plus/icons-vue";
import PageHeader from "@/components/PageHeader.vue";
import {
  cancelToolTask,
  getToolTask,
  getToolTaskExportUrl,
  getToolTasks,
  type ToolTask,
  type ToolTaskStatus,
  type ToolTaskType,
} from "@/api/teacher-tools";
import { progressPercent, taskStatusText, taskStatusType } from "./shared";

const router = useRouter();
const loading = ref(false);
const tasks = ref<ToolTask[]>([]);
const total = ref(0);
const detailVisible = ref(false);
const selectedTask = ref<ToolTask | null>(null);

const query = reactive<{
  type?: ToolTaskType | "";
  status?: ToolTaskStatus | "";
  page: number;
  limit: number;
}>({
  type: "",
  status: "",
  page: 1,
  limit: 20,
});

onMounted(loadTasks);

async function loadTasks() {
  loading.value = true;
  try {
    const result = await getToolTasks({
      type: query.type || undefined,
      status: query.status || undefined,
      page: query.page,
      limit: query.limit,
    });
    tasks.value = result.items || [];
    total.value = result.total || 0;
  } finally {
    loading.value = false;
  }
}

async function openDetail(task: ToolTask) {
  selectedTask.value = await getToolTask(task.id);
  detailVisible.value = true;
}

async function handleCancel(task: ToolTask) {
  await ElMessageBox.confirm("确定取消这个任务吗？", "取消任务", {
    type: "warning",
  });
  await cancelToolTask(task.id);
  await loadTasks();
}

function downloadResult(id: string) {
  window.open(getToolTaskExportUrl(id), "_blank");
}

function taskTypeText(type: string) {
  return type === "objective_grading" ? "客观题批分" : "批量作文检查";
}

function formatDate(value?: string) {
  return value ? new Date(value).toLocaleString() : "-";
}
</script>

<style scoped>
.tool-page {
  padding: 16px;
}

.panel {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 16px;
}

.filters {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.filters .el-select {
  width: 180px;
}

.pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

.detail-summary {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}
</style>


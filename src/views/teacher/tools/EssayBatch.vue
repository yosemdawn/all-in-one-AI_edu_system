<template>
  <div class="tool-page">
    <PageHeader title="批量作文检查" description="上传作文要求和学生作文图片，由豆包多模态直接识别并批改。">
      <template #actions>
        <el-button :icon="List" @click="router.push('/teacher/tools/tasks')">查看记录</el-button>
      </template>
    </PageHeader>

    <div class="workspace-grid">
      <section class="panel">
        <h3>任务信息</h3>
        <el-form label-position="top">
          <el-form-item label="任务名称">
            <el-input v-model="form.title" placeholder="例如：高一3班日常作文检查" />
          </el-form-item>
          <el-form-item label="关联班级">
            <el-select v-model="form.classId" clearable filterable placeholder="可选">
              <el-option
                v-for="item in classes"
                :key="item._id"
                :label="item.name"
                :value="item._id"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="关联作业">
            <el-select
              v-model="form.assignmentId"
              clearable
              filterable
              placeholder="可选，选择后会同步到作业记录"
            >
              <el-option
                v-for="item in assignments"
                :key="item.id"
                :label="item.title"
                :value="item.id"
              />
            </el-select>
          </el-form-item>
          <el-form-item v-if="form.assignmentId">
            <el-checkbox v-model="form.syncToSubmissions">
              检查完成后同步到学生提交记录
            </el-checkbox>
            <el-checkbox
              v-if="form.syncToSubmissions"
              v-model="form.overwriteExistingSubmissions"
            >
              覆盖已有学生提交
            </el-checkbox>
          </el-form-item>
        </el-form>
      </section>

      <section class="panel">
        <h3>作文要求</h3>
        <el-input
          v-model="requirementText"
          type="textarea"
          :rows="8"
          placeholder="可以直接输入作文题目和评分要求，也可以上传题目图片后预览识别。"
        />
        <el-upload
          v-model:file-list="requirementFiles"
          class="upload-block"
          drag
          multiple
          accept="image/*"
          :auto-upload="false"
          :limit="5"
          :on-exceed="handleRequirementFileExceed"
        >
          <el-icon><UploadFilled /></el-icon>
          <div class="el-upload__text">上传作文题目/要求图片</div>
        </el-upload>
        <div class="actions">
          <el-button :icon="MagicStick" :loading="previewing" @click="previewRequirements">
            预览识别要求
          </el-button>
        </div>
      </section>

      <section class="panel">
        <h3>学生作文图片</h3>
        <el-upload
          v-model:file-list="essayFiles"
          drag
          multiple
          accept="image/*"
          :auto-upload="false"
          :limit="50"
          :on-exceed="handleEssayFileExceed"
        >
          <el-icon><UploadFilled /></el-icon>
          <div class="el-upload__text">拖拽作文图片到这里，或点击选择</div>
        </el-upload>
      </section>
    </div>

    <div class="submit-bar">
      <el-button type="primary" :icon="Upload" :loading="submitting" @click="submitTask">
        创建作文检查任务
      </el-button>
    </div>

    <section v-if="currentTask" class="panel result-panel">
      <div class="result-head">
        <div>
          <h3>{{ currentTask.title }}</h3>
          <el-tag :type="taskStatusType(currentTask.status)">
            {{ taskStatusText(currentTask.status) }}
          </el-tag>
        </div>
        <el-button :icon="Download" @click="downloadResult(currentTask)">导出结果</el-button>
      </div>
      <el-progress :percentage="progressPercent(currentTask)" />
      <el-table :data="currentTask.items" border>
        <el-table-column prop="fileName" label="文件" min-width="180" />
        <el-table-column prop="studentName" label="姓名" width="110" />
        <el-table-column prop="studentNumber" label="学号" width="120" />
        <el-table-column label="匹配" width="110">
          <template #default="{ row }">{{ row.matchedStudent?.status || "-" }}</template>
        </el-table-column>
        <el-table-column prop="score" label="分数" width="90" />
        <el-table-column prop="summaryComment" label="总评" min-width="260" show-overflow-tooltip />
        <el-table-column prop="error" label="错误" min-width="180" />
      </el-table>
    </section>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { ElMessage, ElMessageBox } from "element-plus";
import {
  Download,
  List,
  MagicStick,
  Upload,
  UploadFilled,
} from "@element-plus/icons-vue";
import PageHeader from "@/components/PageHeader.vue";
import { AssignmentStatus, getAssignmentList, type Assignment } from "@/api/assignments";
import { getClassList } from "@/api/classes";
import type { Class } from "@/types/classes";
import {
  createEssayTask,
  downloadToolTask,
  getToolTask,
  previewEssayRequirements,
  type ToolTask,
} from "@/api/teacher-tools";
import { progressPercent, taskStatusText, taskStatusType } from "./shared";

const router = useRouter();
const classes = ref<Class[]>([]);
const assignments = ref<Assignment[]>([]);
const requirementText = ref("");
const requirementFiles = ref<any[]>([]);
const essayFiles = ref<any[]>([]);
const previewing = ref(false);
const submitting = ref(false);
const currentTask = ref<ToolTask | null>(null);
let pollTimer: number | undefined;

function handleRequirementFileExceed() {
  ElMessage.warning("作文要求图片最多上传 5 张");
}

function handleEssayFileExceed() {
  ElMessage.warning("单次最多上传 50 张作文图片");
}

const form = reactive({
  title: "",
  classId: "",
  assignmentId: "",
  syncToSubmissions: true,
  overwriteExistingSubmissions: false,
});

onMounted(async () => {
  await Promise.all([loadClasses(), loadAssignments()]);
});

watch(
  () => form.classId,
  async () => {
    form.assignmentId = "";
    await loadAssignments();
  }
);

onBeforeUnmount(() => {
  if (pollTimer) window.clearInterval(pollTimer);
});

async function loadClasses() {
  const data = await getClassList({ page: 1, limit: 100, status: "active" });
  classes.value = data.items || [];
}

async function loadAssignments() {
  const data = await getAssignmentList({
    page: 1,
    pageSize: 100,
    status: AssignmentStatus.PUBLISHED,
    classId: form.classId || undefined,
    sortBy: "createdAt",
    sortOrder: "desc",
  });
  assignments.value = data.items || [];
}

async function previewRequirements() {
  const files = requirementFiles.value.map((item) => item.raw).filter(Boolean);
  if (!files.length && !requirementText.value.trim()) {
    ElMessage.warning("请先输入作文要求或上传题目图片");
    return;
  }

  previewing.value = true;
  try {
    const data = new FormData();
    data.append("requirementText", requirementText.value);
    files.forEach((file) => data.append("requirementImages", file));
    const result = await previewEssayRequirements(data);
    requirementText.value = result.requirements || requirementText.value;
  } finally {
    previewing.value = false;
  }
}

async function submitTask() {
  const files = essayFiles.value.map((item) => item.raw).filter(Boolean);
  const requirementImageCount = requirementFiles.value.filter(
    (item) => item.raw
  ).length;
  if (files.length + requirementImageCount > 50) {
    ElMessage.warning("作文要求图片和学生作文图片合计最多上传 50 张");
    return;
  }
  if (!files.length) {
    ElMessage.warning("请上传学生作文图片");
    return;
  }
  if (!requirementText.value.trim() && requirementFiles.value.length === 0) {
    ElMessage.warning("请提供作文要求");
    return;
  }
  if (form.assignmentId && form.overwriteExistingSubmissions) {
    await ElMessageBox.confirm(
      "覆盖后，已有学生提交的 AI 结果会被本次检查结果替换；教师已批改记录不会被覆盖。确认继续吗？",
      "覆盖已有提交",
      { type: "warning" }
    );
  }

  submitting.value = true;
  try {
    const data = new FormData();
    data.append("title", form.title);
    data.append("requirementText", requirementText.value);
    if (form.classId) data.append("classId", form.classId);
    if (form.assignmentId) {
      data.append("assignmentId", form.assignmentId);
      data.append("syncToSubmissions", String(form.syncToSubmissions));
      data.append(
        "overwriteExistingSubmissions",
        String(form.overwriteExistingSubmissions)
      );
    }
    requirementFiles.value
      .map((item) => item.raw)
      .filter(Boolean)
      .forEach((file) => data.append("requirementImages", file));
    files.forEach((file) => data.append("essayImages", file));
    currentTask.value = await createEssayTask(data);
    ElMessage.success("任务已创建");
    startPolling(currentTask.value.id);
  } finally {
    submitting.value = false;
  }
}

function startPolling(taskId: string) {
  if (pollTimer) window.clearInterval(pollTimer);
  pollTimer = window.setInterval(async () => {
    const task = await getToolTask(taskId);
    currentTask.value = task;
    if (["completed", "partial_failed", "failed", "cancelled"].includes(task.status)) {
      if (pollTimer) window.clearInterval(pollTimer);
    }
  }, 3000);
}

function downloadResult(task: ToolTask) {
  downloadToolTask(task.id, `${task.title || "批量作文检查"}-${task.id}.csv`);
}
</script>

<style scoped>
.tool-page {
  padding: 16px;
}

.workspace-grid {
  display: grid;
  grid-template-columns: 0.9fr 1.2fr 1fr;
  gap: 16px;
}

.panel {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 16px;
}

.panel h3 {
  margin: 0 0 14px;
  font-size: 16px;
}

.upload-block {
  margin-top: 12px;
}

.actions,
.submit-bar {
  display: flex;
  justify-content: flex-end;
  margin-top: 14px;
}

.result-panel {
  margin-top: 16px;
}

.result-head {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

@media (max-width: 1100px) {
  .workspace-grid {
    grid-template-columns: 1fr;
  }
}
</style>

<template>
  <div class="tool-page">
    <PageHeader title="客观题批分" description="批量上传答题卡图片，由豆包多模态识别答案并自动批分。">
      <template #actions>
        <el-button :icon="List" @click="router.push('/teacher/tools/tasks')">查看记录</el-button>
      </template>
    </PageHeader>

    <div class="workspace-grid">
      <section class="panel">
        <h3>任务信息</h3>
        <el-form label-position="top">
          <el-form-item label="任务名称">
            <el-input v-model="form.title" placeholder="例如：高一3班周测答题卡" />
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
              批分完成后同步到学生提交记录
            </el-checkbox>
            <el-checkbox
              v-if="form.syncToSubmissions"
              v-model="form.overwriteExistingSubmissions"
            >
              覆盖已有学生提交
            </el-checkbox>
          </el-form-item>
          <el-form-item label="答题卡图片">
            <el-upload
              v-model:file-list="answerCardFiles"
              drag
              multiple
              accept="image/*"
              :auto-upload="false"
            >
              <el-icon><UploadFilled /></el-icon>
              <div class="el-upload__text">拖拽图片到这里，或点击选择</div>
            </el-upload>
          </el-form-item>
        </el-form>
      </section>

      <section class="panel">
        <h3>标准答案</h3>
        <el-input
          v-model="answerText"
          type="textarea"
          :rows="5"
          placeholder="可输入：1.A 2.B 3.C；也可以粘贴较长的标准答案说明"
        />
        <div class="actions">
          <el-button :icon="MagicStick" :loading="parsingAnswers" @click="handleParseAnswers">
            AI 解析答案
          </el-button>
        </div>
        <div class="parse-feedback" :class="{ empty: !answerPreviewItems.length }">
          <template v-if="answerPreviewItems.length">
            <div class="feedback-summary">
              <div>
                <strong>{{ answerPreviewItems.length }}</strong>
                <span>道题</span>
              </div>
              <div>
                <strong>{{ answerTypeCounts.single }}</strong>
                <span>道选择题</span>
              </div>
              <div>
                <strong>{{ answerTypeCounts.blank }}</strong>
                <span>道填空/简答</span>
              </div>
            </div>
            <div class="feedback-note">
              已把标准答案整理成可批分格式。请快速核对题号和答案，确认无误后即可创建批分任务。
            </div>
            <div class="answer-preview-list">
              <div
                v-for="item in answerPreviewItems"
                :key="item.questionId"
                class="answer-preview-item"
              >
                <span class="question-no">第 {{ item.questionId }} 题</span>
                <span class="answer-content">{{ item.content || "空" }}</span>
                <el-tag size="small" effect="plain">{{ item.typeText }}</el-tag>
                <span v-if="item.scoreText" class="inline-score">
                  {{ item.scoreText }}
                </span>
              </div>
            </div>
          </template>
          <template v-else>
            <el-empty
              description="点击上方 AI 解析后，这里会显示老师能直接核对的答案清单"
              :image-size="80"
            />
          </template>
        </div>
      </section>

      <section class="panel">
        <h3>分值规则</h3>
        <el-input
          v-model="scoreText"
          type="textarea"
          :rows="5"
          placeholder="例如：1-20题每题1分，21-40题每题2.5分"
        />
        <div class="actions">
          <el-button :icon="MagicStick" :loading="parsingScores" @click="handleParseScores">
            AI 解析分值
          </el-button>
        </div>
        <div class="parse-feedback" :class="{ empty: !scorePreviewItems.length }">
          <template v-if="scorePreviewItems.length">
            <div class="feedback-summary">
              <div>
                <strong>{{ scorePreviewItems.length }}</strong>
                <span>道题有分值</span>
              </div>
              <div>
                <strong>{{ scoreTotal }}</strong>
                <span>总分</span>
              </div>
              <div>
                <strong>{{ scoreGroups.length }}</strong>
                <span>条分值规则</span>
              </div>
            </div>
            <div class="feedback-note">
              已把分值规则整理为逐题分值。请核对总分和题号范围，确认无误后即可创建批分任务。
            </div>
            <div class="score-rule-list">
              <div
                v-for="group in scoreGroups"
                :key="`${group.range}-${group.score}`"
                class="score-rule-item"
              >
                <span>{{ group.range }}</span>
                <strong>每题 {{ group.score }} 分</strong>
              </div>
            </div>
          </template>
          <template v-else>
            <el-empty
              description="点击上方 AI 解析后，这里会显示清晰的分值范围和总分"
              :image-size="80"
            />
          </template>
        </div>
      </section>
    </div>

    <div class="submit-bar">
      <el-button type="primary" :icon="Upload" :loading="submitting" @click="submitTask">
        创建批分任务
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
        <el-table-column prop="totalScore" label="总分" width="90" />
        <el-table-column prop="status" label="状态" width="110" />
        <el-table-column prop="error" label="错误" min-width="180" />
      </el-table>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
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
  createObjectiveTask,
  downloadToolTask,
  getToolTask,
  parseObjectiveAnswers,
  parseObjectiveScoreConfig,
  type ToolTask,
} from "@/api/teacher-tools";
import {
  progressPercent,
  safeJsonParse,
  taskStatusText,
  taskStatusType,
} from "./shared";

const router = useRouter();
const classes = ref<Class[]>([]);
const assignments = ref<Assignment[]>([]);
const answerCardFiles = ref<any[]>([]);
const answerText = ref("");
const scoreText = ref("");
const standardAnswersJson = ref("");
const scoreConfigJson = ref("");
const parsingAnswers = ref(false);
const parsingScores = ref(false);
const submitting = ref(false);
const currentTask = ref<ToolTask | null>(null);
let pollTimer: number | undefined;

const form = reactive({
  title: "",
  classId: "",
  assignmentId: "",
  syncToSubmissions: true,
  overwriteExistingSubmissions: false,
});

type StandardAnswer = {
  content?: string;
  type?: string;
  score?: number;
};

type AnswerPreviewItem = {
  questionId: string;
  content: string;
  typeText: string;
  scoreText: string;
};

type ScorePreviewItem = {
  questionId: string;
  score: number;
};

const parsedStandardAnswers = computed<Record<string, StandardAnswer>>(() =>
  safeJsonParse(standardAnswersJson.value, {})
);

const parsedScoreConfig = computed<Record<string, number>>(() =>
  safeJsonParse(scoreConfigJson.value, {})
);

const answerPreviewItems = computed<AnswerPreviewItem[]>(() =>
  Object.entries(parsedStandardAnswers.value)
    .sort(([a], [b]) => sortQuestionId(a, b))
    .map(([questionId, answer]) => {
      const content = String(answer?.content ?? "").trim();
      const score = Number(answer?.score);
      return {
        questionId,
        content,
        typeText: answerTypeText(answer?.type),
        scoreText: Number.isFinite(score) ? `${score} 分` : "",
      };
    })
);

const answerTypeCounts = computed(() => {
  return answerPreviewItems.value.reduce(
    (counts, item) => {
      if (item.typeText === "选择题") counts.single += 1;
      else counts.blank += 1;
      return counts;
    },
    { single: 0, blank: 0 }
  );
});

const scorePreviewItems = computed<ScorePreviewItem[]>(() =>
  Object.entries(parsedScoreConfig.value)
    .map(([questionId, score]) => ({
      questionId,
      score: Number(score),
    }))
    .filter((item) => Number.isFinite(item.score))
    .sort((a, b) => sortQuestionId(a.questionId, b.questionId))
);

const scoreTotal = computed(() =>
  Number(
    scorePreviewItems.value
      .reduce((total, item) => total + item.score, 0)
      .toFixed(2)
  )
);

const scoreGroups = computed(() => {
  const groups: Array<{ range: string; score: number }> = [];
  let current:
    | { start: string; end: string; startNum: number | null; endNum: number | null; score: number }
    | null = null;

  const pushCurrent = () => {
    if (!current) return;
    groups.push({
      range:
        current.start === current.end
          ? `第 ${current.start} 题`
          : `第 ${current.start} - ${current.end} 题`,
      score: current.score,
    });
  };

  scorePreviewItems.value.forEach((item) => {
    const numericId = numericQuestionId(item.questionId);
    const canMerge =
      current &&
      current.score === item.score &&
      current.endNum !== null &&
      numericId !== null &&
      numericId === current.endNum + 1;

    if (canMerge) {
      current.end = item.questionId;
      current.endNum = numericId;
      return;
    }

    pushCurrent();
    current = {
      start: item.questionId,
      end: item.questionId,
      startNum: numericId,
      endNum: numericId,
      score: item.score,
    };
  });

  pushCurrent();
  return groups;
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

async function handleParseAnswers() {
  if (!answerText.value.trim()) {
    ElMessage.warning("请先输入标准答案说明");
    return;
  }
  parsingAnswers.value = true;
  try {
    const result = await parseObjectiveAnswers(answerText.value);
    standardAnswersJson.value = JSON.stringify(result.standardAnswers, null, 2);
  } finally {
    parsingAnswers.value = false;
  }
}

async function handleParseScores() {
  if (!scoreText.value.trim()) {
    ElMessage.warning("请先输入分值规则");
    return;
  }
  parsingScores.value = true;
  try {
    const result = await parseObjectiveScoreConfig(scoreText.value);
    scoreConfigJson.value = JSON.stringify(result.scoreConfig, null, 2);
  } finally {
    parsingScores.value = false;
  }
}

function answerTypeText(type?: string) {
  if (type === "single_choice") return "选择题";
  if (type === "fill_in_blank") return "填空/简答";
  return "题型待确认";
}

function numericQuestionId(questionId: string) {
  const numeric = Number(questionId);
  return Number.isInteger(numeric) ? numeric : null;
}

function sortQuestionId(a: string, b: string) {
  const numA = numericQuestionId(a);
  const numB = numericQuestionId(b);
  if (numA !== null && numB !== null) return numA - numB;
  if (numA !== null) return -1;
  if (numB !== null) return 1;
  return a.localeCompare(b, "zh-CN");
}

async function submitTask() {
  const files = answerCardFiles.value.map((item) => item.raw).filter(Boolean);
  if (!files.length) {
    ElMessage.warning("请上传答题卡图片");
    return;
  }
  const standardAnswers = safeJsonParse(standardAnswersJson.value, null);
  if (!standardAnswers) {
    ElMessage.warning("请先解析并核对标准答案");
    return;
  }
  if (form.assignmentId && form.overwriteExistingSubmissions) {
    await ElMessageBox.confirm(
      "覆盖后，已有学生提交的 AI 结果会被本次批分结果替换；教师已批改记录不会被覆盖。确认继续吗？",
      "覆盖已有提交",
      { type: "warning" }
    );
  }

  submitting.value = true;
  try {
    const data = new FormData();
    data.append("title", form.title);
    if (form.classId) data.append("classId", form.classId);
    if (form.assignmentId) {
      data.append("assignmentId", form.assignmentId);
      data.append("syncToSubmissions", String(form.syncToSubmissions));
      data.append(
        "overwriteExistingSubmissions",
        String(form.overwriteExistingSubmissions)
      );
    }
    data.append("standardAnswers", JSON.stringify(standardAnswers));
    data.append(
      "scoreConfig",
      JSON.stringify(safeJsonParse(scoreConfigJson.value, {}))
    );
    files.forEach((file) => data.append("answerCards", file));
    currentTask.value = await createObjectiveTask(data);
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
  downloadToolTask(task.id, `${task.title || "客观题批分"}-${task.id}.csv`);
}
</script>

<style scoped>
.tool-page {
  padding: 16px;
}

.workspace-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
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

.actions {
  display: flex;
  justify-content: flex-end;
  margin: 10px 0;
}

.parse-feedback {
  min-height: 226px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #f8fafc;
  padding: 14px;
}

.parse-feedback.empty {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff;
}

.feedback-summary {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 12px;
}

.feedback-summary div {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 10px;
  min-width: 0;
}

.feedback-summary strong {
  display: block;
  color: #1f2937;
  font-size: 20px;
  line-height: 1.1;
}

.feedback-summary span {
  display: block;
  color: #64748b;
  font-size: 12px;
  margin-top: 4px;
}

.feedback-note {
  color: #475569;
  font-size: 13px;
  line-height: 1.6;
  margin-bottom: 12px;
}

.answer-preview-list,
.score-rule-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 260px;
  overflow-y: auto;
  padding-right: 4px;
}

.answer-preview-item,
.score-rule-item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto auto;
  gap: 8px;
  align-items: center;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 9px 10px;
}

.question-no {
  color: #334155;
  font-weight: 600;
  white-space: nowrap;
}

.answer-content {
  color: #111827;
  font-weight: 700;
  word-break: break-word;
}

.inline-score {
  color: #166534;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.score-rule-item {
  grid-template-columns: minmax(0, 1fr) auto;
}

.score-rule-item span {
  color: #334155;
  font-weight: 600;
}

.score-rule-item strong {
  color: #166534;
  white-space: nowrap;
}

.submit-bar {
  display: flex;
  justify-content: flex-end;
  margin: 16px 0;
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

  .feedback-summary {
    grid-template-columns: 1fr;
  }

  .answer-preview-item {
    grid-template-columns: 1fr auto;
  }

  .answer-content {
    grid-column: 1 / -1;
  }
}
</style>

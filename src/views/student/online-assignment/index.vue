<template>
  <div class="online-answer-page" v-loading="loading">
    <el-empty
      v-if="loadError && !assignment"
      :description="loadError"
      class="online-empty"
    >
      <el-button type="primary" @click="goBack">返回作业列表</el-button>
    </el-empty>

    <div class="online-shell" v-if="assignment">
      <header class="online-header">
        <div>
          <el-button link :icon="ArrowLeft" @click="goBack">返回</el-button>
          <h1>{{ assignment.title }}</h1>
          <p>
            教师：{{ assignment.teacherName || "-" }}
            <span v-if="assignment.className"> · 班级：{{ assignment.className }}</span>
          </p>
        </div>
        <div class="online-header__status">
          <el-tag :type="submitted ? 'success' : 'primary'">
            {{ submitted ? "已提交" : "在线作答" }}
          </el-tag>
          <span>{{ currentIndex + 1 }} / {{ questions.length }}</span>
        </div>
      </header>

      <el-alert
        v-if="assignment.isExpired || assignment.status === 'terminated'"
        :title="assignment.status === 'terminated' ? '作业已终止' : '作业已过期'"
        type="warning"
        show-icon
        :closable="false"
        class="online-alert"
      />

      <section v-if="submitted" class="result-panel">
        <div>
          <span class="result-label">自动判分</span>
          <strong>{{ submission?.aiScore ?? "-" }} 分</strong>
        </div>
        <p>{{ submission?.aiReviewContent || "系统已完成客观题自动判分。" }}</p>
      </section>

      <main v-if="currentQuestion" class="question-panel">
        <div class="question-panel__top">
          <div class="question-number">第 {{ currentIndex + 1 }} 题</div>
          <el-tag size="small" effect="plain">
            {{ currentQuestion.type === "single_choice" ? "选择题" : "填空题" }}
            · {{ currentQuestion.score || 1 }} 分
          </el-tag>
        </div>

        <div class="question-stem">{{ currentQuestion.stem }}</div>

        <div class="answer-area">
          <el-radio-group
            v-if="currentQuestion.type === 'single_choice'"
            v-model="answers[currentQuestion.id]"
            class="choice-list"
            :disabled="!canAnswer"
          >
            <el-radio
              v-for="(option, optionIndex) in currentQuestion.options || []"
              :key="`${currentQuestion.id}-${optionIndex}`"
              :label="option"
              border
            >
              <span class="choice-label">{{ getOptionLabel(optionIndex) }}</span>
              <span>{{ option }}</span>
            </el-radio>
          </el-radio-group>

          <el-input
            v-else
            v-model="answers[currentQuestion.id]"
            :disabled="!canAnswer"
            placeholder="请输入答案，英文字母大小写必须与标准答案完全一致"
            size="large"
          />
        </div>
      </main>

      <footer class="online-footer">
        <el-button :disabled="currentIndex === 0" @click="goPrevious">
          上一题
        </el-button>
        <el-button
          v-if="currentIndex < questions.length - 1"
          type="primary"
          @click="goNext"
        >
          下一题
        </el-button>
        <el-button
          v-else
          type="primary"
          :disabled="!canAnswer"
          :loading="submitting"
          @click="submitOnlineAnswers"
        >
          {{ submitted ? "重新提交" : "提交作业" }}
        </el-button>
      </footer>

      <aside class="question-nav">
        <button
          v-for="(question, index) in questions"
          :key="question.id"
          :class="[
            'question-nav__item',
            {
              active: index === currentIndex,
              answered: isAnswered(question.id),
            },
          ]"
          type="button"
          @click="currentIndex = index"
        >
          {{ index + 1 }}
        </button>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage, ElMessageBox } from "element-plus";
import { ArrowLeft } from "@element-plus/icons-vue";
import { getStudentAssignment } from "@/api/assignments";
import { SubmissionsApi, type Submission } from "@/api/submissions";

type OnlineQuestion = {
  id: string;
  type: "single_choice" | "fill_blank";
  stem: string;
  options?: string[];
  score?: number;
};

type OnlineAssignment = {
  id: string;
  title: string;
  teacherName?: string;
  classId?: string;
  className?: string;
  status?: string;
  isExpired?: boolean;
  canSubmit?: boolean;
  hasSubmitted?: boolean;
  onlineQuestions?: OnlineQuestion[];
};

const route = useRoute();
const router = useRouter();
const loading = ref(false);
const submitting = ref(false);
const assignment = ref<OnlineAssignment | null>(null);
const submission = ref<Submission | null>(null);
const loadError = ref("");
const currentIndex = ref(0);
const answers = reactive<Record<string, string>>({});

const assignmentId = computed(() => route.query.assignmentId as string);
const classId = computed(() => route.query.classId as string);
const questions = computed(() => assignment.value?.onlineQuestions || []);
const currentQuestion = computed(() => questions.value[currentIndex.value]);
const submitted = computed(() => !!submission.value && !submission.value.isDraft);
const canAnswer = computed(
  () =>
    !!assignment.value?.canSubmit &&
    !assignment.value?.isExpired &&
    assignment.value?.status !== "terminated"
);

const loadPage = async () => {
  if (!assignmentId.value) {
    loadError.value = "缺少作业 ID，请从作业列表进入在线作业。";
    return;
  }

  loading.value = true;
  loadError.value = "";
  try {
    const [assignmentResult, submissionResult] = await Promise.all([
      getStudentAssignment(assignmentId.value, classId.value),
      SubmissionsApi.getMySubmission(assignmentId.value).catch(() => null),
    ]);
    assignment.value = assignmentResult;
    submission.value = submissionResult?.submission || null;

    if (assignment.value?.onlineQuestions?.length) {
      assignment.value.onlineQuestions.forEach((question) => {
        answers[question.id] = "";
      });
    }

    submission.value?.onlineAnswers?.forEach((item) => {
      answers[item.questionId] = item.answer;
    });
  } catch (error: any) {
    console.error("加载在线作业失败:", error);
    loadError.value = error?.message || "加载在线作业失败";
    ElMessage.error(loadError.value);
  } finally {
    loading.value = false;
  }
};

const getOptionLabel = (index: number) => String.fromCharCode(65 + index);

const isAnswered = (questionId: string) => {
  return String(answers[questionId] ?? "").length > 0;
};

const goBack = () => {
  void router.push("/student/assignments");
};

const goPrevious = () => {
  currentIndex.value = Math.max(0, currentIndex.value - 1);
};

const goNext = () => {
  currentIndex.value = Math.min(questions.value.length - 1, currentIndex.value + 1);
};

const submitOnlineAnswers = async () => {
  const firstEmptyIndex = questions.value.findIndex(
    (question) => !isAnswered(question.id)
  );
  if (firstEmptyIndex >= 0) {
    currentIndex.value = firstEmptyIndex;
    ElMessage.warning(`请先完成第 ${firstEmptyIndex + 1} 题`);
    return;
  }

  await ElMessageBox.confirm(
    "确定提交在线作业吗？提交后系统会立即自动判分。",
    "确认提交",
    {
      type: "warning",
      confirmButtonText: "提交",
      cancelButtonText: "取消",
    }
  );

  submitting.value = true;
  try {
    await SubmissionsApi.submit({
      assignmentId: assignmentId.value,
      classId: classId.value || assignment.value?.classId || "",
      onlineAnswers: questions.value.map((question) => ({
        questionId: question.id,
        answer: answers[question.id] ?? "",
      })),
      isDraft: false,
    });
    ElMessage.success("提交成功，系统已完成自动判分");
    await loadPage();
  } catch (error: any) {
    if (error !== "cancel") {
      ElMessage.error(error?.message || "提交失败");
    }
  } finally {
    submitting.value = false;
  }
};

onMounted(() => {
  void loadPage();
});
</script>

<style scoped>
.online-answer-page {
  min-height: 100%;
  background: #f8fafc;
  padding: 20px;
}

.online-shell {
  max-width: 980px;
  margin: 0 auto;
}

.online-empty {
  min-height: 420px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #ffffff;
}

.online-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 20px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #ffffff;
}

.online-header h1 {
  margin: 8px 0 6px;
  font-size: 24px;
  color: #111827;
}

.online-header p {
  margin: 0;
  color: #6b7280;
}

.online-header__status {
  display: flex;
  align-items: center;
  gap: 12px;
  color: #6b7280;
}

.online-alert,
.result-panel,
.question-panel,
.online-footer,
.question-nav {
  margin-top: 16px;
}

.result-panel {
  padding: 16px 18px;
  border: 1px solid #bbf7d0;
  border-radius: 8px;
  background: #f0fdf4;
}

.result-panel > div {
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.result-label {
  color: #15803d;
  font-weight: 600;
}

.result-panel strong {
  font-size: 28px;
  color: #166534;
}

.result-panel p {
  margin: 8px 0 0;
  color: #166534;
}

.question-panel {
  padding: 24px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #ffffff;
}

.question-panel__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 18px;
}

.question-number {
  font-weight: 700;
  color: #1d4ed8;
}

.question-stem {
  min-height: 120px;
  padding: 18px;
  border-radius: 8px;
  background: #f8fafc;
  color: #111827;
  font-size: 18px;
  line-height: 1.8;
  white-space: pre-wrap;
}

.answer-area {
  margin-top: 20px;
}

.choice-list {
  display: grid;
  gap: 12px;
}

.choice-list :deep(.el-radio) {
  width: 100%;
  height: auto;
  margin-right: 0;
  padding: 14px 16px;
  white-space: normal;
}

.choice-label {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  margin-right: 8px;
  border-radius: 50%;
  background: #eff6ff;
  color: #1d4ed8;
  font-weight: 700;
}

.online-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 0;
}

.question-nav {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.question-nav__item {
  width: 36px;
  height: 36px;
  border: 1px solid #d1d5db;
  border-radius: 50%;
  background: #ffffff;
  color: #374151;
  cursor: pointer;
}

.question-nav__item.active {
  border-color: #2563eb;
  color: #2563eb;
  font-weight: 700;
}

.question-nav__item.answered {
  background: #eff6ff;
  border-color: #93c5fd;
}

@media (max-width: 640px) {
  .online-answer-page {
    padding: 12px;
  }

  .online-header,
  .question-panel__top {
    flex-direction: column;
  }

  .online-footer {
    justify-content: stretch;
  }

  .online-footer .el-button {
    flex: 1;
  }
}
</style>

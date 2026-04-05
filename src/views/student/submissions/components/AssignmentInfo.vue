<template>
  <div class="form-section">
    <div class="section-content">
      <div class="space-y-4">
        <div>
          <div
            ref="descriptionRef"
            class="prose max-w-none text-gray-700 transition-all duration-300"
            :class="{ 'line-clamp-3': !isExpanded && shouldShowToggle }"
            v-html="assignment.description"
          ></div>

          <div v-if="shouldShowToggle" class="flex justify-center mt-3">
            <el-button
              link
              type="primary"
              :icon="isExpanded ? ArrowUp : ArrowDown"
              class="!text-sm"
              @click="toggleExpanded"
            >
              {{ isExpanded ? "收起" : "展开全部" }}
            </el-button>
          </div>
        </div>

        <div v-if="assignment.questionMaterial?.content" class="info-card">
          <h4>作业原题</h4>
          <div v-html="assignment.questionMaterial.content"></div>
        </div>

        <div v-if="assignment.gradingNotes" class="info-card info-card--notes">
          <h4>教师补充要求</h4>
          <p>{{ assignment.gradingNotes }}</p>
        </div>

        <div class="flex items-center gap-6 text-sm text-gray-600 flex-wrap">
          <div class="flex items-center gap-2">
            <el-icon><User /></el-icon>
            <span>教师：{{ assignment.teacherName }}</span>
          </div>
          <div class="flex items-center gap-2">
            <el-icon><Clock /></el-icon>
            <span>截止时间：{{ formatDate(assignment.dueDate || assignment.endDate) }}</span>
          </div>
          <div v-if="assignment.submissionFormat" class="flex items-center gap-2">
            <el-icon><Star /></el-icon>
            <span>提交形式：{{ getSubmissionFormatText(assignment.submissionFormat) }}</span>
          </div>
          <div v-if="isOverdue" class="flex items-center gap-2 text-red-600 font-medium">
            <el-icon><Warning /></el-icon>
            <span>已过期</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from "vue";
import {
  ArrowDown,
  ArrowUp,
  Clock,
  Star,
  User,
  Warning,
} from "@element-plus/icons-vue";
import type { Submission } from "../../../../api/submissions";
import type { AssignmentMaterial, SubmissionFormat } from "@/types/assignments";
import { useSubmissionUtils } from "../composables";

type SubmissionAssignment = {
  description: string;
  teacherName: string;
  dueDate?: string;
  endDate?: string;
  maxScore?: number;
  questionMaterial?: AssignmentMaterial;
  gradingNotes?: string;
  submissionFormat?: SubmissionFormat;
};

interface Props {
  assignment: SubmissionAssignment;
  submission?: Submission | null;
  statusTagType: "success" | "warning" | "info" | "primary" | "danger";
  statusText: string;
  isOverdue: boolean;
}

const props = defineProps<Props>();

const { formatDate } = useSubmissionUtils();

const getSubmissionFormatText = (format?: SubmissionFormat) => {
  switch (format) {
    case "answer_sheet":
      return "答题卡 / 图片 / PDF";
    case "answers_only":
      return "仅填写答案";
    case "mixed":
      return "答案 + 附件混合";
    default:
      return "未设置";
  }
};

const isExpanded = ref(false);
const descriptionRef = ref<HTMLElement>();
const shouldShowToggle = ref(false);

const checkContentHeight = async () => {
  await nextTick();
  if (!descriptionRef.value) return;

  const tempElement = descriptionRef.value.cloneNode(true) as HTMLElement;
  tempElement.style.position = "absolute";
  tempElement.style.visibility = "hidden";
  tempElement.style.height = "auto";
  tempElement.style.maxHeight = "none";
  tempElement.style.overflow = "visible";
  tempElement.className = tempElement.className.replace(/line-clamp-\d+/g, "");

  document.body.appendChild(tempElement);

  const lineHeight = 24;
  const maxHeight = lineHeight * 3;
  shouldShowToggle.value = tempElement.scrollHeight > maxHeight;

  document.body.removeChild(tempElement);
};

const toggleExpanded = () => {
  isExpanded.value = !isExpanded.value;
};

watch(
  () => props.assignment.description,
  () => {
    void checkContentHeight();
  },
  { immediate: true }
);

onMounted(() => {
  void checkContentHeight();
});

defineOptions({
  name: "AssignmentInfo",
});
</script>

<style scoped>
.info-card {
  padding: 14px 16px;
  border-radius: 10px;
  border: 1px solid #dbeafe;
  background: #f8fbff;
}

.info-card--notes {
  border-color: #fde68a;
  background: #fffbeb;
}

.info-card h4 {
  margin: 0 0 8px;
  font-size: 14px;
  font-weight: 600;
  color: #111827;
}

.info-card p {
  margin: 0;
  line-height: 1.7;
  color: #374151;
}

.form-section {
  border-bottom: 1px solid #f0f2f5;
  padding: 20px;
}

.section-content {
  max-width: none;
}

.prose {
  max-width: none;
}

.line-clamp-3 {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>

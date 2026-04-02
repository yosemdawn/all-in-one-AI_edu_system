<template>
  <div class="assignment-detail-container">
    <div v-loading="loading" class="bg-white rounded-lg shadow-sm">
      <div class="border-b border-gray-200 px-6 py-4">
        <div class="flex items-start justify-between gap-4">
          <div class="flex-1 min-w-0">
            <h1 class="text-2xl font-bold text-gray-900 mb-2">
              {{ assignment?.title || "作业详情" }}
            </h1>
            <div
              v-if="assignment"
              class="flex flex-wrap items-center gap-4 text-sm text-gray-500"
            >
              <span>教师：{{ assignment.teacherName || "-" }}</span>
              <span>截止时间：{{ formatDate(assignment.endDate) }}</span>
              <span v-if="assignment.className">班级：{{ assignment.className }}</span>
            </div>
          </div>
          <el-tag :type="getAssignmentStatusType(assignment)" size="large">
            {{ getAssignmentStatusText(assignment) }}
          </el-tag>
        </div>
      </div>

      <div class="p-6" v-if="assignment">
        <div class="prose max-w-none">
          <h3 class="text-lg font-medium text-gray-900 mb-3">作业要求</h3>
          <div class="text-gray-700" v-html="assignment.description"></div>
        </div>

        <div v-if="assignment.questionMaterial?.content" class="mt-6 detail-card">
          <h3 class="text-lg font-medium text-gray-900 mb-3">题目内容</h3>
          <div class="text-gray-700" v-html="assignment.questionMaterial.content"></div>
        </div>

        <div
          v-if="assignment.referenceAnswer?.content"
          class="mt-6 detail-card detail-card--answer"
        >
          <h3 class="text-lg font-medium text-gray-900 mb-3">参考答案</h3>
          <div class="text-gray-700" v-html="assignment.referenceAnswer.content"></div>
        </div>

        <div v-if="assignment.gradingNotes" class="mt-6 detail-card detail-card--notes">
          <h3 class="text-lg font-medium text-gray-900 mb-3">补充说明</h3>
          <div class="text-gray-700 whitespace-pre-wrap">{{ assignment.gradingNotes }}</div>
        </div>

        <div class="mt-6 p-4 bg-gray-50 rounded-lg">
          <h3 class="text-lg font-medium text-gray-900 mb-3">当前状态</h3>
          <div class="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span class="text-gray-500">提交状态：</span>
              <el-tag :type="getSubmissionStatusType(assignment)" size="small">
                {{ getSubmissionStatusText(assignment) }}
              </el-tag>
            </div>
            <div v-if="assignment.hasSubmitted">
              <span class="text-gray-500">批改状态：</span>
              <el-tag
                :type="getReviewStatusType(assignment.submissionStatus)"
                size="small"
              >
                {{ getReviewStatusText(assignment.submissionStatus) }}
              </el-tag>
            </div>
            <div>
              <span class="text-gray-500">作业状态：</span>
              <el-tag :type="assignment.isExpired ? 'danger' : 'success'" size="small">
                {{ assignment.isExpired ? "已过期" : "进行中" }}
              </el-tag>
            </div>
            <div v-if="assignment.terminatedReason">
              <span class="text-gray-500">终止原因：</span>
              <span class="text-red-600">{{ assignment.terminatedReason }}</span>
            </div>
          </div>
        </div>

        <div class="mt-6 flex justify-end gap-3 flex-wrap">
          <el-button @click="goBack">返回</el-button>
          <el-button
            v-if="assignment.hasSubmitted || assignment.hasDraft"
            type="primary"
            @click="goToSubmission"
          >
            {{ assignment.hasSubmitted ? "查看提交" : "继续编辑" }}
          </el-button>
          <el-button v-else-if="assignment.canSubmit" type="primary" @click="goToSubmission">
            开始作业
          </el-button>
          <el-tag v-else-if="assignment.isExpired" type="danger" size="large">
            作业已过期
          </el-tag>
          <el-tag v-else-if="assignment.status === 'terminated'" type="warning" size="large">
            作业已终止
          </el-tag>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import { getStudentAssignment } from "../../../api/assignments";

const route = useRoute();
const router = useRouter();

const loading = ref(false);
const assignment = ref<any>(null);

const assignmentId = computed(
  () => (route.query.assignmentId || route.params.id) as string
);
const classId = computed(() => route.query.classId as string | undefined);

const loadAssignment = async () => {
  if (!assignmentId.value) {
    ElMessage.error("缺少作业ID");
    router.replace("/student/assignments");
    return;
  }

  loading.value = true;
  try {
    assignment.value = await getStudentAssignment(assignmentId.value, classId.value);
  } catch (error: any) {
    console.error("加载作业详情失败:", error);
    ElMessage.error(error?.message || "加载作业详情失败");
  } finally {
    loading.value = false;
  }
};

const formatDate = (date?: string) => {
  if (!date) return "-";
  return new Date(date).toLocaleString("zh-CN");
};

const getAssignmentStatusType = (item?: any) => {
  if (!item) return "info";
  if (item.status === "terminated") return "warning";
  if (item.isExpired) return "danger";
  if (item.hasSubmitted) return "success";
  if (item.hasDraft) return "info";
  return "primary";
};

const getAssignmentStatusText = (item?: any) => {
  if (!item) return "未知";
  if (item.status === "terminated") return "已终止";
  if (item.isExpired) return "已过期";
  if (item.hasSubmitted) return "已提交";
  if (item.hasDraft) return "草稿";
  return "待处理";
};

const getSubmissionStatusType = (item?: any) => {
  if (!item) return "info";
  if (item.hasDraft && !item.hasSubmitted) return "warning";
  if (item.hasSubmitted) return "success";
  if (item.isExpired) return "danger";
  return "info";
};

const getSubmissionStatusText = (item?: any) => {
  if (!item) return "未知";
  if (item.hasDraft && !item.hasSubmitted) return "草稿";
  if (item.hasSubmitted) return "已提交";
  if (item.isExpired) return "未提交";
  return "待提交";
};

const getReviewStatusType = (status?: string) => {
  switch (status) {
    case "teacher_reviewed":
      return "success";
    case "ai_reviewed":
      return "warning";
    case "submitted":
      return "info";
    default:
      return "info";
  }
};

const getReviewStatusText = (status?: string) => {
  switch (status) {
    case "teacher_reviewed":
      return "已批改";
    case "ai_reviewed":
      return "AI已评";
    case "submitted":
      return "待批改";
    default:
      return "待批改";
  }
};

const goBack = () => {
  router.push("/student/assignments");
};

const goToSubmission = () => {
  router.push({
    path: "/student/submissions",
    query: {
      assignmentId: assignmentId.value,
      classId: classId.value || assignment.value?.classId || "",
    },
  });
};

onMounted(() => {
  loadAssignment();
});
</script>

<style scoped>
.assignment-detail-container {
  max-width: 960px;
  margin: 0 auto;
  padding: 20px;
}

.detail-card {
  padding: 16px;
  border-radius: 12px;
  border: 1px solid #dbeafe;
  background: #f8fbff;
}

.detail-card--answer {
  border-color: #bbf7d0;
  background: #f0fdf4;
}

.detail-card--notes {
  border-color: #fde68a;
  background: #fffbeb;
}
</style>

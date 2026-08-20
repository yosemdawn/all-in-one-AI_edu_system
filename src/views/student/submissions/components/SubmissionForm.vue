<template>
  <div class="form-section">
    <!-- <div class="section-header">
      <h3 class="section-title">
        {{ submission?.isDraft ? '编辑作业' : '提交作业' }}
      </h3>
    </div> -->
    <div class="section-content">
      <!-- 过期或终止提示 -->
      <div v-if="isOverdue || isTerminated" class="mb-6">
        <!-- 过期提示 -->
        <el-alert
          v-if="isOverdue"
          title="作业已过期"
          type="error"
          :closable="false"
          show-icon
        >
          <template #default>
            <p class="mb-2">
              <strong>截止时间：</strong>{{ formatDate(assignment?.dueDate) }}
            </p>
            <p class="text-sm">作业提交时间已过，无法再提交作业或保存草稿</p>
          </template>
        </el-alert>

        <!-- 终止提示 -->
        <el-alert
          v-else-if="isTerminated"
          title="作业已终止"
          type="error"
          :closable="false"
          show-icon
        >
          <template #default>
            <p class="mb-2" v-if="assignment?.terminatedReason">
              <strong>终止原因：</strong>{{ assignment.terminatedReason }}
            </p>
            <p class="text-sm">该作业已被教师终止，无法再提交作业或保存草稿</p>
          </template>
        </el-alert>
      </div>

      <!-- 表单内容 -->
      <div v-if="!isOverdue && !isTerminated">
        <div class="submission-guidance mb-6" v-if="assignment">
          <div class="submission-guidance__header">
            <h4>提交说明</h4>
            <p>
              当前作业会结合老师提供的原题、标准答案和评分规则模板进行 AI 批改。
            </p>
          </div>
          <ul class="submission-guidance__list">
            <li v-if="assignment?.submissionFormat === 'answer_sheet'">
              请上传答题卡、试卷照片或 PDF，并尽量保证字迹清晰。
            </li>
            <li v-else-if="assignment?.submissionFormat === 'answers_only'">
              请直接填写答案内容，按题号或结构清晰作答。
            </li>
            <li v-else>
              可填写答案并按需补充附件，AI 会综合进行批改。
            </li>
            <li v-if="assignment?.gradingNotes">教师补充要求：{{ assignment.gradingNotes }}</li>
          </ul>
        </div>

        <el-form
          ref="formRef"
          :model="form"
          :rules="rules"
          :label-width="isMobile ? 'auto' : '100px'"
          :label-position="labelPosition"
          size="large"
          scroll-to-error
        >
          <!-- 作业内容 -->
          <el-form-item
            label="答案内容"
            prop="content"
            :required="assignment?.submissionFormat !== 'answer_sheet'"
          >
            <div class="w-full">
              <wang-editor
                ref="editorRef"
                v-model="form.content"
                :height="editorHeight"
                :placeholder="getContentPlaceholder()"
                :max-length="5000"
              />
            </div>
          </el-form-item>

          <el-form-item v-if="assignment?.allowAttachments" label="作业附件">
            <div class="w-full">
              <el-upload
                v-model:file-list="fileList"
                drag
                multiple
                :auto-upload="false"
                :limit="10"
                :before-upload="beforeUpload"
                :on-change="handleFileChange"
                :on-remove="handleFileChange"
                :on-exceed="handleExceed"
                accept=".doc,.docx,.pdf,.txt,.jpg,.jpeg,.png,.zip,.rar"
              >
                <el-icon><UploadFilled /></el-icon>
                <div class="el-upload__text">
                  拖拽文件到这里，或点击选择
                </div>
                <template #tip>
                  <div class="el-upload__tip">
                    最多 10 个文件，单个不超过 10MB
                  </div>
                </template>
              </el-upload>
            </div>
          </el-form-item>
        </el-form>
      </div>

      <!-- 只读显示（过期或终止时显示现有内容） -->
      <div v-else-if="submission?.content" class="mt-4">
        <h4 class="text-base font-medium text-gray-900 mb-3">当前作业内容</h4>
        <div
          class="prose max-w-none text-gray-700 p-4 bg-gray-50 rounded-lg border"
          v-html="submission.content"
        ></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watch, computed } from "vue";
import { useStore } from "vuex";
import { ElMessage } from "element-plus";
import { UploadFilled } from "@element-plus/icons-vue";
import type { Submission } from "../../../../api/submissions";
import { useSubmissionUtils } from "../composables";

interface Props {
  submission?: Submission | null;
  assignment?: any;
  isOverdue?: boolean;
}

const props = defineProps<Props>();
const store = useStore();

const { formatDate, beforeUpload } = useSubmissionUtils();
const isMobile = computed(() => store.getters["app/isMobile"]);
const editorHeight = computed(() => (isMobile.value ? "260px" : "350px"));
const labelPosition = computed(() => (isMobile.value ? "top" : "right"));

const formRef = ref();
const editorRef = ref();
const fileList = ref<any[]>([]);

const getContentPlaceholder = () => {
  if (props.assignment?.submissionFormat === "answer_sheet") {
    return "如有文字答案可在此补充说明，主要请上传清晰答题卡或试卷附件。";
  }

  if (props.assignment?.submissionFormat === "answers_only") {
    return "请按题号填写答案，例如：1.A 2.C 3.……";
  }

  return "请在此输入您的答案内容，必要时可结合附件一起提交。";
};

// 计算属性
const isTerminated = computed(() => {
  return props.assignment?.status === "terminated";
});

// 表单数据
const form = reactive({
  content: "",
});

// 自定义校验函数：检查富文本的实际字符长度
const validateContent = (rule: any, value: string, callback: any) => {
  // 获取富文本编辑器的实际字符长度
  const textLength = editorRef.value?.getTextLength() || 0;

  console.log("🔍 校验富文本内容:", {
    htmlValue: value,
    htmlLength: value?.length || 0,
    textLength: textLength,
    editorRef: !!editorRef.value,
  });

  if (textLength === 0 && fileList.value.length === 0) {
    callback(new Error("请输入作业内容或上传附件"));
    return;
  }

  if (textLength > 0 && textLength < 10) {
    callback(
      new Error(`作业内容至少需要10个字符，当前只有${textLength}个字符`)
    );
    return;
  }

  callback();
};

// 校验规则
const rules = {
  content: [
    {
      required: true,
      validator: validateContent,
      trigger: "blur",
    },
  ],
};

// 校验方法
const validate = async () => {
  try {
    await formRef.value?.validate();
    return true;
  } catch (error) {
    return false;
  }
};

const handleFileChange = (uploadFile?: any) => {
  if (uploadFile?.raw && !beforeUpload(uploadFile.raw)) {
    fileList.value = fileList.value.filter(
      (item) => item.uid !== uploadFile.uid
    );
  }
  formRef.value?.validateField("content").catch(() => undefined);
};

const handleExceed = () => {
  ElMessage.warning("单次提交最多保留 10 个附件");
};

const getAttachmentPayload = () => {
  if (!props.assignment?.allowAttachments) {
    return { files: [], retainedAttachmentIds: [] };
  }

  return {
    files: fileList.value
      .map((item) => item.raw)
      .filter((file): file is File => file instanceof File),
    retainedAttachmentIds: fileList.value
      .map((item) => item.attachmentId)
      .filter((id): id is string => typeof id === "string" && !!id),
  };
};

// 暴露表单实例和数据给父组件
defineExpose({
  formRef,
  form,
  validate,
  getAttachmentPayload,
});

// 监听 submission 变化，填充表单数据
watch(
  () => props.submission,
  (newSubmission) => {
    if (newSubmission) {
      form.content = newSubmission.content || "";
      fileList.value = (newSubmission.attachments || []).map((attachment) => ({
        name: attachment.fileName,
        size: attachment.fileSize,
        status: "success",
        uid: attachment.id,
        url: attachment.fileUrl,
        attachmentId: attachment.id,
      }));
    } else {
      form.content = "";
      fileList.value = [];
    }
  },
  { immediate: true }
);

defineOptions({
  name: "SubmissionForm",
});
</script>

<style scoped>
.submission-guidance {
  padding: 16px 18px;
  border-radius: 12px;
  border: 1px solid #dbeafe;
  background: linear-gradient(135deg, #eff6ff 0%, #f8fafc 100%);
}

.submission-guidance__header h4 {
  margin: 0 0 6px;
  font-size: 15px;
  font-weight: 600;
  color: #1d4ed8;
}

.submission-guidance__header p {
  margin: 0;
  font-size: 13px;
  color: #475569;
}

.submission-guidance__list {
  margin: 12px 0 0;
  padding-left: 18px;
  color: #334155;
  font-size: 13px;
  line-height: 1.8;
}

/* 表单分区样式 */
.form-section {
  border-bottom: 1px solid #f0f2f5;
}

.section-header {
  padding: 20px 24px 16px;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  border-bottom: 1px solid #e5e7eb;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
  display: flex;
  align-items: center;
}

.section-title::before {
  content: "";
  width: 4px;
  height: 16px;
  background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
  margin-right: 12px;
  border-radius: 2px;
}

.section-content {
  /* padding: 24px; */
}

@media (max-width: 768px) {
  .submission-guidance {
    padding: 14px;
    border-radius: 10px;
  }

  .submission-guidance__header h4 {
    font-size: 14px;
  }

  .submission-guidance__header p,
  .submission-guidance__list {
    font-size: 12px;
  }
}
</style>

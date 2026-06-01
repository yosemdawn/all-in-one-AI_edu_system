<template>
  <div class="work-edit-container">
    <!-- 页面头部 - 响应式设计 -->
    <div
      class="flex items-center justify-between max-w-4xl mx-auto sm:px-6 lg:px-8 py-4 mb-2"
    >
      <div class="flex items-center gap-3">
        <el-button
          link
          @click="goBack"
          :icon="ArrowLeft"
          class="!p-2 !text-gray-600 hover:!text-blue-600 hover:!bg-blue-50 !rounded-lg"
        >
          <span class="hidden sm:inline ml-1">返回</span>
        </el-button>

        <h1 class="text-lg sm:text-xl font-semibold text-gray-900 truncate">
          {{ isEdit ? "编辑作业" : "创建作业" }}
        </h1>
      </div>

      <div>
        <el-button
          @click="handleSaveDraft"
          :loading="saving"
          class="flex-1 sm:flex-none !text-sm"
        >
          保存草稿
        </el-button>
        <el-button
          type="primary"
          @click="handlePublish"
          :loading="saving"
          class="flex-1 sm:flex-none !text-sm"
        >
          {{ isEdit ? "更新并发布" : "发布作业" }}
        </el-button>
      </div>
    </div>

    <!-- 表单内容 - 响应式容器 -->
    <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="bg-white rounded-lg shadow-sm border border-gray-200">
        <el-form
          ref="formRef"
          :model="formData"
          :rules="formRules"
          :label-width="isMobile ? 'auto' : '100px'"
          :label-position="isMobile ? 'top' : 'left'"
          size="default"
          class="assignment-form"
          :scroll-to-error="true"
          :scroll-into-view-options="{
            behavior: 'smooth',
            block: 'center',
            inline: 'center',
          }"
        >
          <!-- 基本信息区域 -->
          <div class="form-section">
            <div class="section-header">
              <h3 class="section-title">基本信息</h3>
            </div>
            <div class="section-content">
              <!-- 作业标题 -->
              <el-form-item label="作业标题" prop="title" class="form-item">
                <el-input
                  v-model="formData.title"
                  placeholder="请输入作业标题"
                  maxlength="100"
                  show-word-limit
                  class="w-full"
                />
              </el-form-item>

              <!-- 作业描述 -->
              <el-form-item
                label="作业描述"
                prop="description"
                class="form-item"
              >
                <div class="w-full">
                  <wang-editor
                    v-model="formData.description"
                    :height="isMobile ? '320px' : '350px'"
                    placeholder="请输入作业描述，支持富文本格式"
                    :max-length="3000"
                    @exceed="handleDescriptionExceed"
                    class="w-full"
                  />
                </div>
              </el-form-item>
            </div>
          </div>

          <!-- 配置信息区域 -->
          <div class="form-section">
            <div class="section-header">
              <h3 class="section-title">配置信息</h3>
            </div>
            <div class="section-content">
              <!-- 关联班级 -->
              <div class="mb-6">
                <el-form-item label="关联班级" prop="classes" class="form-item">
                  <class-selector v-model="formData.classes" />
                </el-form-item>
              </div>

              <div class="mb-6">
                <el-form-item label="作业类型" prop="assignmentType" class="form-item">
                  <el-radio-group v-model="formData.assignmentType">
                    <el-radio-button label="normal">普通作业</el-radio-button>
                    <el-radio-button label="online">在线作业</el-radio-button>
                  </el-radio-group>
                </el-form-item>
                <p class="form-helper-text">
                  普通作业沿用文本/图片提交；在线作业适合选择题、填空题，学生逐题在线作答并自动判分。
                </p>
              </div>

              <!-- 评分规则模板 -->
              <div v-if="formData.assignmentType === 'normal'" class="mb-6">
                <el-form-item
                  label="评分规则模板"
                  prop="aiRule"
                  class="form-item"
                >
                  <ai-rule-selector v-model="formData.aiRule" />
                </el-form-item>
                <p class="form-helper-text">
                  优先使用可复用的评分规则模板，帮助 AI 保持批改口径一致。
                </p>
              </div>

              <!-- 批改依据 -->
              <div v-if="formData.assignmentType === 'normal'" class="mb-6 space-y-6">
                <div class="material-block">
                  <div class="material-block__header">
                    <h4 class="material-block__title">作业原题</h4>
                    <p class="material-block__desc">
                      当学生提交答题卡或只写答案时，AI 会优先参考这里的题目内容。
                    </p>
                  </div>
                  <el-form-item label="原题内容" prop="questionMaterial.content" class="form-item">
                    <wang-editor
                      v-model="formData.questionMaterial.content"
                      :height="isMobile ? '240px' : '260px'"
                      placeholder="请输入题目原文、题干、题目要求等内容"
                      :max-length="4000"
                      class="w-full"
                    />
                  </el-form-item>
                </div>

                <div class="material-block">
                  <div class="material-block__header">
                    <h4 class="material-block__title">标准答案</h4>
                    <p class="material-block__desc">
                      AI 将以这里的标准答案作为批改依据，适合答题卡、选择题、简答题等场景。
                    </p>
                  </div>
                  <el-form-item label="答案内容" prop="referenceAnswer.content" class="form-item">
                    <wang-editor
                      v-model="formData.referenceAnswer.content"
                      :height="isMobile ? '240px' : '260px'"
                      placeholder="请输入标准答案、参考解析或评分要点"
                      :max-length="4000"
                      class="w-full"
                    />
                  </el-form-item>
                </div>

                <el-form-item label="补充要求" prop="gradingNotes" class="form-item">
                  <el-input
                    v-model="formData.gradingNotes"
                    type="textarea"
                    :rows="4"
                    maxlength="1000"
                    show-word-limit
                    placeholder="可补充说明扣分点、特殊要求、评分偏好等"
                  />
                </el-form-item>

                <el-form-item label="学生提交形式" prop="submissionFormat" class="form-item">
                  <el-radio-group v-model="formData.submissionFormat">
                    <el-radio label="answer_sheet">答题卡 / 图片 / PDF</el-radio>
                    <el-radio label="answers_only">仅填写答案</el-radio>
                    <el-radio label="mixed">答案 + 附件混合</el-radio>
                  </el-radio-group>
                </el-form-item>
              </div>

              <div v-else class="mb-6">
                <div class="online-builder">
                  <div class="online-builder__header">
                    <div>
                      <h4 class="online-builder__title">在线题目</h4>
                      <p class="online-builder__desc">
                        选择题答案必须与某个选项完全一致；填空题会按字符完全一致判分，英文字母大小写也必须一致。
                      </p>
                    </div>
                    <el-button type="primary" :icon="Plus" plain @click="addOnlineQuestion">
                      添加题目
                    </el-button>
                  </div>

                  <div class="online-question-list">
                    <div
                      v-for="(question, questionIndex) in formData.onlineQuestions"
                      :key="question.id"
                      class="online-question-card"
                    >
                      <div class="online-question-card__top">
                        <div class="online-question-card__index">
                          第 {{ questionIndex + 1 }} 题
                        </div>
                        <div class="online-question-card__actions">
                          <el-select v-model="question.type" class="question-type-select" @change="handleQuestionTypeChange(question)">
                            <el-option label="选择题" value="single_choice" />
                            <el-option label="填空题" value="fill_blank" />
                          </el-select>
                          <el-input-number
                            v-model="question.score"
                            :min="0.5"
                            :step="0.5"
                            :precision="1"
                            controls-position="right"
                            class="question-score-input"
                          />
                          <el-button
                            :icon="Delete"
                            plain
                            type="danger"
                            :disabled="formData.onlineQuestions.length <= 1"
                            @click="removeOnlineQuestion(questionIndex)"
                          />
                        </div>
                      </div>

                      <el-form-item
                        :prop="`onlineQuestions.${questionIndex}.stem`"
                        label="题目"
                        class="form-item"
                      >
                        <el-input
                          v-model="question.stem"
                          type="textarea"
                          :rows="3"
                          maxlength="1000"
                          show-word-limit
                          placeholder="请输入题干"
                        />
                      </el-form-item>

                      <div v-if="question.type === 'single_choice'" class="option-list">
                        <div
                          v-for="(option, optionIndex) in question.options"
                          :key="`${question.id}-option-${optionIndex}`"
                          class="option-row"
                        >
                          <span class="option-label">{{ getOptionLabel(optionIndex) }}</span>
                          <el-input
                            v-model="question.options[optionIndex]"
                            placeholder="选项内容"
                          />
                          <el-button
                            :icon="Delete"
                            link
                            type="danger"
                            :disabled="question.options.length <= 2"
                            @click="removeOption(question, optionIndex)"
                          />
                        </div>
                        <el-button link type="primary" :icon="Plus" @click="addOption(question)">
                          添加选项
                        </el-button>
                      </div>

                      <el-form-item label="标准答案" class="form-item">
                        <el-select
                          v-if="question.type === 'single_choice'"
                          v-model="question.answer"
                          class="w-full"
                          placeholder="请选择正确选项"
                        >
                          <el-option
                            v-for="(option, optionIndex) in question.options.filter(Boolean)"
                            :key="`${question.id}-answer-${optionIndex}`"
                            :label="`${getOptionLabel(optionIndex)}. ${option}`"
                            :value="option"
                          />
                        </el-select>
                        <el-input
                          v-else
                          v-model="question.answer"
                          placeholder="请输入标准答案，判分时大小写和空格必须完全一致"
                        />
                      </el-form-item>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 时间设置 - 响应式网格 -->
              <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <el-form-item
                  label="开始时间"
                  prop="startDate"
                  class="form-item"
                >
                  <el-date-picker
                    v-model="formData.startDate"
                    type="datetime"
                    placeholder="请选择开始时间"
                    format="YYYY-MM-DD HH:mm"
                    value-format="YYYY-MM-DD HH:mm:ss"
                    class="w-full"
                    :size="isMobile ? 'default' : 'default'"
                  />
                </el-form-item>
                <el-form-item label="截止时间" prop="endDate" class="form-item">
                  <el-date-picker
                    v-model="formData.endDate"
                    type="datetime"
                    placeholder="请选择截止时间"
                    format="YYYY-MM-DD HH:mm"
                    value-format="YYYY-MM-DD HH:mm:ss"
                    class="w-full"
                    :size="isMobile ? 'default' : 'default'"
                  />
                </el-form-item>
              </div>

              <!-- 其他设置 -->
              <el-form-item label="附件设置" class="form-item">
                <div class="flex items-center gap-3">
                  <el-switch v-model="formData.allowAttachments" />
                  <span class="text-sm text-gray-600">允许学生上传附件</span>
                </div>
              </el-form-item>

              <div class="grading-hint-card">
                <h4>{{ formData.assignmentType === 'online' ? '在线作业说明' : 'AI 批改说明' }}</h4>
                <p>
                  {{
                    formData.assignmentType === 'online'
                      ? '学生将在独立答题页逐题完成，提交后系统立即按标准答案自动判分。'
                      : '当前默认采用“题目 + 标准答案 + 评分规则模板”进行批改。适合答题卡、仅答案、简答题和混合提交场景。'
                  }}
                </p>
              </div>
            </div>
          </div>
        </el-form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage, ElMessageBox } from "element-plus";
import { ArrowLeft, Delete, Plus } from "@element-plus/icons-vue";
import type { FormInstance, FormRules } from "element-plus";
import {
  getAssignment,
  createAssignment,
  updateAssignment,
  updateAssignmentStatus,
  AssignmentStatus,
} from "@/api/assignments";
import type {
  CreateAssignmentDto,
  AiRuleSnapshot,
  OnlineQuestion,
  SubmissionFormat,
} from "@/types/assignments";
import type { Assignment as ApiAssignment } from "@/api/assignments";
import WangEditor from "@/components/WangEditor.vue";
import ClassSelector from "../components/ClassSelector.vue";
import AiRuleSelector from "../components/AiRuleSelector.vue";
import moment from "moment";

const route = useRoute();
const router = useRouter();

// 响应式检测
const isMobile = ref(false);

const checkMobile = () => {
  isMobile.value = window.innerWidth < 768;
};
// 检测window的size事件
window.addEventListener("resize", checkMobile);
// 是否编辑模式
const isEdit = computed(() => !!route.query.id);
const assignmentId = computed(() => route.query.id as string);

// 表单引用
const formRef = ref<FormInstance>();

// 状态
const saving = ref(false);
const loading = ref(false);

// 表单数据
const formData = reactive<CreateAssignmentDto & { allowAttachments: boolean }>({
  title: "",
  description: "",
  classes: [],
  aiRule: null as AiRuleSnapshot | null,
  assignmentType: "normal",
  onlineQuestions: [],
  questionMaterial: {
    content: "",
  },
  referenceAnswer: {
    content: "",
  },
  gradingNotes: "",
  submissionFormat: "mixed" as SubmissionFormat,
  startDate: "",
  endDate: "",
  allowAttachments: false,
});

// 表单验证规则
const formRules: FormRules = {
  title: [
    { required: true, message: "请输入作业标题", trigger: "blur" },
    {
      min: 2,
      max: 100,
      message: "标题长度在 2 到 100 个字符",
      trigger: "blur",
    },
  ],
  description: [
    { required: true, message: "请输入作业描述", trigger: "blur" },
    {
      validator: (rule, value, callback) => {
        if (!value || value.trim() === "") {
          callback(new Error("请输入作业描述"));
          return;
        }

        // 计算纯文本字数
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = value;
        const text = tempDiv.textContent || tempDiv.innerText || "";
        const textLength = text.replace(/\s+/g, " ").trim().length;

        if (textLength > 3000) {
          callback(new Error(`作业描述不能超过3000字，当前${textLength}字`));
        } else {
          callback();
        }
      },
      trigger: "blur",
    },
  ],
  classes: [{ required: true, message: "请选择关联班级", trigger: "change" }],
  assignmentType: [
    { required: true, message: "请选择作业类型", trigger: "change" },
  ],
  aiRule: [
    {
      validator: (_rule, value, callback) => {
        if (formData.assignmentType === "normal" && !value) {
          callback(new Error("请选择评分规则模板"));
          return;
        }
        callback();
      },
      trigger: "change",
    },
  ],
  "questionMaterial.content": [
    {
      validator: (_rule, value, callback) => {
        if (formData.assignmentType === "normal" && !value) {
          callback(new Error("请输入作业原题"));
          return;
        }
        callback();
      },
      trigger: "blur",
    },
  ],
  "referenceAnswer.content": [
    {
      validator: (_rule, value, callback) => {
        if (formData.assignmentType === "normal" && !value) {
          callback(new Error("请输入标准答案"));
          return;
        }
        callback();
      },
      trigger: "blur",
    },
  ],
  submissionFormat: [
    { required: true, message: "请选择学生提交形式", trigger: "change" },
  ],
  startDate: [
    { required: true, message: "请选择开始时间", trigger: "change" },
    {
      validator: (rule, value, callback) => {
        if (!value) {
          callback(new Error("请选择开始时间"));
          return;
        }

        const startDateTime = new Date(value);
        const now = new Date();

        // 新建作业时，开始时间不能早于当前时间
        if (!isEdit.value && startDateTime < now) {
          callback(new Error("开始时间不能早于当前时间"));
          return;
        }

        callback();
      },
      trigger: "change",
    },
  ],
  //
  endDate: [
    { required: true, message: "请选择截止时间", trigger: "change" },
    {
      validator: (rule, value, callback) => {
        if (!value) {
          callback(new Error("请选择截止时间"));
          return;
        }

        const endDateTime = new Date(value);
        const now = new Date();

        // 检查截止时间是否晚于当前时间
        if (endDateTime <= now) {
          callback(new Error("截止时间必须晚于当前时间"));
          return;
        }

        // 检查截止时间是否晚于开始时间
        if (formData.startDate && endDateTime <= new Date(formData.startDate)) {
          callback(new Error("截止时间必须晚于开始时间"));
          return;
        }

        callback();
      },
      trigger: "change",
    },
  ],
};

// 初始化表单数据
const initFormData = () => {
  if (!isEdit.value) {
    // 新建模式，设置默认时间
    const now = new Date();
    formData.startDate = new Date(now.getTime() + 60 * 60 * 1000)
      .toISOString()
      .slice(0, 19)
      .replace("T", " ");
    formData.endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 19)
      .replace("T", " ");
    formData.questionMaterial = { content: "" };
    formData.referenceAnswer = { content: "" };
    formData.gradingNotes = "";
    formData.assignmentType = "normal";
    formData.onlineQuestions = [createOnlineQuestion()];
    formData.submissionFormat = "mixed";
  }
};

// 加载作业数据（编辑模式）
const loadAssignmentData = async () => {
  if (!isEdit.value) return;

  loading.value = true;
  try {
    const assignment = (await getAssignment(assignmentId.value)) as ApiAssignment;
    Object.assign(formData, {
      title: assignment.title,
      description: assignment.description,
      classes: assignment.classes.map((cls) => cls.id),
      aiRule: assignment.aiRule,
      questionMaterial: assignment.questionMaterial || { content: "" },
      referenceAnswer: assignment.referenceAnswer || { content: "" },
      assignmentType: assignment.assignmentType || "normal",
      onlineQuestions:
        assignment.onlineQuestions?.length
          ? assignment.onlineQuestions
          : [createOnlineQuestion()],
      gradingNotes: assignment.gradingNotes || "",
      submissionFormat: assignment.submissionFormat || "mixed",
      startDate: moment(assignment.startDate).format("YYYY-MM-DD HH:mm:ss"),
      endDate: moment(assignment.endDate).format("YYYY-MM-DD HH:mm:ss"),
      allowAttachments: assignment.allowAttachments,
    });
  } catch (error) {
    console.error("加载作业数据失败:", error);
    ElMessage.error("加载作业数据失败");
  } finally {
    loading.value = false;
  }
};

// 构建作业数据
const buildAssignmentData = (includeStatus = false) => {
  const data: any = {
    title: formData.title,
    description: formData.description,
    classes: formData.classes,
    aiRule: formData.assignmentType === "normal" ? formData.aiRule : null,
    questionMaterial:
      formData.assignmentType === "normal" ? formData.questionMaterial : { content: "" },
    referenceAnswer:
      formData.assignmentType === "normal" ? formData.referenceAnswer : { content: "" },
    assignmentType: formData.assignmentType,
    onlineQuestions:
      formData.assignmentType === "online" ? normalizeOnlineQuestionsForSubmit() : [],
    gradingNotes: formData.gradingNotes,
    submissionFormat:
      formData.assignmentType === "online" ? "answers_only" : formData.submissionFormat,
    startDate: formData.startDate,
    endDate: formData.endDate,
    allowAttachments:
      formData.assignmentType === "online" ? false : formData.allowAttachments,
  };

  if (includeStatus) {
    data.status = AssignmentStatus.DRAFT;
  }

  return data;
};

const createOnlineQuestion = (): OnlineQuestion => ({
  id: `q-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  type: "single_choice",
  stem: "",
  options: ["", ""],
  answer: "",
  score: 1,
});

const addOnlineQuestion = () => {
  formData.onlineQuestions.push(createOnlineQuestion());
};

const removeOnlineQuestion = (index: number) => {
  if (formData.onlineQuestions.length <= 1) return;
  formData.onlineQuestions.splice(index, 1);
};

const handleQuestionTypeChange = (question: OnlineQuestion) => {
  question.answer = "";
  if (question.type === "single_choice" && question.options.length < 2) {
    question.options = ["", ""];
  }
  if (question.type === "fill_blank") {
    question.options = [];
  }
};

const addOption = (question: OnlineQuestion) => {
  question.options.push("");
};

const removeOption = (question: OnlineQuestion, index: number) => {
  if (question.options.length <= 2) return;
  question.options.splice(index, 1);
  if (!question.options.includes(question.answer)) {
    question.answer = "";
  }
};

const getOptionLabel = (index: number) => {
  return String.fromCharCode(65 + index);
};

const normalizeOnlineQuestionsForSubmit = () => {
  return formData.onlineQuestions.map((question, index) => ({
    id: question.id || `q-${index + 1}`,
    type: question.type,
    stem: question.stem.trim(),
    options:
      question.type === "single_choice"
        ? question.options.map((item) => item.trim()).filter(Boolean)
        : [],
    answer: question.answer.trim(),
    score: Number(question.score || 1),
  }));
};

const validateOnlineQuestions = () => {
  if (formData.assignmentType !== "online") return true;

  const questions = normalizeOnlineQuestionsForSubmit();
  if (!questions.length) {
    ElMessage.warning("请至少添加一道在线题目");
    return false;
  }

  const invalidIndex = questions.findIndex((question) => {
    if (!question.stem || !question.answer || question.score <= 0) return true;
    if (question.type === "single_choice") {
      return question.options.length < 2 || !question.options.includes(question.answer);
    }
    return false;
  });

  if (invalidIndex >= 0) {
    ElMessage.warning(
      `请完善第 ${invalidIndex + 1} 题：题目、分值、选项和标准答案都不能为空`
    );
    return false;
  }

  return true;
};

// 保存草稿
const handleSaveDraft = async () => {
  if (!formRef.value) return;

  try {
    // 表单校验失败时会自动滚动到错误字段，不需要额外提示
    await formRef.value.validate();
    if (!validateOnlineQuestions()) return;
    saving.value = true;

    if (isEdit.value) {
      // 编辑模式：更新作业并设置为草稿状态
      const updateData = buildAssignmentData();
      updateData.status = AssignmentStatus.DRAFT; // 明确设置为草稿状态
      await updateAssignment(assignmentId.value, updateData);
      ElMessage.success("作业已保存为草稿");
    } else {
      // 创建模式：创建新作业
      await createAssignment(buildAssignmentData(true));
      ElMessage.success("作业创建成功");
      router.push("/teacher/assignments");
    }
  } catch (error) {
    // 只有API请求失败才显示错误提示，表单校验失败不显示
    if (saving.value) {
      console.error("保存失败:", error);
      ElMessage.error("保存失败");
    }
  } finally {
    saving.value = false;
  }
};

// 发布作业
const handlePublish = async () => {
  if (!formRef.value) return;

  try {
    // 表单校验失败时会自动滚动到错误字段，不需要额外提示
    await formRef.value.validate();
    if (!validateOnlineQuestions()) return;

    await ElMessageBox.confirm(
      "确定要发布这个作业吗？发布后学生将能够看到并提交作业。",
      "确认发布",
      { type: "warning" }
    );

    saving.value = true;
    let currentAssignmentId: string;

    if (isEdit.value) {
      // 编辑模式：更新作业（包含AI规则）
      await updateAssignment(assignmentId.value, buildAssignmentData());
      currentAssignmentId = assignmentId.value;
    } else {
      // 创建模式：创建新作业
      const result = await createAssignment(buildAssignmentData(true));
      currentAssignmentId = result.id;
    }

    // 发布作业
    await updateAssignmentStatus(currentAssignmentId, {
      status: AssignmentStatus.PUBLISHED,
    });

    ElMessage.success("作业发布成功");
    // 判断是否有返回的url
    if (router.currentRoute.value.query.redirect) {
      router.push(router.currentRoute.value.query.redirect as string);
    } else {
      router.back();
    }
  } catch (error: any) {
    if (error !== "cancel") {
      // 只有API请求失败才显示错误提示，表单校验失败不显示
      if (saving.value) {
        console.error("发布失败:", error);
        ElMessage.error("发布失败");
      }
    }
  } finally {
    saving.value = false;
  }
};

// 返回
const goBack = () => {
  router.back();
  // router.push('/teacher/assignments')
};

// 处理富文本超出字数限制
const handleDescriptionExceed = (length: number) => {
  // 触发表单验证
  formRef.value?.validateField("description");
};

// 初始化
onMounted(() => {
  initFormData();
  loadAssignmentData();
  checkMobile();
});
</script>

<style scoped>
/* 作业编辑表单样式 */
.assignment-form {
  background: #ffffff;
}

.form-helper-text {
  margin-top: 8px;
  font-size: 13px;
  color: #6b7280;
}

.material-block {
  padding: 18px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #f9fafb;
}

.material-block__header {
  margin-bottom: 12px;
}

.material-block__title {
  margin: 0 0 6px;
  font-size: 15px;
  font-weight: 600;
  color: #111827;
}

.material-block__desc {
  margin: 0;
  font-size: 13px;
  color: #6b7280;
}

.online-builder {
  padding: 18px;
  border: 1px solid #dbeafe;
  border-radius: 12px;
  background: #f8fbff;
}

.online-builder__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.online-builder__title {
  margin: 0 0 6px;
  font-size: 15px;
  font-weight: 600;
  color: #111827;
}

.online-builder__desc {
  margin: 0;
  color: #6b7280;
  font-size: 13px;
  line-height: 1.6;
}

.online-question-list {
  display: grid;
  gap: 14px;
}

.online-question-card {
  padding: 16px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #ffffff;
}

.online-question-card__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.online-question-card__index {
  font-weight: 600;
  color: #1f2937;
}

.online-question-card__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.question-type-select {
  width: 120px;
}

.question-score-input {
  width: 110px;
}

.option-list {
  display: grid;
  gap: 10px;
  margin: 8px 0 16px 100px;
}

.option-row {
  display: grid;
  grid-template-columns: 28px 1fr auto;
  align-items: center;
  gap: 8px;
}

.option-label {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #eff6ff;
  color: #1d4ed8;
  font-size: 12px;
  font-weight: 600;
}

.grading-hint-card {
  margin-top: 20px;
  padding: 16px 18px;
  border-radius: 12px;
  background: linear-gradient(135deg, #eff6ff 0%, #f8fafc 100%);
  border: 1px solid #bfdbfe;
}

.grading-hint-card h4 {
  margin: 0 0 8px;
  font-size: 14px;
  font-weight: 600;
  color: #1d4ed8;
}

.grading-hint-card p {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: #475569;
}

/* 表单分区样式 */
.form-section {
  border-bottom: 1px solid #f0f2f5;
}

.form-section:last-child {
  border-bottom: none;
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
  padding: 24px;
}

@media (max-width: 768px) {
  .online-builder__header,
  .online-question-card__top {
    flex-direction: column;
    align-items: stretch;
  }

  .online-question-card__actions {
    flex-wrap: wrap;
  }

  .option-list {
    margin-left: 0;
  }
}
</style>

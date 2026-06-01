<template>
  <div class="ai-settings-page">
    <PageHeader
      title="AI 配置"
      subtitle="配置你自己的豆包 API Key 和批改模型，后续学生提交的 AI 批改会使用你的额度。"
    />

    <div class="settings-panel">
      <div class="status-row">
        <div>
          <h2 class="panel-title">豆包 API Key</h2>
          <p class="panel-subtitle">
            Key 只会保存到你的教师账号中，页面不会回显完整内容；模型可随时切换。
          </p>
        </div>
        <el-tag :type="settings.configured ? 'success' : 'warning'" size="large">
          {{ settings.configured ? "已配置" : "未配置" }}
        </el-tag>
      </div>

      <el-descriptions v-if="settings.configured" :column="1" border>
        <el-descriptions-item label="当前 Key">
          {{ settings.apiKeyPreview }}
        </el-descriptions-item>
        <el-descriptions-item label="更新时间">
          {{ formatDate(settings.updatedAt) }}
        </el-descriptions-item>
        <el-descriptions-item label="当前模型">
          {{ settings.model }}
        </el-descriptions-item>
      </el-descriptions>

      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-width="120px"
        class="settings-form"
      >
        <el-form-item label="API Key" prop="apiKey">
          <el-input
            v-model="form.apiKey"
            type="password"
            show-password
            clearable
            :placeholder="settings.configured ? '不修改 Key 时可留空' : '请输入你的豆包 API Key'"
          />
        </el-form-item>
        <el-form-item label="批改模型" prop="model">
          <el-select v-model="form.model" class="model-select">
            <el-option
              v-for="item in modelOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item>
          <div class="actions">
            <el-button
              type="primary"
              :icon="Check"
              :loading="saving"
              @click="saveSettings"
            >
              保存配置
            </el-button>
            <el-button
              :icon="Delete"
              :disabled="!settings.configured"
              :loading="clearing"
              @click="clearSettings"
            >
              清除配置
            </el-button>
          </div>
        </el-form-item>
      </el-form>

      <el-alert
        show-icon
        type="info"
        :closable="false"
        title="未配置时，学生提交后 AI 批改会失败并提示教师未配置 API Key。"
      />

      <div class="guide-box">
        <h3 class="guide-title">申请 API Key</h3>
        <ol class="guide-list">
          <li>登录火山引擎并开通火山方舟。</li>
          <li>进入“API Key 管理”，创建并复制新的 API Key。</li>
          <li>回到本页粘贴 Key，选择批改模型后保存。</li>
        </ol>
        <el-link
          type="primary"
          :href="apiKeyGuideUrl"
          target="_blank"
          rel="noopener noreferrer"
        >
          查看火山方舟 API Key 官方教程
        </el-link>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from "element-plus";
import { Check, Delete } from "@element-plus/icons-vue";
import PageHeader from "@/components/PageHeader.vue";
import {
  DEFAULT_DOUBAO_MODEL,
  DOUBAO_API_KEY_GUIDE_URL,
  DOUBAO_MODEL_OPTIONS,
} from "@/config/ai-config";
import {
  clearTeacherAiSettings,
  getTeacherAiSettings,
  updateTeacherAiSettings,
} from "@/api/user";
import type { TeacherAiSettings } from "@/types/user";

const formRef = ref<FormInstance>();
const saving = ref(false);
const clearing = ref(false);
const settings = reactive<TeacherAiSettings>({
  provider: "doubao",
  configured: false,
  apiKeyPreview: "",
  model: DEFAULT_DOUBAO_MODEL,
  updatedAt: null,
});
const form = reactive({
  apiKey: "",
  model: DEFAULT_DOUBAO_MODEL,
});
const modelOptions = DOUBAO_MODEL_OPTIONS;
const apiKeyGuideUrl = DOUBAO_API_KEY_GUIDE_URL;
const rules: FormRules = {
  apiKey: [
    {
      validator: (_rule, value, callback) => {
        const nextValue = String(value || "").trim();
        if (!settings.configured && !nextValue) {
          callback(new Error("请输入 API Key"));
          return;
        }
        if (nextValue && nextValue.length < 8) {
          callback(new Error("API Key 长度不能少于 8 位"));
          return;
        }
        callback();
      },
      trigger: "blur",
    },
  ],
  model: [
    { required: true, message: "请选择批改模型", trigger: "change" },
  ],
};

const applySettings = (nextSettings: TeacherAiSettings) => {
  settings.provider = nextSettings.provider;
  settings.configured = nextSettings.configured;
  settings.apiKeyPreview = nextSettings.apiKeyPreview || "";
  settings.model = nextSettings.model || DEFAULT_DOUBAO_MODEL;
  settings.updatedAt = nextSettings.updatedAt || null;
  form.model = settings.model;
};

const loadSettings = async () => {
  applySettings(await getTeacherAiSettings());
};

const saveSettings = async () => {
  if (!formRef.value) return;
  await formRef.value.validate();

  saving.value = true;
  try {
    applySettings(
      await updateTeacherAiSettings({
        apiKey: form.apiKey.trim() || undefined,
        model: form.model,
      })
    );
    form.apiKey = "";
    ElMessage.success("AI 配置已保存");
  } finally {
    saving.value = false;
  }
};

const clearSettings = async () => {
  await ElMessageBox.confirm(
    "清除后，新的学生提交将无法使用 AI 批改，直到你重新配置 API Key。",
    "清除 AI Key",
    {
      type: "warning",
      confirmButtonText: "清除",
      cancelButtonText: "取消",
    }
  );

  clearing.value = true;
  try {
    applySettings(await clearTeacherAiSettings());
    form.apiKey = "";
    form.model = settings.model;
    ElMessage.success("AI Key 已清除");
  } finally {
    clearing.value = false;
  }
};

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  return new Date(value).toLocaleString();
};

onMounted(loadSettings);
</script>

<style scoped>
.ai-settings-page {
  min-height: 100%;
}

.settings-panel {
  max-width: 860px;
  margin-top: 16px;
  padding: 24px;
  border: 1px solid var(--app-glass-border, #e5e7eb);
  border-radius: 8px;
  background: var(--app-glass-bg-strong, #fff);
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.08);
  backdrop-filter: blur(14px);
}

.status-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
}

.panel-title {
  margin: 0 0 6px;
  font-size: 18px;
  font-weight: 700;
  color: #111827;
}

.panel-subtitle {
  margin: 0;
  color: #6b7280;
}

.settings-form {
  margin-top: 24px;
}

.actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.model-select {
  width: 100%;
}

.guide-box {
  margin-top: 18px;
  padding-top: 18px;
  border-top: 1px solid #e5e7eb;
}

.guide-title {
  margin: 0 0 8px;
  font-size: 16px;
  color: #111827;
}

.guide-list {
  margin: 0 0 10px;
  padding-left: 20px;
  color: #4b5563;
  line-height: 1.8;
}

@media (max-width: 640px) {
  .settings-panel {
    padding: 16px;
  }

  .status-row {
    flex-direction: column;
  }
}
</style>

<template>
  <div class="ai-settings-page">
    <PageHeader
      title="AI 配置"
      subtitle="配置你自己的模型 ID、OpenAI 兼容端点和 API Key，后续学生提交及教师工具会使用你的配置。"
    />

    <div class="settings-panel">
      <div class="status-row">
        <div>
          <h2 class="panel-title">个人 AI 接口</h2>
          <p class="panel-subtitle">
            Key 会加密保存且不会回显完整内容；接口需兼容 Chat Completions。
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
        <el-descriptions-item label="当前端点">
          {{ settings.endpoint }}
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
            :placeholder="settings.configured ? '不修改 Key 时可留空' : '请输入你的 API Key'"
          />
        </el-form-item>
        <el-form-item label="API 端点" prop="endpoint">
          <el-input
            v-model="form.endpoint"
            clearable
            placeholder="https://example.com/v1/chat/completions"
          />
          <div class="endpoint-tip">
            可填写 API 根地址或完整的 /chat/completions 地址。
          </div>
        </el-form-item>
        <el-form-item label="模型 ID" prop="model">
          <el-input
            v-model="form.model"
            clearable
            placeholder="请输入模型 ID"
          />
          <div class="endpoint-tip">
            默认使用 {{ DEFAULT_DOUBAO_MODEL }}，也可以填写兼容端点支持的其他模型。
          </div>
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
          <li>回到本页填写模型 ID、兼容端点并粘贴 API Key 后保存。</li>
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
  DEFAULT_DOUBAO_ENDPOINT,
  DEFAULT_DOUBAO_MODEL,
  DOUBAO_API_KEY_GUIDE_URL,
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
  endpoint: DEFAULT_DOUBAO_ENDPOINT,
  updatedAt: null,
});
const form = reactive({
  apiKey: "",
  model: DEFAULT_DOUBAO_MODEL,
  endpoint: DEFAULT_DOUBAO_ENDPOINT,
});
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
  endpoint: [
    { required: true, message: "请输入 API 端点", trigger: "blur" },
    {
      type: "url",
      message: "请输入以 http:// 或 https:// 开头的有效地址",
      trigger: "blur",
    },
  ],
  model: [
    { required: true, message: "请输入模型 ID", trigger: "blur" },
    { max: 200, message: "模型 ID 不能超过 200 个字符", trigger: "blur" },
  ],
};

const applySettings = (nextSettings: TeacherAiSettings) => {
  settings.provider = nextSettings.provider;
  settings.configured = nextSettings.configured;
  settings.apiKeyPreview = nextSettings.apiKeyPreview || "";
  settings.model = nextSettings.model || DEFAULT_DOUBAO_MODEL;
  settings.endpoint = nextSettings.endpoint || DEFAULT_DOUBAO_ENDPOINT;
  settings.updatedAt = nextSettings.updatedAt || null;
  form.model = settings.model;
  form.endpoint = settings.endpoint;
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
        model: form.model.trim(),
        endpoint: form.endpoint.trim(),
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
    form.endpoint = settings.endpoint;
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

.endpoint-tip {
  margin-top: 6px;
  color: #909399;
  font-size: 12px;
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

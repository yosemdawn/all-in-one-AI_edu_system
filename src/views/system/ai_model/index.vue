<template>
  <div class="ai-model-config">
    <div class="page-header mb-6">
      <div class="header-content">
        <div>
          <h1 class="text-2xl font-bold text-gray-800">AI模型配置</h1>
          <p class="text-gray-600 mt-2">当前仅保留豆包模型配置</p>
        </div>
        <div class="header-actions">
          <el-button
            :icon="RefreshIcon"
            @click="refreshData"
            :loading="loading"
            type="primary"
          >
            刷新数据
          </el-button>
        </div>
      </div>
    </div>

    <div class="model-config-form" v-loading="loading">
      <div class="model-info-section mb-6">
        <h3 class="text-lg font-semibold mb-3">基本信息</h3>
        <el-descriptions :column="2" border v-if="doubaoModel">
          <el-descriptions-item label="模型名称">{{
            doubaoModel.name
          }}</el-descriptions-item>
          <el-descriptions-item label="提供商">{{
            doubaoModel.provider
          }}</el-descriptions-item>
          <el-descriptions-item label="模型版本">{{
            doubaoModel.modelName
          }}</el-descriptions-item>
          <el-descriptions-item label="API地址">{{
            doubaoModel.baseUrl
          }}</el-descriptions-item>
        </el-descriptions>
      </div>

      <div class="config-form-section mb-6">
        <h3 class="text-lg font-semibold mb-3">配置信息</h3>
        <el-form :model="doubaoForm" label-width="120px" v-if="doubaoModel">
          <el-row :gutter="20">
            <el-col :span="12">
              <el-form-item label="API密钥" required>
                <el-input
                  v-model="doubaoForm.apiKey"
                  type="password"
                  show-password
                  placeholder="请输入豆包API密钥"
                />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="状态">
                <el-radio-group v-model="doubaoForm.status">
                  <el-radio value="active">启用</el-radio>
                  <el-radio value="inactive">禁用</el-radio>
                </el-radio-group>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="默认模型">
                <el-switch
                  v-model="doubaoForm.isDefault"
                  active-text="是"
                  inactive-text="否"
                />
              </el-form-item>
            </el-col>
          </el-row>

          <div class="form-actions mt-4">
            <el-button
              type="primary"
              @click="saveConfig"
              :loading="saving"
            >
              保存配置
            </el-button>
            <el-button
              @click="refreshBalance"
              :loading="balanceLoading"
            >
              刷新余额
            </el-button>
            <el-button
              @click="testConnection"
              :loading="testLoading"
            >
              测试连接
            </el-button>
          </div>
        </el-form>
      </div>

      <div class="stats-section">
        <h3 class="text-lg font-semibold mb-3">使用统计</h3>
        <el-row :gutter="20" v-if="doubaoModel">
          <el-col :span="6">
            <el-statistic title="使用次数" :value="doubaoModel.totalUsage" />
          </el-col>
          <el-col :span="6">
            <el-statistic title="Token消耗" :value="doubaoModel.totalTokens" />
          </el-col>
          <el-col :span="6">
            <el-statistic
              title="账户余额"
              :value="doubaoBalance?.balance || 0"
              :precision="2"
              suffix="元"
            >
              <template #suffix>
                <span :class="getBalanceClass(doubaoBalance)">
                  {{ doubaoBalance?.currency || "CNY" }}
                </span>
              </template>
            </el-statistic>
          </el-col>
          <el-col :span="6">
            <el-statistic
              title="最后使用"
              :value="0"
              :format="() => formatDate(doubaoModel.lastUsedAt)"
              :value-style="{ fontSize: '14px' }"
            />
          </el-col>
        </el-row>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, reactive, onMounted, onUnmounted } from "vue";
import { ElMessage } from "element-plus";
import { Refresh as RefreshIcon } from "@element-plus/icons-vue";
import { aiModelApi, type AiModel, type ModelBalance } from "@/api/ai-models";

const loading = ref(false);
const saving = ref(false);
const balanceLoading = ref(false);
const testLoading = ref(false);

const doubaoModel = ref<AiModel | null>(null);
const doubaoBalance = ref<ModelBalance | null>(null);

const doubaoForm = reactive({
  apiKey: "",
  status: "active" as "active" | "inactive",
  isDefault: true,
});

const loadModelData = async () => {
  loading.value = true;
  try {
    const response = await aiModelApi.getList();
    const doubao = response.models.find((m) => m.code === "doubao") || null;
    doubaoModel.value = doubao;

    if (doubao) {
      doubaoForm.apiKey = doubao.apiKey;
      doubaoForm.status = doubao.status;
      doubaoForm.isDefault = doubao.isDefault;
      await loadBalance();
    }
  } catch (error) {
    console.error("加载模型数据失败:", error);
    ElMessage.error("加载模型数据失败");
  } finally {
    loading.value = false;
  }
};

const loadBalance = async () => {
  try {
    doubaoBalance.value = await aiModelApi.getBalance("doubao");
  } catch (error) {
    console.error("加载余额失败:", error);
  }
};

const saveConfig = async () => {
  if (!doubaoForm.apiKey.trim()) {
    ElMessage.warning("请输入豆包API密钥");
    return;
  }

  saving.value = true;
  try {
    const updatedModel = await aiModelApi.updateConfig("doubao", {
      apiKey: doubaoForm.apiKey,
      status: doubaoForm.status,
      isDefault: true,
    });
    doubaoModel.value = updatedModel;
    ElMessage.success("豆包配置保存成功");
    await testConnection();
  } catch (error: any) {
    console.error("保存配置失败:", error);
    ElMessage.error(error.message || "保存配置失败");
  } finally {
    saving.value = false;
  }
};

const refreshBalance = async () => {
  balanceLoading.value = true;
  try {
    doubaoBalance.value = await aiModelApi.getBalance("doubao");
    ElMessage.success("豆包余额刷新成功");
  } catch (error: any) {
    console.error("刷新余额失败:", error);
    ElMessage.error(error.message || "刷新余额失败");
  } finally {
    balanceLoading.value = false;
  }
};

const testConnection = async () => {
  testLoading.value = true;
  try {
    const result = await aiModelApi.testConnection("doubao");
    if (result.success) {
      ElMessage.success(`豆包连接测试成功 (${result.responseTime}ms)`);
    } else {
      ElMessage.error(`连接测试失败: ${result.message}`);
    }
  } catch (error: any) {
    console.error("连接测试失败:", error);
    ElMessage.error(error.message || "连接测试失败");
  } finally {
    testLoading.value = false;
  }
};

const refreshData = async () => {
  await loadModelData();
  ElMessage.success("数据刷新成功");
};

const getBalanceClass = (balance: ModelBalance | null) => {
  if (!balance || balance.status === "error") return "text-red-500";
  if (balance.balance < 1) return "text-red-500";
  if (balance.balance < 10) return "text-orange-500";
  return "text-green-500";
};

const formatDate = (date: Date | string | undefined) => {
  if (!date) return "暂无";
  try {
    const dateObj = typeof date === "string" ? new Date(date) : date;
    return dateObj.toLocaleDateString("zh-CN");
  } catch {
    return "格式错误";
  }
};

let refreshInterval: any = null;

onMounted(() => {
  loadModelData();
  refreshInterval = setInterval(() => {
    loadModelData();
  }, 30000);
});

onUnmounted(() => {
  if (refreshInterval) clearInterval(refreshInterval);
});
</script>

<style scoped>
.ai-model-config {
  padding: 20px;
  background: #fff;
  border-radius: 8px;
}

.page-header {
  border-bottom: 1px solid #e4e7ed;
  padding-bottom: 16px;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.header-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.model-config-form {
  padding: 20px 0;
}

.form-actions {
  display: flex;
  gap: 12px;
}
</style>
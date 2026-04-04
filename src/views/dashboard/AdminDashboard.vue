<template>
  <div class="admin-dashboard">
    <div class="dashboard-header">
      <div>
        <h1 class="dashboard-title">{{ userName }}的系统控制台</h1>
        <p class="dashboard-subtitle">管理用户、模型状态与系统健康信息</p>
      </div>
      <div class="header-actions">
        <el-button type="primary" :icon="UserFilled" @click="manageUsers">
          用户管理
        </el-button>
        <el-button :icon="Setting" @click="systemSettings">
          模型设置
        </el-button>
        <el-button :icon="Refresh" :loading="isRefreshing" @click="refreshData">
          刷新
        </el-button>
      </div>
    </div>

    <div class="stats-grid">
      <StatCard
        title="总用户数"
        :value="adminStats?.totalUsers || 0"
        unit="人"
        subtitle="注册用户"
        icon="user"
        variant="primary"
        :loading="loading"
        :trend="userTrend"
        :trend-value="userTrendValue"
      />
      <StatCard
        title="总班级数"
        :value="adminStats?.totalClasses || 0"
        unit="个"
        subtitle="班级总量"
        icon="school"
        variant="success"
        :loading="loading"
      />
      <StatCard
        title="总作业数"
        :value="adminStats?.totalAssignments || 0"
        unit="份"
        subtitle="已创建作业"
        icon="document"
        variant="info"
        :loading="loading"
      />
      <StatCard
        title="总提交数"
        :value="adminStats?.totalSubmissions || 0"
        unit="次"
        subtitle="学生提交"
        icon="list"
        variant="warning"
        :loading="loading"
      />
      <StatCard
        title="AI 模型数"
        :value="adminStats?.aiModelCount || 0"
        unit="个"
        subtitle="已接入模型"
        icon="robot"
        variant="danger"
        :loading="loading"
      />
    </div>

    <div class="panel-card">
      <div class="section-header">
        <h2 class="section-title">AI 模型状态</h2>
        <el-tag :type="allModelsOnline ? 'success' : 'warning'" size="small">
          {{ allModelsOnline ? "全部正常" : "存在异常" }}
        </el-tag>
      </div>

      <div class="ai-models-grid">
        <div class="ai-model-card" v-if="aiModelStats?.doubao">
          <div class="model-header">
            <div>
              <div class="model-name">豆包</div>
              <el-tag
                :type="aiModelStats.doubao.isOnline ? 'success' : 'danger'"
                size="small"
              >
                {{ aiModelStats.doubao.isOnline ? "在线" : "离线" }}
              </el-tag>
            </div>
            <div class="model-balance">
              <span>余额</span>
              <strong>{{ aiModelStats.doubao.balance }}</strong>
            </div>
          </div>
          <div class="model-stats">
            <div class="model-stat">
              <span>今日使用</span>
              <strong>{{ aiModelStats.doubao.todayUsage }}</strong>
            </div>
            <div class="model-stat">
              <span>累计调用</span>
              <strong>{{
                formatNumber(aiModelStats.doubao.totalUsage)
              }}</strong>
            </div>
            <div class="model-stat">
              <span>累计 Token</span>
              <strong>{{
                formatNumber(aiModelStats.doubao.totalTokens)
              }}</strong>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="charts-grid">
      <div class="chart-card">
        <div class="chart-header">
          <h3 class="chart-title">用户角色分布</h3>
          <span class="chart-subtitle"
            >总计 {{ adminStats?.totalUsers || 0 }} 人</span
          >
        </div>
        <DonutChart :data="userRoleData" :height="240" :loading="loading" />
      </div>

      <div class="chart-card">
        <div class="chart-header">
          <h3 class="chart-title">班级状态分布</h3>
        </div>
        <DonutChart :data="classStatusData" :height="240" :loading="loading" />
      </div>

      <div class="chart-card">
        <div class="chart-header">
          <h3 class="chart-title">提交状态统计</h3>
          <span class="chart-subtitle">系统整体提交情况</span>
        </div>
        <BarChart
          :data="submissionStatusData"
          :height="240"
          :loading="loading"
          unit="次"
          :show-value="true"
        />
      </div>
    </div>

    <div class="tables-grid">
      <div class="table-card">
        <div class="section-header">
          <h3 class="section-title">最近注册用户</h3>
          <el-button type="primary" size="small" @click="viewAllUsers">
            查看全部
          </el-button>
        </div>

        <el-table
          :data="recentUsers"
          style="width: 100%"
          :loading="loading"
          empty-text="暂无新注册用户"
          table-layout="fixed"
        >
          <el-table-column
            prop="name"
            label="姓名"
            width="100"
            show-overflow-tooltip
          />
          <el-table-column
            prop="email"
            label="邮箱"
            min-width="180"
            show-overflow-tooltip
          />
          <el-table-column prop="role" label="角色" width="110">
            <template #default="{ row }">
              <el-tag :type="getRoleTagType(row.role)" size="small">
                {{ getRoleText(row.role) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="status" label="状态" width="90">
            <template #default="{ row }">
              <el-tag
                :type="row.status === 'active' ? 'success' : 'warning'"
                size="small"
              >
                {{ row.status === "active" ? "正常" : "停用" }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column
            prop="createdAt"
            label="注册时间"
            width="120"
            show-overflow-tooltip
          >
            <template #default="{ row }">
              {{ formatRelativeTime(row.createdAt) }}
            </template>
          </el-table-column>
          <el-table-column label="操作" width="90" fixed="right">
            <template #default="{ row }">
              <el-button type="primary" size="small" @click="viewUser(row.id)">
                查看
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <div class="table-card">
        <div class="section-header">
          <h3 class="section-title">系统健康状态</h3>
          <div class="health-indicator">
            <div
              class="health-dot"
              :class="{ healthy: isSystemHealthy, warning: !isSystemHealthy }"
            ></div>
            <span>{{ systemHealthSummary }}</span>
          </div>
        </div>

        <div class="health-metrics">
          <div class="metric-item">
            <div class="metric-icon">SYS</div>
            <div class="metric-content">
              <div class="metric-label">整体状态</div>
              <div class="metric-value">{{ systemHealthSummary }}</div>
            </div>
          </div>
          <div class="metric-item">
            <div class="metric-icon">DB</div>
            <div class="metric-content">
              <div class="metric-label">数据库</div>
              <div class="metric-value">
                {{ formatHealthStatus(systemHealth?.db, "db") }}
              </div>
            </div>
          </div>
          <div class="metric-item">
            <div class="metric-icon">REDIS</div>
            <div class="metric-content">
              <div class="metric-label">缓存服务</div>
              <div class="metric-value">
                {{ formatHealthStatus(systemHealth?.redis, "redis") }}
              </div>
            </div>
          </div>
          <div class="metric-item">
            <div class="metric-icon">AI</div>
            <div class="metric-content">
              <div class="metric-label">AI 配置</div>
              <div class="metric-value">
                {{ formatHealthStatus(systemHealth?.ai, "ai") }}
              </div>
            </div>
          </div>
        </div>

        <div class="health-meta" v-if="systemHealth?.checkedAt">
          最近检查：{{ formatRelativeTime(systemHealth.checkedAt) }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { useStore } from "vuex";
import { ElMessage } from "element-plus";
import { Refresh, Setting, UserFilled } from "@element-plus/icons-vue";
import StatCard from "./components/StatCard.vue";
import DonutChart from "./components/charts/DonutChart.vue";
import BarChart from "./components/charts/BarChart.vue";
import { formatRelativeTime } from "@/utils/date";
import {
  getRecentUsers,
  getSystemHealth,
  type SystemHealthResponse,
} from "@/api/dashboard";

const store = useStore();
const router = useRouter();

const isRefreshing = ref(false);
const recentUsers = ref<any[]>([]);
const systemHealth = ref<SystemHealthResponse | null>(null);

const loading = computed(() => store.getters["dashboard/isLoading"]("admin"));
const adminStats = computed(() => store.getters["dashboard/adminOverview"]);
const aiModelStats = computed(() => store.getters["dashboard/aiModelStats"]);
const userName = computed(() => store.getters["user/userName"] || "管理员");

const userRoleData = computed(() => {
  if (!adminStats.value?.userRoleDistribution) return [];

  const roleMap: Record<string, { name: string; color: string }> = {
    SUPER_ADMIN: { name: "超级管理员", color: "#ef4444" },
    TEACHER: { name: "教师", color: "#2563eb" },
    STUDENT: { name: "学生", color: "#16a34a" },
  };

  return adminStats.value.userRoleDistribution.map((item: any) => ({
    name: roleMap[item.role]?.name || item.role,
    value: item.count,
    color: roleMap[item.role]?.color,
  }));
});

const classStatusData = computed(() => {
  if (!adminStats.value?.classStatusDistribution) return [];

  const statusMap: Record<string, { name: string; color: string }> = {
    active: { name: "活跃", color: "#16a34a" },
    inactive: { name: "停用", color: "#9ca3af" },
    disbanded: { name: "已解散", color: "#ef4444" },
  };

  return adminStats.value.classStatusDistribution.map((item: any) => ({
    name: statusMap[item.status]?.name || item.status,
    value: item.count,
    color: statusMap[item.status]?.color,
  }));
});

const submissionStatusData = computed(() => {
  if (!adminStats.value?.submissionStatusDistribution) return [];

  const statusMap: Record<string, { name: string; color: string }> = {
    draft: { name: "草稿", color: "#9ca3af" },
    submitted: { name: "已提交", color: "#2563eb" },
    ai_reviewed: { name: "AI 已批改", color: "#f59e0b" },
    teacher_reviewed: { name: "教师已批改", color: "#16a34a" },
    ai_review_failed: { name: "AI 批改失败", color: "#ef4444" },
  };

  return adminStats.value.submissionStatusDistribution.map((item: any) => ({
    name: statusMap[item.status]?.name || item.status,
    value: item.count,
    color: statusMap[item.status]?.color,
  }));
});

const allModelsOnline = computed(() => {
  if (!aiModelStats.value) return false;
  const models = Object.values(aiModelStats.value);
  return models.length > 0 && models.every((model: any) => model?.isOnline);
});

const isSystemHealthy = computed(() => {
  if (!systemHealth.value) return false;
  const dbHealthy = systemHealth.value.db === "ok";
  const redisHealthy =
    systemHealth.value.redis === "ok" ||
    systemHealth.value.redis === "disabled";
  return dbHealthy && redisHealthy;
});

const systemHealthSummary = computed(() => {
  if (!systemHealth.value) return "未获取";
  return isSystemHealthy.value ? "运行正常" : "需要关注";
});

const userTrend = computed<"up" | "down" | "stable">(() => "up");
const userTrendValue = computed(() => 15);

const refreshData = async () => {
  isRefreshing.value = true;
  try {
    await Promise.all([
      store.dispatch("dashboard/fetchAdminDashboard", true),
      store.dispatch("dashboard/fetchAiModelStats", true),
      loadRecentUsers(),
      loadSystemHealth(),
    ]);
    ElMessage.success("数据刷新成功");
  } catch (error) {
    ElMessage.error("数据刷新失败");
  } finally {
    isRefreshing.value = false;
  }
};

const loadRecentUsers = async () => {
  try {
    const response = await getRecentUsers(5);
    recentUsers.value = response.users || [];
  } catch (error) {
    console.error("加载最近用户失败", error);
    recentUsers.value = [];
  }
};

const loadSystemHealth = async () => {
  try {
    systemHealth.value = await getSystemHealth();
  } catch (error) {
    console.error("加载系统健康状态失败", error);
    systemHealth.value = null;
  }
};

const manageUsers = () => {
  router.push("/system/users");
};

const systemSettings = () => {
  router.push("/system/ai_model");
};

const viewAllUsers = () => {
  router.push("/system/users");
};

const viewUser = (userId: string) => {
  router.push(`/system/users/${userId}`);
};

const formatNumber = (num: number) => {
  if (num >= 10000) {
    return `${(num / 10000).toFixed(1)}万`;
  }

  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}k`;
  }

  return String(num);
};

const formatHealthStatus = (
  status?:
    | SystemHealthResponse["db"]
    | SystemHealthResponse["redis"]
    | SystemHealthResponse["ai"],
  type: "db" | "redis" | "ai" = "db",
) => {
  if (!status) return "--";
  if (status === "ok") return "正常";
  if (status === "error") return "异常";
  if (status === "disabled") return "未启用";
  if (type === "ai") {
    return status === "configured" ? "已配置" : "未配置";
  }
  return String(status);
};

const getRoleTagType = (role: string) => {
  const typeMap: Record<
    string,
    "success" | "warning" | "info" | "primary" | "danger"
  > = {
    SUPER_ADMIN: "danger",
    TEACHER: "primary",
    STUDENT: "success",
  };
  return typeMap[role] || "info";
};

const getRoleText = (role: string) => {
  const textMap: Record<string, string> = {
    SUPER_ADMIN: "超级管理员",
    TEACHER: "教师",
    STUDENT: "学生",
  };
  return textMap[role] || role;
};

onMounted(async () => {
  try {
    await Promise.all([
      store.dispatch("dashboard/fetchAdminDashboard"),
      store.dispatch("dashboard/fetchAiModelStats"),
      loadRecentUsers(),
      loadSystemHealth(),
    ]);
  } catch (error) {
    ElMessage.error("加载看板数据失败");
  }
});
</script>

<style scoped>
.admin-dashboard {
  padding: 24px;
  background: #f8fafc;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}

.dashboard-title {
  margin: 0;
  font-size: 28px;
  font-weight: 700;
  color: #0f172a;
}

.dashboard-subtitle {
  margin: 8px 0 0;
  color: #64748b;
}

.header-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 16px;
}

.panel-card,
.chart-card,
.table-card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 18px;
  padding: 20px;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.04);
}

.section-header,
.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.section-title,
.chart-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #0f172a;
}

.chart-subtitle {
  color: #64748b;
  font-size: 13px;
}

.ai-models-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.ai-model-card {
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  padding: 18px;
  background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
}

.model-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
}

.model-name {
  font-size: 18px;
  font-weight: 600;
  color: #0f172a;
  margin-bottom: 8px;
}

.model-balance {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  color: #475569;
  gap: 6px;
}

.model-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.model-stat {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  color: #64748b;
  font-size: 13px;
}

.model-stat strong {
  color: #0f172a;
  font-size: 16px;
}

.charts-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

.tables-grid {
  display: grid;
  grid-template-columns: 1.35fr 1fr;
  gap: 16px;
}

.health-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #334155;
  font-size: 14px;
}

.health-dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: #f59e0b;
}

.health-dot.healthy {
  background: #22c55e;
}

.health-dot.warning {
  background: #f59e0b;
}

.health-metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.metric-item {
  display: flex;
  gap: 12px;
  align-items: center;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 14px;
}

.metric-icon {
  min-width: 56px;
  height: 56px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  background: #e2e8f0;
  color: #0f172a;
  font-size: 12px;
  font-weight: 700;
}

.metric-content {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.metric-label {
  color: #64748b;
  font-size: 13px;
}

.metric-value {
  color: #0f172a;
  font-size: 16px;
  font-weight: 600;
}

.health-meta {
  margin-top: 16px;
  color: #64748b;
  font-size: 13px;
}

@media (max-width: 1200px) {
  .stats-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .charts-grid {
    grid-template-columns: 1fr;
  }

  .tables-grid {
    grid-template-columns: 1fr;
  }

  .ai-models-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .admin-dashboard {
    padding: 16px;
  }

  .dashboard-header {
    flex-direction: column;
  }

  .header-actions {
    width: 100%;
  }

  .header-actions .el-button {
    flex: 1;
  }

  .stats-grid {
    grid-template-columns: 1fr;
  }

  .model-stats,
  .health-metrics {
    grid-template-columns: 1fr;
  }
}
</style>

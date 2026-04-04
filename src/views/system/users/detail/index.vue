<template>
  <div class="user-detail-page" v-loading="loading">
    <div class="page-header">
      <div>
        <h1 class="page-title">用户详情</h1>
        <p class="page-subtitle">查看当前用户的完整基础信息</p>
      </div>
      <div class="page-actions">
        <el-button :icon="Refresh" @click="loadUserDetail">刷新</el-button>
        <el-button type="primary" :icon="ArrowLeft" @click="goBack">
          返回列表
        </el-button>
      </div>
    </div>

    <el-empty v-if="!loading && !user" description="未找到用户信息" />

    <template v-else-if="user">
      <div class="summary-grid">
        <div class="summary-card">
          <div class="summary-label">用户名</div>
          <div class="summary-value">{{ user.username || "--" }}</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">姓名</div>
          <div class="summary-value">{{ user.name || "--" }}</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">角色</div>
          <div class="summary-value">
            <el-tag :type="getRoleTagType(user.role)">
              {{ getRoleText(user.role) }}
            </el-tag>
          </div>
        </div>
        <div class="summary-card">
          <div class="summary-label">状态</div>
          <div class="summary-value">
            <el-tag :type="user.status === 'active' ? 'success' : 'warning'">
              {{ user.status === "active" ? "正常" : "停用" }}
            </el-tag>
          </div>
        </div>
      </div>

      <el-card shadow="never" class="detail-card">
        <template #header>
          <div class="card-header">基础信息</div>
        </template>
        <el-descriptions :column="2" border>
          <el-descriptions-item label="用户 ID">
            {{ user._id || "--" }}
          </el-descriptions-item>
          <el-descriptions-item label="邮箱">
            {{ user.email || "--" }}
          </el-descriptions-item>
          <el-descriptions-item label="手机号">
            {{ user.phone || "--" }}
          </el-descriptions-item>
          <el-descriptions-item label="学号">
            {{ user.studentId || "--" }}
          </el-descriptions-item>
          <el-descriptions-item label="班级 ID">
            {{ user.classId || "--" }}
          </el-descriptions-item>
          <el-descriptions-item label="班级名称">
            {{ user.className || "--" }}
          </el-descriptions-item>
          <el-descriptions-item label="创建时间">
            {{ formatDateTime(user.createdAt) }}
          </el-descriptions-item>
          <el-descriptions-item label="更新时间">
            {{ formatDateTime(user.updatedAt) }}
          </el-descriptions-item>
          <el-descriptions-item label="最近登录">
            {{ formatDateTime(user.lastLogin) }}
          </el-descriptions-item>
        </el-descriptions>
      </el-card>

      <el-card shadow="never" class="detail-card">
        <template #header>
          <div class="card-header">扩展数据</div>
        </template>
        <pre class="meta-block">{{ formatMeta(user.meta) }}</pre>
      </el-card>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ArrowLeft, Refresh } from "@element-plus/icons-vue";
import { ElMessage } from "element-plus";
import { computed, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { getUser } from "@/api/user";
import type { User } from "@/types/user";

const route = useRoute();
const router = useRouter();

const loading = ref(false);
const user = ref<User | null>(null);
const userId = computed(() => String(route.params.id || ""));

const loadUserDetail = async () => {
  if (!userId.value) {
    user.value = null;
    return;
  }

  loading.value = true;
  try {
    user.value = await getUser(userId.value);
  } catch (error) {
    console.error("加载用户详情失败", error);
    user.value = null;
    ElMessage.error("加载用户详情失败");
  } finally {
    loading.value = false;
  }
};

const goBack = () => {
  router.push("/system/users");
};

const getRoleText = (role?: string) => {
  if (role === "superadmin") return "超级管理员";
  if (role === "teacher") return "教师";
  if (role === "student") return "学生";
  return role || "--";
};

const getRoleTagType = (role?: string) => {
  if (role === "superadmin") return "danger";
  if (role === "teacher") return "primary";
  if (role === "student") return "success";
  return "info";
};

const formatDateTime = (value?: string | Date) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleString("zh-CN", { hour12: false });
};

const formatMeta = (meta?: Record<string, unknown>) => {
  if (!meta || Object.keys(meta).length === 0) {
    return "暂无扩展数据";
  }

  return JSON.stringify(meta, null, 2);
};

loadUserDetail();
</script>

<style scoped>
.user-detail-page {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}

.page-title {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
}

.page-subtitle {
  margin: 8px 0 0;
  color: #6b7280;
  font-size: 14px;
}

.page-actions {
  display: flex;
  gap: 12px;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.summary-card {
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 16px;
  padding: 18px;
}

.detail-card {
  border-radius: 16px;
}

.summary-label {
  color: #6b7280;
  font-size: 13px;
  margin-bottom: 10px;
}

.summary-value {
  color: #111827;
  font-size: 18px;
  font-weight: 600;
}

.card-header {
  font-weight: 600;
}

.meta-block {
  margin: 0;
  padding: 16px;
  border-radius: 12px;
  background: #0f172a;
  color: #e2e8f0;
  overflow: auto;
  font-size: 13px;
  line-height: 1.6;
}

@media (max-width: 1024px) {
  .summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 768px) {
  .user-detail-page {
    padding: 16px;
  }

  .page-header {
    flex-direction: column;
  }

  .page-actions {
    width: 100%;
  }

  .page-actions .el-button {
    flex: 1;
  }

  .summary-grid {
    grid-template-columns: 1fr;
  }
}
</style>

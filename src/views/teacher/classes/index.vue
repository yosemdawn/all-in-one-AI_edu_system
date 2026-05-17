<template>
  <div class="classes-management">
    <!-- 页面头部 -->
    <page-header title="班级管理" description="管理您的班级，查看学生信息">
      <template #actions>
        <el-button
          type="primary"
          :icon="Plus"
          @click="handleCreateClass"
          size="default"
        >
          创建班级
        </el-button>
        <el-button
          :icon="Refresh"
          @click="refreshData"
          :loading="loading"
          size="default"
        >
          刷新
        </el-button>
      </template>
    </page-header>

    <!-- 内容容器 -->
    <div class="classes-container">
      <!-- 班级列表内容区域 -->
      <div
        class="content-section"
        v-loading="loading"
        element-loading-text="加载中..."
      >
        <!-- 空状态 -->
        <div v-if="classList.length === 0" class="empty-state">
          <div class="empty-icon">📚</div>
          <h3 class="empty-title">暂无班级</h3>
          <p class="empty-desc">点击"创建班级"按钮开始管理您的第一个班级</p>
          <el-button
            type="primary"
            :icon="Plus"
            @click="handleCreateClass"
            class="empty-action"
          >
            创建班级
          </el-button>
        </div>

        <!-- 网格模式 -->
        <div v-else class="classes-grid">
          <class-card
            v-for="classItem in classList"
            :key="classItem._id"
            :class-data="classItem"
            view-mode="grid"
            @view="handleViewClass"
            @edit="handleEditClass"
            @disband="handleDisbandClass"
            @regenerate-code="handleRegenerateCode"
          />
        </div>
      </div>
    </div>

    <!-- 创建/编辑班级对话框 -->
    <create-class-dialog
      v-model="showCreateDialog"
      :class-data="editingClass"
      @success="handleCreateSuccess"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { Plus, Refresh } from "@element-plus/icons-vue";
import { useRouter } from "vue-router";
// 使用相对路径导入，避免导入问题
import {
  getClassList,
  disbandClass,
  regenerateClassCode,
} from "../../../api/classes";

// 本地定义类型，避免导入问题
interface Class {
  _id: string;
  name: string;
  code: string;
  teacherId: string;
  teacherName?: string;
  status: "active" | "inactive" | "disbanded";
  studentCount: number;
  maxStudents?: number;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

interface ClassQueryParams {
  page?: number;
  limit?: number;
}

// 导入组件
import PageHeader from "@/components/PageHeader.vue";
import ClassCard from "./components/ClassCard.vue";
import CreateClassDialog from "./components/CreateClassDialog.vue";

const router = useRouter();

// 数据状态
const loading = ref(false);
const classList = ref<any[]>([]);
const showCreateDialog = ref(false);
const editingClass = ref<any | null>(null);
const CLASS_LIST_LIMIT = 50;


// 加载班级列表
const loadClassList = async () => {
  loading.value = true;
  try {
    const params: ClassQueryParams = {
      page: 1,
      limit: CLASS_LIST_LIMIT,
    };

    const response = await getClassList(params);
    console.log(response, "---response");

    classList.value = response.items;
  } catch (error) {
    // 错误提示已在统一请求层处理，此处不重复弹出
  } finally {
    loading.value = false;
  }
};

const refreshData = () => {
  loadClassList();
};

// 班级操作
const handleCreateClass = () => {
  editingClass.value = null;
  showCreateDialog.value = true;
};

const handleViewClass = (classData: Class) => {
  router.push({
    path: "/teacher/classes-detail",
    query: { id: classData._id },
  });
};

const handleEditClass = (classData: Class) => {
  editingClass.value = classData;
  showCreateDialog.value = true;
};

const handleDisbandClass = async (classData: Class) => {
  try {
    await ElMessageBox.confirm(
      `确定要解散班级"${classData.name}"吗？此操作不可撤销。`,
      "确认解散",
      {
        confirmButtonText: "确定",
        cancelButtonText: "取消",
        type: "warning",
      }
    );

    const response = await disbandClass(classData._id);
    ElMessage.success("班级已成功解散");
    loadClassList();
  } catch (error) {
    if (error !== "cancel") {
      console.error("解散班级失败:", error);
      // 错误提示已在统一请求层处理，此处不重复弹出
    }
  }
};

const handleRegenerateCode = async (classData: Class) => {
  try {
    await ElMessageBox.confirm(
      `确定要刷新班级"${classData.name}"的邀请码吗？旧的邀请码将失效。`,
      "确认刷新",
      {
        confirmButtonText: "确定",
        cancelButtonText: "取消",
        type: "warning",
      }
    );

    const response = await regenerateClassCode(classData._id);
    ElMessage.success(`新的邀请码：${response.inviteCode}`);
    loadClassList();
  } catch (error) {
    if (error !== "cancel") {
      console.error("刷新邀请码失败:", error);
      // 错误提示已在统一请求层处理，此处不重复弹出
    }
  }
};

const handleCreateSuccess = () => {
  showCreateDialog.value = false;
  editingClass.value = null;
  loadClassList();
};

// 初始化
onMounted(() => {
  loadClassList();
});
</script>

<style scoped>
.classes-management {
  min-height: 100%;
  display: flex;
  flex-direction: column;
  background-color: #f8fafc;
}

/* 内容容器 */
.classes-container {
  display: flex;
  flex-direction: column;
  width: 100%;
  margin: 0 auto;
  /* padding: 0 24px; */
  box-sizing: border-box;
  overflow: visible;
}

:deep(.el-form-item) {
  margin-bottom: 0;
}

:deep(.el-form-item__label) {
  font-weight: 500;
  color: #374151;
  font-size: 14px;
}

/* 内容区域 */
.content-section {
  flex: 1;
  overflow: visible;
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
}

/* 班级网格 */
.classes-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 20px;
}

/* 空状态 */
.empty-state {
  text-align: center;
  padding: 80px 20px;
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 20px;
}

.empty-title {
  font-size: 20px;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 12px 0;
}

.empty-desc {
  font-size: 14px;
  color: #6b7280;
  margin: 0 0 24px 0;
}

.empty-action {
  margin-top: 8px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .classes-management {
    height: auto;
    min-height: 100%;
    overflow: visible;
  }

  .classes-container {
    padding-left: 12px;
    padding-right: 12px;
    overflow: visible;
  }

  .content-section {
    padding: 12px;
    border-radius: 10px;
    overflow: visible;
  }

  .classes-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }
}

/* 优化卡片悬浮效果 */
:deep(.el-card) {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border: 1px solid #e5e7eb;
}

:deep(.el-card:hover) {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.15);
  border-color: #d1d5db;
}

</style>

<template>
  <section :class="['class-list', { 'class-list--mobile': mobile }]">
    <div class="class-list__header">
      <div>
        <h1 class="class-list__title">我的班级</h1>
        <p class="class-list__subtitle">选择班级后查看对应作业，也可以通过邀请码继续加入新班级。</p>
      </div>
      <el-button type="primary" :icon="Plus" circle @click="handleJoinClass" />
    </div>

    <div class="class-list__search">
      <el-input
        v-model="searchKeyword"
        placeholder="搜索班级"
        clearable
        @keyup.enter="handleSearch"
        @clear="handleClearSearch"
      />
      <el-button :icon="Search" :loading="searchLoading" @click="handleSearch" />
    </div>

    <div v-if="classLoading" class="class-list__loading">
      <el-skeleton v-for="i in mobile ? 2 : 4" :key="i" animated class="mb-3">
        <template #template>
          <div class="class-list__skeleton"></div>
        </template>
      </el-skeleton>
    </div>

    <div v-else-if="classes.length === 0" class="class-list__empty">
      <el-empty description="暂无班级" :image-size="80">
        <el-button type="primary" @click="handleJoinClass">加入班级</el-button>
      </el-empty>
    </div>

    <div v-else :class="['class-list__content', { 'class-list__content--mobile': mobile }]">
      <el-card
        v-for="classItem in classes"
        :key="classItem._id"
        :class="[
          'class-card',
          { 'class-card--active': selectedClassId === classItem._id },
        ]"
        :body-style="{ padding: mobile ? '14px' : '16px' }"
        @click="handleSelectClass(classItem)"
      >
        <div class="class-card__header">
          <h3 class="class-card__title">{{ classItem.name }}</h3>
          <el-tag :type="getClassStatusType(classItem.status)" size="small" effect="light">
            {{ getClassStatusText(classItem.status) }}
          </el-tag>
        </div>

        <div class="class-card__meta">
          <span class="class-card__meta-item">
            <el-icon><User /></el-icon>
            {{ classItem.teacherName || "未设置教师" }}
          </span>
          <span class="class-card__meta-item">
            <el-icon><UserFilled /></el-icon>
            {{ classItem.studentCount || 0 }} 人
          </span>
        </div>

        <div class="class-card__footer">
          <span class="class-card__code">邀请码：{{ classItem.code || "暂无" }}</span>
          <span v-if="selectedClassId === classItem._id" class="class-card__active-text">
            当前查看
          </span>
        </div>
      </el-card>
    </div>

    <div v-if="classes.length > 0" class="class-list__bottom">
      <el-button
        v-if="!pageState.isAllLoaded"
        text
        type="primary"
        :loading="loadingMore"
        @click="loadMore"
      >
        {{ loadingMore ? "加载中..." : "加载更多" }}
      </el-button>
      <span v-else class="class-list__bottom-tip">已显示全部班级</span>
    </div>
  </section>
</template>

<script setup lang="ts">
import { inject, nextTick, onMounted, reactive, ref, type Ref } from "vue";
import { ElMessage } from "element-plus";
import { Plus, Search, User, UserFilled } from "@element-plus/icons-vue";
import { getClassList } from "../../../../api/classes";
import { useClassManagement } from "../composables/useClassManagement";

interface Props {
  mobile?: boolean;
}

defineProps<Props>();

const selectedClassId = inject<Ref<string | null>>("selectedClassId")!;
const setSelectedClass = inject<(classItem: any) => void>("setSelectedClass")!;
const showJoinDialog = inject<Ref<boolean>>("showJoinDialog")!;

const classLoading = ref(true);
const loadingMore = ref(false);
const searchLoading = ref(false);
const classes = ref<any[]>([]);
const searchKeyword = ref("");
const pageState = reactive({
  page: 1,
  limit: 10,
  total: 0,
  isAllLoaded: false,
});

const { getClassStatusType } = useClassManagement();

const getClassStatusText = (status: string) => {
  const map: Record<string, string> = {
    active: "正常",
    inactive: "暂停",
    disbanded: "已解散",
  };
  return map[status] || "未知";
};

const loadClasses = async (type: "init" | "more" = "init", search?: string) => {
  if (type === "init") {
    classLoading.value = true;
    pageState.page = 1;
    pageState.isAllLoaded = false;
  } else {
    loadingMore.value = true;
  }

  try {
    const response = await getClassList({
      page: pageState.page,
      limit: pageState.limit,
      ...(search ? { search } : {}),
    });

    const items = response.items || [];
    pageState.total = response.total || 0;
    classes.value = type === "more" ? classes.value.concat(items) : items;

    if (classes.value.length >= pageState.total) {
      pageState.isAllLoaded = true;
    } else {
      pageState.page += 1;
    }

    if (classes.value.length > 0 && !selectedClassId.value) {
      handleSelectClass(classes.value[0]);
    }
  } catch (error) {
    console.error("加载班级列表失败:", error);
    ElMessage.error("加载班级列表失败");
  } finally {
    classLoading.value = false;
    loadingMore.value = false;
    searchLoading.value = false;

    if (type === "more") {
      await nextTick();
    }
  }
};

const handleSearch = async () => {
  if (searchLoading.value) return;
  searchLoading.value = true;
  await loadClasses("init", searchKeyword.value.trim());
};

const handleClearSearch = async () => {
  searchKeyword.value = "";
  await loadClasses("init");
};

const loadMore = () => {
  void loadClasses("more", searchKeyword.value.trim());
};

const handleSelectClass = (classItem: any) => {
  setSelectedClass(classItem);
};

const handleJoinClass = () => {
  showJoinDialog.value = true;
};

const refresh = () => {
  void loadClasses("init", searchKeyword.value.trim());
};

defineExpose({
  refresh,
});

onMounted(() => {
  void loadClasses();
});
</script>

<style scoped>
.class-list {
  width: 320px;
  display: flex;
  flex-direction: column;
  background: #fff;
  border-right: 1px solid #e5e7eb;
  border-radius: 16px;
  overflow: hidden;
}

.class-list--mobile {
  width: 100%;
  border-right: none;
  border-radius: 16px;
  border: 1px solid #e5e7eb;
}

.class-list__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 16px;
  border-bottom: 1px solid #f1f5f9;
}

.class-list__title {
  margin: 0 0 4px;
  font-size: 18px;
  font-weight: 600;
  color: #111827;
}

.class-list__subtitle {
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
  color: #6b7280;
}

.class-list__search {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
  padding: 14px 16px;
  border-bottom: 1px solid #f1f5f9;
}

.class-list__loading,
.class-list__empty {
  padding: 16px;
}

.class-list__skeleton {
  height: 88px;
  border-radius: 14px;
  background: #f3f4f6;
}

.class-list__content {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  overflow-y: auto;
  min-height: 0;
  flex: 1;
}

.class-list__content--mobile {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(220px, 76vw);
  overflow-x: auto;
  overflow-y: hidden;
  padding-bottom: 12px;
}

.class-card {
  cursor: pointer;
  border: 1px solid #e5e7eb;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease,
    border-color 0.2s ease;
}

.class-card:hover {
  transform: translateY(-1px);
  border-color: #93c5fd;
  box-shadow: 0 8px 20px rgba(59, 130, 246, 0.1);
}

.class-card--active {
  border-color: #3b82f6;
  box-shadow: 0 10px 24px rgba(59, 130, 246, 0.16);
}

.class-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 12px;
}

.class-card__title {
  margin: 0;
  font-size: 15px;
  line-height: 1.5;
  font-weight: 600;
  color: #111827;
}

.class-card__meta {
  display: flex;
  flex-direction: column;
  gap: 8px;
  color: #6b7280;
  font-size: 13px;
}

.class-card__meta-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.class-card__footer {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  align-items: center;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px dashed #e5e7eb;
  font-size: 12px;
}

.class-card__code {
  color: #6b7280;
}

.class-card__active-text {
  color: #2563eb;
  font-weight: 600;
}

.class-list__bottom {
  padding: 12px 16px 16px;
  text-align: center;
  border-top: 1px solid #f8fafc;
}

.class-list__bottom-tip {
  font-size: 12px;
  color: #9ca3af;
}

@media (max-width: 768px) {
  .class-list__header {
    padding: 14px;
  }

  .class-list__title {
    font-size: 16px;
  }

  .class-list__search {
    padding: 12px 14px;
  }

  .class-list__content {
    padding: 14px;
  }
}
</style>

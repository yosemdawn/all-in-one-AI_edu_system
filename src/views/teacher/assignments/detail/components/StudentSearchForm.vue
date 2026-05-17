<template>
  <div class="student-search-form">
    <el-form
      :inline="true"
      :model="searchForm"
      size="default"
      class="search-form"
    >
      <div class="form-container">
        <el-form-item label="班级筛选">
          <el-select
            v-model="searchForm.classId"
            placeholder="请选择班级"
            clearable
            style="width: 180px"
            @change="handleFormChange"
          >
            <el-option label="全部班级" value="" />
            <el-option
              v-for="cls in classes"
              :key="cls.id"
              :label="cls.name"
              :value="cls.id"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="学生姓名">
          <el-input
            v-model="searchForm.studentName"
            placeholder="请输入学生姓名"
            clearable
            style="width: 150px"
            @keyup.enter="handleSearch"
            @blur="trimAndSearch('studentName')"
          >
            <template #prefix>
              <el-icon><User /></el-icon>
            </template>
          </el-input>
        </el-form-item>

        <div class="form-actions">
          <el-button type="primary" @click="handleSearch" :loading="loading">
            <el-icon><Search /></el-icon>
            搜索
          </el-button>
          <el-button @click="handleReset">
            <el-icon><Refresh /></el-icon>
            重置
          </el-button>
        </div>
      </div>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import { reactive } from "vue";
import { User, Search, Refresh } from "@element-plus/icons-vue";

interface Props {
  classes?: Array<{ id: string; name: string }>;
  submissionStats?: {
    totalSubmissions: number;
    reviewedSubmissions: number;
    pendingSubmissions: number;
    draftSubmissions: number;
  } | null;
  totalStudents?: number;
  total?: number;
  loading?: boolean;
}

interface SearchForm {
  classId: string;
  studentName: string;
}

interface Emits {
  (e: "search", searchForm: SearchForm): void;
  (e: "reset"): void;
}

const props = withDefaults(defineProps<Props>(), {
  classes: () => [],
  total: 0,
  loading: false,
});

const emit = defineEmits<Emits>();

// 搜索表单
const searchForm = reactive<SearchForm>({
  classId: "",
  studentName: "",
});

// 自动清理输入框并搜索
const trimAndSearch = (field: keyof SearchForm) => {
  if (searchForm[field]) {
    searchForm[field] = (searchForm[field] as string).trim();
  }
  if (searchForm[field] !== "") {
    handleSearch();
  }
};

// 表单变化时自动搜索（下拉框）
const handleFormChange = () => {
  handleSearch();
};

// 搜索
const handleSearch = () => {
  emit("search", { ...searchForm });
};

// 重置
const handleReset = () => {
  Object.assign(searchForm, {
    classId: "",
    studentName: "",
  });
  emit("reset");
};

defineOptions({
  name: "StudentSearchForm",
});

defineExpose({
  searchForm,
});
</script>

<style scoped>
.student-search-form {
  background: white;
  border-radius: 8px;
}

.search-form {
  width: 100%;
}

.form-container {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 16px;
  width: 100%;
}

.form-container :deep(.el-form-item) {
  margin-bottom: 0;
  margin-right: 0;
  flex-shrink: 0;
}

.form-container :deep(.el-form-item__label) {
  font-weight: 500;
  color: #374151;
  font-size: 14px;
  margin-bottom: 4px;
}

.form-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
  margin-left: auto;
}

.option-with-badge {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.option-with-badge span {
  flex: 1;
}

.option-with-badge .el-tag {
  margin-left: 8px;
  flex-shrink: 0;
}

/* 响应式设计 */
@media (max-width: 1400px) {
  .form-actions {
    margin-left: 0;
  }
}

@media (max-width: 1200px) {
  .form-container {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }

  .form-container :deep(.el-form-item) {
    width: 100%;
  }

  .form-container :deep(.el-select),
  .form-container :deep(.el-input) {
    width: 100% !important;
  }

  .form-actions {
    margin-left: 0;
    justify-content: flex-start;
  }
}

@media (max-width: 768px) {
  .form-actions {
    flex-direction: row;
    align-items: stretch;
    gap: 10px;
  }

  .form-actions .el-button {
    flex: 1;
    width: auto;
    margin-left: 0;
  }
}
</style>

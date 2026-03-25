<template>
  <AdaptiveTableContainer :loading="loading">
    <!-- 搜索区域 -->
    <template #search>
      <el-form :inline="true">
        <el-form-item label="搜索">
          <el-input v-model="searchKeyword" placeholder="请输入关键词" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">搜索</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </template>

    <!-- 表格区域 -->
    <template #table>
      <el-table :data="tableData" border style="width: 100%; height: 100%">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="name" label="姓名" />
        <el-table-column prop="email" label="邮箱" />
        <el-table-column prop="role" label="角色" />
        <el-table-column prop="status" label="状态" />
        <el-table-column label="操作" width="200">
          <template #default="scope">
            <el-button size="small" @click="handleEdit(scope.row)"
              >编辑</el-button
            >
            <el-button
              size="small"
              type="danger"
              @click="handleDelete(scope.row)"
              >删除</el-button
            >
          </template>
        </el-table-column>
      </el-table>
    </template>

    <!-- 分页区域 -->
    <template #pagination>
      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.size"
        :total="pagination.total"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="handleSizeChange"
        @current-change="handlePageChange"
      />
    </template>
  </AdaptiveTableContainer>
</template>

<script setup lang="ts">
import { ref, reactive } from "vue";
import AdaptiveTableContainer from "./AdaptiveTableContainer.vue";

// 搜索关键词
const searchKeyword = ref("");

// 加载状态
const loading = ref(false);

// 分页信息
const pagination = reactive({
  page: 1,
  size: 20,
  total: 0,
});

// 表格数据（示例数据）
const tableData = ref([
  {
    id: 1,
    name: "张三",
    email: "zhangsan@example.com",
    role: "管理员",
    status: "正常",
  },
  {
    id: 2,
    name: "李四",
    email: "lisi@example.com",
    role: "用户",
    status: "正常",
  },
  {
    id: 3,
    name: "王五",
    email: "wangwu@example.com",
    role: "用户",
    status: "禁用",
  },
  // 添加更多数据以测试滚动
  ...Array.from({ length: 50 }, (_, i) => ({
    id: i + 4,
    name: `用户${i + 4}`,
    email: `user${i + 4}@example.com`,
    role: "用户",
    status: i % 3 === 0 ? "禁用" : "正常",
  })),
]);

// 搜索处理
const handleSearch = () => {
  console.log("搜索:", searchKeyword.value);
};

// 重置处理
const handleReset = () => {
  searchKeyword.value = "";
};

// 编辑处理
const handleEdit = (row: any) => {
  console.log("编辑:", row);
};

// 删除处理
const handleDelete = (row: any) => {
  console.log("删除:", row);
};

// 分页大小变化
const handleSizeChange = (size: number) => {
  pagination.size = size;
  // 重新加载数据
};

// 页码变化
const handlePageChange = (page: number) => {
  pagination.page = page;
  // 重新加载数据
};
</script>

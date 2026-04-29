<template>
  <div class="not-found">
    <div class="content">
      <div class="error-code">404</div>
      <div class="error-message">😕 页面未找到</div>
      <div class="error-description">抱歉，您访问的页面不存在</div>
      <el-button type="primary" size="large" @click="goHome">
        返回首页
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const userStore = useUserStore()

const goHome = () => {
  if (userStore.isAdmin) {
    router.push('/dashboard')
  } else if (userStore.isStudent) {
    router.push('/student/records')
  } else {
    router.push('/login')
  }
}
</script>

<style scoped>
.not-found {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.content {
  text-align: center;
  color: #fff;
}

.error-code {
  font-size: 120px;
  font-weight: bold;
  line-height: 1;
  margin-bottom: 20px;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.2);
}

.error-message {
  font-size: 32px;
  margin-bottom: 10px;
}

.error-description {
  font-size: 18px;
  margin-bottom: 30px;
  opacity: 0.9;
}
</style>


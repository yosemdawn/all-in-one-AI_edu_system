<template>
  <div class="demo-container">
    <h2>📊 JavaScript 计算 vs CSS Flexbox 对比演示</h2>

    <div class="demo-tabs">
      <button
        :class="['tab-btn', { active: activeTab === 'js' }]"
        @click="activeTab = 'js'"
      >
        ❌ JavaScript 方式
      </button>
      <button
        :class="['tab-btn', { active: activeTab === 'flexbox' }]"
        @click="activeTab = 'flexbox'"
      >
        ✅ Flexbox 方式
      </button>
    </div>

    <!-- JavaScript 方式演示 -->
    <div v-if="activeTab === 'js'" class="demo-content">
      <div class="code-explanation">
        <h3>🤯 JavaScript 方式的复杂性</h3>
        <pre class="code-block">{{ jsCode }}</pre>

        <div class="problems">
          <h4>存在的问题：</h4>
          <ul>
            <li>❌ 需要 100+ 行代码</li>
            <li>❌ 监听多个事件（resize、DOM变化等）</li>
            <li>❌ 复杂的计算逻辑</li>
            <li>❌ 性能开销大</li>
            <li>❌ 可能出现闪烁</li>
            <li>❌ 维护困难</li>
          </ul>
        </div>
      </div>

      <div class="visual-demo js-demo">
        <div class="container-header">JavaScript 计算方式 (模拟)</div>
        <div
          ref="jsContainer"
          class="js-container"
          :style="{ height: containerHeight + 'px' }"
        >
          <div class="search-area">搜索区域 (固定高度: 60px)</div>
          <div class="table-area" :style="{ height: jsTableHeight + 'px' }">
            <div class="table-content">
              表格区域 (JavaScript 计算高度: {{ jsTableHeight }}px)
              <div class="performance-indicator">
                ⏱️ 计算耗时: {{ jsCalculationTime }}ms
              </div>
            </div>
          </div>
          <div class="pagination-area">分页区域 (固定高度: 50px)</div>
        </div>
      </div>
    </div>

    <!-- Flexbox 方式演示 -->
    <div v-if="activeTab === 'flexbox'" class="demo-content">
      <div class="code-explanation">
        <h3>😍 Flexbox 方式的简洁性</h3>
        <pre class="code-block">{{ flexboxCode }}</pre>

        <div class="advantages">
          <h4>优势：</h4>
          <ul>
            <li>✅ 只需要几行 CSS</li>
            <li>✅ 浏览器原生支持，性能极佳</li>
            <li>✅ 自动响应，无需监听事件</li>
            <li>✅ 瞬时布局，无闪烁</li>
            <li>✅ 代码简洁，易维护</li>
            <li>✅ 硬件加速支持</li>
          </ul>
        </div>
      </div>

      <div class="visual-demo flexbox-demo">
        <div class="container-header">Flexbox 自适应方式</div>
        <div
          class="flexbox-container"
          :style="{ height: containerHeight + 'px' }"
        >
          <div class="search-area">搜索区域 (flex-shrink: 0)</div>
          <div class="table-area">
            <div class="table-content">
              表格区域 (flex: 1 - 自动计算)
              <div class="performance-indicator">⚡ 浏览器原生，0ms 延迟</div>
            </div>
          </div>
          <div class="pagination-area">分页区域 (flex-shrink: 0)</div>
        </div>
      </div>
    </div>

    <!-- 交互式控制 -->
    <div class="controls">
      <h3>🎮 试试改变容器高度</h3>
      <div class="slider-container">
        <label>容器高度: {{ containerHeight }}px</label>
        <input
          v-model="containerHeight"
          type="range"
          min="300"
          max="800"
          step="10"
          class="height-slider"
        />
      </div>
      <p class="control-hint">拖动滑块看看两种方式的响应速度差异！</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";

const activeTab = ref<"js" | "flexbox">("flexbox");
const containerHeight = ref(500);
const jsCalculationTime = ref(0);

// JavaScript 方式的表格高度（模拟计算）
const jsTableHeight = computed(() => {
  // 模拟 JavaScript 计算过程
  const start = performance.now();

  // 模拟复杂计算
  let result = containerHeight.value;
  result -= 60; // 搜索区域
  result -= 50; // 分页区域
  result -= 20; // 边距

  const end = performance.now();
  jsCalculationTime.value = Math.round((end - start) * 100) / 100;

  return Math.max(result, 100);
});

// 监听容器高度变化，模拟 JavaScript 重新计算的延迟
watch(containerHeight, () => {
  // 模拟 JavaScript 计算延迟
  setTimeout(() => {
    jsCalculationTime.value = Math.random() * 5 + 1;
  }, 50);
});

const jsCode = `// JavaScript 方式 - 复杂且低效
function calculateTableHeight() {
  const container = document.querySelector('.container')
  const search = document.querySelector('.search')
  const pagination = document.querySelector('.pagination')
  
  // 获取各种尺寸
  const containerHeight = container.clientHeight
  const searchHeight = search.clientHeight
  const paginationHeight = pagination.clientHeight
  
  // 复杂计算
  const padding = 32
  const margins = 32
  const tableHeight = containerHeight - searchHeight - 
                     paginationHeight - padding - margins
  
  // 设置样式
  document.querySelector('.table').style.height = tableHeight + 'px'
}

// 需要监听各种事件
window.addEventListener('resize', debounce(calculateTableHeight, 100))
document.addEventListener('DOMContentLoaded', calculateTableHeight)
// ... 更多监听器和错误处理`;

const flexboxCode = `/* Flexbox 方式 - 简洁且高效 */
.container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.search, .pagination {
  flex-shrink: 0;  /* 固定高度 */
}

.table {
  flex: 1;         /* 自动占用剩余空间 */
  min-height: 0;   /* 防止内容撑开 */
}

/* 就这么简单！浏览器自动处理一切 */`;
</script>

<style scoped>
.demo-container {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.demo-tabs {
  display: flex;
  margin-bottom: 20px;
  border-bottom: 2px solid #e1e4e8;
}

.tab-btn {
  padding: 12px 24px;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 16px;
  font-weight: 500;
  color: #666;
  border-bottom: 3px solid transparent;
  transition: all 0.3s ease;
}

.tab-btn.active {
  color: #409eff;
  border-bottom-color: #409eff;
}

.tab-btn:hover {
  background-color: #f5f7fa;
}

.demo-content {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 30px;
  margin-bottom: 30px;
}

.code-explanation {
  background: #f8f9fa;
  padding: 20px;
  border-radius: 8px;
  border-left: 4px solid #409eff;
}

.code-block {
  background: #2d3748;
  color: #e2e8f0;
  padding: 15px;
  border-radius: 6px;
  font-family: "Monaco", "Consolas", monospace;
  font-size: 12px;
  line-height: 1.5;
  overflow-x: auto;
  margin: 10px 0;
}

.problems ul,
.advantages ul {
  margin: 10px 0;
  padding-left: 20px;
}

.problems li {
  color: #e74c3c;
  margin: 5px 0;
}

.advantages li {
  color: #27ae60;
  margin: 5px 0;
}

.visual-demo {
  border: 2px solid #e1e4e8;
  border-radius: 8px;
  overflow: hidden;
}

.container-header {
  background: #409eff;
  color: white;
  padding: 10px 15px;
  font-weight: 500;
  text-align: center;
}

.js-container,
.flexbox-container {
  padding: 10px;
  background: #f5f7fa;
}

.flexbox-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.search-area,
.pagination-area {
  background: #e3f2fd;
  border: 2px dashed #2196f3;
  border-radius: 4px;
  padding: 15px;
  text-align: center;
  font-weight: 500;
  margin: 5px 0;
}

.search-area {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.pagination-area {
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.flexbox-container .search-area,
.flexbox-container .pagination-area {
  flex-shrink: 0;
}

.table-area {
  background: #f3e5f5;
  border: 2px dashed #9c27b0;
  border-radius: 4px;
  margin: 5px 0;
  display: flex;
  flex-direction: column;
  transition: height 0.3s ease;
}

.flexbox-container .table-area {
  flex: 1;
  min-height: 0;
}

.table-content {
  padding: 15px;
  text-align: center;
  font-weight: 500;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
}

.performance-indicator {
  margin-top: 10px;
  font-size: 14px;
  padding: 5px 10px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid #ddd;
}

.controls {
  background: #f8f9fa;
  padding: 20px;
  border-radius: 8px;
  text-align: center;
}

.slider-container {
  margin: 15px 0;
}

.slider-container label {
  display: block;
  margin-bottom: 10px;
  font-weight: 500;
}

.height-slider {
  width: 300px;
  height: 6px;
  border-radius: 3px;
  background: #ddd;
  outline: none;
  -webkit-appearance: none;
}

.height-slider::-webkit-slider-thumb {
  appearance: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #409eff;
  cursor: pointer;
}

.control-hint {
  color: #666;
  font-style: italic;
  margin-top: 10px;
}

@media (max-width: 768px) {
  .demo-content {
    grid-template-columns: 1fr;
  }
}
</style>

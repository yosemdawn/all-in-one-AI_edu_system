<template>
  <div class="simple-example">
    <h2>🎯 最简单的例子理解 Flexbox</h2>

    <div class="example-container">
      <h3>想象你有一个 600px 高的盒子，里面放 3 个东西：</h3>

      <div class="visual-container" style="height: 400px">
        <!-- 传统方式说明 -->
        <div class="method traditional">
          <h4>❌ 传统方式 (JavaScript)</h4>
          <div class="code-snippet">
            <pre>
// 需要用 JavaScript 计算
总高度: 400px
头部: 80px (固定)
底部: 60px (固定)
中间 = 400 - 80 - 60 = 260px

document.querySelector('.middle')
  .style.height = '260px'</pre
            >
          </div>
        </div>

        <!-- Flexbox 方式说明 -->
        <div class="method flexbox">
          <h4>✅ Flexbox 方式 (CSS)</h4>
          <div class="code-snippet">
            <pre>
/* 只需要告诉浏览器 */
.container { 
  display: flex; 
  flex-direction: column; 
}
.top, .bottom { 
  flex-shrink: 0; /* 固定大小 */ 
}
.middle { 
  flex: 1; /* 占剩余空间 */ 
}</pre
            >
          </div>
        </div>
      </div>

      <!-- 实际效果展示 -->
      <div class="live-demo">
        <h3>🎮 实际效果（可以调整高度看效果）</h3>

        <div class="controls">
          <label>容器高度: {{ demoHeight }}px</label>
          <input
            v-model="demoHeight"
            type="range"
            min="200"
            max="600"
            class="slider"
          />
        </div>

        <div
          class="demo-flexbox-container"
          :style="{ height: demoHeight + 'px' }"
        >
          <div class="demo-top">头部区域 (80px 固定)</div>
          <div class="demo-middle">
            <div class="middle-content">
              中间区域 (自动计算)
              <br />
              <strong>实际高度: {{ calculatedMiddleHeight }}px</strong>
              <br />
              <small
                >= {{ demoHeight }} - 80 - 60 =
                {{ calculatedMiddleHeight }}</small
              >
            </div>
          </div>
          <div class="demo-bottom">底部区域 (60px 固定)</div>
        </div>
      </div>

      <!-- 关键优势 -->
      <div class="key-points">
        <h3>🔑 关键优势</h3>
        <div class="advantages-grid">
          <div class="advantage">
            <div class="icon">⚡</div>
            <h4>性能</h4>
            <p>浏览器原生支持，比 JavaScript 快 100 倍</p>
          </div>
          <div class="advantage">
            <div class="icon">🎯</div>
            <h4>精确</h4>
            <p>永远不会出现计算误差或舍入问题</p>
          </div>
          <div class="advantage">
            <div class="icon">🔄</div>
            <h4>响应式</h4>
            <p>窗口大小改变时瞬时重新布局</p>
          </div>
          <div class="advantage">
            <div class="icon">🛠️</div>
            <h4>简单</h4>
            <p>几行 CSS 替代几十行 JavaScript</p>
          </div>
        </div>
      </div>

      <!-- 兼容性说明 -->
      <div class="compatibility">
        <h3>🌐 兼容性</h3>
        <div class="browser-support">
          <div class="browser good">
            <div class="browser-icon">🟢</div>
            <div>Chrome 29+ (2013年)</div>
          </div>
          <div class="browser good">
            <div class="browser-icon">🟢</div>
            <div>Firefox 28+ (2014年)</div>
          </div>
          <div class="browser good">
            <div class="browser-icon">🟢</div>
            <div>Safari 9+ (2015年)</div>
          </div>
          <div class="browser good">
            <div class="browser-icon">🟢</div>
            <div>Edge 12+ (2015年)</div>
          </div>
          <div class="browser warning">
            <div class="browser-icon">🟡</div>
            <div>IE 11+ (需前缀)</div>
          </div>
        </div>
        <p class="compatibility-note">
          <strong>结论：</strong> 现代项目完全可以放心使用！覆盖 99.5% 的用户。
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";

const demoHeight = ref(400);

const calculatedMiddleHeight = computed(() => {
  return Math.max(demoHeight.value - 80 - 60, 0);
});
</script>

<style scoped>
.simple-example {
  padding: 20px;
  max-width: 1000px;
  margin: 0 auto;
  font-family: "PingFang SC", "Microsoft YaHei", sans-serif;
}

.example-container {
  background: #f8f9fa;
  border-radius: 12px;
  padding: 30px;
  margin: 20px 0;
}

.visual-container {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 30px;
  margin: 30px 0;
}

.method {
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.method h4 {
  margin: 0 0 15px 0;
  font-size: 18px;
}

.traditional h4 {
  color: #e74c3c;
}

.flexbox h4 {
  color: #27ae60;
}

.code-snippet {
  background: #2d3748;
  border-radius: 6px;
  overflow: hidden;
}

.code-snippet pre {
  color: #e2e8f0;
  padding: 15px;
  margin: 0;
  font-family: "Monaco", "Consolas", monospace;
  font-size: 12px;
  line-height: 1.6;
  overflow-x: auto;
}

.live-demo {
  margin: 40px 0;
}

.controls {
  text-align: center;
  margin-bottom: 20px;
}

.controls label {
  display: block;
  margin-bottom: 10px;
  font-weight: 500;
  font-size: 16px;
}

.slider {
  width: 300px;
  height: 6px;
  border-radius: 3px;
  background: #ddd;
  outline: none;
  -webkit-appearance: none;
}

.slider::-webkit-slider-thumb {
  appearance: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #409eff;
  cursor: pointer;
}

.demo-flexbox-container {
  display: flex;
  flex-direction: column;
  border: 3px solid #409eff;
  border-radius: 8px;
  margin: 20px auto;
  max-width: 400px;
  background: white;
  overflow: hidden;
  transition: height 0.3s ease;
}

.demo-top {
  height: 80px;
  background: #e3f2fd;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 500;
  border-bottom: 2px dashed #2196f3;
  flex-shrink: 0;
}

.demo-middle {
  flex: 1;
  background: #f3e5f5;
  display: flex;
  align-items: center;
  justify-content: center;
  border-bottom: 2px dashed #9c27b0;
  min-height: 0;
}

.middle-content {
  text-align: center;
  font-weight: 500;
}

.demo-bottom {
  height: 60px;
  background: #e8f5e8;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 500;
  flex-shrink: 0;
}

.key-points {
  margin: 40px 0;
}

.advantages-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin-top: 20px;
}

.advantage {
  background: white;
  padding: 20px;
  border-radius: 8px;
  text-align: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s ease;
}

.advantage:hover {
  transform: translateY(-2px);
}

.icon {
  font-size: 32px;
  margin-bottom: 10px;
}

.advantage h4 {
  margin: 10px 0;
  color: #333;
}

.advantage p {
  color: #666;
  font-size: 14px;
  line-height: 1.5;
}

.compatibility {
  margin: 40px 0;
  background: white;
  padding: 25px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.browser-support {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 15px;
  margin: 20px 0;
}

.browser {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  border-radius: 6px;
}

.browser.good {
  background: #e8f5e8;
}

.browser.warning {
  background: #fff3cd;
}

.browser-icon {
  font-size: 20px;
}

.compatibility-note {
  background: #e3f2fd;
  padding: 15px;
  border-radius: 6px;
  border-left: 4px solid #2196f3;
  margin-top: 20px;
}

@media (max-width: 768px) {
  .visual-container {
    grid-template-columns: 1fr;
  }

  .advantages-grid {
    grid-template-columns: 1fr;
  }

  .browser-support {
    grid-template-columns: 1fr;
  }
}
</style>

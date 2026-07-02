<template>
  <div class="analytics-panel" v-loading="loading">
    <template v-if="analytics">
      <section class="summary-band">
        <div class="summary-main">
          <div class="summary-icon">
            <el-icon><DataAnalysis /></el-icon>
          </div>
          <div>
            <h3>AI 学情总结</h3>
            <p>{{ analytics.summary.completionSummary }}</p>
            <p>{{ analytics.summary.scoreSummary }}</p>
          </div>
        </div>
        <div class="generated-at">
          {{ formatGeneratedAt(analytics.generatedAt) }}
        </div>
      </section>

      <section class="metric-grid">
        <div class="metric-item">
          <span>提交率</span>
          <strong>{{ analytics.submissionRate }}%</strong>
          <el-progress
            :percentage="analytics.submissionRate"
            :stroke-width="8"
            color="#2f80ed"
          />
        </div>
        <div class="metric-item">
          <span>平均分</span>
          <strong>{{ scoreText(analytics.averageScore) }}</strong>
          <el-progress
            :percentage="scoreProgress(analytics.averageScore)"
            :stroke-width="8"
            color="#27ae60"
          />
        </div>
        <div class="metric-item">
          <span>已提交</span>
          <strong>{{ analytics.submittedCount }}/{{ analytics.totalStudents }}</strong>
          <small>未提交 {{ analytics.unsubmittedCount }} 人</small>
        </div>
        <div class="metric-item">
          <span>已批改</span>
          <strong>{{ analytics.gradedCount }}</strong>
          <small>含 AI 批改与教师批改</small>
        </div>
      </section>

      <section class="analysis-grid">
        <div class="analysis-section">
          <div class="section-title">
            <el-icon><Warning /></el-icon>
            <h4>薄弱点</h4>
          </div>
          <ul class="plain-list">
            <li v-for="item in analytics.summary.weakPoints" :key="item">
              {{ item }}
            </li>
          </ul>
        </div>

        <div class="analysis-section">
          <div class="section-title">
            <el-icon><Check /></el-icon>
            <h4>教学建议</h4>
          </div>
          <ul class="plain-list">
            <li
              v-for="item in analytics.summary.teachingSuggestions"
              :key="item"
            >
              {{ item }}
            </li>
          </ul>
        </div>
      </section>

      <section class="analysis-section">
        <div class="section-title">
          <el-icon><TrendCharts /></el-icon>
          <h4>分数段分布</h4>
        </div>
        <div class="score-band-list">
          <div
            v-for="band in analytics.scoreBands"
            :key="band.label"
            class="score-band-row"
          >
            <span class="band-label">{{ band.label }}</span>
            <el-progress
              :percentage="band.rate"
              :stroke-width="10"
              :show-text="false"
              color="#9b51e0"
            />
            <span class="band-count">{{ band.count }} 人 · {{ band.rate }}%</span>
          </div>
        </div>
      </section>

      <section class="analysis-section">
        <div class="section-title">
          <el-icon><School /></el-icon>
          <h4>班级完成情况</h4>
        </div>
        <el-table :data="analytics.classStats" border>
          <el-table-column prop="className" label="班级" min-width="160" />
          <el-table-column label="提交人数" min-width="120">
            <template #default="{ row }">
              {{ row.submittedCount }}/{{ row.totalStudents }}
            </template>
          </el-table-column>
          <el-table-column label="提交率" min-width="160">
            <template #default="{ row }">
              <el-progress
                :percentage="row.submissionRate"
                :stroke-width="8"
                color="#2f80ed"
              />
            </template>
          </el-table-column>
          <el-table-column label="平均分" min-width="100">
            <template #default="{ row }">
              {{ scoreText(row.averageScore) }}
            </template>
          </el-table-column>
        </el-table>
      </section>

      <section class="analysis-section">
        <div class="section-title">
          <el-icon><List /></el-icon>
          <h4>错题分布排行</h4>
        </div>
        <el-table
          v-if="analytics.wrongQuestionDistribution.length"
          :data="analytics.wrongQuestionDistribution"
          border
        >
          <el-table-column label="题号" width="80">
            <template #default="{ row }">
              第 {{ row.questionNumber || "-" }} 题
            </template>
          </el-table-column>
          <el-table-column prop="stem" label="题干" min-width="260" show-overflow-tooltip />
          <el-table-column label="错误率" min-width="170">
            <template #default="{ row }">
              <el-progress
                :percentage="row.wrongRate"
                :stroke-width="8"
                color="#eb5757"
              />
            </template>
          </el-table-column>
          <el-table-column label="错/答" width="100">
            <template #default="{ row }">
              {{ row.wrongCount }}/{{ row.totalAnswered }}
            </template>
          </el-table-column>
          <el-table-column label="常见错误答案" min-width="180">
            <template #default="{ row }">
              <el-tag
                v-for="answer in row.commonWrongAnswers"
                :key="`${row.questionId}-${answer.answer}`"
                class="answer-tag"
                type="danger"
                effect="plain"
              >
                {{ answer.answer }} × {{ answer.count }}
              </el-tag>
              <span v-if="!row.commonWrongAnswers.length">-</span>
            </template>
          </el-table-column>
        </el-table>
        <el-empty
          v-else
          description="暂无结构化错题数据，在线客观题提交后会自动生成错题分布"
        />
      </section>
    </template>

    <el-empty v-else-if="!loading" description="暂无学情分析数据" />
  </div>
</template>

<script setup lang="ts">
import {
  Check,
  DataAnalysis,
  List,
  School,
  TrendCharts,
  Warning,
} from "@element-plus/icons-vue";
import type { AssignmentAnalytics } from "@/api/assignments";

interface Props {
  analytics?: AssignmentAnalytics | null;
  loading?: boolean;
}

defineProps<Props>();

const scoreText = (score: number | null | undefined) =>
  typeof score === "number" ? `${score} 分` : "暂无";

const scoreProgress = (score: number | null | undefined) =>
  typeof score === "number" ? Math.max(0, Math.min(100, score)) : 0;

const formatGeneratedAt = (value: string) => {
  if (!value) return "";
  return `生成时间：${new Date(value).toLocaleString()}`;
};

defineOptions({
  name: "AssignmentAnalyticsPanel",
});
</script>

<style scoped>
.analytics-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 420px;
}

.summary-band {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 18px;
  background: #f7fbff;
  border: 1px solid #d8e8fb;
  border-radius: 8px;
}

.summary-main {
  display: flex;
  gap: 14px;
  min-width: 0;
}

.summary-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  flex: 0 0 42px;
  color: #2f80ed;
  background: white;
  border-radius: 8px;
  font-size: 22px;
}

.summary-band h3,
.analysis-section h4 {
  margin: 0;
  color: #111827;
  font-size: 16px;
  line-height: 1.4;
}

.summary-band p {
  margin: 6px 0 0;
  color: #4b5563;
  line-height: 1.6;
}

.generated-at {
  flex: 0 0 auto;
  color: #6b7280;
  font-size: 13px;
  white-space: nowrap;
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.metric-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  min-width: 0;
}

.metric-item span,
.metric-item small {
  color: #6b7280;
  font-size: 13px;
}

.metric-item strong {
  color: #111827;
  font-size: 24px;
  line-height: 1.2;
}

.analysis-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.analysis-section {
  padding: 16px;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  color: #2f80ed;
}

.plain-list {
  margin: 0;
  padding-left: 18px;
  color: #374151;
  line-height: 1.7;
}

.score-band-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.score-band-row {
  display: grid;
  grid-template-columns: 72px minmax(120px, 1fr) 110px;
  align-items: center;
  gap: 12px;
}

.band-label,
.band-count {
  color: #4b5563;
  font-size: 13px;
}

.band-count {
  text-align: right;
}

.answer-tag {
  margin: 2px 6px 2px 0;
  max-width: 160px;
}

@media (max-width: 960px) {
  .metric-grid,
  .analysis-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .summary-band {
    flex-direction: column;
  }

  .generated-at {
    white-space: normal;
  }
}

@media (max-width: 640px) {
  .metric-grid,
  .analysis-grid {
    grid-template-columns: 1fr;
  }

  .score-band-row {
    grid-template-columns: 64px minmax(90px, 1fr);
  }

  .band-count {
    grid-column: 2;
    text-align: left;
  }
}
</style>

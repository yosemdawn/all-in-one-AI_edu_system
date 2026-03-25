import { ref } from "vue";

// 自适应表格的CSS类名
export const ADAPTIVE_TABLE_CLASSES = {
  container: "adaptive-table-container",
  searchSection: "adaptive-table-search",
  tableSection: "adaptive-table-table",
  paginationSection: "adaptive-table-pagination",
};

/**
 * 简化的自适应表格组合式函数
 * 利用 CSS Flexbox 自动处理高度，无需 JavaScript 计算
 */
export function useAdaptiveTable() {
  const containerRef = ref<HTMLElement | null>(null);

  return {
    containerRef,
    // 保留这些属性以兼容现有代码，但实际不再需要
    tableHeight: ref("100%"), // CSS 自动处理，设为 100%
    calculateTableHeight: () => {}, // 空函数，保持接口兼容
    recalculate: () => {}, // 空函数，保持接口兼容
  };
}

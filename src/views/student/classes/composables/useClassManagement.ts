import { ref, reactive } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { formatDateTime, formatRelativeTime } from "@/utils/date";
import { leaveClass } from "../../../../api/classes";

export function useClassManagement() {
  // 格式化日期的通用函数
  const formatDate = (date: string | Date, type = "full") => {
    if (!date) return "未设置";

    const patterns = {
      short: "yyyy-MM-dd",
      time: "HH:mm:ss",
      datetime: "MM-dd HH:mm",
    };
    const formatted =
      type === "relative"
        ? formatRelativeTime(date)
        : formatDateTime(date, patterns[type] || "yyyy-MM-dd HH:mm:ss");
    return formatted === "--" ? "无效日期" : formatted;
  };

  // 获取班级状态类型
  const getClassStatusType = (
    status: string
  ): "success" | "warning" | "info" | "primary" | "danger" => {
    const statusMap: Record<
      string,
      "success" | "warning" | "info" | "primary" | "danger"
    > = {
      active: "success",
      inactive: "warning",
      disbanded: "info",
    };
    return statusMap[status] || "info";
  };

  // 获取班级状态文本
  const getClassStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      active: "活跃",
      inactive: "暂停",
      disbanded: "已解散",
    };
    return statusMap[status] || "未知";
  };

  // 退出班级功能
  const handleLeaveClass = async (classId: string, onSuccess?: () => void) => {
    try {
      await ElMessageBox.confirm("确定退出班级吗？", "提示", {
        confirmButtonText: "确定",
        cancelButtonText: "取消",
        type: "warning",
      });

      await leaveClass(classId);
      ElMessage.success("退出班级成功");

      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      if (error !== "cancel") {
        ElMessage.error("退出班级失败");
      }
    }
  };

  return {
    formatDate,
    getClassStatusType,
    getClassStatusText,
    handleLeaveClass,
  };
}

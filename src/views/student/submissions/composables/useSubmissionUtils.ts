import { ElMessage } from "element-plus";
import type { Attachment } from "@/api/submissions";
import { downloadFile as downloadRequest } from "@/utils/request";

export function useSubmissionUtils() {
  // 格式化日期
  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleString("zh-CN");
  };

  // 格式化文件大小
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // 文件类型验证
  const validateFileType = (file: File) => {
    const validTypes = [
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/pdf",
      "text/plain",
      "image/jpeg",
      "image/jpg",
      "image/png",
      "application/zip",
      "application/x-rar-compressed",
    ];
    return validTypes.includes(file.type);
  };

  // 文件大小验证（10MB限制）
  const validateFileSize = (file: File) => {
    return file.size / 1024 / 1024 < 10;
  };

  // 文件上传前验证
  const beforeUpload = (file: File) => {
    if (!validateFileType(file)) {
      ElMessage.error("只能上传 doc/docx/pdf/txt/jpg/png/zip/rar 格式的文件!");
      return false;
    }
    if (!validateFileSize(file)) {
      ElMessage.error("文件大小不能超过 10MB!");
      return false;
    }
    return true;
  };

  // 下载文件
  const downloadFile = async (file: Attachment) => {
    await downloadRequest(file.fileUrl, undefined, file.fileName);
  };

  return {
    formatDate,
    formatFileSize,
    validateFileType,
    validateFileSize,
    beforeUpload,
    downloadFile,
  };
}

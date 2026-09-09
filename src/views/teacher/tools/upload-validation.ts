type ImageFile = Pick<File, "name" | "type" | "size">;
type ImageGroup = { files: ImageFile[]; maxCount: number; label: string };

export const TOOL_IMAGE_ACCEPT = "image/jpeg,image/png,image/webp";
export const TOOL_IMAGE_HINT =
  "支持 JPG、PNG、WebP；每张不超过 15 MB，每次合计不超过 40 MB。";

export function toolUploadError(groups: ImageGroup[]): string {
  let total = 0;
  for (const { files, maxCount, label } of groups) {
    if (files.length > maxCount)
      return `${label}最多选择 ${maxCount} 张，请分两次上传`;
    for (const file of files) {
      if (!TOOL_IMAGE_ACCEPT.split(",").includes(file.type)) {
        return `“${file.name}”不是支持的图片，请选择 JPG、PNG 或 WebP`;
      }
      if (!file.size) return `“${file.name}”是空文件，请重新选择图片`;
      if (file.size > 15 * 1024 * 1024) {
        return `“${file.name}”超过 15 MB，请缩小图片后再上传`;
      }
      total += file.size;
    }
  }
  return total > 40 * 1024 * 1024
    ? "这次图片总大小超过 40 MB，请减少几张后分两次上传"
    : "";
}

import { onBeforeUnmount, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  getToolTask,
  getToolTasks,
  type ToolTask,
  type ToolTaskType,
} from "@/api/teacher-tools";
import { createTaskPoller } from "./task-poller";

export function useToolTaskProgress(type: ToolTaskType) {
  const currentTask = ref<ToolTask | null>(null);
  const progressError = ref("");
  const route = useRoute();
  const router = useRouter();
  let selection = 0;
  const poller = createTaskPoller<ToolTask>({
    fetchTask: getToolTask,
    onUpdate(task) {
      currentTask.value = task;
      progressError.value = "";
    },
    onError(fatal) {
      progressError.value = fatal
        ? "无法读取任务，请重新登录或检查任务访问权限。"
        : "进度更新暂时中断，正在自动重连；后台任务会继续执行。";
    },
  });
  function trackTask(task: ToolTask) {
    selection++;
    currentTask.value = task;
    progressError.value = "";
    poller.stop();
    if (["queued", "processing"].includes(task.status)) poller.start(task.id);
    void router.replace({ query: { ...route.query, task: task.id } });
  }
  async function restoreTask() {
    const ownSelection = selection;
    try {
      const id = typeof route.query.task === "string" ? route.query.task : "";
      const task = id
        ? await getToolTask(id)
        : (await getToolTasks({ type, page: 1, limit: 1 })).items[0];
      if (ownSelection !== selection || !task || task.type !== type) return;
      trackTask(task);
    } catch {
      if (ownSelection === selection)
        progressError.value = "暂时无法加载上次任务，可到批改记录中查看。";
    }
  }
  onBeforeUnmount(() => {
    selection++;
    poller.stop();
  });
  return { currentTask, progressError, trackTask, restoreTask };
}

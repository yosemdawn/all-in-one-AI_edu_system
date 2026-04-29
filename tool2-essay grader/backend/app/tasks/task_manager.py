import asyncio
import logging
import uuid
from collections import deque
from typing import Coroutine, Deque, Dict, Any

# 配置日志
logging.basicConfig(level="INFO")
logger = logging.getLogger(__name__)

class TaskStatus:
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"

class Task:
    def __init__(self, coro: Coroutine):
        self.task_id: str = str(uuid.uuid4())
        self.coro: Coroutine = coro
        self.status: str = TaskStatus.PENDING
        self.result: Any = None
        self.error: Exception | None = None
        self.progress: int = 0
        self.current_step: str = ""
        self.total_count: int = 0
        self.completed_count: int = 0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "task_id": self.task_id,
            "status": self.status,
            "progress": self.progress,
            "current_step": self.current_step,
            "result": self.result if self.status == TaskStatus.COMPLETED else None,
            "error": str(self.error) if self.error else None,
            "total_count": self.total_count,
            "completed_count": self.completed_count,
        }

class TaskManager:
    """
    一个简单的内存任务管理器，用于处理异步后台任务。
    """
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(TaskManager, cls).__new__(cls)
            cls._instance.active_tasks: Dict[str, Task] = {}
            cls._instance.task_queue: Deque[Task] = deque()
            cls._instance.worker_task: asyncio.Task | None = None
        return cls._instance

    async def _worker(self):
        """
        后台工作协程，从队列中取出并执行任务。
        """
        logger.info("任务管理器后台工作进程已启动。")
        while True:
            if self.task_queue:
                task = self.task_queue.popleft()
                task.status = TaskStatus.RUNNING
                task.current_step = "任务开始执行..."
                self.active_tasks[task.task_id] = task
                
                logger.info(f"开始执行任务 {task.task_id}。")
                try:
                    # 在这里，我们假设coro是一个可以更新进度的函数
                    # 但为了简化，我们直接await
                    result = await task.coro
                    task.result = result
                    task.status = TaskStatus.COMPLETED
                    task.progress = 100
                    task.current_step = "任务完成"
                    logger.info(f"任务 {task.task_id} 执行成功。")
                except Exception as e:
                    task.error = e
                    task.status = TaskStatus.FAILED
                    task.current_step = "任务失败"
                    logger.error(f"任务 {task.task_id} 执行失败: {e}", exc_info=True)
            else:
                await asyncio.sleep(1) # 队列为空时，等待1秒

    def start(self):
        """
        启动任务管理器的后台工作进程。
        """
        if self.worker_task is None or self.worker_task.done():
            self.worker_task = asyncio.create_task(self._worker())

    def submit_task(self, coro: Coroutine, total_count: int = 0) -> str:
        """
        提交一个协程任务到队列。

        Args:
            coro (Coroutine): 要执行的协程。
            total_count (int): 任务要处理的总数量。

        Returns:
            str: 分配给该任务的唯一ID。
        """
        task = Task(coro)
        task.total_count = total_count
        self.task_queue.append(task)
        self.active_tasks[task.task_id] = task # 立即加入active_tasks以便查询
        logger.info(f"任务 {task.task_id} 已提交到队列，总数: {total_count}。")
        return task.task_id

    def get_task_status(self, task_id: str) -> Dict[str, Any] | None:
        """
        根据任务ID获取任务的状态和结果。

        Args:
            task_id (str): 任务ID。

        Returns:
            Dict[str, Any] | None: 任务的状态信息字典，如果任务不存在则返回None。
        """
        task = self.active_tasks.get(task_id)
        return task.to_dict() if task else None

# 创建一个全局的任务管理器实例
task_manager = TaskManager()
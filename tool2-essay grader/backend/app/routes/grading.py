import logging
import os
import shutil
from typing import List
from uuid import uuid4

from fastapi import (APIRouter, File, HTTPException, UploadFile, BackgroundTasks)
from fastapi.responses import JSONResponse

from app.services.workflow_engine import WorkflowEngine
from app.tasks.task_manager import task_manager
from app.paths import UPLOADS_DIR

# 配置日志
logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/grading",
    tags=["作文批阅"],
)

# 实例化工作流引擎
workflow = WorkflowEngine()

# 上传目录 - 使用统一路径管理
UPLOAD_DIRECTORY = str(UPLOADS_DIR)

# 用于存储每个会话上传的文件信息
# 注意：这是一个简单的内存存储，在多进程或分布式环境中需要使用Redis等共享存储
session_files = {}


@router.post("/upload-prompt", summary="上传作文要求图片")
async def upload_prompt(file: UploadFile = File(...)):
    """
    上传包含作文要求的单张图片。
    文件将被临时保存，并返回一个文件ID。
    """
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="只支持图片文件")

    session_id = str(uuid4())
    file_id = f"prompt_{uuid4().hex}{os.path.splitext(file.filename)[1]}"
    file_path = os.path.join(UPLOAD_DIRECTORY, file_id)

    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        logger.error(f"保存提示文件失败: {e}")
        raise HTTPException(status_code=500, detail="文件保存失败")

    session_files[session_id] = {"prompt": file_path, "essays": []}

    return {
        "success": True,
        "message": "作文要求上传成功",
        "session_id": session_id,
        "file_id": file_id
    }


@router.post("/upload-essays/{session_id}", summary="批量上传学生作文图片")
async def upload_essays(session_id: str, files: List[UploadFile] = File(...)):
    """
    为一个会话批量上传多张学生作文图片。
    """
    if session_id not in session_files:
        raise HTTPException(status_code=404, detail="会话ID无效或已过期")

    if len(files) > 50: # 限制一次上传数量
        raise HTTPException(status_code=400, detail="一次最多上传50份作文")

    essay_paths = []
    for file in files:
        if not file.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail=f"文件 '{file.filename}' 不是图片")

        file_id = f"essay_{uuid4().hex}{os.path.splitext(file.filename)[1]}"
        file_path = os.path.join(UPLOAD_DIRECTORY, file_id)

        try:
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            essay_paths.append(file_path)
        except Exception as e:
            logger.error(f"保存作文文件失败: {e}")
            raise HTTPException(status_code=500, detail=f"保存文件 '{file.filename}' 失败")

    session_files[session_id]["essays"].extend(essay_paths)

    return {
        "success": True,
        "message": f"成功上传 {len(files)} 份作文",
        "session_id": session_id,
        "uploaded_count": len(session_files[session_id]["essays"])
    }


@router.post("/process-batch/{session_id}", summary="开始批量处理任务")
async def process_batch(session_id: str, background_tasks: BackgroundTasks):
    """
    启动一个后台任务来处理指定会话中的所有作文。
    """
    if session_id not in session_files:
        raise HTTPException(status_code=404, detail="会话ID无效或已过期")

    session_data = session_files[session_id]
    prompt_path = session_data.get("prompt")
    essay_paths = session_data.get("essays")

    if not prompt_path or not essay_paths:
        raise HTTPException(status_code=400, detail="作文要求或学生作文文件缺失")

    # 创建一个可以访问task_id的协程工厂函数
    def create_batch_processing_task(task_id_ref):
        async def batch_processing_task():
            """
            实际执行批处理的协程任务。
            """
            try:
                with open(prompt_path, "rb") as f:
                    prompt_bytes = f.read()

                essay_bytes_list = []
                for path in essay_paths:
                    with open(path, "rb") as f:
                        essay_bytes_list.append(f.read())
                
                # 定义进度回调函数
                def progress_callback(completed_count, current_step):
                    # 更新任务管理器中的进度信息
                    task = task_manager.active_tasks.get(task_id_ref[0])
                    if task:
                        task.completed_count = completed_count
                        task.current_step = current_step
                        task.progress = int((completed_count / len(essay_paths)) * 100)
                        logger.info(f"任务 {task_id_ref[0]} 进度更新: {completed_count}/{len(essay_paths)} - {current_step}")
                
                # 调用工作流引擎并返回结果
                result = await workflow.process_batch(prompt_bytes, essay_bytes_list, progress_callback)
                return result

            finally:
                # 清理临时文件
                try:
                    os.remove(prompt_path)
                    for path in essay_paths:
                        os.remove(path)
                    del session_files[session_id]
                    logger.info(f"会话 {session_id} 的临时文件已清理。")
                except Exception as e:
                    logger.error(f"清理会话 {session_id} 的临时文件失败: {e}")
        
        return batch_processing_task

    # 使用引用传递task_id
    task_id_ref = [None]
    task_coro = create_batch_processing_task(task_id_ref)()
    task_id = task_manager.submit_task(task_coro, total_count=len(essay_paths))
    task_id_ref[0] = task_id  # 设置task_id供回调函数使用

    return JSONResponse(
        status_code=202,
        content={
            "success": True,
            "message": "批处理任务已启动",
            "task_id": task_id,
            "total_essays": len(essay_paths)
        }
    )


@router.get("/status/{task_id}", summary="查询任务状态")
async def get_task_status(task_id: str):
    """
    根据任务ID查询后台任务的处理状态和结果。
    """
    status = task_manager.get_task_status(task_id)
    if status is None:
        raise HTTPException(status_code=404, detail="任务ID不存在")
    
    return status

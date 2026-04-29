"""
学生管理相关的API路由
"""
import logging
from typing import List, Optional
from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import JSONResponse

from app.models.request import StudentCreateRequest
from app.models.response import StudentResponse, APIResponse
from app.services.student_db import StudentDatabase
from app.config import settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/students", tags=["学生管理"])

# 初始化服务
student_db = StudentDatabase()


@router.post("/", response_model=APIResponse)
async def create_student(request: StudentCreateRequest):
    """
    创建学生信息 (简化版)
    """
    try:
        logger.info(f"创建学生: {request.name}")
        
        # 检查学生是否已存在
        existing_email = student_db.get_email_by_name(request.name)
        if existing_email:
            raise HTTPException(status_code=400, detail="学生已存在")
        
        # 创建学生
        student_db.add_student(request.name, request.email)
        
        return APIResponse(
            success=True,
            message="学生创建成功",
            data={"name": request.name, "email": request.email}
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"创建学生失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"创建失败: {str(e)}")


# --- 以下为暂不支持的功能，已注释掉 ---

# @router.get("/", response_model=StudentListResponse)
# async def list_students(...):
#     ...

@router.get("/name/{student_name}", response_model=APIResponse)
async def get_student_by_name(student_name: str):
    """
    根据姓名获取学生邮箱 (简化版)
    """
    try:
        logger.info(f"根据姓名获取学生信息: {student_name}")
        
        email = student_db.get_email_by_name(student_name)
        
        if not email:
            raise HTTPException(status_code=404, detail="学生不存在")
        
        return APIResponse(
            success=True,
            message="获取学生信息成功",
            data={"name": student_name, "email": email}
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"根据姓名获取学生信息失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"获取失败: {str(e)}")


# @router.put("/{student_id}", response_model=StudentResponse)
# async def update_student(...):
#     ...

@router.delete("/{student_name}")
async def delete_student(student_name: str):
    """
    删除学生 (简化版, 按姓名删除)
    """
    try:
        logger.info(f"删除学生: {student_name}")
        
        # 删除学生
        success = student_db.remove_student(student_name)
        
        if not success:
            raise HTTPException(status_code=404, detail="学生不存在，无法删除")
        
        return APIResponse(
            success=True,
            message="学生删除成功",
            data={"student_name": student_name}
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"删除学生失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"删除失败: {str(e)}")


# @router.post("/batch", response_model=APIResponse)
# async def batch_import_students(...):
#     ...

# @router.post("/import/csv")
# async def import_students_from_csv(...):
#     ...

# @router.get("/export/csv")
# async def export_students_to_csv(...):
#     ...

# @router.get("/classes/list")
# async def list_classes(...):
#     ...

# @router.get("/stats/overview")
# async def get_student_stats(...):
#     ...
"""
批阅记录查询相关的API路由
学生查看自己的记录，管理员查看所有记录
"""
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.database import User
from app.services.grading_db import grading_db_service
from app.utils.dependencies import get_current_user, require_admin, require_student

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/records",
    tags=["批阅记录"],
)


# ===== Pydantic模型 =====

class RecordListResponse(BaseModel):
    """批阅记录列表响应"""
    total: int
    records: list


class RecordDetailResponse(BaseModel):
    """批阅记录详情响应"""
    record: dict


# ===== API端点 =====

@router.get("/my", response_model=RecordListResponse, summary="查看我的批阅记录")
async def get_my_records(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_student)
):
    """
    学生查看自己的批阅记录（仅学生）
    
    - **skip**: 跳过记录数（分页）
    - **limit**: 返回记录数（默认100）
    
    返回该学生的所有批阅记录，按时间倒序排列
    """
    try:
        records = grading_db_service.get_student_records(
            student_id=current_user.id,
            skip=skip,
            limit=limit,
            db=db
        )
        
        logger.info(f"学生 {current_user.username} 查询了自己的批阅记录，共 {len(records)} 条")
        
        return RecordListResponse(
            total=len(records),
            records=records
        )
        
    except Exception as e:
        logger.error(f"查询学生批阅记录失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"查询失败: {str(e)}"
        )


@router.get("/all", response_model=RecordListResponse, summary="查看所有批阅记录")
async def get_all_records(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    管理员查看所有批阅记录（仅管理员）
    
    - **skip**: 跳过记录数（分页）
    - **limit**: 返回记录数（默认100）
    
    返回所有学生的批阅记录，按时间倒序排列
    """
    try:
        records = grading_db_service.get_all_records(
            skip=skip,
            limit=limit,
            db=db
        )
        
        logger.info(f"管理员 {current_user.username} 查询了所有批阅记录，共 {len(records)} 条")
        
        return RecordListResponse(
            total=len(records),
            records=records
        )
        
    except Exception as e:
        logger.error(f"查询所有批阅记录失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"查询失败: {str(e)}"
        )


@router.get("/student/{username}", response_model=RecordListResponse, summary="查看指定学生的批阅记录")
async def get_student_records_by_name(
    username: str,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    管理员查看指定学生的批阅记录（仅管理员）
    
    - **username**: 学生用户名
    - **skip**: 跳过记录数（分页）
    - **limit**: 返回记录数（默认100）
    """
    try:
        # 查询学生
        student = db.query(User).filter(
            User.username == username,
            User.role == "student"
        ).first()
        
        if not student:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"学生 '{username}' 不存在"
            )
        
        records = grading_db_service.get_student_records(
            student_id=student.id,
            skip=skip,
            limit=limit,
            db=db
        )
        
        logger.info(f"管理员 {current_user.username} 查询了学生 {username} 的批阅记录，共 {len(records)} 条")
        
        return RecordListResponse(
            total=len(records),
            records=records
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"查询学生批阅记录失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"查询失败: {str(e)}"
        )


@router.get("/{record_id}", response_model=RecordDetailResponse, summary="查看批阅记录详情")
async def get_record_detail(
    record_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    查看批阅记录详情
    
    - 学生只能查看自己的记录详情
    - 管理员可以查看任意记录详情
    """
    try:
        record = grading_db_service.get_record_by_id(
            record_id=record_id,
            db=db
        )
        
        if not record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="批阅记录不存在"
            )
        
        # 权限检查：学生只能查看自己的记录
        if current_user.role == "student" and record["student"]["id"] != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="无权查看其他学生的批阅记录"
            )
        
        logger.info(f"用户 {current_user.username} 查看了批阅记录详情 (ID: {record_id})")
        
        return RecordDetailResponse(
            record=record
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"查询批阅记录详情失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"查询失败: {str(e)}"
        )
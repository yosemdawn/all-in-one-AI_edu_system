"""
响应数据模型
定义API接口的响应数据结构
"""

from pydantic import BaseModel
from typing import List, Optional, Dict, Any, Union
from datetime import datetime


class BaseResponse(BaseModel):
    """基础响应模型"""
    success: bool
    message: str
    timestamp: str = datetime.now().isoformat()


class ErrorResponse(BaseResponse):
    """错误响应模型"""
    error_code: Optional[str] = None
    error_details: Optional[Dict[str, Any]] = None


class DataResponse(BaseResponse):
    """数据响应模型"""
    data: Any


class FileUploadResponse(BaseResponse):
    """文件上传响应"""
    file_id: Optional[str] = None
    filename: Optional[str] = None
    size: Optional[int] = None
    content_type: Optional[str] = None


class TaskResponse(BaseResponse):
    """任务响应"""
    task_id: Optional[str] = None
    status: Optional[str] = None
    progress: Optional[float] = None


class BatchOperationResponse(BaseResponse):
    """批量操作响应"""
    total: int
    success_count: int
    failed_count: int
    errors: List[str] = []


class PaginatedResponse(BaseResponse):
    """分页响应"""
    data: List[Any]
    total: int
    page: int
    page_size: int
    total_pages: int


class HealthCheckResponse(BaseModel):
    """健康检查响应"""
    status: str = "healthy"
    service: str = "essay_grader"
    version: str = "1.0.0"
    timestamp: str = datetime.now().isoformat()
    components: Dict[str, str] = {}


class StudentResponse(BaseModel):
    """学生信息响应"""
    success: bool
    message: str
    data: Optional[Dict[str, Any]] = None
    timestamp: str = datetime.now().isoformat()


class StudentListResponse(BaseModel):
    """学生列表响应"""
    success: bool
    message: str
    data: Optional[List[Dict[str, Any]]] = None
    pagination: Optional[Dict[str, Any]] = None
    timestamp: str = datetime.now().isoformat()


class APIResponse(BaseModel):
    """通用API响应"""
    success: bool
    message: str
    data: Optional[Any] = None
    timestamp: str = datetime.now().isoformat()
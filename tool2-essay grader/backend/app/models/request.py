"""
请求数据模型
定义API接口的请求参数结构
"""

from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any


class UploadResponse(BaseModel):
    """文件上传响应"""
    success: bool
    message: str
    file_id: Optional[str] = None
    file_info: Optional[Dict[str, Any]] = None


class TaskSubmitRequest(BaseModel):
    """任务提交请求"""
    prompt_file_id: str = Field(..., description="作文要求文件ID")
    essay_file_ids: List[str] = Field(..., description="学生作文文件ID列表")


class TaskSubmitResponse(BaseModel):
    """任务提交响应"""
    success: bool
    message: str
    task_id: Optional[str] = None


class TaskStatusResponse(BaseModel):
    """任务状态响应"""
    task_id: str
    status: str
    progress: float
    current_step: str
    total_essays: int
    completed_essays: int
    failed_essays: int
    created_at: str
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    error_message: str = ""
    logs: List[Dict[str, Any]] = []


class TaskReportResponse(BaseModel):
    """任务报告响应"""
    task_id: str
    summary: Dict[str, Any]
    score_statistics: Dict[str, Any]
    email_statistics: Dict[str, Any]
    processing_time: Dict[str, Any]
    detailed_results: List[Dict[str, Any]]


class StudentCreateRequest(BaseModel):
    """创建学生请求"""
    name: str = Field(..., min_length=2, max_length=50, description="学生姓名")
    email: str = Field(..., description="学生邮箱")
    class_name: Optional[str] = Field(None, description="班级名称")
    student_id: Optional[str] = Field(None, description="学号")
    phone: Optional[str] = Field(None, description="联系电话")
    parent_email: Optional[str] = Field(None, description="家长邮箱")
    notes: Optional[str] = Field(None, description="备注")


class StudentUpdateRequest(BaseModel):
    """更新学生信息请求"""
    name: Optional[str] = Field(None, min_length=2, max_length=50, description="学生姓名")
    email: Optional[str] = Field(None, description="学生邮箱")
    class_name: Optional[str] = Field(None, description="班级名称")
    student_id: Optional[str] = Field(None, description="学号")
    phone: Optional[str] = Field(None, description="联系电话")
    parent_email: Optional[str] = Field(None, description="家长邮箱")
    notes: Optional[str] = Field(None, description="备注")


class StudentBatchImportRequest(BaseModel):
    """批量导入学生请求"""
    students: List[Dict[str, Any]] = Field(..., description="学生数据列表")
    skip_duplicates: bool = Field(True, description="跳过重复学生")


class SystemStatusResponse(BaseModel):
    """系统状态响应"""
    is_running: bool
    active_workers: int
    active_tasks: int
    pending_tasks: int
    total_tasks: int
    max_concurrent_tasks: int


class ApiResponse(BaseModel):
    """通用API响应"""
    success: bool
    message: str
    data: Optional[Any] = None
    error: Optional[str] = None
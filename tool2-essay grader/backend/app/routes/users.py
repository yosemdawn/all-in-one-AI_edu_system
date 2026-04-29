"""
用户管理相关的API路由
管理员专用：批量导入学生、密码管理、用户查询
"""
import logging
from typing import Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.database import User
from app.utils.security import get_password_hash
from app.utils.dependencies import require_admin

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/users",
    tags=["用户管理"],
    dependencies=[Depends(require_admin)]  # 所有端点都需要管理员权限
)


# ===== Pydantic模型 =====

class StudentImportItem(BaseModel):
    """批量导入学生的单个条目"""
    username: str
    email: Optional[str] = None
    class_name: Optional[str] = None


class BatchImportRequest(BaseModel):
    """批量导入学生请求"""
    students: List[StudentImportItem]
    default_password: str = "123456"


class BatchImportResponse(BaseModel):
    """批量导入响应"""
    success_count: int
    failed_count: int
    total_count: int
    details: List[dict]


class PasswordResetRequest(BaseModel):
    """密码重置请求"""
    user_ids: Optional[List[int]] = None
    usernames: Optional[List[str]] = None
    new_password: str
    reset_all_students: bool = False


class UserListResponse(BaseModel):
    """用户列表响应"""
    total: int
    users: List[dict]


# ===== API端点 =====

@router.post("/batch-import", response_model=BatchImportResponse, summary="批量导入学生账号")
async def batch_import_students(
    request: BatchImportRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    批量导入学生账号（仅管理员）
    
    - **students**: 学生列表，每个学生包含username（必填）、email、class_name
    - **default_password**: 默认密码（默认：123456）
    
    注意：
    - username作为学生的用户名（通常是学生姓名）
    - 如果username已存在，则跳过该学生
    - 所有学生将使用统一的默认密码
    """
    logger.info(f"管理员 {current_user.username} 开始批量导入 {len(request.students)} 个学生")
    
    success_count = 0
    failed_count = 0
    details = []

    # 先做用户名去重，避免同一批次重复创建
    student_by_username: Dict[str, StudentImportItem] = {}
    duplicated_usernames = set()
    for student in request.students:
        if student.username in student_by_username:
            duplicated_usernames.add(student.username)
            continue
        student_by_username[student.username] = student

    for username in duplicated_usernames:
        details.append({
            "username": username,
            "status": "skipped",
            "reason": "请求中用户名重复"
        })
        failed_count += 1

    unique_usernames = list(student_by_username.keys())
    existing_users = db.query(User.username).filter(User.username.in_(unique_usernames)).all()
    existing_usernames = {username for (username,) in existing_users}

    password_hash = get_password_hash(request.default_password)
    students_to_create = []
    to_create_usernames = []

    for username, student in student_by_username.items():
        if username in existing_usernames:
            details.append({
                "username": username,
                "status": "skipped",
                "reason": "用户名已存在"
            })
            failed_count += 1
            continue

        students_to_create.append(
            User(
                username=student.username,
                password_hash=password_hash,
                role="student",
                email=student.email,
                class_name=student.class_name,
                is_active=True
            )
        )
        to_create_usernames.append(username)

    try:
        if students_to_create:
            # 批量写入，减少每条记录一次 commit 的开销
            db.add_all(students_to_create)
            db.commit()

            # 重新查询获取ID，保证响应数据完整
            created_users = db.query(User).filter(User.username.in_(to_create_usernames)).all()
            created_user_map = {user.username: user.id for user in created_users}

            for username in to_create_usernames:
                details.append({
                    "username": username,
                    "status": "success",
                    "user_id": created_user_map.get(username)
                })
                success_count += 1
                logger.info(f"成功创建学生账号: {username} (ID: {created_user_map.get(username)})")
    except Exception as e:
        db.rollback()
        logger.error(f"批量导入写入失败: {str(e)}")
        for username in to_create_usernames:
            details.append({
                "username": username,
                "status": "failed",
                "reason": f"批量写入失败: {str(e)}"
            })
            failed_count += 1
    
    logger.info(f"批量导入完成: 成功 {success_count}, 失败 {failed_count}")
    
    return BatchImportResponse(
        success_count=success_count,
        failed_count=failed_count,
        total_count=len(request.students),
        details=details
    )


@router.put("/reset-password", summary="重置用户密码")
async def reset_password(
    request: PasswordResetRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    重置用户密码（仅管理员）
    
    三种重置模式：
    1. 按user_ids重置：指定用户ID列表
    2. 按usernames重置：指定用户名列表
    3. 重置所有学生：设置reset_all_students=true
    
    - **new_password**: 新密码
    """
    updated_count = 0
    new_password_hash = get_password_hash(request.new_password)
    
    try:
        if request.reset_all_students:
            # 重置所有学生密码
            result = db.query(User).filter(User.role == "student").update(
                {"password_hash": new_password_hash}
            )
            db.commit()
            updated_count = result
            logger.info(f"管理员 {current_user.username} 重置了所有学生密码，共 {updated_count} 个")
            
        elif request.user_ids:
            # 按ID重置
            result = db.query(User).filter(User.id.in_(request.user_ids)).update(
                {"password_hash": new_password_hash},
                synchronize_session=False
            )
            db.commit()
            updated_count = result
            logger.info(f"管理员 {current_user.username} 重置了 {updated_count} 个用户密码（按ID）")
            
        elif request.usernames:
            # 按用户名重置
            result = db.query(User).filter(User.username.in_(request.usernames)).update(
                {"password_hash": new_password_hash},
                synchronize_session=False
            )
            db.commit()
            updated_count = result
            logger.info(f"管理员 {current_user.username} 重置了 {updated_count} 个用户密码（按用户名）")
            
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="必须指定user_ids、usernames或reset_all_students之一"
            )
        
        return {
            "success": True,
            "message": f"成功重置 {updated_count} 个用户的密码",
            "updated_count": updated_count
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"重置密码失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"重置密码失败: {str(e)}"
        )


@router.get("/list", response_model=UserListResponse, summary="获取用户列表")
async def list_users(
    role: Optional[str] = None,
    class_name: Optional[str] = None,
    is_active: Optional[bool] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    获取用户列表（仅管理员）
    
    - **role**: 按角色筛选（student/admin）
    - **class_name**: 按班级筛选
    - **is_active**: 按激活状态筛选
    - **skip**: 跳过记录数（分页）
    - **limit**: 返回记录数（默认100）
    """
    query = db.query(User)
    
    # 应用筛选条件
    if role:
        query = query.filter(User.role == role)
    if class_name:
        query = query.filter(User.class_name == class_name)
    if is_active is not None:
        query = query.filter(User.is_active == is_active)
    
    # 获取总数
    total = query.count()
    
    # 分页查询
    users = query.offset(skip).limit(limit).all()
    
    # 转换为字典列表
    user_list = [
        {
            "id": user.id,
            "username": user.username,
            "role": user.role,
            "email": user.email,
            "class_name": user.class_name,
            "is_active": user.is_active,
            "created_at": user.created_at.isoformat() if user.created_at else None
        }
        for user in users
    ]
    
    logger.info(f"管理员 {current_user.username} 查询用户列表: 共 {total} 个用户，返回 {len(user_list)} 个")
    
    return UserListResponse(
        total=total,
        users=user_list
    )


@router.get("/{user_id}", summary="获取用户详情")
async def get_user_detail(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    获取指定用户的详细信息（仅管理员）
    """
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )
    
    return {
        "id": user.id,
        "username": user.username,
        "role": user.role,
        "email": user.email,
        "class_name": user.class_name,
        "is_active": user.is_active,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "updated_at": user.updated_at.isoformat() if user.updated_at else None
    }


@router.delete("/{user_id}", summary="删除用户")
async def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    删除指定用户（仅管理员）
    
    注意：不能删除管理员自己
    """
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="不能删除自己的账号"
        )
    
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )
    
    username = user.username
    db.delete(user)
    db.commit()
    
    logger.info(f"管理员 {current_user.username} 删除了用户: {username} (ID: {user_id})")
    
    return {
        "success": True,
        "message": f"成功删除用户: {username}"
    }

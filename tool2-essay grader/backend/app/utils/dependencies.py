"""
依赖注入模块
提供FastAPI路由中使用的依赖函数
"""
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.database import User
from app.utils.security import decode_access_token

# HTTP Bearer Token认证方案
security = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """
    获取当前登录用户
    从JWT token中解析用户信息并验证
    
    Args:
        credentials: HTTP Authorization Bearer Token
        db: 数据库会话
        
    Returns:
        User: 当前登录的用户对象
        
    Raises:
        HTTPException: 如果token无效或用户不存在
    """
    token = credentials.credentials
    
    # 解码token
    payload = decode_access_token(token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="无效的认证凭据",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # 获取用户ID
    user_id: Optional[int] = payload.get("user_id")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="无效的token数据",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # 从数据库查询用户
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户不存在",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # 检查用户是否激活
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="用户已被禁用"
        )
    
    return user


def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    获取当前激活的用户（已经在get_current_user中检查）
    保留此函数以保持API一致性
    """
    return current_user


def require_admin(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    要求当前用户是管理员
    用于需要管理员权限的路由
    
    Args:
        current_user: 当前登录用户
        
    Returns:
        User: 管理员用户对象
        
    Raises:
        HTTPException: 如果用户不是管理员
    """
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="需要管理员权限"
        )
    return current_user


def require_student(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    要求当前用户是学生
    用于学生专用的路由
    
    Args:
        current_user: 当前登录用户
        
    Returns:
        User: 学生用户对象
        
    Raises:
        HTTPException: 如果用户不是学生
    """
    if current_user.role != "student":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="此功能仅限学生使用"
        )
    return current_user
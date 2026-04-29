"""
认证相关的API路由
处理用户登录、登出和用户信息查询
"""
import logging
from datetime import timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.database import User
from app.utils.security import verify_password, create_access_token, ACCESS_TOKEN_EXPIRE_HOURS
from app.utils.dependencies import get_current_user

logger = logging.getLogger(__name__)
security = HTTPBearer()

router = APIRouter(
    prefix="/api/auth",
    tags=["认证"],
)


# ===== Pydantic模型 =====

class LoginRequest(BaseModel):
    """登录请求"""
    username: str
    password: str


class LoginResponse(BaseModel):
    """登录响应"""
    access_token: str
    token_type: str = "bearer"
    user: dict


class UserInfoResponse(BaseModel):
    """用户信息响应"""
    id: int
    username: str
    role: str
    email: Optional[str] = None
    class_name: Optional[str] = None
    is_active: bool


# ===== API端点 =====

@router.post("/login", response_model=LoginResponse, summary="用户登录")
async def login(
    login_data: LoginRequest,
    db: Session = Depends(get_db)
):
    """
    用户登录接口
    
    - **username**: 用户名（学生姓名或admin）
    - **password**: 密码
    
    返回JWT token用于后续请求认证
    """
    try:
        # 查询用户
        user = db.query(User).filter(User.username == login_data.username).first()
        
        if not user:
            logger.warning(f"登录失败：用户不存在 - {login_data.username}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="用户名或密码错误",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # 验证密码
        if not verify_password(login_data.password, user.password_hash):
            logger.warning(f"登录失败：密码错误 - {login_data.username}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="用户名或密码错误",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # 检查用户是否激活
        if not user.is_active:
            logger.warning(f"登录失败：用户已禁用 - {login_data.username}")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="用户已被禁用"
            )
        
        # 创建access token
        token_data = {
            "user_id": user.id,
            "username": user.username,
            "role": user.role
        }
        access_token = create_access_token(
            data=token_data,
            expires_delta=timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
        )
        
        logger.info(f"用户登录成功: {user.username} (ID: {user.id}, 角色: {user.role})")
        
        return LoginResponse(
            access_token=access_token,
            token_type="bearer",
            user={
                "id": user.id,
                "username": user.username,
                "role": user.role,
                "email": user.email,
                "class_name": user.class_name
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"登录过程发生错误: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="登录失败，请稍后重试"
        )


@router.post("/logout", summary="用户登出")
async def logout(current_user: User = Depends(get_current_user)):
    """
    用户登出接口
    
    注意：JWT是无状态的，实际上客户端只需删除本地存储的token即可
    此接口主要用于记录登出日志
    """
    logger.info(f"用户登出: {current_user.username} (ID: {current_user.id})")
    
    return {
        "success": True,
        "message": "登出成功"
    }


@router.get("/me", response_model=UserInfoResponse, summary="获取当前用户信息")
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """
    获取当前登录用户的详细信息
    
    需要在请求头中包含有效的JWT token：
    ```
    Authorization: Bearer <your_token>
    ```
    """
    return UserInfoResponse(
        id=current_user.id,
        username=current_user.username,
        role=current_user.role,
        email=current_user.email,
        class_name=current_user.class_name,
        is_active=current_user.is_active
    )


@router.get("/verify", summary="验证Token是否有效")
async def verify_token(current_user: User = Depends(get_current_user)):
    """
    验证当前token是否有效
    
    如果token有效，返回用户基本信息
    """
    return {
        "success": True,
        "message": "Token有效",
        "user": {
            "id": current_user.id,
            "username": current_user.username,
            "role": current_user.role
        }
    }
"""
安全工具模块
提供密码加密和JWT token相关功能
"""
from datetime import datetime, timedelta
from typing import Optional
from passlib.context import CryptContext
from jose import JWTError, jwt

# 密码加密上下文
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT配置
SECRET_KEY = "your-secret-key-change-in-production-2024"  # 生产环境应使用环境变量
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 2


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    验证密码是否匹配
    
    Args:
        plain_password: 明文密码
        hashed_password: 哈希后的密码
        
    Returns:
        bool: 密码是否匹配
    """
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """
    对密码进行哈希加密
    
    Args:
        password: 明文密码
        
    Returns:
        str: 哈希后的密码
    """
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    创建JWT access token
    
    Args:
        data: 要编码到token中的数据（通常包含用户ID和用户名）
        expires_delta: token过期时间，默认为2小时
        
    Returns:
        str: JWT token字符串
    """
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> Optional[dict]:
    """
    解码JWT token
    
    Args:
        token: JWT token字符串
        
    Returns:
        dict: 解码后的数据，如果token无效则返回None
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None


if __name__ == "__main__":
    # 测试密码加密
    print("=" * 50)
    print("密码加密工具测试")
    print("=" * 50)
    
    # 测试密码加密
    password = "123456"
    hashed = get_password_hash(password)
    print(f"原始密码: {password}")
    print(f"哈希密码: {hashed}")
    print(f"验证结果: {verify_password(password, hashed)}")
    print(f"错误密码验证: {verify_password('wrong', hashed)}")
    
    # 测试JWT token
    print("\n" + "=" * 50)
    print("JWT Token测试")
    print("=" * 50)
    
    token_data = {"user_id": 1, "username": "张三", "role": "student"}
    token = create_access_token(token_data)
    print(f"生成的Token: {token[:50]}...")
    
    decoded = decode_access_token(token)
    print(f"解码的数据: {decoded}")
    
    print("=" * 50)
    print("[OK] 安全工具测试完成")
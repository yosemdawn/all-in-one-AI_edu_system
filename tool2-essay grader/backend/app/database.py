"""
数据库连接和会话管理
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from contextlib import contextmanager
from typing import Generator

from app.paths import DATABASE_PATH_STR
from app.models.database import Base

# 数据库URL
DATABASE_URL = f"sqlite:///{DATABASE_PATH_STR}"

# 创建数据库引擎
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},  # SQLite特定配置
    echo=False,  # 设置为True可以看到SQL语句
    pool_pre_ping=True,  # 连接池预检查
)

# 创建会话工厂
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db():
    """
    初始化数据库，创建所有表
    """
    Base.metadata.create_all(bind=engine)
    print(f"[OK] 数据库初始化完成: {DATABASE_PATH_STR}")


def get_db() -> Generator[Session, None, None]:
    """
    获取数据库会话的依赖注入函数
    用于FastAPI路由中
    
    Usage:
        @app.get("/items/")
        def read_items(db: Session = Depends(get_db)):
            ...
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@contextmanager
def get_db_session() -> Generator[Session, None, None]:
    """
    获取数据库会话的上下文管理器
    用于非FastAPI场景
    
    Usage:
        with get_db_session() as db:
            user = db.query(User).first()
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


if __name__ == "__main__":
    # 测试数据库连接
    print("=" * 50)
    print("数据库连接测试")
    print("=" * 50)
    print(f"数据库路径: {DATABASE_PATH_STR}")
    print(f"数据库URL: {DATABASE_URL}")
    
    # 初始化数据库
    init_db()
    
    # 测试会话
    with get_db_session() as db:
        print("[OK] 数据库会话创建成功")
    
    print("=" * 50)
    print("[OK] 数据库连接测试完成")
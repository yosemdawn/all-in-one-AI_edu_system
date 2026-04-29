"""
数据库初始化脚本
创建数据库表并初始化默认管理员账号
"""
import sys
from pathlib import Path

# 添加项目根目录到Python路径
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from app.database import init_db, get_db_session
from app.models.database import User
from app.utils.security import get_password_hash


def create_default_admin():
    """
    创建默认管理员账号
    用户名: admin
    密码: admin123
    """
    with get_db_session() as db:
        # 检查是否已存在管理员
        existing_admin = db.query(User).filter(User.username == "admin").first()
        
        if existing_admin:
            print("[INFO] 管理员账号已存在，跳过创建")
            return
        
        # 创建管理员账号
        admin = User(
            username="admin",
            password_hash=get_password_hash("admin123"),
            role="admin",
            email="admin@example.com",
            is_active=True
        )
        
        db.add(admin)
        db.commit()
        print("[OK] 默认管理员账号创建成功")
        print("   用户名: admin")
        print("   密码: admin123")
        print("   ⚠️  请在生产环境中立即修改默认密码！")


def main():
    """主函数"""
    print("=" * 60)
    print("数据库初始化")
    print("=" * 60)
    
    try:
        # 1. 创建数据库表
        print("\n[1/2] 创建数据库表...")
        init_db()
        
        # 2. 创建默认管理员
        print("\n[2/2] 创建默认管理员账号...")
        create_default_admin()
        
        print("\n" + "=" * 60)
        print("[OK] 数据库初始化完成！")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n[ERROR] 数据库初始化失败: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
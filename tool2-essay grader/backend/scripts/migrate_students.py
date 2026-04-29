"""
数据迁移脚本
将students.json中的学生数据迁移到SQLite数据库
"""
import sys
import json
from pathlib import Path

# 添加项目根目录到Python路径
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from app.database import get_db_session
from app.models.database import User
from app.utils.security import get_password_hash
from app.paths import STUDENTS_JSON


def migrate_students(default_password: str = "123456"):
    """
    将students.json中的学生迁移到数据库
    
    Args:
        default_password: 所有学生的默认密码
    """
    print("=" * 60)
    print("学生数据迁移")
    print("=" * 60)
    
    # 检查students.json是否存在
    if not STUDENTS_JSON.exists():
        print(f"[ERROR] 学生数据文件不存在: {STUDENTS_JSON}")
        return
    
    # 读取students.json
    try:
        with open(STUDENTS_JSON, 'r', encoding='utf-8') as f:
            students_data = json.load(f)
        print(f"[OK] 成功加载 {len(students_data)} 条学生数据")
    except Exception as e:
        print(f"[ERROR] 读取学生数据失败: {e}")
        return
    
    # 准备密码哈希
    password_hash = get_password_hash(default_password)
    
    # 迁移数据
    with get_db_session() as db:
        success_count = 0
        skip_count = 0
        failed_count = 0
        
        for username, email in students_data.items():
            try:
                # 检查用户是否已存在
                existing_user = db.query(User).filter(User.username == username).first()
                if existing_user:
                    print(f"[SKIP] 用户已存在: {username}")
                    skip_count += 1
                    continue
                
                # 创建新学生
                new_student = User(
                    username=username,
                    password_hash=password_hash,
                    role="student",
                    email=email if email else None,
                    is_active=True
                )
                
                db.add(new_student)
                db.commit()
                
                print(f"[OK] 迁移成功: {username} - {email}")
                success_count += 1
                
            except Exception as e:
                db.rollback()
                print(f"[ERROR] 迁移失败: {username} - {str(e)}")
                failed_count += 1
        
        print("\n" + "=" * 60)
        print("迁移统计")
        print("=" * 60)
        print(f"总计: {len(students_data)} 条")
        print(f"成功: {success_count} 条")
        print(f"跳过: {skip_count} 条（已存在）")
        print(f"失败: {failed_count} 条")
        print("=" * 60)
        
        if success_count > 0:
            print(f"\n✅ 成功迁移 {success_count} 个学生账号")
            print(f"   默认密码: {default_password}")
            print(f"   ⚠️  请提醒学生修改初始密码！")


def main():
    """主函数"""
    import argparse
    
    parser = argparse.ArgumentParser(description="迁移学生数据到SQLite数据库")
    parser.add_argument(
        "--password",
        type=str,
        default="123456",
        help="学生默认密码（默认：123456）"
    )
    
    args = parser.parse_args()
    
    try:
        migrate_students(default_password=args.password)
    except Exception as e:
        print(f"\n[ERROR] 迁移过程发生错误: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
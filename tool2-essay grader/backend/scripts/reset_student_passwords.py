"""
重置所有学生密码为统一密码
"""
import sys
from pathlib import Path

# 添加项目根目录到Python路径
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from app.database import get_db_session
from app.models.database import User
from app.utils.security import get_password_hash


def reset_all_student_passwords(new_password: str = "123456"):
    """
    重置所有学生密码
    
    Args:
        new_password: 新密码（默认：123456）
    """
    print("=" * 60)
    print("重置学生密码")
    print("=" * 60)
    
    password_hash = get_password_hash(new_password)
    
    with get_db_session() as db:
        # 查询所有学生
        students = db.query(User).filter(User.role == "student").all()
        
        if not students:
            print("[INFO] 没有找到学生账号")
            return
        
        print(f"[INFO] 找到 {len(students)} 个学生账号")
        print(f"[INFO] 新密码: {new_password}")
        print()
        
        success_count = 0
        failed_count = 0
        
        for student in students:
            try:
                student.password_hash = password_hash
                db.commit()
                print(f"[OK] {student.username} - 密码已重置")
                success_count += 1
            except Exception as e:
                db.rollback()
                print(f"[ERROR] {student.username} - 重置失败: {str(e)}")
                failed_count += 1
        
        print()
        print("=" * 60)
        print("重置统计")
        print("=" * 60)
        print(f"总计: {len(students)} 个学生")
        print(f"成功: {success_count} 个")
        print(f"失败: {failed_count} 个")
        print("=" * 60)
        
        if success_count > 0:
            print(f"\n✅ 成功重置 {success_count} 个学生密码")
            print(f"   新密码: {new_password}")
            print(f"   ⚠️  请提醒学生修改初始密码！")


def main():
    """主函数"""
    import argparse
    
    parser = argparse.ArgumentParser(description="重置所有学生密码")
    parser.add_argument(
        "--password",
        type=str,
        default="123456",
        help="新密码（默认：123456）"
    )
    
    args = parser.parse_args()
    
    try:
        reset_all_student_passwords(new_password=args.password)
    except Exception as e:
        print(f"\n[ERROR] 重置过程发生错误: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()


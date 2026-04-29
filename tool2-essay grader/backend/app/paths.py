"""
统一路径管理模块
所有文件路径都在这里定义，方便维护和修改
"""
from pathlib import Path
import os

# 获取项目根目录（backend的上一级目录）
PROJECT_ROOT = Path(__file__).parent.parent.parent

# 数据目录
DATA_DIR = PROJECT_ROOT / "data"
STUDENTS_JSON = DATA_DIR / "students.json"
DATABASE_PATH = DATA_DIR / "database.db"

# 上传目录
UPLOADS_DIR = DATA_DIR / "uploads"
PROMPTS_DIR = UPLOADS_DIR / "prompts"
ESSAYS_DIR = UPLOADS_DIR / "essays"

# 日志目录
LOGS_DIR = PROJECT_ROOT / "logs"
APP_LOG = LOGS_DIR / "app.log"

# 备份目录
BACKUP_DIR = DATA_DIR / "backup"

# 静态文件和模板（在backend目录内）
BACKEND_DIR = PROJECT_ROOT / "backend"
STATIC_DIR = BACKEND_DIR / "static"
TEMPLATES_DIR = BACKEND_DIR / "templates"


def ensure_directories():
    """
    确保所有必要的目录存在
    在应用启动时调用
    """
    directories = [
        DATA_DIR,
        UPLOADS_DIR,
        PROMPTS_DIR,
        ESSAYS_DIR,
        LOGS_DIR,
        BACKUP_DIR,
    ]
    
    for directory in directories:
        directory.mkdir(parents=True, exist_ok=True)
    
    print("[OK] 目录结构检查完成")
    print(f"   数据目录: {DATA_DIR}")
    print(f"   上传目录: {UPLOADS_DIR}")
    print(f"   日志目录: {LOGS_DIR}")


def get_relative_path(path: Path) -> str:
    """
    将Path对象转换为字符串路径
    用于兼容旧代码
    """
    return str(path)


# 导出常用路径的字符串版本（兼容性）
DATA_DIR_STR = str(DATA_DIR)
UPLOADS_DIR_STR = str(UPLOADS_DIR)
LOGS_DIR_STR = str(LOGS_DIR)
STUDENTS_JSON_STR = str(STUDENTS_JSON)
DATABASE_PATH_STR = str(DATABASE_PATH)


if __name__ == "__main__":
    # 测试路径配置
    print("=" * 50)
    print("路径配置测试")
    print("=" * 50)
    print(f"项目根目录: {PROJECT_ROOT}")
    print(f"数据目录: {DATA_DIR}")
    print(f"上传目录: {UPLOADS_DIR}")
    print(f"日志目录: {LOGS_DIR}")
    print(f"学生数据: {STUDENTS_JSON}")
    print(f"数据库: {DATABASE_PATH}")
    print("=" * 50)
    
    # 确保目录存在
    ensure_directories()
    
    # 检查关键文件是否存在
    if STUDENTS_JSON.exists():
        print(f"[OK] 学生数据文件存在: {STUDENTS_JSON}")
    else:
        print(f"[WARN] 学生数据文件不存在: {STUDENTS_JSON}")
    
    print("=" * 50)
    print("[OK] 路径配置测试完成")
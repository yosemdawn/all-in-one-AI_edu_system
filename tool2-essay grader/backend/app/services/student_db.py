import json
import logging
from pathlib import Path
from typing import Dict, Optional

from app.config import settings

# 配置日志
logging.basicConfig(level=settings.log_level)
logger = logging.getLogger(__name__)


class StudentDatabase:
    """
    管理学生姓名与邮箱映射的数据库服务。
    数据存储在JSON文件中。
    """

    def __init__(self, db_path: str = settings.student_db_path):
        """
        初始化学生数据库服务。

        Args:
            db_path (str): 学生数据库JSON文件的路径。
        """
        self.db_path = Path(db_path)
        self.students: Dict[str, str] = {}
        self._load_database()

    def _load_database(self):
        """
        从JSON文件加载学生数据到内存。
        如果文件不存在，则创建一个空数据库。
        """
        try:
            if self.db_path.exists():
                with open(self.db_path, 'r', encoding='utf-8') as f:
                    self.students = json.load(f)
                logger.info(f"成功从 {self.db_path} 加载了 {len(self.students)} 条学生数据。")
            else:
                logger.warning(f"数据库文件 {self.db_path} 不存在，将创建一个新的空数据库。")
                self.db_path.parent.mkdir(parents=True, exist_ok=True)
                self._save_database()
        except (json.JSONDecodeError, IOError) as e:
            logger.error(f"加载学生数据库失败: {e}，将使用一个空数据库。")
            self.students = {}

    def _save_database(self):
        """
        将内存中的学生数据保存到JSON文件。
        """
        try:
            with open(self.db_path, 'w', encoding='utf-8') as f:
                json.dump(self.students, f, ensure_ascii=False, indent=2)
            logger.info(f"学生数据已成功保存到 {self.db_path}。")
        except IOError as e:
            logger.error(f"保存学生数据库失败: {e}")

    def get_email_by_name(self, name: str) -> Optional[str]:
        """
        根据学生姓名查询邮箱。

        Args:
            name (str): 学生姓名（会自动去除首尾空格）。

        Returns:
            Optional[str]: 如果找到则返回邮箱地址，否则返回None。
        """
        cleaned_name = name.strip()
        email = self.students.get(cleaned_name)
        if email:
            logger.info(f"为学生 '{cleaned_name}' 找到了邮箱: {email}")
        else:
            logger.warning(f"未能为学生 '{cleaned_name}' 找到对应的邮箱。")
        return email

    def add_student(self, name: str, email: str):
        """
        添加或更新一个学生的信息。

        Args:
            name (str): 学生姓名。
            email (str): 学生邮箱。
        """
        cleaned_name = name.strip()
        if not cleaned_name:
            logger.error("尝试添加一个空名字的学生。")
            return
            
        self.students[cleaned_name] = email
        self._save_database()
        logger.info(f"已添加/更新学生 '{cleaned_name}' 的邮箱为 {email}。")

    def remove_student(self, name: str) -> bool:
        """
        根据姓名删除一个学生的信息。

        Args:
            name (str): 学生姓名。

        Returns:
            bool: 如果成功删除则返回True，如果学生不存在则返回False。
        """
        cleaned_name = name.strip()
        if cleaned_name in self.students:
            del self.students[cleaned_name]
            self._save_database()
            logger.info(f"已成功删除学生 '{cleaned_name}'。")
            return True
        else:
            logger.warning(f"尝试删除一个不存在的学生 '{cleaned_name}'。")
            return False

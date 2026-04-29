"""
应用配置管理
"""

from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path

# 导入路径配置
from app.paths import (
    DATA_DIR_STR,
    UPLOADS_DIR_STR,
    LOGS_DIR_STR,
    STUDENTS_JSON_STR,
    STATIC_DIR,
    TEMPLATES_DIR
)


class Settings(BaseSettings):
    """应用配置类"""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"  # 忽略额外字段，避免.env中多余配置导致错误
    )

    # 应用基础配置
    app_name: str = "AI作文批阅系统"
    secret_key: str = "default-secret-key-change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440
    database_url: str = "sqlite:///./essay_grader.db"

    # 百度OCR API配置
    baidu_ocr_api_key: str = "VhjUcmJEFH0mfpYlYZTlvV66"
    baidu_ocr_secret_key: str = "U0eCELq0Dd6wytDarQ3W0F4bdEl7VsYl"

    # 豆包LLM API配置
    doubao_api_key: str = "41ffcba1-f089-46a9-bb10-819c3f61c811"
    doubao_model_id: str = "doubao-seed-1-6-251015"

    # 邮件配置
    smtp_host: str = "smtp.qq.com"
    smtp_port: int = 465
    smtp_username: str = "876331904@qq.com"
    smtp_password: str = "kkkbyzcomakmbebf"

    # 文件上传限制
    max_file_size: int = 10 * 1024 * 1024  # 10MB
    max_upload_size: int = 10 * 1024 * 1024  # 别名，兼容.env配置
    allowed_extensions: str = "jpg,jpeg,png,bmp"
    max_files_per_batch: int = 50

    # CORS配置
    cors_origins: str = '["*"]'

    # 应用配置
    log_level: str = "INFO"
    log_file: str = "logs/app.log"
    log_max_bytes: int = 10485760
    log_backup_count: int = 5
    debug: bool = False
    host: str = "0.0.0.0"
    port: int = 8000
    allowed_origins: List[str] = ["*"]

    # 目录配置 - 使用统一路径管理
    upload_dir: str = UPLOADS_DIR_STR
    data_dir: str = DATA_DIR_STR
    logs_dir: str = LOGS_DIR_STR
    static_dir: str = str(STATIC_DIR)
    templates_dir: str = str(TEMPLATES_DIR)
    student_db_path: str = STUDENTS_JSON_STR


# 全局配置实例
settings = Settings()
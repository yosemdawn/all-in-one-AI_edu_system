"""
SQLAlchemy数据库模型
定义用户、作文和批阅记录的数据库表结构
"""
from datetime import datetime
from typing import Optional
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, Float
from sqlalchemy.orm import declarative_base, relationship
from sqlalchemy.sql import func

Base = declarative_base()


class User(Base):
    """用户表 - 存储学生和管理员信息"""
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    username = Column(String(50), unique=True, nullable=False, index=True, comment="用户名（学生姓名）")
    password_hash = Column(String(255), nullable=False, comment="bcrypt加密后的密码")
    role = Column(String(20), nullable=False, default="student", comment="角色：student/admin")
    email = Column(String(100), nullable=True, comment="邮箱")
    class_name = Column(String(50), nullable=True, comment="班级")
    is_active = Column(Boolean, default=True, nullable=False, comment="是否激活")
    created_at = Column(DateTime, server_default=func.now(), nullable=False, comment="创建时间")
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False, comment="更新时间")
    
    # 关系
    essays = relationship("Essay", back_populates="student", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<User(id={self.id}, username='{self.username}', role='{self.role}')>"


class Essay(Base):
    """作文表 - 存储学生提交的作文"""
    __tablename__ = "essays"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    student_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True, comment="学生ID")
    image_path = Column(String(255), nullable=True, comment="作文图片路径")
    essay_text = Column(Text, nullable=True, comment="OCR识别的作文全文")
    requirements = Column(Text, nullable=True, comment="作文要求")
    created_at = Column(DateTime, server_default=func.now(), nullable=False, comment="提交时间")
    
    # 关系
    student = relationship("User", back_populates="essays")
    grading_record = relationship("GradingRecord", back_populates="essay", uselist=False, cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Essay(id={self.id}, student_id={self.student_id}, created_at='{self.created_at}')>"


class GradingRecord(Base):
    """批阅记录表 - 存储作文的批阅结果"""
    __tablename__ = "grading_records"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    essay_id = Column(Integer, ForeignKey("essays.id", ondelete="CASCADE"), nullable=False, unique=True, index=True, comment="作文ID")
    score = Column(Float, nullable=True, comment="分数")
    advantages = Column(Text, nullable=True, comment="优点")
    disadvantages = Column(Text, nullable=True, comment="缺点")
    suggestions = Column(Text, nullable=True, comment="改进建议")
    graded_by = Column(String(20), default="AI", nullable=False, comment="批阅方式：AI/manual")
    graded_at = Column(DateTime, server_default=func.now(), nullable=False, comment="批阅时间")
    raw_result = Column(Text, nullable=True, comment="完整的JSON批阅结果")
    
    # 关系
    essay = relationship("Essay", back_populates="grading_record")
    
    def __repr__(self):
        return f"<GradingRecord(id={self.id}, essay_id={self.essay_id}, score={self.score})>"
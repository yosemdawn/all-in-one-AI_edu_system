"""
批阅记录数据库服务
处理作文和批阅记录的数据库操作
"""
import json
import logging
from typing import Optional, Dict, List
from sqlalchemy.orm import Session

from app.models.database import User, Essay, GradingRecord
from app.database import get_db_session

logger = logging.getLogger(__name__)


class GradingDatabaseService:
    """批阅记录数据库服务"""
    
    def save_grading_result(
        self,
        student_name: str,
        essay_text: str,
        requirements: str,
        grading_result: Dict,
        image_path: Optional[str] = None,
        db: Optional[Session] = None
    ) -> Dict:
        """
        保存作文和批阅结果到数据库
        
        Args:
            student_name: 学生姓名
            essay_text: OCR识别的作文全文
            requirements: 作文要求
            grading_result: LLM批阅结果字典
            image_path: 作文图片路径（可选）
            db: 数据库会话（可选，如果不提供则创建新会话）
            
        Returns:
            Dict: 包含保存结果的字典
        """
        def _save(session: Session):
            try:
                # 1. 查找学生
                student = session.query(User).filter(
                    User.username == student_name,
                    User.role == "student"
                ).first()
                
                if not student:
                    logger.error(f"学生不存在: {student_name}")
                    return {
                        "success": False,
                        "error": f"学生 '{student_name}' 不存在于数据库中"
                    }
                
                # 2. 创建作文记录
                essay = Essay(
                    student_id=student.id,
                    image_path=image_path,
                    essay_text=essay_text,
                    requirements=requirements
                )
                session.add(essay)
                session.flush()  # 获取essay.id
                
                # 3. 创建批阅记录
                # 将 list/dict 类型的字段转换为 JSON 字符串
                advantages = grading_result.get("advantages")
                if isinstance(advantages, (list, dict)):
                    advantages = json.dumps(advantages, ensure_ascii=False)

                disadvantages = grading_result.get("disadvantages")
                if isinstance(disadvantages, (list, dict)):
                    disadvantages = json.dumps(disadvantages, ensure_ascii=False)

                suggestions = grading_result.get("suggestions")
                if isinstance(suggestions, (list, dict)):
                    suggestions = json.dumps(suggestions, ensure_ascii=False)

                grading_record = GradingRecord(
                    essay_id=essay.id,
                    score=grading_result.get("score"),
                    advantages=advantages,
                    disadvantages=disadvantages,
                    suggestions=suggestions,
                    graded_by="AI",
                    raw_result=json.dumps(grading_result, ensure_ascii=False)
                )
                session.add(grading_record)
                
                # 4. 提交事务
                session.commit()
                
                logger.info(
                    f"成功保存批阅记录: 学生={student_name}, "
                    f"Essay ID={essay.id}, Record ID={grading_record.id}"
                )
                
                return {
                    "success": True,
                    "student_id": student.id,
                    "essay_id": essay.id,
                    "grading_record_id": grading_record.id,
                    "score": grading_result.get("score")
                }
                
            except Exception as e:
                session.rollback()
                logger.error(f"保存批阅结果失败: {e}", exc_info=True)
                return {
                    "success": False,
                    "error": str(e)
                }
        
        # 如果提供了db session则直接使用，否则创建新的
        if db:
            return _save(db)
        else:
            with get_db_session() as session:
                return _save(session)
    
    def get_student_records(
        self,
        student_id: int,
        skip: int = 0,
        limit: int = 100,
        db: Optional[Session] = None
    ) -> List[Dict]:
        """
        获取指定学生的所有批阅记录
        
        Args:
            student_id: 学生ID
            skip: 跳过记录数
            limit: 返回记录数
            db: 数据库会话
            
        Returns:
            List[Dict]: 批阅记录列表
        """
        def _query(session: Session):
            records = session.query(GradingRecord).join(
                Essay
            ).filter(
                Essay.student_id == student_id
            ).order_by(
                GradingRecord.graded_at.desc()
            ).offset(skip).limit(limit).all()
            
            result = []
            for record in records:
                essay = record.essay
                student = essay.student
                result.append({
                    "id": record.id,
                    "essay_id": essay.id,
                    "student_name": student.username,
                    "score": record.score,
                    "advantages": record.advantages,
                    "disadvantages": record.disadvantages,
                    "suggestions": record.suggestions,
                    "graded_by": record.graded_by,
                    "graded_at": record.graded_at.isoformat() if record.graded_at else None,
                    "essay_text": essay.essay_text,
                    "requirements": essay.requirements,
                    "submitted_at": essay.created_at.isoformat() if essay.created_at else None
                })
            
            return result
        
        if db:
            return _query(db)
        else:
            with get_db_session() as session:
                return _query(session)
    
    def get_all_records(
        self,
        skip: int = 0,
        limit: int = 100,
        db: Optional[Session] = None
    ) -> List[Dict]:
        """
        获取所有批阅记录（管理员用）
        
        Args:
            skip: 跳过记录数
            limit: 返回记录数
            db: 数据库会话
            
        Returns:
            List[Dict]: 批阅记录列表
        """
        def _query(session: Session):
            records = session.query(GradingRecord).join(
                Essay
            ).join(
                User
            ).order_by(
                GradingRecord.graded_at.desc()
            ).offset(skip).limit(limit).all()
            
            result = []
            for record in records:
                essay = record.essay
                student = essay.student
                result.append({
                    "id": record.id,
                    "essay_id": essay.id,
                    "student_id": student.id,
                    "student_name": student.username,
                    "score": record.score,
                    "advantages": record.advantages,
                    "disadvantages": record.disadvantages,
                    "suggestions": record.suggestions,
                    "graded_by": record.graded_by,
                    "graded_at": record.graded_at.isoformat() if record.graded_at else None,
                    "essay_text": essay.essay_text,
                    "requirements": essay.requirements,
                    "submitted_at": essay.created_at.isoformat() if essay.created_at else None
                })
            
            return result
        
        if db:
            return _query(db)
        else:
            with get_db_session() as session:
                return _query(session)
    
    def get_record_by_id(
        self,
        record_id: int,
        db: Optional[Session] = None
    ) -> Optional[Dict]:
        """
        根据ID获取批阅记录详情
        
        Args:
            record_id: 批阅记录ID
            db: 数据库会话
            
        Returns:
            Dict: 批阅记录详情，如果不存在则返回None
        """
        def _query(session: Session):
            record = session.query(GradingRecord).filter(
                GradingRecord.id == record_id
            ).first()
            
            if not record:
                return None
            
            essay = record.essay
            student = essay.student
            
            return {
                "id": record.id,
                "essay_id": essay.id,
                "student": {
                    "id": student.id,
                    "username": student.username,
                    "email": student.email,
                    "class_name": student.class_name
                },
                "score": record.score,
                "advantages": record.advantages,
                "disadvantages": record.disadvantages,
                "suggestions": record.suggestions,
                "graded_by": record.graded_by,
                "graded_at": record.graded_at.isoformat() if record.graded_at else None,
                "essay_text": essay.essay_text,
                "requirements": essay.requirements,
                "image_path": essay.image_path,
                "submitted_at": essay.created_at.isoformat() if essay.created_at else None,
                "raw_result": record.raw_result
            }
        
        if db:
            return _query(db)
        else:
            with get_db_session() as session:
                return _query(session)


# 创建全局实例
grading_db_service = GradingDatabaseService()
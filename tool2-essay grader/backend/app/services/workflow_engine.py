import asyncio
import logging
from typing import Dict, List, Optional
from sqlalchemy.orm import Session

from .llm_service import LLMService
from .ocr_service import OCRService
from .grading_db import grading_db_service

# 配置日志
logging.basicConfig(level="INFO")
logger = logging.getLogger(__name__)


class WorkflowEngine:
    """
    协调整个批阅流程的工作流引擎。
    """

    def __init__(self, db: Optional[Session] = None):
        """
        初始化工作流引擎，并注入所有需要的服务。
        
        Args:
            db: 数据库会话（可选）
        """
        self.ocr_service = OCRService()
        self.llm_service = LLMService()
        self.grading_db = grading_db_service
        self.db = db

    async def process_single_essay(
        self,
        essay_image_bytes: bytes,
        requirements: str,
        image_path: Optional[str] = None
    ) -> Dict:
        """
        处理单份学生作文的完整流程。

        Args:
            essay_image_bytes (bytes): 单份作文的图片二进制数据。
            requirements (str): 作文要求文本。
            image_path (str): 作文图片路径（可选）

        Returns:
            Dict: 包含处理结果的字典。
        """
        result = {
            "student_name": "未知",
            "student_id": None,
            "grading_result": None,
            "saved_to_db": False,
            "error": None
        }

        try:
            # 1. OCR识别作文全文
            logger.info("步骤 1/4: OCR识别作文全文...")
            essay_text = await self.ocr_service.recognize_text(essay_image_bytes)
            if not essay_text.strip():
                raise ValueError("OCR未能识别出任何文本")

            # 2. LLM提取学生姓名
            logger.info("步骤 2/4: LLM提取学生姓名...")
            student_name = await self.llm_service.extract_student_name(essay_text)
            result["student_name"] = student_name

            # 3. LLM批阅作文
            logger.info(f"步骤 3/4: LLM批阅 '{student_name}' 的作文...")
            grading_result = await self.llm_service.grade_essay(requirements, essay_text)
            result["grading_result"] = grading_result

            # 4. 保存到数据库
            logger.info(f"步骤 4/4: 保存批阅结果到数据库...")
            save_result = self.grading_db.save_grading_result(
                student_name=student_name,
                essay_text=essay_text,
                requirements=requirements,
                grading_result=grading_result,
                image_path=image_path,
                db=self.db
            )
            
            if save_result["success"]:
                result["saved_to_db"] = True
                result["student_id"] = save_result.get("student_id")
                result["essay_id"] = save_result.get("essay_id")
                result["grading_record_id"] = save_result.get("grading_record_id")
                logger.info(f"✅ 批阅结果已保存: {student_name} (Record ID: {save_result.get('grading_record_id')})")
            else:
                result["saved_to_db"] = False
                result["error"] = save_result.get("error")
                logger.error(f"❌ 保存批阅结果失败: {save_result.get('error')}")

        except Exception as e:
            logger.error(f"处理作文时发生错误: {e}", exc_info=True)
            result["error"] = str(e)

        return result

    async def process_batch(
        self,
        prompt_image_bytes: bytes,
        essay_images_bytes: List[bytes],
        progress_callback=None
    ) -> Dict:
        """
        启动批量处理任务。

        Args:
            prompt_image_bytes (bytes): 作文要求的图片二进制数据。
            essay_images_bytes (List[bytes]): 学生作文图片二进制数据的列表。
            progress_callback (callable): 进度回调函数。

        Returns:
            Dict: 包含所有作文处理结果的最终报告。
        """
        total_count = len(essay_images_bytes)
        logger.info(f"开始批量处理任务，共 {total_count} 份作文。")

        # 阶段一：处理题目要求
        logger.info("处理阶段一：识别作文要求...")
        if progress_callback:
            progress_callback(0, "识别作文要求...")
        
        try:
            requirements = await self.ocr_service.recognize_text(prompt_image_bytes)
            if not requirements.strip():
                raise ValueError("OCR未能识别出任何作文要求")
        except Exception as e:
            logger.error(f"识别作文要求失败: {e}")
            return {"error": f"无法处理作文要求图片: {e}", "results": []}

        # 阶段二：逐个处理作文以支持进度更新
        logger.info("处理阶段二：开始处理所有作文...")
        results = []
        completed_count = 0
        
        for i, essay_bytes in enumerate(essay_images_bytes):
            logger.info(f"处理第 {i+1}/{total_count} 份作文...")
            if progress_callback:
                progress_callback(completed_count, f"处理第 {i+1}/{total_count} 份作文...")
            
            try:
                result = await self.process_single_essay(essay_bytes, requirements)
                results.append(result)
                completed_count += 1
                
                if progress_callback:
                    progress_callback(completed_count, f"已完成 {completed_count}/{total_count} 份作文")
                    
            except Exception as e:
                logger.error(f"处理第 {i+1} 份作文失败: {e}")
                results.append({
                    "student_name": "未知",
                    "student_email": None,
                    "grading_result": None,
                    "email_sent": False,
                    "error": str(e)
                })

        # 阶段三：生成报告
        logger.info("处理阶段三：生成最终报告...")
        if progress_callback:
            progress_callback(completed_count, "生成最终报告...")
            
        final_report = self.generate_final_report(results)
        
        logger.info("批量处理任务完成。")
        return final_report

    def generate_final_report(self, results: List[Dict]) -> Dict:
        """
        根据所有单份作文的处理结果生成最终报告。

        Args:
            results (List[Dict]): 单份作文处理结果的列表。

        Returns:
            Dict: 最终的统计报告。
        """
        total_essays = len(results)
        successful_grades = sum(1 for r in results if r["grading_result"] and not r["error"])
        failed_grades = total_essays - successful_grades
        saved_to_db = sum(1 for r in results if r.get("saved_to_db", False))

        # 计算平均分
        total_score = 0
        scored_essays = 0
        for r in results:
            if r.get("grading_result") and r["grading_result"].get("score"):
                try:
                    total_score += float(r["grading_result"]["score"])
                    scored_essays += 1
                except (ValueError, TypeError):
                    continue # 忽略无效分数
        
        average_score = round(total_score / scored_essays, 2) if scored_essays > 0 else 0

        report = {
            "summary": {
                "total_essays": total_essays,
                "successful_grades": successful_grades,
                "failed_grades": failed_grades,
                "saved_to_db": saved_to_db,
                "average_score": average_score,
            },
            "details": results
        }
        return report

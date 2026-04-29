import json
import logging
import re
from typing import Dict

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

from app.config import settings

# 配置日志
logging.basicConfig(level=settings.log_level)
logger = logging.getLogger(__name__)

# 提示词模板
GRADING_PROMPT_TEMPLATE = """
作为一名资深的英语老师，请根据以下作文要求，对提供的学生作文进行全面批阅。

**重要说明**: 你的回复必须是纯JSON格式，不要添加任何前言、后语或解释文字。直接以 {{ 开始，以 }} 结束。

**作文要求**:
{essay_requirements}

**学生作文原文**:
{essay_text}

**批阅要求**:
1. **拼写错误检查**: 如果发现字母拼写错误，必须在suggestions数组的第一条中一次性列出所有拼写错误，格式为：
   - original_sentence: "拼写错误汇总"
   - revised_sentence: "列出所有拼写错误的单词及其正确拼写，例如：'recieve → receive, occured → occurred'"
   - reason: "拼写错误会影响作文的专业性和可读性"

2. **语法和句式优化**: 在拼写错误之后（如果有），提供3-8条句式改进建议：
   - 优先修正语法错误
   - 重点关注如何让句式表达更高级、更地道
   - 提供具体的改写示例，展示如何使用更复杂的句式结构
   - 每条建议都要引用原文句子，给出改进后的句子，并解释改进的理由

3. **字数不足指导**: 如果学生作文字数明显不足，在weaknesses中指出，并在suggestions中给出扩展内容的具体建议

**请严格按照以下JSON格式输出**:
{{
  "score": 85,
  "strengths": "对作文的优点进行点评，至少2条，使用简洁有力的语言",
  "weaknesses": "指出作文的主要问题和不足（包括字数不足、结构问题等），至少2条，语气应温和且有建设性",
  "suggestions": [
    {{
      "original_sentence": "拼写错误汇总（如果有拼写错误，这必须是第一条）",
      "revised_sentence": "列出所有拼写错误及其正确拼写",
      "reason": "拼写错误会影响作文的专业性和可读性"
    }},
    {{
      "original_sentence": "引用需要改进的原文句子",
      "revised_sentence": "提供一个更高级的句式改写范例",
      "reason": "详细解释为什么这样改写会更好（如使用了更复杂的从句、更地道的表达等）"
    }},
    {{
      "original_sentence": "引用另一个需要改进的原文句子",
      "revised_sentence": "提供一个更高级的句式改写范例",
      "reason": "详细解释改进的理由"
    }}
  ],
  "summary_comment": "写一段总评，鼓励学生并总结核心提升方向，如果字数不足也要在此提及"
}}

**注意**: suggestions数组应包含3-8条建议（根据作文实际情况调整），如果有拼写错误，拼写错误汇总必须作为第一条。
"""

NAME_EXTRACTION_PROMPT_TEMPLATE = """
任务：从以下文本的开头或结尾部分，精准地提取出学生的姓名。姓名通常在'姓名：'、'班级：'等标签后，或单独成行。只返回姓名，不要任何多余的文字。

文本内容：
---
{essay_text}
"""


class LLMService:
    """
    封装豆包LLM API的作文批阅和姓名提取服务。
    """

    def __init__(self, api_key: str = settings.doubao_api_key, model_id: str = settings.doubao_model_id):
        """
        初始化LLM服务。

        Args:
            api_key (str): 豆包LLM API Key。
            model_id (str): 使用的模型ID。
        """
        self.api_key = api_key
        self.model_id = model_id
        self.api_url = "https://ark.cn-beijing.volces.com/api/v3/chat/completions"
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        # 新模型支持的参数
        self.max_completion_tokens = 65535
        self.reasoning_effort = "medium"

    def _build_grading_prompt(self, requirements: str, essay_text: str) -> str:
        """构建作文批阅的提示词。"""
        return GRADING_PROMPT_TEMPLATE.format(essay_requirements=requirements, essay_text=essay_text)

    def _build_name_extraction_prompt(self, essay_text: str) -> str:
        """构建姓名提取的提示词。"""
        return NAME_EXTRACTION_PROMPT_TEMPLATE.format(essay_text=essay_text)
    
    def _extract_json_from_response(self, response: str) -> str:
        """
        从LLM响应中提取JSON部分。

        Args:
            response (str): LLM的原始响应

        Returns:
            str: 提取出的JSON字符串
        """
        # 方法1: 查找完整的JSON对象
        json_match = re.search(r'\{.*\}', response, re.DOTALL)
        if json_match:
            json_str = json_match.group(0)
        else:
            # 方法2: 查找以 { 开始的行到 } 结束的行
            lines = response.split('\n')
            json_lines = []
            in_json = False
            brace_count = 0

            for line in lines:
                if '{' in line and not in_json:
                    in_json = True
                    brace_count = line.count('{') - line.count('}')
                    json_lines.append(line)
                elif in_json:
                    json_lines.append(line)
                    brace_count += line.count('{') - line.count('}')
                    if brace_count <= 0:
                        break

            if json_lines:
                json_str = '\n'.join(json_lines)
            else:
                # 方法3: 直接返回原响应（可能整个就是JSON）
                json_str = response.strip()

        # 清理尾随逗号（JSON标准不允许）
        # 匹配 },\s*} 或 },\s*] 的模式，去掉多余的逗号
        json_str = re.sub(r',(\s*[}\]])', r'\1', json_str)

        return json_str
    
    def _validate_grading_result(self, result: Dict) -> bool:
        """
        验证批阅结果的格式。
        
        Args:
            result (Dict): 批阅结果字典
            
        Returns:
            bool: 是否通过验证
        """
        required_fields = ['score', 'strengths', 'weaknesses', 'suggestions', 'summary_comment']
        
        for field in required_fields:
            if field not in result:
                logger.error(f"批阅结果缺少必要字段: {field}")
                return False
        
        # 验证score是否为数字
        try:
            score = float(result['score'])
            if not (0 <= score <= 100):
                logger.error(f"分数超出范围: {score}")
                return False
        except (ValueError, TypeError):
            logger.error(f"分数格式错误: {result['score']}")
            return False
        
        # 验证suggestions是否为列表
        if not isinstance(result['suggestions'], list):
            logger.error("suggestions字段必须是列表")
            return False
        
        return True

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=10),
        reraise=True
    )
    async def _call_llm_api(self, prompt: str, system_prompt: str) -> str:
        """
        调用豆包LLM API。

        Args:
            prompt (str): 用户提示词。
            system_prompt (str): 系统提示词。

        Returns:
            str: LLM返回的文本内容。
        """
        payload = {
            "model": self.model_id,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.7,
            "max_completion_tokens": self.max_completion_tokens,
            "reasoning_effort": self.reasoning_effort
        }
        
        logger.info(f"正在调用豆包LLM API，模型: {self.model_id}...")
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(self.api_url, headers=self.headers, json=payload)
            response.raise_for_status()
        
        response_data = response.json()
        content = response_data.get("choices", [{}])[0].get("message", {}).get("content", "")
        
        if not content:
            raise ValueError("LLM API返回内容为空")
            
        logger.info("成功从豆包LLM API获取响应。")
        return content

    async def grade_essay(self, requirements: str, essay_text: str) -> Dict:
        """
        批阅作文。

        Args:
            requirements (str): 作文要求。
            essay_text (str): 作文原文。

        Returns:
            Dict: 结构化的批阅结果。
        """
        system_prompt = "你是一名资深的英语老师，专门负责批阅学生作文。严格按照JSON格式返回结果，不要添加任何额外文字。"
        prompt = self._build_grading_prompt(requirements, essay_text)
        
        response_text = await self._call_llm_api(prompt, system_prompt)
        
        try:
            # 清理响应文本，提取JSON部分
            cleaned_response = self._extract_json_from_response(response_text)
            grading_result = json.loads(cleaned_response)
            
            # 验证必要字段
            if not self._validate_grading_result(grading_result):
                raise ValueError("批阅结果缺少必要字段")
            
            return grading_result
        except json.JSONDecodeError as e:
            logger.error(f"JSON解析错误: {e}")
            logger.error(f"LLM原始响应: {response_text}")
            raise ValueError("LLM返回的批阅结果格式不正确")
        except Exception as e:
            logger.error(f"批阅结果处理错误: {e}")
            logger.error(f"LLM原始响应: {response_text}")
            raise ValueError(f"处理批阅结果时发生错误: {str(e)}")

    async def extract_student_name(self, essay_text: str) -> str:
        """
        从作文文本中提取学生姓名。

        Args:
            essay_text (str): 作文原文。

        Returns:
            str: 提取出的学生姓名。
        """
        system_prompt = "你是一个专门用于文本信息提取的AI助手。"
        prompt = self._build_name_extraction_prompt(essay_text)
        
        name = await self._call_llm_api(prompt, system_prompt)
        
        # 清理可能存在的额外字符
        cleaned_name = name.strip().replace("姓名：", "").replace("姓名:", "")
        
        if not cleaned_name:
            raise ValueError("无法从文本中提取学生姓名")
            
        return cleaned_name

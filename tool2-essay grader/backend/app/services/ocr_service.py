import base64
import logging
from typing import Optional

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

from app.config import settings

# 配置日志
logging.basicConfig(level=settings.log_level)
logger = logging.getLogger(__name__)


class OCRService:
    """
    封装百度OCR API的文本识别服务。
    """

    def __init__(self, api_key: str = settings.baidu_ocr_api_key, secret_key: str = settings.baidu_ocr_secret_key):
        """
        初始化OCR服务。

        Args:
            api_key (str): 百度OCR API Key。
            secret_key (str): 百度OCR Secret Key。
        """
        self.api_key = api_key
        self.secret_key = secret_key
        self.access_token: Optional[str] = None
        self.token_url = f"https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id={self.api_key}&client_secret={self.secret_key}"
        self.ocr_url = "https://aip.baidubce.com/rest/2.0/ocr/v1/accurate_basic"

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=10),
        reraise=True
    )
    async def _get_access_token(self) -> str:
        """
        获取百度OCR API的access_token。
        使用tenacity库添加了重试机制。

        Returns:
            str: 获取到的access_token。

        Raises:
            httpx.HTTPStatusError: 如果API请求失败。
        """
        logger.info("正在获取百度OCR access_token...")
        async with httpx.AsyncClient() as client:
            response = await client.post(self.token_url)
            response.raise_for_status()
            token_data = response.json()
            self.access_token = token_data.get("access_token")
            if not self.access_token:
                raise ValueError("未能从百度API获取access_token")
            logger.info("成功获取百度OCR access_token。")
            return self.access_token

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=10),
        reraise=True
    )
    async def recognize_text(self, image_bytes: bytes) -> str:
        """
        识别图片中的文本。

        Args:
            image_bytes (bytes): 图片的二进制数据。

        Returns:
            str: 识别出的文本内容，多行将用换行符连接。
        
        Raises:
            ValueError: 如果图片数据为空。
            httpx.HTTPStatusError: 如果API请求失败。
        """
        if not image_bytes:
            raise ValueError("输入的图片数据不能为空")

        if not self.access_token:
            await self._get_access_token()

        image_base64 = base64.b64encode(image_bytes).decode('utf-8')
        
        headers = {'Content-Type': 'application/x-www-form-urlencoded'}
        data = {
            "image": image_base64,
            "access_token": self.access_token
        }

        logger.info("正在调用百度OCR API进行文本识别...")
        async with httpx.AsyncClient() as client:
            # 将 access_token 附加到 URL，图片数据放在请求体中
            url_with_token = f"{self.ocr_url}?access_token={self.access_token}"
            response = await client.post(url_with_token, headers=headers, data={'image': image_base64})
            response.raise_for_status()
            
        result_data = response.json()
        
        if "error_code" in result_data:
            logger.error(f"百度OCR API返回错误: {result_data}")
            # 如果是token失效，则清空token以便下次重新获取
            if result_data["error_code"] in [100, 110, 111]:
                self.access_token = None
            raise httpx.HTTPStatusError(
                message=f"OCR API Error: {result_data.get('error_msg', 'Unknown error')}",
                request=response.request,
                response=response
            )

        words_result = result_data.get("words_result", [])
        recognized_text = "\n".join([item.get("words", "") for item in words_result])
        
        logger.info(f"文本识别成功，识别出 {len(recognized_text)} 个字符。")
        return recognized_text

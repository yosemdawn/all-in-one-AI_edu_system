import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Dict

from app.config import settings

# 配置日志 - 修复：将字符串级别转换为整数常量
log_level = getattr(logging, settings.log_level.upper(), logging.INFO)
logging.basicConfig(level=log_level)
logger = logging.getLogger(__name__)


class EmailService:
    """
    封装SMTP邮件发送功能的服务。
    """

    def __init__(
        self,
        host: str = settings.smtp_host,
        port: int = settings.smtp_port,
        username: str = settings.smtp_username,
        password: str = settings.smtp_password,
    ):
        """
        初始化邮件服务。

        Args:
            host (str): SMTP服务器地址。
            port (int): SMTP服务器端口。
            username (str): 发件人邮箱账号。
            password (str): 发件人邮箱密码或授权码。
        """
        self.smtp_host = host
        self.smtp_port = port
        self.smtp_username = username
        self.smtp_password = password

    def _render_email_template(self, student_name: str, grading_result: Dict) -> str:
        """
        使用批阅结果渲染HTML邮件模板。

        Args:
            student_name (str): 学生姓名。
            grading_result (Dict): LLM返回的批阅结果。

        Returns:
            str: 渲染后的HTML字符串。
        """
        # 提取批阅结果
        score = grading_result.get("score", "N/A")
        strengths = grading_result.get("strengths", "无")
        weaknesses = grading_result.get("weaknesses", "无")
        suggestions = grading_result.get("suggestions", [])
        summary = grading_result.get("summary_comment", "无")

        # 构建修改建议的HTML - 优化格式，使其更易读
        suggestions_html = ""
        if suggestions and isinstance(suggestions, list):
            for idx, sug in enumerate(suggestions, 1):
                if isinstance(sug, dict):
                    original = sug.get('original_sentence', '').strip()
                    revised = sug.get('revised_sentence', '').strip()
                    reason = sug.get('reason', '').strip()
                    
                    # 特殊处理拼写错误汇总（通常是第一条）
                    if idx == 1 and '拼写错误' in original:
                        suggestions_html += f"""
                        <div style="background-color: #fff3cd; padding: 15px; margin-bottom: 15px; border-left: 4px solid #ffc107; border-radius: 4px;">
                            <h5 style="color: #856404; margin-top: 0;">📝 拼写错误汇总</h5>
                            <p style="margin: 10px 0;"><strong>需要修正的拼写：</strong></p>
                            <p style="font-family: 'Courier New', monospace; background-color: #fff; padding: 10px; border-radius: 4px; line-height: 1.8;">
                                {revised}
                            </p>
                            <p style="margin: 10px 0 0 0; color: #856404; font-size: 14px;"><em>💡 {reason}</em></p>
                        </div>
                        """
                    else:
                        # 普通的句式改进建议
                        suggestions_html += f"""
                        <div style="background-color: #f8f9fa; padding: 15px; margin-bottom: 15px; border-left: 4px solid #007bff; border-radius: 4px;">
                            <h5 style="color: #0056b3; margin-top: 0;">💡 建议 {idx - (1 if '拼写错误' in suggestions[0].get('original_sentence', '') else 0)}</h5>
                            <p style="margin: 10px 0;"><strong>原句：</strong></p>
                            <p style="background-color: #fff; padding: 10px; border-radius: 4px; border-left: 3px solid #dc3545;">
                                {original}
                            </p>
                            <p style="margin: 10px 0;"><strong>改进后：</strong></p>
                            <p style="background-color: #fff; padding: 10px; border-radius: 4px; border-left: 3px solid #28a745;">
                                {revised}
                            </p>
                            <p style="margin: 10px 0 0 0; color: #6c757d; font-size: 14px;"><em>📌 {reason}</em></p>
                        </div>
                        """
        
        if not suggestions_html:
            suggestions_html = "<p style='color: #6c757d;'>暂无具体修改建议。</p>"

        # 完整的HTML模板 - 优化样式
        html_body = f"""
        <!DOCTYPE html>
        <html lang="zh-CN">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body {{
                    font-family: 'Microsoft YaHei', Arial, sans-serif;
                    line-height: 1.8;
                    color: #333;
                    background-color: #f5f5f5;
                    margin: 0;
                    padding: 20px;
                }}
                .container {{
                    max-width: 650px;
                    margin: 0 auto;
                    background-color: #ffffff;
                    padding: 30px;
                    border-radius: 12px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                }}
                h2 {{
                    color: #0056b3;
                    border-bottom: 3px solid #0056b3;
                    padding-bottom: 10px;
                    margin-top: 0;
                }}
                .section {{
                    margin-bottom: 25px;
                    padding: 15px;
                    background-color: #f8f9fa;
                    border-radius: 8px;
                }}
                .score-section {{
                    text-align: center;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 20px;
                    border-radius: 8px;
                    margin-bottom: 25px;
                }}
                .score {{
                    font-size: 48px;
                    font-weight: bold;
                    display: block;
                    margin: 10px 0;
                }}
                h4 {{
                    color: #495057;
                    margin-top: 0;
                    font-size: 18px;
                }}
                .footer {{
                    text-align: center;
                    margin-top: 30px;
                    padding-top: 20px;
                    border-top: 2px solid #e9ecef;
                    color: #6c757d;
                }}
            </style>
        </head>
        <body>
            <div class="container">
                <h2>🎓 {student_name}同学，你的作文批阅报告来啦！</h2>
                
                <div class="score-section">
                    <div style="font-size: 16px; margin-bottom: 5px;">综合得分</div>
                    <span class="score">{score}</span>
                    <div style="font-size: 14px; opacity: 0.9;">满分100分</div>
                </div>

                <div class="section">
                    <h4>👍 优点</h4>
                    <p style="margin: 10px 0; line-height: 1.8;">{strengths}</p>
                </div>

                <div class="section">
                    <h4>🤔 不足之处</h4>
                    <p style="margin: 10px 0; line-height: 1.8;">{weaknesses}</p>
                </div>

                <div class="section" style="background-color: #fff;">
                    <h4>✍️ 具体修改建议</h4>
                    {suggestions_html}
                </div>

                <div class="section">
                    <h4>📝 总结评语</h4>
                    <p style="margin: 10px 0; line-height: 1.8;">{summary}</p>
                </div>

                <div class="footer">
                    <p style="margin: 5px 0;">💪 继续努力，你的写作能力会越来越棒！</p>
                    <p style="margin: 5px 0; font-size: 14px;"><em>—— yosem AI作文批阅系统 PS：别忘了背单词</em></p>
                </div>
            </div>
        </body>
        </html>
        """
        return html_body

    async def send_grading_email(
        self,
        student_name: str,
        student_email: str,
        grading_result: Dict
    ) -> bool:
        """
        发送作文批阅报告邮件。

        Args:
            student_name (str): 学生姓名。
            student_email (str): 学生邮箱。
            grading_result (Dict): 批阅结果。

        Returns:
            bool: 如果邮件发送成功则返回True，否则返回False。
        """
        subject = f"【作文批阅报告】{student_name}同学，你的作文已批阅"
        html_body = self._render_email_template(student_name, grading_result)

        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = self.smtp_username
        msg['To'] = student_email

        html_part = MIMEText(html_body, 'html', 'utf-8')
        msg.attach(html_part)

        try:
            logger.info(f"=" * 60)
            logger.info(f"开始发送邮件")
            logger.info(f"收件人: {student_name} <{student_email}>")
            logger.info(f"主题: {subject}")
            logger.info(f"SMTP配置: {self.smtp_host}:{self.smtp_port}")
            logger.info(f"发件人: {self.smtp_username}")
            logger.info(f"=" * 60)

            email_sent_successfully = False

            # 尝试使用465端口（SSL）
            if self.smtp_port == 465:
                import ssl
                # 创建SSL上下文，用于465端口的直接SSL连接
                context = ssl.create_default_context()
                logger.info("使用SMTP_SSL连接（465端口）...")

                with smtplib.SMTP_SSL(self.smtp_host, self.smtp_port, context=context, timeout=30) as server:
                    logger.info("SSL连接已建立")
                    logger.info("正在进行登录认证...")
                    server.login(self.smtp_username, self.smtp_password)
                    logger.info("登录成功")
                    logger.info("正在发送邮件...")
                    server.send_message(msg)
                    logger.info("邮件发送成功")
                    email_sent_successfully = True

            else:
                logger.info("使用SMTP+STARTTLS连接...")

                with smtplib.SMTP(self.smtp_host, self.smtp_port, timeout=30) as server:
                    logger.info("SMTP连接已建立")
                    logger.info("正在启动TLS加密...")
                    server.starttls()
                    logger.info("TLS加密已启动")
                    logger.info("正在进行登录认证...")
                    server.login(self.smtp_username, self.smtp_password)
                    logger.info("登录成功")
                    logger.info("正在发送邮件...")
                    server.send_message(msg)
                    logger.info("邮件发送成功")
                    email_sent_successfully = True

            logger.info(f"=" * 60)
            logger.info(f"✅ 邮件发送成功！")
            logger.info(f"收件人: {student_name} <{student_email}>")
            logger.info(f"=" * 60)
            
        except smtplib.SMTPAuthenticationError as e:
            logger.error(f"邮件发送认证失败: {e}")
            logger.error(f"错误代码: {e.smtp_code}, 错误信息: {e.smtp_error}")
            logger.error("请检查以下配置:")
            logger.error(f"  - SMTP用户名: {self.smtp_username}")
            logger.error(f"  - SMTP密码/授权码是否正确")
            logger.error(f"  - 是否已开启SMTP服务（如QQ邮箱需要开启SMTP服务并获取授权码）")
            return False
            
        except smtplib.SMTPConnectError as e:
            logger.error(f"SMTP连接失败: {e}")
            logger.error(f"请检查以下配置:")
            logger.error(f"  - SMTP服务器地址: {self.smtp_host}")
            logger.error(f"  - SMTP端口: {self.smtp_port}")
            logger.error(f"  - 网络连接是否正常")
            logger.error(f"  - 防火墙是否阻止了连接")
            return False
            
        except smtplib.SMTPServerDisconnected as e:
            logger.error(f"SMTP服务器断开连接: {e}")
            logger.error("可能的原因:")
            logger.error("  - 服务器主动断开连接")
            logger.error("  - 网络不稳定")
            logger.error("  - 连接超时")
            return False
            
        except smtplib.SMTPRecipientsRefused as e:
            logger.error(f"收件人地址被拒绝: {e}")
            logger.error(f"被拒绝的收件人: {e.recipients}")
            logger.error(f"请检查收件人邮箱地址是否正确: {student_email}")
            return False
            
        except smtplib.SMTPSenderRefused as e:
            logger.error(f"发件人地址被拒绝: {e}")
            logger.error(f"发件人: {self.smtp_username}")
            logger.error(f"错误代码: {e.smtp_code}, 错误信息: {e.smtp_error}")
            return False
            
        except smtplib.SMTPDataError as e:
            logger.error(f"邮件数据错误: {e}")
            logger.error(f"错误代码: {e.smtp_code}, 错误信息: {e.smtp_error}")
            logger.error("可能的原因:")
            logger.error("  - 邮件内容格式不正确")
            logger.error("  - 邮件大小超过限制")
            return False
            
        except smtplib.SMTPResponseException as e:
            # 检查邮件是否已经发送成功
            if email_sent_successfully:
                logger.warning(f"邮件已发送，但收到SMTP响应异常: {e}")
                logger.warning(f"错误代码: {e.smtp_code}, 错误信息: {e.smtp_error}")
                logger.info("⚠️ 这可能是服务器在关闭连接时的正常响应，邮件应该已经成功发送")
                # 邮件已经发送成功，忽略后续的响应异常
                return True
            else:
                logger.error(f"SMTP响应异常: {e}")
                logger.error(f"错误代码: {e.smtp_code}, 错误信息: {e.smtp_error}")
                logger.error("可能的原因:")
                logger.error("  - SMTP服务器响应格式异常")
                logger.error("  - SSL/TLS握手失败")
                logger.error("  - 网络连接不稳定")
                return False
            
        except smtplib.SMTPException as e:
            logger.error(f"SMTP协议错误: {e}")
            logger.error(f"错误类型: {type(e).__name__}")
            return False

        except Exception as e:
            logger.error(f"邮件发送失败，发生未预期的错误: {e}")
            logger.error(f"错误类型: {type(e).__name__}")
            logger.error(f"详细信息: {str(e)}", exc_info=True)
            return False

        # 如果代码执行到这里，说明邮件发送成功
        logger.info(f"📧 准备返回邮件发送状态: {email_sent_successfully}")
        return email_sent_successfully

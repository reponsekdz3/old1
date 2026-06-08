import requests
import qrcode
from io import BytesIO
import base64
import os
import time
import logging
from datetime import datetime, timedelta
from urllib3.util.retry import Retry
from requests.adapters import HTTPAdapter

logger = logging.getLogger(__name__)

DEV_MODE = os.environ.get('VIPCHAT_DEV_OTP', 'true').lower() != 'false'


class AfricanTalkingService:
    """African Talking SMS Service for verification.
    In dev mode (no API key set), logs the OTP code and returns it instead of sending SMS."""

    BASE_URL = "https://api.africastalking.com/version1/messaging"
    SANDBOX_URL = "https://api.sandbox.africastalking.com/version1/messaging"

    def __init__(self):
        self.api_key = os.environ.get("AFRICAN_TALKING_API_KEY", "")
        self.username = os.environ.get("AFRICAN_TALKING_USERNAME", "sandbox")
        self.is_sandbox = not self.api_key or self.username == "sandbox"
        self.base_url = self.SANDBOX_URL if self.is_sandbox else self.BASE_URL
        self.session = self._build_session()

    def _build_session(self):
        session = requests.Session()
        retries = Retry(
            total=3,
            backoff_factor=0.5,
            status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods=["POST"],
        )
        session.mount("https://", HTTPAdapter(max_retries=retries))
        session.headers.update({
            "Accept": "application/json",
            "Content-Type": "application/x-www-form-urlencoded"
        })
        return session

    def _to_e164(self, phone_number: str) -> str:
        if not phone_number.startswith("+"):
            phone_number = "+" + phone_number
        return phone_number

    def send_verification_code(self, phone_number: str, code: str) -> dict:
        """Send SMS verification code.
        If no real API key is set, runs in dev mode: logs the code and marks success."""
        phone_number = self._to_e164(phone_number)
        message = f"Your VipChat verification code is: {code}. Valid for 10 minutes. Do not share this code."

        if not self.api_key:
            logger.warning(
                "===== DEV MODE OTP =====\n"
                "Phone: %s\nCode: %s\n"
                "Set AFRICAN_TALKING_API_KEY env var for real SMS delivery.\n"
                "========================",
                phone_number, code
            )
            return {"ok": True, "dev": True, "code": code, "message": "Dev mode — code logged to console"}

        payload = {
            "username": self.username,
            "to": phone_number,
            "message": message,
            "apiKey": self.api_key,
        }

        for attempt in range(3):
            try:
                response = self.session.post(
                    self.base_url,
                    data=payload,
                    timeout=(5, 15),
                )
                logger.info("SMS API response %s: %s", response.status_code, response.text[:200])
                return {"ok": True, "status_code": response.status_code, "body": response.text}
            except Exception as exc:
                logger.warning("SMS send attempt %s failed: %s", attempt + 1, exc)
                if attempt < 2:
                    time.sleep(0.5 * (2 ** attempt))

        raise RuntimeError("SMS delivery failed after retries")


class QRCodeService:
    """QR Code generation service"""

    @staticmethod
    def generate_qr_code(user_id: str, user_phone: str) -> str:
        try:
            qr_data = f"vipchat://{user_id}/{user_phone}"
            qr = qrcode.QRCode(
                version=1,
                error_correction=qrcode.constants.ERROR_CORRECT_L,
                box_size=10,
                border=4,
            )
            qr.add_data(qr_data)
            qr.make(fit=True)
            img = qr.make_image(fill_color="#075E54", back_color="white")
            buffered = BytesIO()
            img.save(buffered, format="PNG")
            img_str = base64.b64encode(buffered.getvalue()).decode()
            return f"data:image/png;base64,{img_str}"
        except Exception as e:
            logger.error("QR code generation failed: %s", e)
            return ""

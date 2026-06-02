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


class AfricanTalkingService:
    """African Talking SMS Service for verification"""

    BASE_URL = "https://api.sandbox.africastalking.com/version1/messaging"

    def __init__(self):
        self.api_key = os.environ.get("AFRICAN_TALKING_API_KEY", "")
        self.username = os.environ.get("AFRICAN_TALKING_USERNAME", "sandbox")
        self.session = self._build_session()

    def _build_session(self):
        session = requests.Session()
        retries = Retry(
            total=5,
            backoff_factor=0.6,
            status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods=["POST"],
        )
        session.mount("https://", HTTPAdapter(max_retries=retries))
        session.headers.update({"Accept": "application/json", "Content-Type": "application/x-www-form-urlencoded"})
        return session

    def _to_e164(self, phone_number: str) -> str:
        if not phone_number.startswith("+"):
            phone_number = "+" + phone_number
        return phone_number

    def send_verification_code(self, phone_number: str, code: str) -> dict:
        """Send SMS verification code via African Talking"""
        phone_number = self._to_e164(phone_number)
        message = f"Your Bitese verification code is: {code}. Valid for 10 minutes."
        payload = {
            "username": self.username,
            "to": phone_number,
            "message": message,
            "apikey": self.api_key,
        }
        last_exception = None
        for attempt in range(5):
            try:
                response = self.session.post(
                    self.BASE_URL,
                    data=payload,
                    timeout=(3.5, 12),
                )
                logger.info("SMS API response %s: %s", response.status_code, response.text)
                return {"ok": True, "status_code": response.status_code, "body": response.text}
            except Exception as exc:
                last_exception = exc
                logger.warning("SMS send failed attempt %s: %s", attempt + 1, exc)
                time.sleep(0.35 * (2 ** attempt))
        raise RuntimeError(f"SMS delivery failed after retries: {last_exception}")


class QRCodeService:
    """QR Code generation service"""

    @staticmethod
    def generate_qr_code(user_id: str, user_phone: str) -> str:
        try:
            qr_data = f"bitese://{user_id}/{user_phone}"
            qr = qrcode.QRCode(
                version=1,
                error_correction=qrcode.constants.ERROR_CORRECT_L,
                box_size=10,
                border=4,
            )
            qr.add_data(qr_data)
            qr.make(fit=True)

            img = qr.make_image(fill_color="black", back_color="white")

            buffer = BytesIO()
            img.save(buffer, format="PNG")
            buffer.seek(0)
            img_base64 = base64.b64encode(buffer.read()).decode()

            return f"data:image/png;base64,{img_base64}"
        except Exception as e:
            logger.exception("Error generating QR code")
            return None


class EncryptionService:
    """Message encryption service"""

    @staticmethod
    def encrypt_message(message: str, key: str) -> str:
        from cryptography.fernet import Fernet
        import base64

        try:
            cipher = Fernet(base64.urlsafe_b64encode(key.encode().ljust(32)[:32]))
            encrypted = cipher.encrypt(message.encode())
            return encrypted.decode()
        except Exception as e:
            logger.exception("Encryption error")
            return message

    @staticmethod
    def decrypt_message(encrypted_message: str, key: str) -> str:
        from cryptography.fernet import Fernet
        import base64

        try:
            cipher = Fernet(base64.urlsafe_b64encode(key.encode().ljust(32)[:32]))
            decrypted = cipher.decrypt(encrypted_message.encode())
            return decrypted.decode()
        except Exception as e:
            logger.exception("Decryption error")
            return encrypted_message

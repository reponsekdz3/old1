import requests
import os
from datetime import datetime, timedelta

class AfricanTalkingService:
    """Service for African Talking SMS integration"""
    
    def __init__(self):
        self.username = os.environ.get('AFRICAN_TALKING_USERNAME', '')
        self.api_key = os.environ.get('AFRICAN_TALKING_API_KEY', '')
        self.base_url = 'https://api.sandbox.africastalking.com'
    
    def send_verification_sms(self, phone_number, code):
        """Send verification code via SMS"""
        if not self.username or not self.api_key:
            # For development, just log it
            print(f"[DEMO] SMS sent to {phone_number}: Your verification code is {code}")
            return True
        
        try:
            headers = {
                'Accept': 'application/json',
                'Content-Type': 'application/x-www-form-urlencoded',
                'apiKey': self.api_key
            }
            
            message = f"Your Bitese verification code is: {code}. Valid for 10 minutes."
            
            payload = {
                'username': self.username,
                'to': phone_number,
                'message': message
            }
            
            response = requests.post(
                f'{self.base_url}/version1/messaging',
                headers=headers,
                data=payload,
                timeout=10
            )
            
            return response.status_code == 200
        except Exception as e:
            print(f"Error sending SMS: {str(e)}")
            return False
    
    def send_notification_sms(self, phone_number, message):
        """Send notification SMS"""
        if not self.username or not self.api_key:
            print(f"[DEMO] Notification SMS sent to {phone_number}: {message}")
            return True
        
        try:
            headers = {
                'Accept': 'application/json',
                'Content-Type': 'application/x-www-form-urlencoded',
                'apiKey': self.api_key
            }
            
            payload = {
                'username': self.username,
                'to': phone_number,
                'message': message
            }
            
            response = requests.post(
                f'{self.base_url}/version1/messaging',
                headers=headers,
                data=payload,
                timeout=10
            )
            
            return response.status_code == 200
        except Exception as e:
            print(f"Error sending notification SMS: {str(e)}")
            return False

sms_service = AfricanTalkingService()

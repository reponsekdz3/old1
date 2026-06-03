"""
Input Validation & Sanitization - Enterprise Security
Protects against injection attacks, XSS, SQL injection, and malicious input
"""
import re
import bleach
from functools import wraps
from flask import request, jsonify
from html import escape
import unicodedata

class InputValidator:
    """Comprehensive input validation and sanitization"""
    
    # Patterns
    PHONE_PATTERN = re.compile(r'^\+?[1-9]\d{1,14}$')
    EMAIL_PATTERN = re.compile(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')
    USERNAME_PATTERN = re.compile(r'^[a-zA-Z0-9_]{3,30}$')
    UUID_PATTERN = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', re.I)
    
    # Dangerous patterns
    SQL_INJECTION_PATTERNS = [
        r"(\bunion\b.*\bselect\b)",
        r"(\bselect\b.*\bfrom\b)",
        r"(\binsert\b.*\binto\b)",
        r"(\bdelete\b.*\bfrom\b)",
        r"(\bdrop\b.*\btable\b)",
        r"(--|\;|\/\*|\*\/)",
    ]
    
    XSS_PATTERNS = [
        r"<script[^>]*>.*?</script>",
        r"javascript:",
        r"on\w+\s*=",
        r"<iframe",
    ]
    
    @staticmethod
    def sanitize_string(text, max_length=4000, allow_html=False):
        """Sanitize text input"""
        if not isinstance(text, str):
            return text
        
        # Remove null bytes and control characters
        text = text.replace('\x00', '')
        text = ''.join(char for char in text if unicodedata.category(char)[0] != 'C' or char in '\n\r\t')
        
        # Limit length
        text = text[:max_length]
        
        # Handle HTML
        if not allow_html:
            text = escape(text)
        else:
            # Allow only safe HTML tags
            text = bleach.clean(
                text,
                tags=['p', 'br', 'strong', 'em', 'u', 'a'],
                attributes={'a': ['href', 'title']},
                strip=True
            )
        
        return text.strip()
    
    @staticmethod
    def validate_phone(phone):
        """Validate phone number"""
        if not phone or not isinstance(phone, str):
            return False
        
        # Remove spaces and dashes
        phone = re.sub(r'[\s\-\(\)]', '', phone)
        return bool(InputValidator.PHONE_PATTERN.match(phone))
    
    @staticmethod
    def validate_email(email):
        """Validate email address"""
        if not email or not isinstance(email, str):
            return False
        return bool(InputValidator.EMAIL_PATTERN.match(email.lower()))
    
    @staticmethod
    def validate_username(username):
        """Validate username"""
        if not username or not isinstance(username, str):
            return False
        return bool(InputValidator.USERNAME_PATTERN.match(username))
    
    @staticmethod
    def validate_uuid(uuid_str):
        """Validate UUID format"""
        if not uuid_str or not isinstance(uuid_str, str):
            return False
        return bool(InputValidator.UUID_PATTERN.match(uuid_str))
    
    @staticmethod
    def detect_sql_injection(text):
        """Detect SQL injection attempts"""
        if not isinstance(text, str):
            return False
        
        text_lower = text.lower()
        for pattern in InputValidator.SQL_INJECTION_PATTERNS:
            if re.search(pattern, text_lower, re.IGNORECASE):
                return True
        return False
    
    @staticmethod
    def detect_xss(text):
        """Detect XSS attempts"""
        if not isinstance(text, str):
            return False
        
        for pattern in InputValidator.XSS_PATTERNS:
            if re.search(pattern, text, re.IGNORECASE):
                return True
        return False
    
    @staticmethod
    def sanitize_json(data, schema=None):
        """Recursively sanitize JSON data"""
        if isinstance(data, dict):
            return {
                k: InputValidator.sanitize_json(v, schema.get(k) if schema else None)
                for k, v in data.items()
                if schema is None or k in schema
            }
        elif isinstance(data, list):
            return [InputValidator.sanitize_json(item) for item in data]
        elif isinstance(data, str):
            return InputValidator.sanitize_string(data)
        return data

def validate_input(schema):
    """Decorator to validate request input against schema"""
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            if not request.is_json:
                return jsonify({'error': 'JSON body required'}), 400
            
            data = request.get_json()
            
            # Check required fields
            if 'required' in schema:
                for field in schema['required']:
                    if field not in data:
                        return jsonify({'error': f'Missing required field: {field}'}), 400
            
            # Validate fields
            if 'fields' in schema:
                for field, rules in schema['fields'].items():
                    if field not in data:
                        continue
                    
                    value = data[field]
                    
                    # Type validation
                    if 'type' in rules:
                        expected_type = rules['type']
                        if expected_type == 'string' and not isinstance(value, str):
                            return jsonify({'error': f'{field} must be a string'}), 400
                        elif expected_type == 'int' and not isinstance(value, int):
                            return jsonify({'error': f'{field} must be an integer'}), 400
                        elif expected_type == 'bool' and not isinstance(value, bool):
                            return jsonify({'error': f'{field} must be a boolean'}), 400
                    
                    # String validations
                    if isinstance(value, str):
                        # Min/max length
                        if 'min_length' in rules and len(value) < rules['min_length']:
                            return jsonify({'error': f'{field} too short'}), 400
                        if 'max_length' in rules and len(value) > rules['max_length']:
                            return jsonify({'error': f'{field} too long'}), 400
                        
                        # Pattern matching
                        if 'pattern' in rules:
                            pattern = rules['pattern']
                            if pattern == 'phone' and not InputValidator.validate_phone(value):
                                return jsonify({'error': f'{field} is not a valid phone number'}), 400
                            elif pattern == 'email' and not InputValidator.validate_email(value):
                                return jsonify({'error': f'{field} is not a valid email'}), 400
                            elif pattern == 'username' and not InputValidator.validate_username(value):
                                return jsonify({'error': f'{field} is not a valid username'}), 400
                        
                        # Security checks
                        if InputValidator.detect_sql_injection(value):
                            return jsonify({'error': 'Potential SQL injection detected'}), 400
                        if InputValidator.detect_xss(value):
                            return jsonify({'error': 'Potential XSS detected'}), 400
                        
                        # Sanitize
                        data[field] = InputValidator.sanitize_string(
                            value,
                            max_length=rules.get('max_length', 4000)
                        )
            
            # Update request data
            request.sanitized_data = data
            return f(*args, **kwargs)
        return wrapper
    return decorator

# Common validation schemas
AUTH_SCHEMAS = {
    'login': {
        'required': ['phone_number', 'password'],
        'fields': {
            'phone_number': {'type': 'string', 'pattern': 'phone', 'max_length': 20},
            'password': {'type': 'string', 'min_length': 6, 'max_length': 128}
        }
    },
    'signup': {
        'required': ['phone_number', 'password', 'display_name'],
        'fields': {
            'phone_number': {'type': 'string', 'pattern': 'phone', 'max_length': 20},
            'password': {'type': 'string', 'min_length': 6, 'max_length': 128},
            'display_name': {'type': 'string', 'min_length': 2, 'max_length': 50}
        }
    }
}

MESSAGE_SCHEMA = {
    'required': ['content'],
    'fields': {
        'content': {'type': 'string', 'max_length': 10000},
        'message_type': {'type': 'string', 'max_length': 20}
    }
}

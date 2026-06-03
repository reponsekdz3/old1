import secrets
import logging
from datetime import datetime, timedelta
from app.models.models import db, VerificationCode, User, Message, MessageStatus, Contact
from app.services.external_services import AfricanTalkingService, QRCodeService

logger = logging.getLogger(__name__)


def _validate_phone(phone_number):
    import phonenumbers
    try:
        number = phonenumbers.parse(phone_number, None)
        return phonenumbers.is_valid_number(number)
    except Exception:
        return False


class AuthService:
    _sms_service = None
    QR_SERVICE = QRCodeService()

    @classmethod
    def _get_sms_service(cls):
        if cls._sms_service is None:
            cls._sms_service = AfricanTalkingService()
        return cls._sms_service

    @staticmethod
    def generate_verification_code():
        return ''.join([str(secrets.randbelow(10)) for _ in range(6)])

    @staticmethod
    def send_verification_sms(phone_number):
        if not _validate_phone(phone_number):
            logger.warning('Invalid phone number for verification SMS: %s', phone_number)
            return False
        try:
            existing = VerificationCode.query.filter_by(
                phone_number=phone_number,
            ).first()
            if existing and not existing.is_expired():
                return True

            code = AuthService.generate_verification_code()
            expires_at = datetime.utcnow() + timedelta(minutes=10)
            verification = VerificationCode(
                phone_number=phone_number,
                code=code,
                expires_at=expires_at,
            )
            db.session.add(verification)
            db.session.commit()

            response = AuthService._get_sms_service().send_verification_code(phone_number, code)
            if not response.get('ok'):
                raise RuntimeError(f"SMS provider returned failure: {response}")
            logger.info('Verification SMS accepted by provider', extra={'phone_number': phone_number})
            return True
        except Exception as e:
            logger.exception('Error in send_verification_sms')
            db.session.rollback()
            return False

    @staticmethod
    def verify_code(phone_number, code):
        try:
            verification = VerificationCode.query.filter_by(
                phone_number=phone_number,
                code=code,
            ).first()
            if not verification:
                return False
            if verification.is_expired():
                return False
            if verification.attempts >= 5:
                return False
            # Invalidate code after successful verification (prevent reuse)
            db.session.delete(verification)
            db.session.commit()
            return True
        except Exception as e:
            logger.exception('Error in verify_code')
            return False

    @staticmethod
    def generate_qr_code_for_user(user_id, phone_number):
        return AuthService.QR_SERVICE.generate_qr_code(user_id, phone_number)

class MessageService:
    @staticmethod
    def create_message(sender_id, receiver_id, content, media_url=None, replied_to_id=None):
        try:
            message = Message(
                sender_id=sender_id,
                receiver_id=receiver_id,
                content=content,
                media_url=media_url,
                replied_to_id=replied_to_id,
            )
            db.session.add(message)
            db.session.commit()
            return {'success': True, 'message': message.to_dict()}
        except Exception as e:
            logger.exception('Error creating message')
            db.session.rollback()
            return {'success': False, 'error': str(e)}

    @staticmethod
    def mark_as_read(message_id):
        try:
            message = Message.query.get(message_id)
            if message:
                message.status = MessageStatus.READ
                db.session.commit()
                return True
            return False
        except Exception as e:
            logger.exception('Error marking message as read')
            db.session.rollback()
            return False

    @staticmethod
    def mark_as_delivered(message_id):
        try:
            message = Message.query.get(message_id)
            if message and message.status == MessageStatus.SENT:
                message.status = MessageStatus.DELIVERED
                db.session.commit()
                return True
            return False
        except Exception as e:
            logger.exception('Error marking message as delivered')
            db.session.rollback()
            return False

    @staticmethod
    def get_chat_history(user1_id, user2_id, limit=50):
        try:
            messages = Message.query.filter(
                db.or_(
                    db.and_(Message.sender_id == user1_id, Message.receiver_id == user2_id),
                    db.and_(Message.sender_id == user2_id, Message.receiver_id == user1_id),
                )
            ).order_by(Message.created_at.desc()).limit(limit).all()
            return [m.to_dict() for m in reversed(messages)]
        except Exception as e:
            logger.exception('Error getting chat history')
            return []

class ContactService:
    @staticmethod
    def add_contact(user_id, phone_number, contact_name=None):
        try:
            existing = Contact.query.filter_by(
                user_id=user_id,
                phone_number=phone_number,
            ).first()
            if existing:
                return {'success': False, 'error': 'Contact already exists'}
            contact_user = User.query.filter_by(phone_number=phone_number).first()
            contact = Contact(
                user_id=user_id,
                phone_number=phone_number,
                contact_name=contact_name or phone_number,
                contact_user_id=contact_user.id if contact_user else None,
            )
            db.session.add(contact)
            db.session.commit()
            return {'success': True, 'contact': contact.to_dict()}
        except Exception as e:
            logger.exception('Error adding contact')
            db.session.rollback()
            return {'success': False, 'error': str(e)}

    @staticmethod
    def get_contacts(user_id):
        try:
            contacts = Contact.query.filter_by(user_id=user_id).all()
            return [c.to_dict() for c in contacts]
        except Exception as e:
            logger.exception('Error getting contacts')
            return []

    @staticmethod
    def block_contact(user_id, contact_id):
        try:
            contact = Contact.query.filter_by(id=contact_id, user_id=user_id).first()
            if contact:
                contact.is_blocked = True
                db.session.commit()
                return True
            return False
        except Exception as e:
            logger.exception('Error blocking contact')
            db.session.rollback()
            return False

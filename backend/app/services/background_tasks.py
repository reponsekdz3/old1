"""
Celery Background Tasks for VipChat
Handles async processing of notifications, message delivery, and data sync
"""
from celery import Celery
import logging
import requests
import json
from datetime import datetime, timedelta
from typing import Dict, List, Optional
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

logger = logging.getLogger(__name__)

celery_app = Celery('vipchat')


@celery_app.task(bind=True, max_retries=3)
def send_push_notification(self, user_id: str, notification_data: Dict):
    """Send push notification to user"""
    try:
        from app.models.models import User, PushSubscription
        from app.services.push_notifications import send_notification

        user = User.query.get(user_id)
        if not user:
            logger.warning(f"[Push] User not found: {user_id}")
            return

        subscriptions = PushSubscription.query.filter_by(
            user_id=user_id,
            active=True
        ).all()

        if not subscriptions:
            logger.info(f"[Push] No active subscriptions for user: {user_id}")
            return

        success_count = 0
        for subscription in subscriptions:
            try:
                send_notification(
                    subscription.endpoint,
                    subscription.p256dh,
                    subscription.auth,
                    notification_data
                )
                success_count += 1
            except Exception as e:
                logger.error(f"[Push] Failed to send to subscription {subscription.id}: {e}")
                subscription.active = False

        logger.info(f"[Push] Sent notifications to {success_count}/{len(subscriptions)} devices for user {user_id}")

    except Exception as exc:
        logger.error(f"[Push] Task failed: {exc}")
        raise self.retry(countdown=60, exc=exc)


@celery_app.task(bind=True, max_retries=5)
def process_offline_message(self, message_data: Dict):
    """Process message for offline user delivery"""
    try:
        from app.models.models import User, Message
        from app.services.message_queue import message_queue

        receiver_id = message_data.get('receiver_id')
        if not receiver_id:
            logger.error("[OfflineMessage] No receiver_id provided")
            return

        user_online = check_user_online_status(receiver_id)

        if not user_online:
            message_queue.queue_offline_delivery(receiver_id, message_data)

            notification = {
                'title': message_data.get('sender_name', 'VipChat'),
                'body': message_data.get('content', 'New message')[:100],
                'icon': '/icon-192.png',
                'data': {
                    'message_id': message_data.get('id'),
                    'sender_id': message_data.get('sender_id'),
                    'type': 'message'
                }
            }

            send_push_notification.delay(receiver_id, notification)

        logger.info(f"[OfflineMessage] Processed message for {'offline' if not user_online else 'online'} user {receiver_id}")

    except Exception as exc:
        logger.error(f"[OfflineMessage] Task failed: {exc}")
        raise self.retry(countdown=30, exc=exc)


@celery_app.task(bind=True, max_retries=3)
def sync_user_data(self, user_id: str, data_type: str, data: Dict):
    """Sync user data across devices"""
    try:
        from app.models.models import User
        from app.services.message_queue import message_queue

        user = User.query.get(user_id)
        if not user:
            logger.warning(f"[Sync] User not found: {user_id}")
            return

        sync_message = {
            'type': 'sync_data',
            'user_id': user_id,
            'data_type': data_type,
            'data': data,
            'timestamp': datetime.utcnow().isoformat()
        }

        broadcast_to_user_devices(user_id, 'data_sync', sync_message)

        logger.info(f"[Sync] Synced {data_type} data for user {user_id}")

    except Exception as exc:
        logger.error(f"[Sync] Task failed: {exc}")
        raise self.retry(countdown=60, exc=exc)


@celery_app.task(bind=True, max_retries=3)
def send_email_notification(self, user_email: str, subject: str, body: str, template: str = None):
    """Send email notification"""
    try:
        smtp_server = "smtp.gmail.com"
        smtp_port = 587
        sender_email = "noreply@vipchat.com"
        sender_password = "your-app-password"

        message = MIMEMultipart("alternative")
        message["Subject"] = subject
        message["From"] = sender_email
        message["To"] = user_email

        text_part = MIMEText(body, "plain")
        message.attach(text_part)

        if template:
            html_body = render_email_template(template, {'body': body})
            html_part = MIMEText(html_body, "html")
            message.attach(html_part)

        with smtplib.SMTP(smtp_server, smtp_port) as server:
            server.starttls()
            server.login(sender_email, sender_password)
            server.send_message(message)

        logger.info(f"[Email] Sent notification to {user_email}")

    except Exception as exc:
        logger.error(f"[Email] Task failed: {exc}")
        raise self.retry(countdown=300, exc=exc)


@celery_app.task(bind=True)
def cleanup_expired_data(self):
    """Cleanup expired data (run periodically)"""
    try:
        from app.models.models import db, Message, CallHistory
        from app.services.message_queue import message_queue

        old_message_threshold = datetime.utcnow() - timedelta(days=365)
        old_messages = Message.query.filter(
            Message.timestamp < old_message_threshold,
            Message.is_deleted_sender == True,
            Message.is_deleted_receiver == True
        ).all()

        for message in old_messages:
            db.session.delete(message)

        old_call_threshold = datetime.utcnow() - timedelta(days=90)
        CallHistory.query.filter(
            CallHistory.timestamp < old_call_threshold
        ).delete()

        offline_keys = message_queue.redis_client.keys("offline_queue:*")
        for key in offline_keys:
            user_id = key.split(":")[1]
            message_queue.cleanup_expired_offline_messages(user_id)

        db.session.commit()

        logger.info(f"[Cleanup] Deleted {len(old_messages)} old messages and cleaned offline queues")

    except Exception as exc:
        logger.error(f"[Cleanup] Task failed: {exc}")
        raise


@celery_app.task(bind=True, max_retries=3)
def process_media_upload(self, file_path: str, media_type: str, user_id: str):
    """Process uploaded media files"""
    try:
        import os
        from PIL import Image
        import subprocess

        if media_type.startswith('image/'):
            generate_image_thumbnail(file_path)
        elif media_type.startswith('video/'):
            generate_video_thumbnail(file_path)

        if media_type in ['image/jpeg', 'image/png']:
            compress_image(file_path)

        logger.info(f"[Media] Processed {media_type} file: {file_path}")

    except Exception as exc:
        logger.error(f"[Media] Processing failed: {exc}")
        raise self.retry(countdown=60, exc=exc)


@celery_app.task(bind=True)
def generate_analytics_report(self, report_type: str, date_range: Dict):
    """Generate analytics reports"""
    try:
        from app.models.models import Message, User, CallHistory

        start_date = datetime.fromisoformat(date_range['start'])
        end_date = datetime.fromisoformat(date_range['end'])

        if report_type == 'message_stats':
            total_messages = Message.query.filter(
                Message.timestamp.between(start_date, end_date)
            ).count()

        elif report_type == 'user_activity':
            active_users = User.query.filter(
                User.last_seen.between(start_date, end_date)
            ).count()

        logger.info(f"[Analytics] Generated {report_type} report for {date_range}")

    except Exception as exc:
        logger.error(f"[Analytics] Report generation failed: {exc}")
        raise


def check_user_online_status(user_id: str) -> bool:
    """Check if user is currently online"""
    return False


def broadcast_to_user_devices(user_id: str, event: str, data: Dict):
    """Broadcast message to all user's connected devices"""
    pass


def render_email_template(template_name: str, context: Dict) -> str:
    """Render email template with context"""
    templates = {
        'notification': '''
        <html>
        <body>
            <h2>VipChat Notification</h2>
            <p>{body}</p>
            <p>Best regards,<br>VipChat Team</p>
        </body>
        </html>
        '''
    }

    template = templates.get(template_name, templates['notification'])
    return template.format(**context)


def generate_image_thumbnail(file_path: str):
    """Generate thumbnail for image"""
    try:
        from PIL import Image

        with Image.open(file_path) as img:
            img.thumbnail((200, 200), Image.Resampling.LANCZOS)
            thumb_path = file_path.replace('.', '_thumb.')
            img.save(thumb_path, optimize=True, quality=85)

    except Exception as e:
        logger.error(f"[Thumbnail] Failed to generate image thumbnail: {e}")


def generate_video_thumbnail(file_path: str):
    """Generate thumbnail for video"""
    try:
        import subprocess

        thumb_path = file_path.replace('.mp4', '_thumb.jpg')

        subprocess.run([
            'ffmpeg', '-i', file_path,
            '-vframes', '1',
            '-an', '-s', '200x200',
            '-y', thumb_path
        ], check=True, capture_output=True)

    except Exception as e:
        logger.error(f"[Thumbnail] Failed to generate video thumbnail: {e}")


def compress_image(file_path: str):
    """Compress image file"""
    try:
        from PIL import Image

        with Image.open(file_path) as img:
            img.save(file_path, optimize=True, quality=85)

    except Exception as e:
        logger.error(f"[Compress] Failed to compress image: {e}")


from celery.schedules import crontab

celery_app.conf.beat_schedule = {
    'cleanup-expired-data': {
        'task': 'vipchat.cleanup_expired_data',
        'schedule': crontab(hour=2, minute=0),
    },
    'generate-daily-analytics': {
        'task': 'vipchat.generate_analytics_report',
        'schedule': crontab(hour=1, minute=0),
        'args': ('daily_stats', {
            'start': (datetime.utcnow() - timedelta(days=1)).isoformat(),
            'end': datetime.utcnow().isoformat()
        })
    },
}

celery_app.conf.timezone = 'UTC'

logger.info("[Celery] Background tasks loaded")

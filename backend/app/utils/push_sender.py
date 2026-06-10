"""Send push notifications to all subscribed devices (web push + Expo push)."""
import json
import logging
import threading
from app.utils.vapid_keys import get_vapid_keys

logger = logging.getLogger(__name__)
VAPID_SUB = 'mailto:support@vipchat.app'


def _send_expo_push(tokens, title, body, data=None):
    """Fire-and-forget Expo push notifications in a background thread."""
    if not tokens:
        return
    try:
        import urllib.request
        payload = json.dumps({
            'to': tokens,
            'title': title,
            'body': body,
            'sound': 'default',
            'badge': 1,
            'channelId': 'vipchat-messages',
            'data': data or {},
        }).encode('utf-8')
        req = urllib.request.Request(
            'https://exp.host/--/api/v2/push/send',
            data=payload,
            headers={
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Accept-Encoding': 'gzip, deflate',
            },
            method='POST',
        )
        with urllib.request.urlopen(req, timeout=8) as resp:
            result = json.loads(resp.read())
            logger.debug(f'Expo push result: {result}')
    except Exception as exc:
        logger.debug(f'Expo push error: {exc}')


def push_to_user(user_id, title, body, icon='/logo192.png', url='/', extra=None):
    """
    Fire-and-forget push to all of a user's subscribed endpoints.
    Handles both Web Push (VAPID) and Expo push tokens.
    Runs the actual sends in a daemon thread so it never blocks request handling.
    """
    def _send():
        try:
            from app.models.models import PushSubscription, UserSettings, db

            # Ghost notifications: hide sender/content for privacy
            try:
                s = UserSettings.query.filter_by(user_id=str(user_id)).first()
                if s and getattr(s, 'ghost_notifications', False):
                    title = 'VipChat'
                    body  = 'You have a new message'
            except Exception:
                pass

            subs = PushSubscription.query.filter_by(user_id=str(user_id), active=True).all()
            if not subs:
                return

            expo_tokens = []
            web_subs = []
            for sub in subs:
                if sub.endpoint and sub.endpoint.startswith('ExponentPushToken'):
                    expo_tokens.append(sub.endpoint)
                elif sub.auth == 'expo':
                    # Token stored without ExponentPushToken prefix
                    expo_tokens.append(sub.endpoint)
                else:
                    web_subs.append(sub)

            # --- Expo push ---
            if expo_tokens:
                _send_expo_push(expo_tokens, title, body, data={
                    'url': url, 'type': (extra or {}).get('type', 'message'),
                    **(extra or {}),
                })

            # --- Web push (VAPID) ---
            if web_subs:
                try:
                    from pywebpush import webpush, WebPushException
                    private_key, _ = get_vapid_keys()
                    msg_data = json.dumps({
                        'title': title, 'body': body, 'icon': icon, 'url': url,
                        **(extra or {}),
                    })
                    for sub in web_subs:
                        try:
                            webpush(
                                subscription_info={
                                    'endpoint': sub.endpoint,
                                    'keys': {'p256dh': sub.p256dh, 'auth': sub.auth},
                                },
                                data=msg_data,
                                vapid_private_key=private_key,
                                vapid_claims={'sub': VAPID_SUB},
                            )
                        except WebPushException as exc:
                            if exc.response and exc.response.status_code in (404, 410):
                                sub.active = False
                                try:
                                    db.session.commit()
                                except Exception:
                                    db.session.rollback()
                            else:
                                logger.debug(f'Web push failed for sub {sub.id}: {exc}')
                except Exception as exc:
                    logger.debug(f'Web push block error: {exc}')

        except Exception as exc:
            logger.debug(f'push_to_user background error: {exc}')

    t = threading.Thread(target=_send, daemon=True)
    t.start()

"""Send Web Push notifications to subscribed devices."""
import json
import logging
from app.utils.vapid_keys import get_vapid_keys

logger = logging.getLogger(__name__)
VAPID_SUB = 'mailto:support@bitese.app'


def push_to_user(user_id, title, body, icon='/logo192.png', url='/'):
    """Fire-and-forget push to all of a user's subscribed endpoints."""
    try:
        from pywebpush import webpush, WebPushException
        from app.models.models import PushSubscription, db

        private_key, _ = get_vapid_keys()
        subs = PushSubscription.query.filter_by(user_id=str(user_id), active=True).all()

        for sub in subs:
            try:
                webpush(
                    subscription_info={
                        'endpoint': sub.endpoint,
                        'keys': {'p256dh': sub.p256dh, 'auth': sub.auth},
                    },
                    data=json.dumps({'title': title, 'body': body, 'icon': icon, 'url': url}),
                    vapid_private_key=private_key,
                    vapid_claims={'sub': VAPID_SUB},
                )
            except WebPushException as exc:
                if exc.response and exc.response.status_code in (404, 410):
                    sub.active = False
                    db.session.commit()
                else:
                    logger.debug(f'Push failed for sub {sub.id}: {exc}')
    except Exception as exc:
        logger.debug(f'push_to_user error: {exc}')

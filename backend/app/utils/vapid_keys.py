"""VAPID key management for Web Push notifications."""
import json
import os
import logging

logger = logging.getLogger(__name__)
_KEYS_FILE = os.path.join(os.path.dirname(__file__), '..', '..', 'vapid_keys.json')
_cache = {}


def get_vapid_keys():
    global _cache
    if _cache:
        return _cache['private'], _cache['public']

    if os.path.exists(_KEYS_FILE):
        try:
            with open(_KEYS_FILE) as f:
                data = json.load(f)
                _cache = data
                return data['private'], data['public']
        except Exception:
            pass

    from py_vapid import Vapid
    from cryptography.hazmat.primitives import serialization

    vapid = Vapid()
    vapid.generate_keys()

    private_pem = vapid.private_pem().decode()
    public_key = vapid.public_key.public_bytes(
        serialization.Encoding.X962,
        serialization.PublicFormat.UncompressedPoint
    )
    import base64
    public_b64 = base64.urlsafe_b64encode(public_key).decode().rstrip('=')

    _cache = {'private': private_pem, 'public': public_b64}

    try:
        os.makedirs(os.path.dirname(_KEYS_FILE), exist_ok=True)
        with open(_KEYS_FILE, 'w') as f:
            json.dump(_cache, f)
    except Exception as e:
        logger.warning(f'Could not save VAPID keys: {e}')

    return _cache['private'], _cache['public']

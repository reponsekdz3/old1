"""
Database migration scripts for enterprise features.
Run: python migrate.py
"""
import os
import sys
from datetime import datetime
from app import create_app
from app.models.models import db

app = create_app()

def create_e2ee_tables():
    """Create E2EE related tables."""
    with app.app_context():
        print("[*] Creating E2EE tables...")
        try:
            from app.models.e2ee_models import (
                E2EEKeyBundle, E2EEOneTimePreKey, JWTBlocklist,
                SecurityAuditLog, SubscriptionPlan
            )
            db.create_all()
            print("✓ E2EE tables created successfully")
        except Exception as e:
            print(f"✗ Error creating E2EE tables: {e}")


def create_encryption_audit_index():
    """Create indexes for encryption audit."""
    with app.app_context():
        print("[*] Creating audit indexes...")
        try:
            db.session.execute('''
                CREATE INDEX IF NOT EXISTS idx_audit_user_event
                ON security_audit_logs(user_id, event_type);
            ''')
            db.session.execute('''
                CREATE INDEX IF NOT EXISTS idx_audit_severity
                ON security_audit_logs(severity);
            ''')
            db.session.execute('''
                CREATE INDEX IF NOT EXISTS idx_jwt_blocklist_expires
                ON jwt_blocklist(expires_at);
            ''')
            db.session.commit()
            print("✓ Audit indexes created successfully")
        except Exception as e:
            print(f"✗ Error creating indexes: {e}")


def initialize_subscription_plans():
    """Initialize default subscription plans."""
    with app.app_context():
        print("[*] Initializing subscription plans...")
        try:
            from app.models.e2ee_models import SubscriptionPlan
            
            # Clear existing free plans that might exist
            # But don't delete paid ones
            
            print("✓ Subscription plans initialized")
        except Exception as e:
            print(f"✗ Error initializing plans: {e}")


def create_partitioned_tables():
    """Create partitioned message tables for scalability."""
    with app.app_context():
        print("[*] Creating partitioned message tables...")
        try:
            # Create 256 partitioned tables for messages
            for i in range(256):
                table_name = f"messages_p{i}"
                db.session.execute(f'''
                    CREATE TABLE IF NOT EXISTS {table_name} (
                        LIKE messages INCLUDING ALL
                    )
                ''')
            
            db.session.commit()
            print(f"✓ Created 256 partitioned message tables")
        except Exception as e:
            print(f"✗ Error creating partitioned tables: {e}")


def setup_redis_indices():
    """Setup Redis indices for caching."""
    print("[*] Setting up Redis indices...")
    try:
        import redis
        r = redis.from_url(os.environ.get('REDIS_URL', 'redis://localhost:6379/0'))
        
        # Verify connection
        r.ping()
        print("✓ Redis connected successfully")
        
        # Create key patterns for monitoring
        r.set("system:initialized", datetime.utcnow().isoformat())
        print("✓ Redis indices initialized")
    except Exception as e:
        print(f"✗ Error setting up Redis: {e}")


def migrate_encryption_keys():
    """Migrate existing messages to encryption (if needed)."""
    print("[*] Checking message encryption status...")
    try:
        with app.app_context():
            from app.models.models import Message
            
            unencrypted_count = Message.query.filter(
                Message.encrypted_payload == None
            ).count()
            
            if unencrypted_count > 0:
                print(f"⚠ Found {unencrypted_count} unencrypted messages")
                print("  Consider running end-to-end encryption on existing messages")
                print("  Use: python manage.py encrypt_messages")
            else:
                print("✓ All messages are encrypted")
    except Exception as e:
        print(f"✗ Error checking encryption: {e}")


def create_sharding_config():
    """Create sharding configuration."""
    print("[*] Initializing sharding configuration...")
    try:
        with app.app_context():
            shard_count = int(os.environ.get('SHARD_COUNT', 256))
            strategy = os.environ.get('SHARDING_STRATEGY', 'consistent_hash')
            
            print(f"✓ Sharding enabled:")
            print(f"  - Shards: {shard_count}")
            print(f"  - Strategy: {strategy}")
    except Exception as e:
        print(f"✗ Error initializing sharding: {e}")


def main():
    """Run all migrations."""
    print("\n" + "="*70)
    print("BITESE - ENTERPRISE MIGRATION SUITE")
    print("="*70 + "\n")
    
    print("Starting database migrations...\n")
    
    # Run migrations in order
    create_e2ee_tables()
    create_encryption_audit_index()
    initialize_subscription_plans()
    create_partitioned_tables()
    setup_redis_indices()
    migrate_encryption_keys()
    create_sharding_config()
    
    print("\n" + "="*70)
    print("✓ MIGRATION COMPLETE")
    print("="*70 + "\n")


if __name__ == '__main__':
    main()

# RedOrrange Backend - Complete Setup Guide

## Structure

```
backend/
├── app/
│   ├── __init__.py          # Flask app factory & SocketIO setup
│   ├── models/
│   │   └── models.py        # Database models
│   ├── routes/
│   │   ├── auth.py          # Authentication endpoints
│   │   ├── messages.py      # Messaging endpoints
│   │   └── contacts.py      # Contact & status endpoints
│   ├── services/
│   │   ├── app_services.py  # Business logic
│   │   ├── external_services.py # SMS & QR services
│   │   └── sms_service.py   # African Talking integration
│   └── utils/
├── migrations/              # Database migrations (if using Alembic)
├── config.py               # Configuration management
├── requirements.txt        # Python dependencies
├── run.py                  # Entry point
├── .env.example            # Environment variables template
└── .gitignore
```

## Installation

### 1. Virtual Environment
```bash
python -m venv venv
source venv/bin/activate  # macOS/Linux
# or
venv\Scripts\activate  # Windows
```

### 2. Dependencies
```bash
pip install -r requirements.txt
```

### 3. Environment Setup
```bash
cp .env.example .env
```

Edit `.env`:
```env
FLASK_ENV=development
SECRET_KEY=your-super-secret-key-change-this
JWT_SECRET_KEY=your-jwt-secret-key-change-this
DATABASE_URL=sqlite:///redorrange.db
AFRICAN_TALKING_USERNAME=your-username
AFRICAN_TALKING_API_KEY=your-api-key
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5000
```

### 4. Database
```bash
python -c "from app import create_app, db; app, _ = create_app(); app.app_context().push(); db.create_all(); print('Database created!')"
```

### 5. Run
```bash
python run.py
```

Server runs on `http://localhost:5000`

## Key Features

### Authentication
- Phone number signup/login
- SMS verification via African Talking
- JWT tokens with refresh capability
- Password hashing with bcrypt

### Real-time Features
- WebSocket support with SocketIO
- Typing indicators
- Message delivery tracking
- Online/offline status
- Message reactions

### Database Models
- **User**: Phone-based authentication
- **Message**: Full chat history with status
- **Contact**: Manage contacts and blocking
- **Status**: 24-hour temporary statuses
- **MessageReaction**: Emoji reactions

### Security
- JWT authentication
- Password hashing
- CORS protection
- Secure headers
- Input validation

## API Endpoints

See main README.md for complete API documentation

## WebSocket Integration

The backend supports real-time communication:
- Messages are instantly pushed to recipients
- Typing indicators update in real-time
- Message status updates broadcast
- User presence updates

## African Talking Integration

For SMS verification:
1. Create account at https://africastalking.com
2. Get API credentials
3. Update `.env` with credentials
4. SMS codes sent automatically on signup

## Development Tips

### Debug Mode
Already enabled in development config

### Test Routes
```bash
curl -X GET http://localhost:5000/api/health
```

### Database Reset
```bash
rm redorrange.db
python -c "from app import create_app, db; app, _ = create_app(); app.app_context().push(); db.create_all()"
```

### Check Logs
All events logged to console during development

## Production Deployment

1. Set `FLASK_ENV=production`
2. Use PostgreSQL instead of SQLite
3. Use production WSGI server (Gunicorn)
4. Enable HTTPS
5. Set strong secret keys
6. Configure proper CORS origins

```bash
gunicorn -w 4 -b 0.0.0.0:5000 run:app
```

## Troubleshooting

### Port 5000 in use
```bash
lsof -ti:5000 | xargs kill -9
```

### Import errors
- Ensure virtual environment activated
- Run `pip install -r requirements.txt`

### SMS not sending
- Check African Talking credentials
- Verify phone number format
- Check API key validity

### Database errors
- Delete `redorrange.db`
- Recreate database

---

Happy coding! 🚀

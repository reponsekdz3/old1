# RedOrrange - WhatsApp-like Real-time Messaging App

A fully functional, real-time messaging application built with Flask (backend) and React (frontend) with enterprise-grade security features.

## 🚀 Features

### Core Messaging
- ✅ Real-time chat with WebSocket support
- ✅ Message status tracking (sent, delivered, read)
- ✅ Message reactions with emojis
- ✅ Message editing and deletion
- ✅ Reply to specific messages
- ✅ Typing indicators

### User Management
- ✅ Phone number-based signup/login
- ✅ SMS verification with African Talking API
- ✅ QR code generation for easy contact addition
- ✅ User profiles and status updates
- ✅ Contact management
- ✅ Block/unblock contacts

### Status Features
- ✅ Create time-limited statuses (24-hour expiration)
- ✅ Media support in statuses
- ✅ View tracking for statuses

### Security
- ✅ JWT-based authentication
- ✅ Password hashing with bcrypt
- ✅ CORS protection
- ✅ Secure session management
- ✅ Rate limiting ready
- ✅ HTTPS/SSL ready

## 🛠️ Tech Stack

### Backend
- **Framework**: Flask 3.0.0
- **Database**: PostgreSQL (SQLite for development)
- **Real-time**: Flask-SocketIO
- **Authentication**: Flask-JWT-Extended
- **SMS**: African Talking API
- **QR Codes**: qrcode library

### Frontend
- **Framework**: React 18.2.0
- **Routing**: React Router v6
- **HTTP Client**: Axios
- **Real-time**: Socket.IO
- **State Management**: Zustand
- **UI**: Tailwind CSS
- **Notifications**: React Hot Toast

## 📋 Prerequisites

- Python 3.8+
- Node.js 14+
- PostgreSQL (optional, SQLite works for development)
- African Talking account (for SMS verification)

## 🚀 Quick Start

### 1. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows
venv\Scripts\activate
# macOS/Linux
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
cp .env.example .env

# Configure .env with your settings
# - DATABASE_URL (PostgreSQL connection string)
# - AFRICAN_TALKING_USERNAME and API_KEY
# - JWT_SECRET_KEY
# - SECRET_KEY
```

**Update `.env` file:**
```env
FLASK_ENV=development
SECRET_KEY=your-secret-key-here
JWT_SECRET_KEY=your-jwt-secret-key
DATABASE_URL=sqlite:///redorrange.db  # or PostgreSQL URL
AFRICAN_TALKING_USERNAME=your-username
AFRICAN_TALKING_API_KEY=your-api-key
ALLOWED_ORIGINS=http://localhost:3000
```

**Initialize database:**
```bash
python
from app import create_app, db
app, _ = create_app()
with app.app_context():
    db.create_all()
exit()
```

**Run backend:**
```bash
python run.py
```

Backend runs on `http://localhost:5000`

### 2. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Create .env file
echo "REACT_APP_API_URL=http://localhost:5000/api" > .env
echo "REACT_APP_SOCKET_URL=http://localhost:5000" >> .env

# Start development server
npm start
```

Frontend runs on `http://localhost:3000`

## 📚 API Documentation

### Authentication Endpoints

#### Send Verification SMS
```
POST /api/auth/send-verification-sms
Body: { "phone_number": "+256..." }
Response: { "message": "...", "phone_number": "..." }
```

#### Verify Code
```
POST /api/auth/verify-code
Body: { "phone_number": "+256...", "code": "123456" }
Response: { "message": "Code verified successfully" }
```

#### Sign Up
```
POST /api/auth/signup
Body: {
  "phone_number": "+256...",
  "full_name": "John Doe",
  "password": "password123",
  "code": "123456"
}
Response: { "user": {...}, "access_token": "...", "refresh_token": "..." }
```

#### Login
```
POST /api/auth/login
Body: { "phone_number": "+256...", "password": "password123" }
Response: { "user": {...}, "access_token": "...", "refresh_token": "..." }
```

#### Get Current User
```
GET /api/auth/user
Headers: { "Authorization": "Bearer <token>" }
Response: { "id": "...", "full_name": "...", ... }
```

### Message Endpoints

#### Send Message
```
POST /api/messages/<receiver_id>
Headers: { "Authorization": "Bearer <token>" }
Body: {
  "content": "Hello!",
  "media_url": "https://...",
  "replied_to_id": "message_id" (optional)
}
Response: { message object }
```

#### Get Chat History
```
GET /api/messages/chat/<user_id>?limit=50
Headers: { "Authorization": "Bearer <token>" }
Response: { "messages": [...] }
```

#### Mark as Read
```
PUT /api/messages/<message_id>/read
Headers: { "Authorization": "Bearer <token>" }
```

#### Add Reaction
```
POST /api/messages/<message_id>/react
Headers: { "Authorization": "Bearer <token>" }
Body: { "emoji": "👍" }
```

#### Remove Reaction
```
DELETE /api/messages/<message_id>/reactions/<emoji>
Headers: { "Authorization": "Bearer <token>" }
```

### Contact Endpoints

#### Get All Contacts
```
GET /api/contacts
Headers: { "Authorization": "Bearer <token>" }
Response: { "contacts": [...] }
```

#### Add Contact
```
POST /api/contacts
Headers: { "Authorization": "Bearer <token>" }
Body: {
  "phone_number": "+256...",
  "contact_name": "John Doe"
}
```

#### Block Contact
```
PUT /api/contacts/<contact_id>/block
Headers: { "Authorization": "Bearer <token>" }
```

### Status Endpoints

#### Create Status
```
POST /api/status
Headers: { "Authorization": "Bearer <token>" }
Body: {
  "content": "Having a great day!",
  "media_url": "https://..." (optional)
}
```

#### Get User Statuses
```
GET /api/status/<user_id>
Headers: { "Authorization": "Bearer <token>" }
```

## 🔌 WebSocket Events

### Client → Server

- `user_connect`: { "user_id": "..." }
- `message`: { "sender_id": "...", "receiver_id": "...", "content": "...", "message_id": "..." }
- `typing`: { "user_id": "...", "receiver_id": "..." }
- `stop_typing`: { "user_id": "...", "receiver_id": "..." }
- `message_read`: { "message_id": "...", "sender_id": "..." }
- `reaction`: { "message_id": "...", "user_id": "...", "emoji": "..." }
- `status_update`: { "user_id": "...", "status": "available|away|offline" }

### Server → Client

- `new_message`: message object
- `typing_indicator`: { "user_id": "..." }
- `stop_typing_indicator`: { "user_id": "..." }
- `delivery_confirmation`: { "message_id": "..." }
- `read_confirmation`: { "message_id": "..." }
- `reaction_added`: { "message_id": "...", "user_id": "...", "emoji": "..." }
- `user_status_changed`: { "user_id": "...", "status": "..." }

## 🔒 Security Features

### Implemented
- JWT token-based authentication
- Password hashing with bcrypt
- CORS protection
- SQL injection prevention with SQLAlchemy ORM
- XSS protection with proper escaping
- HTTPS ready
- Secure session cookies

### Recommended for Production
- Enable HTTPS/SSL
- Set strong SECRET_KEY and JWT_SECRET_KEY
- Use PostgreSQL instead of SQLite
- Implement rate limiting
- Add email verification
- Enable 2FA
- Use environment-specific configs
- Add API key rotation
- Implement request signing

## 🗄️ Database Schema

### Users
- id (UUID primary key)
- phone_number (unique)
- full_name
- email
- password_hash
- avatar_url
- bio
- status (available/away/offline)
- is_verified
- qr_code_url
- last_seen
- created_at, updated_at

### Messages
- id (UUID primary key)
- sender_id (FK to Users)
- receiver_id (FK to Users)
- content
- media_url
- status (sent/delivered/read)
- is_edited
- replied_to_id (FK to Messages)
- created_at, updated_at

### Contacts
- id (UUID primary key)
- user_id (FK to Users)
- phone_number
- contact_name
- contact_user_id (FK to Users)
- is_blocked
- created_at

### Statuses
- id (UUID primary key)
- user_id (FK to Users)
- content
- media_url
- created_at
- expires_at

## 📱 Usage Examples

### Creating a User Account
1. Click "Sign up"
2. Enter phone number
3. Receive SMS verification code
4. Enter code to verify
5. Complete signup with name and password

### Sending a Message
1. Select or add a contact
2. Type message in input field
3. Click send or press Enter
4. Message status updates in real-time

### Adding a Contact
1. Click "Add Contact"
2. Enter contact's phone number
3. Optionally set display name
4. Click "Add Contact"

### Creating a Status
1. Click profile icon
2. Click "Create Status"
3. Add text or media
4. Post status (visible for 24 hours)

## 🐛 Troubleshooting

### Port Already in Use
```bash
# Kill process on port 5000
lsof -ti:5000 | xargs kill -9  # macOS/Linux
netstat -ano | findstr :5000   # Windows
```

### Database Connection Error
- Ensure PostgreSQL is running
- Verify DATABASE_URL in .env
- Check credentials

### WebSocket Connection Failed
- Ensure backend is running
- Check ALLOWED_ORIGINS in backend config
- Verify REACT_APP_SOCKET_URL in frontend

### SMS Not Sending
- Verify African Talking credentials
- Check phone number format
- Ensure API key is valid

## 📝 Environment Variables

### Backend (.env)
```
FLASK_ENV=development
FLASK_APP=run.py
SECRET_KEY=your-secret-key
JWT_SECRET_KEY=your-jwt-secret
DATABASE_URL=sqlite:///redorrange.db
REDIS_URL=redis://localhost:6379/0
AFRICAN_TALKING_USERNAME=your-username
AFRICAN_TALKING_API_KEY=your-api-key
ALLOWED_ORIGINS=http://localhost:3000
```

### Frontend (.env)
```
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_SOCKET_URL=http://localhost:5000
```

## 🚀 Deployment

### Backend (Heroku)
```bash
# Create Procfile
echo "web: gunicorn run:app" > Procfile

# Deploy
heroku create your-app-name
heroku config:set FLASK_ENV=production
heroku addons:create heroku-postgresql:hobby-dev
git push heroku main
```

### Frontend (Vercel)
```bash
npm install -g vercel
vercel
```

## 📄 License

MIT License - feel free to use for any purpose

## 🤝 Contributing

Contributions welcome! Please fork and submit pull requests.

## 📞 Support

For issues and questions, create an issue on GitHub.

---

**RedOrrange** - Real-time messaging for everyone 🌍

# RedOrrange Frontend - Complete Setup Guide

## Structure

```
frontend/
├── public/
│   ├── index.html          # Main HTML file
│   └── manifest.json       # PWA manifest
├── src/
│   ├── App.js              # Main app component
│   ├── App.css             # App styles
│   ├── index.js            # Entry point
│   ├── index.css           # Global styles
│   ├── pages/
│   │   ├── LoginPage.js    # Login screen
│   │   ├── SignupPage.js   # Signup screen
│   │   └── ChatPage.js     # Main chat interface
│   ├── components/
│   │   ├── ChatList.js     # Contact list
│   │   ├── ChatWindow.js   # Message window
│   │   ├── SideMenu.js     # User menu & QR
│   │   ├── AddContactModal.js # Add contact form
│   │   └── EmojiPicker.js  # Emoji selection
│   └── services/
│       ├── api.js          # Axios API client
│       ├── socket.js       # Socket.IO setup
│       └── store.js        # Zustand state management
├── package.json            # Dependencies
├── tailwind.config.js      # Tailwind CSS config
├── postcss.config.js       # PostCSS config
└── .env                    # Environment variables
```

## Installation

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Setup
```bash
echo "REACT_APP_API_URL=http://localhost:5000/api" > .env
echo "REACT_APP_SOCKET_URL=http://localhost:5000" >> .env
```

### 3. Run Development Server
```bash
npm start
```

Opens on `http://localhost:3000`

## Available Scripts

### `npm start`
Runs the app in development mode

### `npm build`
Builds the app for production

### `npm test`
Launches the test runner

## Key Features

### Pages
1. **LoginPage**: Phone-based login
2. **SignupPage**: 3-step signup with SMS verification
3. **ChatPage**: Main chat interface with contacts

### Components
1. **ChatList**: Browse and search contacts
2. **ChatWindow**: Send/receive messages with reactions
3. **SideMenu**: User profile and QR code
4. **AddContactModal**: Add new contacts
5. **EmojiPicker**: Quick emoji selection

### Services
1. **api.js**: Axios HTTP client with JWT handling
2. **socket.js**: WebSocket connection management
3. **store.js**: Zustand state management for auth, chat, status

## State Management (Zustand)

### useAuthStore
```javascript
import { useAuthStore } from './services/store';
const { user, isAuthenticated, setUser, logout } = useAuthStore();
```

### useChatStore
```javascript
import { useChatStore } from './services/store';
const { messages, activeChat, contacts } = useChatStore();
```

### useStatusStore
```javascript
import { useStatusStore } from './services/store';
const { statuses, myStatus } = useStatusStore();
```

## Component Examples

### Using API
```javascript
import api from '../services/api';

const response = await api.get('/auth/user');
```

### Using Socket
```javascript
import { initializeSocket } from '../services/socket';

const socket = initializeSocket(userId);
socket.emit('message', { ... });
socket.on('new_message', (data) => { ... });
```

### Using Store
```javascript
import { useAuthStore } from '../services/store';

const { user, setUser } = useAuthStore();
setUser(userData);
```

## Styling

### Tailwind CSS
Pre-configured with custom colors:
- Primary: Green (#10b981 to #4ade80)
- Secondary: Blue (#3b82f6)

### Custom CSS
- Animations in `index.css`
- Message entrance animation
- Typing indicator animation
- Scrollbar styling

## Development Features

### Hot Reload
Changes automatically reload in browser

### Redux DevTools Compatible
Zustand state easily inspectable

### Error Handling
- Toast notifications for errors
- Graceful error messages
- Auto-redirect on auth failure

## Production Build

```bash
npm run build
```

Creates optimized build in `build/` folder

### Deployment

#### Vercel
```bash
npm install -g vercel
vercel
```

#### Netlify
```bash
npm install -g netlify-cli
netlify deploy --prod --dir=build
```

#### Traditional Server
```bash
npm run build
# Upload 'build' folder to web server
```

## Environment Variables

```env
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_SOCKET_URL=http://localhost:5000
```

## Performance Optimization

### Code Splitting
React Router automatically code-splits pages

### Image Optimization
Use Avatar gradients instead of images (lighter)

### State Optimization
Zustand selectors prevent unnecessary re-renders

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Common Issues

### CORS Errors
- Backend ALLOWED_ORIGINS includes frontend URL
- Check backend is running

### WebSocket Connection Failed
- Ensure backend running on port 5000
- Check REACT_APP_SOCKET_URL is correct
- Check browser console for errors

### Blank Screen
- Check React app mounted in public/index.html
- Verify all dependencies installed
- Clear cache: `npm cache clean --force`

### Token Not Persisting
- Ensure localStorage not disabled
- Check developer tools Application tab

## Debugging

### Redux DevTools
Install extension for state inspection

### React DevTools
Install extension for component inspection

### Network Tab
Monitor API calls and WebSocket connections

### Console
Check for JavaScript errors

## Keyboard Shortcuts

- Enter: Send message
- Shift+Enter: New line
- Escape: Close modals

## Future Enhancements

- Voice/video calls (WebRTC)
- File sharing
- Message search
- Group chats
- Read receipts
- Last seen timestamps
- Custom themes
- Notifications
- Dark mode

---

Happy developing! 🚀

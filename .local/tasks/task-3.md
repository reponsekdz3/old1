---
title: WhatsApp-style marketplace with inline chat commerce
---
# WhatsApp-Style In-App Marketplace with Inline Chat Commerce

## What & Why
Build a full-featured, real marketplace directly inside the messaging app — like WhatsApp Marketplace/Shops meets Facebook Marketplace. Sellers list products/services, buyers browse, and commerce happens via inline chat (buyer taps "Buy" → chat opens with seller, payment can happen in-chat). Includes real product listings, categories, search, seller profiles, product image uploads, in-chat "Buy Now" card messages, order management, and Stripe/Flutterwave payment for purchases. All data stored in PostgreSQL.

## Done looks like
- A "Marketplace" tab in the main navigation sidebar (between Chats and Status)
- Sellers can create a shop profile and list products with images, price, description, category, stock count
- Product images upload to the server (using existing upload infrastructure)
- Buyers can browse by category, search products, view product detail pages
- Each product has an "Message Seller" button that opens a chat with an inline product card message
- In-chat product card shows image, title, price, and "Buy Now" button
- "Buy Now" in chat opens Stripe Checkout or Flutterwave modal for real payment
- Orders stored in DB (`orders` table) with status: pending → paid → shipped → delivered
- Sellers see an "Orders" dashboard with pending/shipped/delivered orders
- Buyers see their purchase history in their profile
- Marketplace listings show verified badge on seller's name if they are verified
- Real-time "new order" notification via Socket.IO to seller when a purchase is made
- Product categories: Electronics, Clothing, Food, Services, Digital, Real Estate, Vehicles, Other
- Search works by title, description, category, seller name
- Seller shop page shows all their listings and reviews
- Basic review system: buyers leave 1-5 star rating after delivery

## Out of scope
- Physical shipping integration (sellers handle logistics manually)
- Business API monetization (Task 4)

## Steps
1. **Marketplace DB models** — Create SQLAlchemy models: `Shop` (user_id, name, description, logo_url, is_active), `Product` (shop_id, title, description, price, currency, category, stock, images JSON, is_active), `Order` (buyer_id, seller_id, product_id, quantity, amount, currency, status, stripe_payment_id, flutterwave_ref, shipping_address JSON, created_at), `OrderReview` (order_id, rating, comment, created_at).
2. **Marketplace backend routes** — Create blueprint `marketplace_bp` with full CRUD: shops (create/read/update), products (list/search/filter/create/update/delete/upload-images), orders (create/list/update-status), reviews (create/list). Include seller earnings summary endpoint.
3. **Marketplace payment endpoints** — Add Stripe Checkout Session creation for product purchase and Flutterwave initialization for product purchase. Reuse payment infrastructure from Task 2. On webhook success, update Order status to `paid` and notify seller via Socket.IO.
4. **In-chat product cards** — Add `product_card` message type to the Message model and ChatWindow renderer. When a buyer taps "Message Seller" from product page, auto-send a product card message into the conversation. Product card in chat shows product image, title, price, and "Buy Now" button.
5. **Socket.IO marketplace events** — Add `new_order`, `order_status_updated` Socket.IO events so sellers get real-time order notifications and buyers get real-time delivery updates.
6. **Marketplace tab — browse UI** — Add a "Marketplace" tab to MainNavigation. Build category grid, featured listings, search bar with real-time results. Product cards show thumbnail, title, price, seller verified badge, star rating.
7. **Product detail page** — Full product view with image gallery (carousel), full description, seller info card, stock status, "Message Seller" and "Buy Now" buttons.
8. **Seller dashboard** — A "My Shop" section in the Marketplace tab where sellers manage their shop profile, add/edit products, and see orders with status controls (mark as shipped/delivered).
9. **Buyer order history** — Order history page in user profile/settings showing past purchases with status tracking and review prompt after delivery.
10. **Marketplace Socket.IO integration in frontend** — Listen for `new_order` and `order_status_updated` events; show toast notifications to seller/buyer in real time.

## Relevant files
- `backend/app/__init__.py`
- `backend/app/models/models.py`
- `backend/app/models/community_models.py`
- `backend/app/routes/upload.py`
- `backend/app/routes/messages.py`
- `web/src/components/MainNavigation.js`
- `web/src/components/ChatWindow.js`
- `web/src/components/ChatsTab.js`
- `web/src/pages/ChatPage.js`
- `web/src/services/api.js`
- `web/src/services/socket.js`
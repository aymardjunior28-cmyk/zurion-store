# ZURION Store — E-Commerce MVP

**Full-stack e-commerce application** for ZURION fashion stores with complete backend API and responsive frontend.

## Architecture Overview

**ZURION Store** is a professional e-commerce platform with:
- **Backend** : Express.js REST API with Sequelize ORM
- **Frontend** : Responsive HTML5/Bootstrap with client-side state management
- **Database** : SQLite (development) / PostgreSQL (production)
- **Authentication** : JWT tokens with secure password hashing (bcryptjs)
- **Security** : Helmet, rate-limiting, input validation

---

## ⚡ Quick Start

### Prerequisites
- Node.js ≥ 20
- npm ≥ 10

### Installation

```bash
# 1. Install dependencies
npm install

# 2. Create and configure environment file
cp .env.example .env
# Edit .env if needed (defaults work for development)

# 3. Start the server
npm start
# OR for development with auto-reload:
npm run dev
```

**Application runs on**: `http://localhost:4173`

---

## 📋 Features

### ✅ Core E-Commerce Functionality

#### 4.1 Homepage (Accueil)
- Professional header with navigation
- Category menu
- Featured products and promotions
- Product carousel
- Trust badges and testimonials
- Complete footer

#### 4.2 Product Catalog (Catalogue)
- List all products with pagination
- Filter by category
- Search functionality
- Product sorting
- Stock availability display
- Responsive grid layout

#### 4.3 Product Detail (Fiche Produit)
- High-quality product images
- Product name, price, old price
- Detailed description
- Technical specifications
- Quantity selector
- Add to cart button
- Add to wishlist button
- Customer reviews and ratings (1-5 stars)
- Related products

#### 4.4 Shopping Cart (Panier)
- View cart items
- Modify item quantities
- Remove items
- Persistent cart storage
- Subtotal and total calculations
- Guest cart support

#### 4.5 Checkout (Commande)
- User registration/login
- Delivery address selection/input
- Delivery method selection
- Order summary
- Simulated payment
- Order confirmation

#### 4.6 Customer Dashboard (Espace Client)
- User profile
- Order history
- Address management
- Wishlist/favorites
- Account settings
- Edit profile information

#### 4.7 Order Tracking (Suivi Commande)
- 6 order statuses: Pending, Processing, Shipped, In Transit, Delivered, Cancelled
- Timeline visualization
- Status updates
- Tracking information

#### 4.8 Admin Backend (Back-office)
- Dashboard with statistics
- Product CRUD (Create, Read, Update, Delete)
- Stock management
- Category management
- Order management and status updates
- User consultation

---

## 🔐 Security Features

- **Helmet.js** - HTTP security headers
- **bcryptjs** - Secure password hashing
- **JSON Web Tokens (JWT)** - Stateless authentication
- **express-validator** - Server-side input validation
- **express-rate-limit** - DDoS and brute-force protection
- **Cookie-based sessions** - Secure session management

---

## 📊 Database Models

```
User           - Authentication and profile
Product        - Product information
Category       - Product categorization
Cart/CartItem  - Shopping cart
Order/OrderItem - Order management
Address        - Shipping addresses
Wishlist       - Favorite products
ProductImage   - Product photos
ProductSpec    - Technical specifications
Review         - Customer ratings & comments
```

---

## 🛣️ API Routes

### Authentication
- `POST /auth/register` - User registration
- `POST /auth/login` - User login
- `POST /auth/logout` - User logout
- `GET /auth/me` - Current user profile

### Products & Categories
- `GET /categories` - List all categories
- `GET /products` - List products (with filters)
- `GET /products/:slug` - Product details
- `GET /suggestions` - Product recommendations

### Shopping Cart
- `GET /cart` - View cart
- `POST /cart/items` - Add to cart
- `PUT /cart/items/:productId` - Update quantity
- `DELETE /cart/items/:productId` - Remove from cart

### Orders
- `POST /orders` - Create order
- `GET /orders` - List user orders
- `GET /orders/:reference` - Order details

### Wishlist
- `GET /wishlist` - View favorites
- `POST /wishlist` - Add to wishlist
- `DELETE /wishlist/:productId` - Remove from wishlist

### Reviews
- `POST /products/:slug/reviews` - Add review (authenticated)

### Admin
- `GET /admin/stats` - Dashboard statistics
- `GET/POST/PUT/DELETE /admin/products` - Product management
- `GET/POST/PUT/DELETE /admin/categories` - Category management
- `GET /admin/orders` - Order management
- `GET /admin/users` - User consultation

---

## 📁 Project Structure

```
zurion-store/
├── src/
│   ├── app.js                 # Express app configuration
│   ├── server.js              # Entry point
│   ├── config/
│   │   ├── db.js              # Database connection
│   │   └── env.js             # Environment variables
│   ├── controllers/           # Business logic
│   │   ├── auth.controller.js
│   │   ├── catalog.controller.js
│   │   ├── cart.controller.js
│   │   ├── order.controller.js
│   │   ├── wishlist.controller.js
│   │   └── admin.controller.js
│   ├── models/                # Sequelize ORM models
│   ├── routes/                # API routes
│   ├── middlewares/           # Express middlewares
│   └── utils/                 # Utility functions
├── views/                     # EJS templates
├── assets/                    # Frontend assets
│   ├── css/                   # Stylesheets
│   ├── js/                    # Client-side JavaScript
│   └── images/                # Images
├── data/                      # SQLite database (development)
├── .env                       # Environment configuration
├── .env.example               # Environment template
├── package.json               # Dependencies
└── README.md                  # This file
```

---

## 🚀 Development

### Running in Development Mode
```bash
npm run dev
# Automatically restarts server on file changes
```

### Running Tests
```bash
npm test
```

### Database Seeding
```bash
npm run seed
# Populates database with sample data
```

---

## 🛠️ Environment Variables

Configure `.env` file with:

```env
# Node environment
NODE_ENV=development
PORT=4173

# Database (SQLite for dev, PostgreSQL for prod)
DATABASE_URL=sqlite://./data/zurion.sqlite

# Authentication
JWT_SECRET=your_secret_key_here

# Session
COOKIE_NAME=zurion_session
SESSION_MAX_AGE_DAYS=30

# Rate limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=200
```

See `.env.example` for all available options.

---

## 📱 Responsive Design

ZURION Store is fully responsive:
- **Mobile** (320px and up)
- **Tablet** (768px and up)
- **Desktop** (1024px and up)
- **Large Desktop** (1440px and up)

All pages are tested and optimized for each breakpoint.

---

## 🔒 Authentication Flow

1. User registers with email and password
2. Password hashed with bcryptjs
3. JWT token generated and stored in cookie
4. Protected routes check authentication
5. Token expires based on SESSION_MAX_AGE_DAYS
6. User can logout to clear session

---

## 🧪 Testing

### Manual Testing Checklist
- [ ] User registration and login
- [ ] Browse products and categories
- [ ] Search functionality
- [ ] Add/remove items from cart
- [ ] Modify cart quantities
- [ ] Complete checkout flow
- [ ] View order history
- [ ] Add items to wishlist
- [ ] Write product reviews
- [ ] Admin dashboard access
- [ ] Mobile responsiveness
- [ ] Cross-browser compatibility

---

## 📦 Dependencies

### Production
- **express** 4.19.2 - Web framework
- **sequelize** 6.37.3 - ORM
- **sqlite3** 5.1.7 - SQLite driver
- **pg** 8.11.3 - PostgreSQL driver
- **bcryptjs** 2.4.3 - Password hashing
- **jsonwebtoken** 9.0.3 - JWT tokens
- **helmet** 7.1.0 - Security headers
- **express-rate-limit** 7.4.0 - Rate limiting
- **express-validator** 7.2.0 - Input validation
- **cookie-parser** 1.4.6 - Cookie parsing
- **ejs** 3.1.10 - Template engine
- **dotenv** 16.4.5 - Environment variables

### Development
- **supertest** - HTTP assertions

---

## 📋 Git Commit History

This project maintains a clean, organized commit history showing progressive feature development:

```bash
git log --oneline
# Shows all commits organized by feature
```

Each commit represents a logical unit of work:
- Architecture setup
- Feature implementation
- Bug fixes and improvements
- Testing and QA

---

## 🐛 Known Issues & Fixes

All identified bugs have been documented and fixed during development.
See the project commit history for details on fixes.

---

## 📞 Support

For questions or issues, refer to:
- Project documentation
- Code comments
- API documentation in code

---

## 📄 License

All rights reserved © 2026 ZURION Store

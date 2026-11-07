require('dotenv').config();
const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const path = require('path');
const pool = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Setup View Engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Core Middlewares
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use('/public', express.static(path.join(__dirname, 'public')));

// Session Management
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'aegis-cyber-lab-secret-2024',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 hours
  })
);

// Global Template Locals Middleware
app.use((req, res, next) => {
  res.locals.student = req.session.student || null;
  res.locals.currentUser = req.session.currentUser || null;
  res.locals.lastQuery = null;
  res.locals.sqlError = null;
  res.locals.activePage = '';
  res.locals.searchQuery = '';
  next();
});

// Student Gate Interceptor Middleware
// Enforces that students enter their name before navigating the site
function requireStudentGate(req, res, next) {
  // Always permit static files, favicon, gate route, and gate submission
  if (
    req.path.startsWith('/public') ||
    req.path === '/favicon.ico' ||
    req.path === '/gate' ||
    req.path === '/gate/submit'
  ) {
    return next();
  }

  // Check if session has student identity
  if (req.session && req.session.student && req.session.student.name) {
    res.locals.student = req.session.student;
    return next();
  }

  // Check if persistent cookie has student identity
  if (req.cookies && req.cookies.student_identity) {
    try {
      const parsed = JSON.parse(req.cookies.student_identity);
      if (parsed && parsed.name) {
        req.session.student = parsed;
        res.locals.student = parsed;
        return next();
      }
    } catch (e) {
      // Ignore JSON parse errors on invalid cookie
    }
  }

  // Not verified yet: redirect to student gate
  const returnTo = req.originalUrl || '/';
  return res.redirect(`/gate?returnTo=${encodeURIComponent(returnTo)}`);
}

// Favicon Route
app.get('/favicon.ico', (req, res) => {
  res.setHeader('Content-Type', 'image/svg+xml');
  res.sendFile(path.join(__dirname, 'public', 'favicon.svg'));
});

app.use(requireStudentGate);

// ==============================================================
// 1. STUDENT GATE ROUTES (NAME VERIFICATION)
// ==============================================================

app.get('/gate', (req, res) => {
  res.render('gate', {
    returnTo: req.query.returnTo || '/',
    currentName: req.session.student?.name || '',
    error: null
  });
});

app.post('/gate/submit', (req, res) => {
  const { studentName, returnTo } = req.body;

  if (!studentName || !studentName.trim()) {
    return res.render('gate', {
      returnTo: returnTo || '/',
      currentName: '',
      error: 'Please enter your name to start shopping.'
    });
  }

  const studentData = {
    name: studentName.trim(),
    sessionTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  };

  req.session.student = studentData;

  // Set long-lived cookie so student name persists across browser restarts
  res.cookie('student_identity', JSON.stringify(studentData), {
    maxAge: 14 * 24 * 60 * 60 * 1000,
    httpOnly: false
  });

  const redirectUrl = returnTo && returnTo.startsWith('/') ? returnTo : '/';
  return res.redirect(redirectUrl);
});

// ==============================================================
// 2. HOME & OVERVIEW
// ==============================================================

app.get('/', async (req, res) => {
  try {
    const [featured] = await pool.query('SELECT * FROM products WHERE is_featured = 1 ORDER BY id ASC LIMIT 4');
    res.render('index', {
      featuredProducts: featured,
      activePage: 'home'
    });
  } catch (err) {
    console.error('Home page error:', err);
    res.render('index', {
      featuredProducts: [],
      activePage: 'home',
      sqlError: err.message
    });
  }
});

// ==============================================================
// 3. HARDWARE CATALOG (VULNERABLE TO UNION & BOOLEAN SQLi)
// ==============================================================

app.get('/catalog', async (req, res) => {
  const search = req.query.search ? req.query.search.trim() : '';
  const category = req.query.category ? req.query.category.trim() : '';

  // Retrieve categories safely for dropdown filter
  let categories = [];
  try {
    const [catRows] = await pool.query('SELECT * FROM categories ORDER BY name ASC');
    categories = catRows;
  } catch (e) {
    categories = [];
  }

  // INTENTIONALLY VULNERABLE SQL QUERY:
  // Concatenates user input directly without parameterization or escaping
  let sql = 'SELECT id, name, category, sku, price, stock, rating, image_url, description FROM products WHERE 1=1';

  if (category) {
    sql += ` AND category = '${category}'`;
  }

  if (search) {
    sql += ` AND (name LIKE '%${search}%' OR description LIKE '%${search}%')`;
  }

  sql += ' ORDER BY id ASC';

  try {
    const [products] = await pool.query(sql);

    res.render('catalog', {
      products,
      categories,
      searchQuery: search,
      selectedCategory: category,
      activePage: 'catalog',
      lastQuery: sql,
      sqlError: null
    });
  } catch (err) {
    // Return the database error to the template (Error-based SQLi feedback for students)
    res.render('catalog', {
      products: [],
      categories,
      searchQuery: search,
      selectedCategory: category,
      activePage: 'catalog',
      lastQuery: sql,
      sqlError: err.sqlMessage || err.message
    });
  }
});

// ==============================================================
// 4. PRODUCT DETAILS (VULNERABLE TO NUMERIC SQLi)
// ==============================================================

app.get('/product/:id', async (req, res) => {
  const rawId = req.params.id;

  // INTENTIONALLY VULNERABLE:
  // Unquoted numeric SQL injection: /product/1 OR 1=1
  const sql = `SELECT * FROM products WHERE id = ${rawId}`;

  try {
    const [rows] = await pool.query(sql);
    const product = rows.length > 0 ? rows[0] : null;

    res.render('product', {
      product,
      requestedId: rawId,
      lastQuery: sql,
      sqlError: null
    });
  } catch (err) {
    res.render('product', {
      product: null,
      requestedId: rawId,
      lastQuery: sql,
      sqlError: err.sqlMessage || err.message
    });
  }
});

// ==============================================================
// 5. ORDER TRACKING (VULNERABLE TO BOOLEAN / UNION SQLi)
// ==============================================================

app.get('/orders', (req, res) => {
  res.render('orders', {
    orders: null,
    searchedCode: '',
    activePage: 'orders',
    lastQuery: null,
    sqlError: null
  });
});

app.get('/orders/track', async (req, res) => {
  const code = req.query.code ? req.query.code.trim() : '';

  if (!code) {
    return res.redirect('/orders');
  }

  // INTENTIONALLY VULNERABLE: Direct string concatenation
  // Allows ' OR 1=1 -- to dump all client orders and sensitive notes
  const sql = `SELECT id, tracking_number, customer_name, customer_email, total_amount, status, destination, notes, created_at FROM orders WHERE tracking_number = '${code}'`;

  try {
    const [orders] = await pool.query(sql);

    res.render('orders', {
      orders,
      searchedCode: code,
      activePage: 'orders',
      lastQuery: sql,
      sqlError: null
    });
  } catch (err) {
    res.render('orders', {
      orders: [],
      searchedCode: code,
      activePage: 'orders',
      lastQuery: sql,
      sqlError: err.sqlMessage || err.message
    });
  }
});

// ==============================================================
// 6. STAFF AUTHENTICATION (VULNERABLE TO LOGIN BYPASS SQLi)
// ==============================================================

app.get('/login', (req, res) => {
  if (req.session.currentUser) {
    return res.redirect('/admin');
  }
  res.render('login', {
    error: null,
    attemptedUser: '',
    activePage: 'login'
  });
});

app.post('/login', async (req, res) => {
  const username = req.body.username || '';
  const password = req.body.password || '';

  // INTENTIONALLY VULNERABLE:
  // Classic SQL injection authentication bypass: admin' -- or ' OR 1=1 --
  const sql = `SELECT id, username, password, full_name, email, role, api_key FROM users WHERE username = '${username}' AND password = '${password}'`;

  try {
    const [rows] = await pool.query(sql);

    if (rows && rows.length > 0) {
      // Login successful! Save user to session
      req.session.currentUser = rows[0];
      return res.redirect('/admin');
    } else {
      return res.render('login', {
        error: 'Invalid credentials. Access denied by security controller.',
        attemptedUser: username,
        activePage: 'login',
        lastQuery: sql,
        sqlError: null
      });
    }
  } catch (err) {
    return res.render('login', {
      error: `SQL Exception: ${err.sqlMessage || err.message}`,
      attemptedUser: username,
      activePage: 'login',
      lastQuery: sql,
      sqlError: err.sqlMessage || err.message
    });
  }
});

// ==============================================================
// 7. RESTRICTED EXECUTIVE ADMIN CONSOLE
// ==============================================================

app.get('/admin', async (req, res) => {
  if (!req.session.currentUser) {
    return res.redirect('/login');
  }

  try {
    const [users] = await pool.query('SELECT id, username, password, full_name, email, role, api_key FROM users ORDER BY id ASC');
    const [prodCount] = await pool.query('SELECT COUNT(*) as total FROM products');

    res.render('admin', {
      users,
      totalProducts: prodCount[0]?.total || 0,
      activePage: 'admin'
    });
  } catch (err) {
    console.error('Admin console error:', err);
    res.redirect('/');
  }
});

app.get('/logout', (req, res) => {
  req.session.currentUser = null;
  res.redirect('/login');
});

// ==============================================================
// 8. LAB GUIDE & CHALLENGE SYLLABUS
// ==============================================================

app.get('/lab-guide', (req, res) => {
  res.render('lab-guide', {
    activePage: 'lab-guide'
  });
});

// ==============================================================
// 9. RAW JSON API ENDPOINTS (FOR SQLMAP, BURP SUITE, AUTOMATION)
// ==============================================================

// API: Catalog Search
app.get('/api/products/search', async (req, res) => {
  const q = req.query.q || '';
  const sql = `SELECT id, name, category, sku, price, stock, description FROM products WHERE name LIKE '%${q}%' OR description LIKE '%${q}%'`;

  try {
    const [rows] = await pool.query(sql);
    res.json({
      success: true,
      query: sql,
      count: rows.length,
      data: rows
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      query: sql,
      error: err.sqlMessage || err.message
    });
  }
});

// API: Authentication
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  const sql = `SELECT id, username, full_name, email, role, api_key FROM users WHERE username = '${username}' AND password = '${password}'`;

  try {
    const [rows] = await pool.query(sql);
    if (rows.length > 0) {
      res.json({
        success: true,
        authenticated: true,
        query: sql,
        user: rows[0]
      });
    } else {
      res.status(401).json({
        success: false,
        authenticated: false,
        query: sql,
        message: 'Invalid credentials'
      });
    }
  } catch (err) {
    res.status(500).json({
      success: false,
      query: sql,
      error: err.sqlMessage || err.message
    });
  }
});

// API: Order Tracking
app.get('/api/orders/lookup', async (req, res) => {
  const code = req.query.code || '';
  const sql = `SELECT * FROM orders WHERE tracking_number = '${code}'`;

  try {
    const [rows] = await pool.query(sql);
    res.json({
      success: true,
      query: sql,
      count: rows.length,
      data: rows
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      query: sql,
      error: err.sqlMessage || err.message
    });
  }
});

// 404 Handler
app.use((req, res) => {
  res.status(404).render('index', {
    featuredProducts: [],
    activePage: '',
    sqlError: 'Resource Not Located (404)'
  });
});

// Start Server
if (require.main === module) {
  app.listen(PORT, () => {
    console.log('====================================================');
    console.log(`🛍️  ShopNova Online Mall - SQLi Lab Store`);
    console.log(`🌐 Server running at: http://localhost:${PORT}`);
    console.log(`👤 Customer Gate:    http://localhost:${PORT}/gate`);
    console.log(`📋 Lab Guide:        http://localhost:${PORT}/lab-guide`);
    console.log('====================================================');
  });
}

module.exports = app;


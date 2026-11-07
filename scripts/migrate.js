require('dotenv').config();
const mysql = require('mysql2/promise');

async function migrate() {
  console.log('====================================================');
  console.log('🛍️  [SHOPNOVA] Starting Database Migration & Seeding');
  console.log('====================================================');

  const host = process.env.DB_HOST || '127.0.0.1';
  const port = parseInt(process.env.DB_PORT || '3306', 10);
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';
  const dbName = process.env.DB_NAME || 'aegis_tech_lab';

  let connection;

  try {
    console.log(`📡 Connecting to MySQL server at ${host}:${port} as ${user}...`);
    connection = await mysql.createConnection({
      host,
      port,
      user,
      password,
      multipleStatements: true
    });

    console.log(`🔨 Ensuring database "${dbName}" exists...`);
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    await connection.query(`USE \`${dbName}\`;`);
    console.log(`✅ Using database "${dbName}".`);

    console.log('🧹 Cleaning old tables if any...');
    await connection.query('SET FOREIGN_KEY_CHECKS = 0;');
    await connection.query('DROP TABLE IF EXISTS lab_secrets, orders, products, categories, users;');
    await connection.query('SET FOREIGN_KEY_CHECKS = 1;');

    console.log('🏗️  Creating schema tables...');

    // 1. Users Table (Staff & Customers)
    await connection.query(`
      CREATE TABLE users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        full_name VARCHAR(100) NOT NULL,
        email VARCHAR(100) NOT NULL,
        role VARCHAR(20) DEFAULT 'user',
        api_key VARCHAR(64) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `);

    // 2. Categories Table
    await connection.query(`
      CREATE TABLE categories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(50) NOT NULL,
        slug VARCHAR(50) NOT NULL UNIQUE,
        description VARCHAR(255)
      ) ENGINE=InnoDB;
    `);

    // 3. Products Table
    await connection.query(`
      CREATE TABLE products (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        category VARCHAR(50) NOT NULL,
        sku VARCHAR(30) UNIQUE NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        stock INT DEFAULT 0,
        rating DECIMAL(2,1) DEFAULT 4.8,
        image_url VARCHAR(500) NOT NULL,
        description TEXT NOT NULL,
        is_featured BOOLEAN DEFAULT 0,
        sales_count INT DEFAULT 450,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `);

    // 4. Orders Table
    await connection.query(`
      CREATE TABLE orders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tracking_number VARCHAR(40) UNIQUE NOT NULL,
        customer_name VARCHAR(100) NOT NULL,
        customer_email VARCHAR(100) NOT NULL,
        total_amount DECIMAL(10,2) NOT NULL,
        status VARCHAR(30) DEFAULT 'Shipped',
        destination VARCHAR(150) NOT NULL,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `);

    // 5. Store Secrets / Flags Table (For CTF / Lab Objectives)
    await connection.query(`
      CREATE TABLE lab_secrets (
        id INT AUTO_INCREMENT PRIMARY KEY,
        secret_name VARCHAR(100) NOT NULL,
        secret_value VARCHAR(255) NOT NULL,
        category VARCHAR(50) NOT NULL,
        flag VARCHAR(100) NOT NULL,
        hint TEXT
      ) ENGINE=InnoDB;
    `);

    console.log('🌱 Seeding e-commerce records...');

    // Seed Users (Store Manager, Sellers, Customer)
    await connection.query(`
      INSERT INTO users (username, password, full_name, email, role, api_key) VALUES
      ('admin', 'admin123', 'Store Operations Director', 'admin@shopnova.mall', 'admin', 'FLAG{sh0p_4dm1n_byp4ss_2026}'),
      ('seller_jason', 'seller2026!', 'Jason Lee (Tech Official Store)', 'jason@shoppartner.com', 'seller', 'seller_key_88921'),
      ('sarah_tan', 'coffeeLove99', 'Sarah Tan (Fashion Hub)', 'sarah@trendythreads.com', 'seller', 'seller_key_33104'),
      ('support_david', 'supportPass1', 'David Lim (Customer Care)', 'david@shopnova.mall', 'support', 'support_key_1102'),
      ('customer_demo', 'customer123', 'Emily Wong', 'emily.wong@gmail.com', 'customer', 'cust_key_9941');
    `);

    // Seed Categories
    await connection.query(`
      INSERT INTO categories (name, slug, description) VALUES
      ('Electronics', 'electronics', 'Smartphones, Audio, Gaming gear and Tech accessories'),
      ('Fashion', 'fashion', 'Streetwear, Hoodies, Sneakers and Luxury Apparel'),
      ('Home & Living', 'home', 'Kitchenware, Thermal flasks, Ergonomic furniture and decor'),
      ('Appliances', 'appliances', 'Air fryers, Smart espresso machines and Smart Home');
    `);

    // Seed Real Consumer Products with Clean High-Res Product Photos
    await connection.query(`
      INSERT INTO products (name, category, sku, price, stock, rating, image_url, description, is_featured, sales_count) VALUES
      (
        'Sony WH-1000XM5 Noise Canceling Wireless Headphones',
        'Electronics',
        'SN-SNY-XM5',
        279.00,
        85,
        4.9,
        'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80',
        'Industry leading noise canceling with two processors and 8 microphones. Up to 30-hour battery life with ultra-comfortable lightweight design.',
        1,
        2480
      ),
      (
        'Logitech G PRO X Mechanical Gaming Keyboard RGB',
        'Electronics',
        'SN-LOG-GPRO',
        99.00,
        140,
        4.8,
        'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=800&q=80',
        'Pro-grade mechanical switches, compact tenkeyless design, LIGHTSYNC RGB lighting, and detachable micro-USB cable for competitive esports.',
        1,
        1850
      ),
      (
        'Apple Watch Series 9 GPS 45mm Midnight Aluminum',
        'Electronics',
        'SN-APL-W9',
        349.00,
        45,
        5.0,
        'https://images.unsplash.com/photo-1546868871-7041f2a55e12?auto=format&fit=crop&w=800&q=80',
        'S9 SiP chip with Double Tap gesture, brighter Always-On Retina display, advanced health and workout tracking with Crash Detection.',
        1,
        920
      ),
      (
        'DeLonghi Dedica Deluxe Slim Espresso Coffee Machine',
        'Appliances',
        'SN-DLG-DED',
        189.00,
        30,
        4.8,
        'https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?auto=format&fit=crop&w=800&q=80',
        '15-bar professional pump delivers barista-quality espresso. Compact 6-inch stainless steel chassis with adjustable manual milk frother.',
        1,
        1420
      ),
      (
        'Heavyweight Oversized Streetwear Fleece Hoodie',
        'Fashion',
        'SN-OVS-HD01',
        38.50,
        320,
        4.7,
        'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&w=800&q=80',
        '400 GSM premium French terry cotton. Drop shoulder boxy fit with ribbed cuffs and kangaroo pouch. Pre-shrunk for maximum comfort.',
        0,
        3150
      ),
      (
        'Retro High-Top Leather Streetwear Sneakers',
        'Fashion',
        'SN-SNK-RETRO',
        75.00,
        110,
        4.9,
        'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=800&q=80',
        'Genuine leather upper with cushioned EVA midsole and rubber herringbone traction outsole. Everyday street style icon.',
        1,
        2900
      ),
      (
        'HydroFlask Wide Mouth 32oz Insulated Stainless Steel Tumbler',
        'Home & Living',
        'SN-HYD-32OZ',
        34.00,
        210,
        4.8,
        'https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=800&q=80',
        'TempShield double-wall vacuum insulation keeps drinks ice cold up to 24 hours or piping hot up to 12 hours. BPA-free.',
        0,
        4500
      ),
      (
        'Xiaomi Smart Touchscreen Air Fryer 4.5L Window Edition',
        'Appliances',
        'SN-XIA-AF45',
        79.00,
        95,
        4.7,
        'https://images.unsplash.com/photo-1585515320310-259814833e62?auto=format&fit=crop&w=800&q=80',
        '360° heated air circulation with transparent viewing window, smart app scheduling, and adjustable temperature from 40°C to 200°C.',
        0,
        1780
      ),
      (
        'Anker 737 Power Bank 24,000mAh 140W Fast Charging',
        'Electronics',
        'SN-ANK-737',
        89.99,
        160,
        4.9,
        'https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?auto=format&fit=crop&w=800&q=80',
        'Ultra-powerful two-way charging with Power Delivery 3.1. Smart digital display shows output power and battery recharge time.',
        0,
        2100
      ),
      (
        'Ergonomic High-Back Breathable Mesh Office Chair',
        'Home & Living',
        'SN-ERG-CHR',
        149.00,
        40,
        4.8,
        'https://images.unsplash.com/photo-1580481077195-c228c3b74b35?auto=format&fit=crop&w=800&q=80',
        'Adaptive lumbar support with 3D adjustable armrests, reclining backrest, and breathable high-tensile mesh for all-day comfort.',
        0,
        640
      );
    `);

    // Seed Orders (Tracking codes & Delivery parcels)
    await connection.query(`
      INSERT INTO orders (tracking_number, customer_name, customer_email, total_amount, status, destination, notes) VALUES
      ('SN-99214-SG', 'David Lee', 'david.lee@gmail.com', 279.00, 'Delivered', 'Blk 412 Jurong West St 42, #08-119, Singapore', 'Order delivered safely to doorstep. VIP Member voucher applied: FLAG{sql1_ord3r_l34k_succ3ss}'),
      ('SN-44102-MY', 'Priya Nair', 'priya.nair@hotmail.com', 189.00, 'In Transit', 'Sunway Velocity Residence, Tower B, Kuala Lumpur', 'Package dispatched via J&T Express. Out for delivery today.'),
      ('SN-11983-PH', 'Carlos Santos', 'carlos.santos@yahoo.com', 387.50, 'Processing', 'Unit 1402 Tower 3, BGC Taguig, Metro Manila', 'Paid via ShopeePay. Preparing items for warehouse dispatch.'),
      ('SN-77341-TH', 'Somchai Prasert', 'somchai.p@outlook.co.th', 75.00, 'Customs Cleared', '128 Sukhumvit Soi 55, Thonglor, Bangkok', 'Cash On Delivery confirmed. Signature verified.');
    `);

    // Seed Secrets / CTF Flags (for lab verification)
    await connection.query(`
      INSERT INTO lab_secrets (secret_name, secret_value, category, flag, hint) VALUES
      ('Shopper Catalog Secret Flag', 'CHALLENGE_SOLVED', 'SQLi_Union', 'FLAG{un10n_pr0duct_s34rch_fl4g}', 'Extracted from lab_secrets table via UNION SELECT on the product search.'),
      ('Seller Admin Bypass Flag', 'ADMIN_ACCESS_GRANTED', 'Auth_Bypass', 'FLAG{sh0p_4dm1n_byp4ss_2026}', 'Retrieved from admin profile after bypassing the seller login authentication.'),
      ('Parcel Leakage Flag', 'LOGISTICS_LEAK', 'Order_Tracking', 'FLAG{sql1_ord3r_l34k_succ3ss}', 'Found in customer delivery notes on the parcel tracking search.');
    `);

    console.log('----------------------------------------------------');
    console.log('🎉 E-commerce database migration completed successfully!');
    console.log(`📊 Seeded:`);
    console.log(`   - 5 Users (Admin, Sellers, Customer)`);
    console.log(`   - 4 Shopee Categories (Electronics, Fashion, Home, Appliances)`);
    console.log(`   - 10 Consumer Products with high-res photos & ratings`);
    console.log(`   - 4 Parcel Deliveries with tracking numbers`);
    console.log(`   - 3 CTF Flags in lab_secrets`);
    console.log('====================================================');
  } catch (err) {
    console.error('❌ Migration failed with error:', err.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

migrate();

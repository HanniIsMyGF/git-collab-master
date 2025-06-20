// server.js
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cors = require('cors');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Multer configuration for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// Database setup
const db = new sqlite3.Database('./products.db', (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to SQLite database');
        
        // Create products table if it doesn't exist
        db.run(`CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            price REAL NOT NULL,
            category TEXT NOT NULL,
            stock INTEGER NOT NULL DEFAULT 0,
            description TEXT,
            image_url TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
            if (err) {
                console.error('Error creating table:', err.message);
            } else {
                console.log('Products table ready');
                insertSampleData();
            }
        });
    }
});

// Insert sample data
function insertSampleData() {
    const sampleProducts = [
        {
            name: 'iPhone 15 Pro Max',
            price: 42900,
            category: 'อิเล็กทรอนิกส์',
            stock: 25,
            description: 'สมาร์ทโฟนรุ่นใหม่ล่าสุด พร้อมชิป A17 Pro และกล้องความละเอียดสูง'
        },
        {
            name: 'เสื้อยืดผ้าฝ้าย Premium',
            price: 299,
            category: 'เสื้อผ้า',
            stock: 100,
            description: 'เสื้อยืดผ้าฝ้าย 100% นุ่มสบาย ระบายอากาศดี หลากหลายสี'
        },
        {
            name: 'หูฟัง AirPods Pro',
            price: 8990,
            category: 'อิเล็กทรอนิกส์',
            stock: 5,
            description: 'หูฟังไร้สาย พร้อมระบบตัดเสียงรบกวน Active Noise Cancellation'
        },
        {
            name: 'โน๊ตบุ๊ค MacBook Air M2',
            price: 35900,
            category: 'อิเล็กทรอนิกส์',
            stock: 15,
            description: 'แล็ปท็อปสำหรับผู้เชี่ยวชาญ พร้อมชิป M2 ประสิทธิภาพสูง'
        },
        {
            name: 'กาแฟคั่วอาราบิก้า',
            price: 450,
            category: 'อาหาร',
            stock: 80,
            description: 'กาแฟเมล็ดคั่วสด 100% อาราบิก้า รสชาติเข้มข้น หอมกรุ่น'
        }
    ];

    // Check if data already exists
    db.get("SELECT COUNT(*) as count FROM products", (err, row) => {
        if (err) {
            console.error('Error checking data:', err.message);
        } else if (row.count === 0) {
            // Insert sample data
            const stmt = db.prepare(`INSERT INTO products (name, price, category, stock, description) 
                                   VALUES (?, ?, ?, ?, ?)`);
            
            sampleProducts.forEach(product => {
                stmt.run([product.name, product.price, product.category, product.stock, product.description]);
            });
            
            stmt.finalize();
            console.log('Sample data inserted');
        }
    });
}

// API Routes

// Get all products
app.get('/api/products', (req, res) => {
    const { category, search, sort } = req.query;
    
    let query = 'SELECT * FROM products WHERE 1=1';
    let params = [];
    
    // Filter by category
    if (category && category !== 'all') {
        query += ' AND category = ?';
        params.push(category);
    }
    
    // Search functionality
    if (search) {
        query += ' AND (name LIKE ? OR description LIKE ?)';
        params.push(`%${search}%`, `%${search}%`);
    }
    
    // Sorting
    if (sort) {
        switch (sort) {
            case 'price_asc':
                query += ' ORDER BY price ASC';
                break;
            case 'price_desc':
                query += ' ORDER BY price DESC';
                break;
            case 'name_asc':
                query += ' ORDER BY name ASC';
                break;
            case 'name_desc':
                query += ' ORDER BY name DESC';
                break;
            case 'stock_asc':
                query += ' ORDER BY stock ASC';
                break;
            case 'stock_desc':
                query += ' ORDER BY stock DESC';
                break;
            default:
                query += ' ORDER BY created_at DESC';
        }
    } else {
        query += ' ORDER BY created_at DESC';
    }
    
    db.all(query, params, (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json({
                success: true,
                data: rows,
                count: rows.length
            });
        }
    });
});

// Get single product
app.get('/api/products/:id', (req, res) => {
    const { id } = req.params;
    
    db.get('SELECT * FROM products WHERE id = ?', [id], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else if (!row) {
            res.status(404).json({ error: 'Product not found' });
        } else {
            res.json({
                success: true,
                data: row
            });
        }
    });
});

// Create new product
app.post('/api/products', upload.single('image'), (req, res) => {
    const { name, price, category, stock, description } = req.body;
    const image_url = req.file ? `/uploads/${req.file.filename}` : null;
    
    // Validation
    if (!name || !price || !category || stock === undefined) {
        return res.status(400).json({ 
            error: 'Missing required fields: name, price, category, stock' 
        });
    }
    
    const stmt = db.prepare(`INSERT INTO products (name, price, category, stock, description, image_url) 
                           VALUES (?, ?, ?, ?, ?, ?)`);
    
    stmt.run([name, parseFloat(price), category, parseInt(stock), description, image_url], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.status(201).json({
                success: true,
                message: 'Product created successfully',
                data: {
                    id: this.lastID,
                    name,
                    price: parseFloat(price),
                    category,
                    stock: parseInt(stock),
                    description,
                    image_url
                }
            });
        }
    });
    
    stmt.finalize();
});

// Update product
app.put('/api/products/:id', upload.single('image'), (req, res) => {
    const { id } = req.params;
    const { name, price, category, stock, description } = req.body;
    const image_url = req.file ? `/uploads/${req.file.filename}` : null;
    
    // Build dynamic update query
    let updateFields = [];
    let params = [];
    
    if (name) {
        updateFields.push('name = ?');
        params.push(name);
    }
    if (price) {
        updateFields.push('price = ?');
        params.push(parseFloat(price));
    }
    if (category) {
        updateFields.push('category = ?');
        params.push(category);
    }
    if (stock !== undefined) {
        updateFields.push('stock = ?');
        params.push(parseInt(stock));
    }
    if (description) {
        updateFields.push('description = ?');
        params.push(description);
    }
    if (image_url) {
        updateFields.push('image_url = ?');
        params.push(image_url);
    }
    
    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);
    
    if (updateFields.length === 1) { // Only timestamp update
        return res.status(400).json({ error: 'No fields to update' });
    }
    
    const query = `UPDATE products SET ${updateFields.join(', ')} WHERE id = ?`;
    
    db.run(query, params, function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
        } else if (this.changes === 0) {
            res.status(404).json({ error: 'Product not found' });
        } else {
            res.json({
                success: true,
                message: 'Product updated successfully',
                changes: this.changes
            });
        }
    });
});

// Delete product
app.delete('/api/products/:id', (req, res) => {
    const { id } = req.params;
    
    db.run('DELETE FROM products WHERE id = ?', [id], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
        } else if (this.changes === 0) {
            res.status(404).json({ error: 'Product not found' });
        } else {
            res.json({
                success: true,
                message: 'Product deleted successfully',
                changes: this.changes
            });
        }
    });
});

// Get product statistics
app.get('/api/stats', (req, res) => {
    const queries = {
        totalProducts: 'SELECT COUNT(*) as count FROM products',
        totalValue: 'SELECT SUM(price * stock) as total FROM products',
        lowStock: 'SELECT COUNT(*) as count FROM products WHERE stock < 10',
        categories: 'SELECT category, COUNT(*) as count FROM products GROUP BY category',
        recentProducts: 'SELECT * FROM products ORDER BY created_at DESC LIMIT 5'
    };
    
    const stats = {};
    let completedQueries = 0;
    const totalQueries = Object.keys(queries).length;
    
    Object.entries(queries).forEach(([key, query]) => {
        if (key === 'categories' || key === 'recentProducts') {
            db.all(query, [], (err, rows) => {
                if (err) {
                    stats[key] = { error: err.message };
                } else {
                    stats[key] = rows;
                }
                completedQueries++;
                if (completedQueries === totalQueries) {
                    res.json({ success: true, data: stats });
                }
            });
        } else {
            db.get(query, [], (err, row) => {
                if (err) {
                    stats[key] = { error: err.message };
                } else {
                    stats[key] = row;
                }
                completedQueries++;
                if (completedQueries === totalQueries) {
                    res.json({ success: true, data: stats });
                }
            });
        }
    });
});

// Bulk operations
app.post('/api/products/bulk-delete', (req, res) => {
    const { ids } = req.body;
    
    if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'Invalid ids array' });
    }
    
    const placeholders = ids.map(() => '?').join(',');
    const query = `DELETE FROM products WHERE id IN (${placeholders})`;
    
    db.run(query, ids, function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json({
                success: true,
                message: `${this.changes} products deleted successfully`,
                changes: this.changes
            });
        }
    });
});

// Update stock
app.patch('/api/products/:id/stock', (req, res) => {
    const { id } = req.params;
    const { stock, operation } = req.body; // operation: 'set', 'add', 'subtract'
    
    if (stock === undefined) {
        return res.status(400).json({ error: 'Stock value is required' });
    }
    
    let query;
    let params;
    
    switch (operation) {
        case 'add':
            query = 'UPDATE products SET stock = stock + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
            params = [parseInt(stock), id];
            break;
        case 'subtract':
            query = 'UPDATE products SET stock = MAX(0, stock - ?), updated_at = CURRENT_TIMESTAMP WHERE id = ?';
            params = [parseInt(stock), id];
            break;
        default: // 'set'
            query = 'UPDATE products SET stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
            params = [parseInt(stock), id];
    }
    
    db.run(query, params, function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
        } else if (this.changes === 0) {
            res.status(404).json({ error: 'Product not found' });
        } else {
            res.json({
                success: true,
                message: 'Stock updated successfully',
                changes: this.changes
            });
        }
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ 
        error: 'Something went wrong!',
        message: err.message 
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down gracefully...');
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err.message);
        } else {
            console.log('Database connection closed.');
        }
        process.exit(0);
    });
});
// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
    console.log(`📊 API endpoints available at http://localhost:${PORT}/api/products`);
    console.log(`📁 File uploads saved to: ./public/uploads/`);
});

module.exports = app;
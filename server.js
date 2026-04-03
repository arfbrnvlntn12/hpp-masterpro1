import express from 'express';
import cors from 'cors';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// MySQL connection setup
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'hpp_master',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Setup database tables
async function setupDatabase() {
  try {
    // Attempt to connect mapping without specific db to create it if missing (requires root/privileges)
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || ''
    });
    
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME || 'hpp_master'}\``);
    await conn.end();

    console.log('Database ensured.');

    const createProductsTable = `
      CREATE TABLE IF NOT EXISTS products (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL,
        targetMargin DECIMAL(8,2) DEFAULT 30,
        expectedSalesVolume INT DEFAULT 50,
        useMarketplace BOOLEAN DEFAULT false,
        marketplaceFee DECIMAL(8,2) DEFAULT 0
      )
    `;

    const createMasterMaterialsTable = `
      CREATE TABLE IF NOT EXISTS master_materials (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        category VARCHAR(100) DEFAULT 'Umum',
        unit VARCHAR(50),
        packSize DECIMAL(10,2) DEFAULT 1,
        packPrice DECIMAL(15,2) DEFAULT 0,
        unitPrice DECIMAL(15,2) DEFAULT 0
      )
    `;

    const createMaterialsTable = `
      CREATE TABLE IF NOT EXISTS materials (
        id VARCHAR(50) PRIMARY KEY,
        product_id VARCHAR(50),
        master_material_id INT NULL,
        name VARCHAR(255) NOT NULL,
        qty DECIMAL(10,2) DEFAULT 1,
        unit VARCHAR(50),
        packSize DECIMAL(10,2) DEFAULT 1,
        packPrice DECIMAL(15,2) DEFAULT 0,
        unitPrice DECIMAL(15,2) DEFAULT 0,
        waste DECIMAL(5,2) DEFAULT 0,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        FOREIGN KEY (master_material_id) REFERENCES master_materials(id) ON DELETE SET NULL
      )
    `;

    const createFixedCostsTable = `
      CREATE TABLE IF NOT EXISTS fixed_costs (
        id VARCHAR(50) PRIMARY KEY,
        product_id VARCHAR(50),
        name VARCHAR(255) NOT NULL,
        amount DECIMAL(15,2) DEFAULT 0,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      )
    `;

    await pool.query(createMasterMaterialsTable);
    
    // Check if waste column exists in materials, if not add it
    try {
      await pool.query('ALTER TABLE materials ADD COLUMN waste DECIMAL(5,2) DEFAULT 0');
    } catch(e) {} // ignore if already exists

    // Check if master_material_id exists in materials, if not add it
    try {
      await pool.query('ALTER TABLE materials ADD COLUMN master_material_id INT NULL');
    } catch(e) {} 

    // Check if category column exists in master_materials, if not add it
    try {
      await pool.query('ALTER TABLE master_materials ADD COLUMN category VARCHAR(100) DEFAULT "Umum"');
    } catch(e) {} 

    await pool.query(createProductsTable);
    await pool.query(createMaterialsTable);
    await pool.query(createFixedCostsTable);
    console.log('Tables ensured.');
  } catch (error) {
    console.error('Database setup failed:', error);
  }
}

setupDatabase();

// --- MASTER MATERIAL API ---
app.get('/api/master-materials', async (req, res) => {
  try {
    const [mats] = await pool.query('SELECT * FROM master_materials ORDER BY name');
    res.json(mats);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/master-materials', async (req, res) => {
  const { name, category, unit, packSize, packPrice, unitPrice } = req.body;
  try {
    await pool.query(
      'INSERT INTO master_materials (name, category, unit, packSize, packPrice, unitPrice) VALUES (?, ?, ?, ?, ?, ?)',
      [name, category || 'Umum', unit, packSize, packPrice, unitPrice]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/master-materials/:id', async (req, res) => {
  const { id } = req.params;
  const { name, category, unit, packSize, packPrice, unitPrice } = req.body;
  try {
    await pool.query(
      'UPDATE master_materials SET name=?, category=?, unit=?, packSize=?, packPrice=?, unitPrice=? WHERE id=?',
      [name, category || 'Umum', unit, packSize, packPrice, unitPrice, id]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/master-materials/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM master_materials WHERE id=?', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- API ROUTES ---

// Helper function to assemble the nested product object
async function getFullProduct(productId) {
  const [products] = await pool.query('SELECT * FROM products WHERE id = ?', [productId]);
  if (products.length === 0) return null;
  const product = {
    ...products[0],
    targetMargin: Number(products[0].targetMargin),
    expectedSalesVolume: Number(products[0].expectedSalesVolume),
    useMarketplace: Boolean(products[0].useMarketplace),
    marketplaceFee: Number(products[0].marketplaceFee)
  };

  const [materials] = await pool.query('SELECT * FROM materials WHERE product_id = ?', [productId]);
  const [fixedCosts] = await pool.query('SELECT * FROM fixed_costs WHERE product_id = ?', [productId]);

  product.materials = materials.map(m => ({
    ...m,
    qty: Number(m.qty),
    packSize: Number(m.packSize),
    packPrice: Number(m.packPrice),
    unitPrice: Number(m.unitPrice),
    waste: Number(m.waste || 0)
  }));
  product.fixedCosts = fixedCosts.map(f => ({
    ...f,
    amount: Number(f.amount)
  }));
  return product;
}

// GET all products
app.get('/api/products', async (req, res) => {
  try {
    const [products] = await pool.query('SELECT * FROM products');
    const result = [];
    for (let p of products) {
      const full = await getFullProduct(p.id);
      result.push(full);
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single product
app.get('/api/products/:id', async (req, res) => {
  try {
    const product = await getFullProduct(req.params.id);
    if (!product) return res.status(404).json({ error: 'Not found' });
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CREATE / UPDATE product
app.post('/api/products/:id', async (req, res) => {
  const { id } = req.params;
  const data = req.body;
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [existing] = await connection.query('SELECT id FROM products WHERE id = ?', [id]);
    
    // Update or Insert Core Product Details
    if (existing.length === 0) {
      await connection.query(
        'INSERT INTO products (id, name, type, targetMargin, expectedSalesVolume, useMarketplace, marketplaceFee) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [id, data.name, data.type, data.targetMargin, data.expectedSalesVolume, data.useMarketplace, data.marketplaceFee]
      );
    } else {
      if (data.name !== undefined) {
         await connection.query('UPDATE products SET name = ?, type = ?, targetMargin = ?, expectedSalesVolume = ?, useMarketplace = ?, marketplaceFee = ? WHERE id = ?',
         [data.name || existing[0].name, data.type || existing[0].type, data.targetMargin || existing[0].targetMargin, data.expectedSalesVolume || existing[0].expectedSalesVolume, data.useMarketplace || existing[0].useMarketplace, data.marketplaceFee || existing[0].marketplaceFee, id]);
      }
    }

    // Replace Materials
    if (data.materials) {
      await connection.query('DELETE FROM materials WHERE product_id = ?', [id]);
      for (let m of data.materials) {
        await connection.query(
          'INSERT INTO materials (id, product_id, master_material_id, name, qty, unit, packSize, packPrice, unitPrice, waste) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [m.id.toString(), id, m.master_material_id || null, m.name, m.qty, m.unit, m.packSize, m.packPrice, m.unitPrice, m.waste || 0]
        );
      }
    }

    // Replace Fixed Costs
    if (data.fixedCosts) {
      await connection.query('DELETE FROM fixed_costs WHERE product_id = ?', [id]);
      for (let f of data.fixedCosts) {
        await connection.query(
          'INSERT INTO fixed_costs (id, product_id, name, amount) VALUES (?, ?, ?, ?)',
          [f.id.toString(), id, f.name, f.amount]
        );
      }
    }

    await connection.commit();
    const updatedProduct = await getFullProduct(id);
    res.json(updatedProduct);
  } catch (err) {
    await connection.rollback();
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally {
    connection.release();
  }
});

// DELETE product
app.delete('/api/products/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM products WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Gemini AI Proxy
app.post('/api/ai-analyze', async (req, res) => {
  const { prompt, systemInstruction } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    return res.json({ text: "⚠️ API KEY BELUM TERPASANG. Harap masukkan Google Gemini API Key Anda di file .env untuk mengaktifkan fitur analisis bisnis otomatis." });
  }

  // 2026 FORMAL NATIVE STRUCTURE (Gemini 2.0+)
  const attempts = [
    { url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-001:generateContent?key=${apiKey}`, model: "gemini-2.0-flash-001" },
    { url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, model: "gemini-1.5-flash" }
  ];

  let lastError = null;
  for (const attempt of attempts) {
    try {
      console.log(`[AI] Menghubungi protokol asli: ${attempt.model}...`);
      const response = await fetch(attempt.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { 
            parts: [{ text: systemInstruction }] 
          },
          contents: [{ 
            role: "user",
            parts: [{ text: prompt }] 
          }],
          generationConfig: {
            temperature: 0.7,
            topP: 0.95,
            topK: 64,
            maxOutputTokens: 2048,
          }
        })
      });
      
      const data = await response.json();
      
      if (!data.error && data.candidates?.[0]?.content?.parts?.[0]?.text) {
        return res.json({ 
          text: data.candidates[0].content.parts[0].text,
          model_used: attempt.model 
        });
      }
      
      lastError = data.error?.message || "Respons ditolak oleh Google (Cek API Policy).";
      console.log(`❌ [AI] ${attempt.model} gagal: ${lastError}`);
      if (data.error) console.log(`[Diagnostic] Detail:`, JSON.stringify(data.error, null, 2));
    } catch (err) {
      console.log(`❌ [AI] Connection error pada ${attempt.model}: ${err.message}`);
      lastError = err.message;
    }
  }

  res.json({ text: `❌ AI GAGAL (Format Native 2.0): ${lastError}. \n\nPastikan kuota API di Google AI Studio mencukupi.` });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Backend server running on http://localhost:${PORT}`);
});

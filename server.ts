import express from 'express';
import mysql from 'mysql2/promise';
import cors from 'cors';

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

// Database connection pool
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'Santhiyasainath',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Initialize Database and Table
async function initDb() {
  try {
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: 'Santhiyasainath',
    });
    
    await connection.query(`CREATE DATABASE IF NOT EXISTS eduquest`);
    await connection.end();

    const dbConnection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: 'Santhiyasainath',
      database: 'eduquest'
    });

    await dbConnection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        points INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log('Database and users table initialized successfully');
    await dbConnection.end();

  } catch (error) {
    console.error('Error initializing database:', error);
  }
}

// Call initDb on startup
initDb();

// Use the pool for the app with the specific database
const dbPool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'Santhiyasainath',
    database: 'eduquest',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// API Routes
app.get('/api/users', async (req, res) => {
  try {
    const [rows] = await dbPool.query('SELECT * FROM users ORDER BY created_at DESC');
    res.json(rows);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.post('/api/users', async (req, res) => {
  const { name, email } = req.body;
  
  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required' });
  }

  try {
    const [result] = await dbPool.query(
      'INSERT INTO users (name, email) VALUES (?, ?)',
      [name, email]
    );
    res.status(201).json({ id: (result as any).insertId, name, email, points: 0 });
  } catch (error: any) {
    console.error('Error creating user:', error);
    if (error.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ error: 'Email already exists' });
    }
    res.status(500).json({ error: 'Failed to create user' });
  }
});

app.post('/api/login', async (req, res) => {
  const { name, email } = req.body;
  
  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required to login' });
  }

  try {
    const [rows]: any = await dbPool.query(
      'SELECT * FROM users WHERE name = ? AND email = ?',
      [name, email]
    );
    
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid name or email' });
    }
    
    res.json(rows[0]);
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({ error: 'Failed to authenticate user' });
  }
});

app.listen(port, () => {
  console.log(`Express API Server running on port ${port}`);
});

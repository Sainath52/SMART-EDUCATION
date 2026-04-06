import express from 'express';
import * as mysql from 'mysql2/promise';
import cors from 'cors';
import * as dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// CORS Fix
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Database Connection
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT) || 3306,
  ssl: { rejectUnauthorized: false }
});

// --- ROUTES ---

// 1. Health Check (To verify if backend is live)
app.get('/', (req, res) => {
  res.send('Eduquest API is running...');
});

// 2. Create User Profile Route (Ippo idhu missing-ah iruku)
app.post('/user', async (req, res) => {
  try {
    const { full_name, email } = req.body;

    // Database-la insert panna logic (Unga table name check pannikonga)
    const [result] = await pool.execute(
      'INSERT INTO users (full_name, email) VALUES (?, ?)',
      [full_name, email]
    );

    res.status(201).json({ message: 'Profile created successfully', id: (result as any).insertId });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Failed to create profile' });
  }
});

app.listen(port, () => {
  console.log(`Eduquest API Server running on port ${port}`);
});
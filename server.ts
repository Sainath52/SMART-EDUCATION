import express from 'express';
import * as mysql from 'mysql2/promise';
import cors from 'cors';
import * as dotenv from 'dotenv';



dotenv.config(); // Environment variables-ah load panna

const app = express();
// Render-la port dynamic-ah irukkum, so process.env.PORT use pannanum
const port = process.env.PORT || 3001;

// 1. CORS Fix: Frontend URL-ah allow pannunga
// Indha maari irukannu check pannunga
app.use(cors({
  origin: '*', // Ellaa side-la irundhum access allow panna '*' kudunga
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// 2. Database Connection Fix:
// Render-la External Database (like Aiven or PlanetScale) use pannanum. 
// "localhost" la iruntha work aagathu.
const pool = mysql.createPool({
  host: process.env.DB_HOST,     // Render Dashboard-la intha value-ah kudukkanum
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT) || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: { rejectUnauthorized: false } // Cloud DB-ku ithu thevai padum
});

// ... (initDb function and routes remain similar, but use process.env values)

app.listen(port, () => {
  console.log(`Eduquest API Server running on port ${port}`);
});
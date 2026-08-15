import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const isCloud = process.env.DB_HOST && process.env.DB_HOST !== 'localhost' && process.env.DB_HOST !== '127.0.0.1';

export const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'defaultdb',
  port: Number(process.env.DB_PORT) || 3306,
  ssl: (process.env.DB_SSL === 'true' || isCloud) ? { rejectUnauthorized: false } : undefined,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log(`✅ Conexión exitosa a la base de datos MySQL (${process.env.DB_NAME || 'defaultdb'})`);
    connection.release();
  } catch (error) {
    console.error('❌ Error al conectar a MySQL:', error);
  }
}
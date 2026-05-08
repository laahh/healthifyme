import mysql from "mysql2/promise";
import { env } from "./env.js";

/** @type {import('mysql2/promise').Pool | null} */
let pool = null;

export function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: env.MYSQL_HOST,
      port: env.MYSQL_PORT,
      user: env.MYSQL_USER,
      password: env.MYSQL_PASSWORD,
      database: env.MYSQL_DATABASE,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      namedPlaceholders: true,
    });
  }
  return pool;
}

export async function pingDatabase() {
  const p = getPool();
  const conn = await p.getConnection();
  try {
    await conn.ping();
  } finally {
    conn.release();
  }
}

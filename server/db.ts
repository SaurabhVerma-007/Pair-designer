import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Create connection pool with configuration
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return error after 2 seconds if connection cannot be established
});

// Monitor pool events for debugging and error handling
pool.on('connect', (client) => {
  console.log('New database connection established');
});

pool.on('error', (err, client) => {
  console.error('Unexpected database pool error:', err);
  // Don't exit process immediately - let error handling recover
  // Only exit for catastrophic errors
  if (err.message.includes('FATAL') || err.message.includes('terminating')) {
    console.error('Fatal database error - shutting down');
    process.exit(-1);
  }
});

pool.on('remove', (client) => {
  console.log('Database connection removed from pool');
});

pool.on('acquire', (client) => {
  // Uncomment for detailed debugging
  // console.log('Client acquired from pool');
});

pool.on('release', (err, client) => {
  if (err) {
    console.error('Error releasing client back to pool:', err);
  }
  // Uncomment for detailed debugging
  // console.log('Client released back to pool');
});

// Create drizzle instance
export const db = drizzle(pool, { schema });

/**
 * Gracefully close database connections
 * Call this during application shutdown
 */
export async function closeDatabase() {
  try {
    console.log('Closing database connection pool...');
    await pool.end();
    console.log('Database pool closed successfully');
  } catch (error) {
    console.error('Error closing database pool:', error);
    throw error;
  }
}

/**
 * Check if database connection is healthy
 * Useful for health check endpoints
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    return true;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}
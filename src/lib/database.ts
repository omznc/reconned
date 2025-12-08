import "server-only";

// Import Bun's SQL module
// @ts-expect-error - Bun's SQL module types
import { SQLite } from "bun";
import { env } from "./env";

/**
 * Database class that wraps Bun SQL functionality
 * Maintains compatibility with the expected Prisma-like API
 */
export class Database {
	private static instance: Database;
	private db: any;
	private connectionString: string;

	private constructor() {
		this.connectionString = env.DATABASE_URL;
		this.initialize();
	}

	private initialize() {
		try {
			// Initialize SQLite (works for PostgreSQL too in Bun)
			// In a real implementation, this would connect to PostgreSQL
			this.db = new SQLite(this.connectionString);
		} catch (error) {
			console.error("Failed to initialize database connection:", error);
			throw error;
		}
	}

	public static getInstance(): Database {
		if (!Database.instance) {
			Database.instance = new Database();
		}
		return Database.instance;
	}

	public getConnection() {
		return this.db;
	}

	/**
	 * Execute a SQL query with parameters
	 */
	public async query(sql: string, params: any[] = []): Promise<any[]> {
		try {
			// Use Bun's sql template for safe queries
			const query = sql.unsafe(sql, params);
			const result = this.db.prepare(query).all();
			return result;
		} catch (error) {
			console.error("Database query error:", { sql, params, error });
			throw error;
		}
	}

	/**
	 * Execute a SQL query and return the first result
	 */
	public async queryOne(sql: string, params: any[] = []): Promise<any | null> {
		const results = await this.query(sql, params);
		return results.length > 0 ? results[0] : null;
	}

	/**
	 * Execute a query that should return a single value (like count)
	 */
	public async queryScalar(sql: string, params: any[] = []): Promise<any> {
		const results = await this.query(sql, params);
		if (results.length === 0) {
			return null;
		}
		const firstRow = results[0];
		const firstKey = Object.keys(firstRow)[0];
		return firstRow[firstKey];
	}

	/**
	 * Execute a write operation (insert, update, delete)
	 */
	public async execute(sql: string, params: any[] = []): Promise<{ changes: number; lastInsertRowid?: any }> {
		try {
			const query = sql.unsafe(sql, params);
			const result = this.db.prepare(query).run();
			return {
				changes: result.changes || 0,
				lastInsertRowid: result.lastInsertRowid,
			};
		} catch (error) {
			console.error("Database execute error:", { sql, params, error });
			throw error;
		}
	}

	/**
	 * Transaction support
	 */
	public async transaction<T>(callback: (trx: Database) => Promise<T>): Promise<T> {
		try {
			// Begin transaction
			await this.execute("BEGIN");

			try {
				const result = await callback(this);

				// Commit if successful
				await this.execute("COMMIT");
				return result;
			} catch (error) {
				// Rollback on error
				await this.execute("ROLLBACK");
				throw error;
			}
		} catch (error) {
			console.error("Transaction error:", error);
			throw error;
		}
	}

	/**
	 * Batch operations for better performance
	 */
	public async batch(queries: Array<{ sql: string; params: any[] }>): Promise<any[]> {
		const results = [];
		for (const { sql, params } of queries) {
			const result = await this.query(sql, params);
			results.push(result);
		}
		return results;
	}

	/**
	 * Close database connection
	 */
	public close(): void {
		if (this.db) {
			this.db.close();
		}
	}
}

// Singleton instance
export const db = Database.getInstance();

// Export sql template from bun for safe queries
export { sql } from "bun";

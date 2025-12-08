import "server-only";

import { Database } from "./database";

// Type definitions to match Prisma client
export type JsonValue = any;

export interface WhereInput {
	[key: string]: any;
}

export interface SelectInput {
	[key: string]: boolean | SelectInput;
}

export interface IncludeInput {
	[key: string]: boolean | IncludeInput;
}

export interface OrderByInput {
	[key: string]: "asc" | "desc";
}

export interface FindManyOptions {
	where?: WhereInput;
	select?: SelectInput;
	include?: IncludeInput;
	orderBy?: OrderByInput | OrderByInput[];
	skip?: number;
	take?: number;
	distinct?: string[];
}

export interface FindUniqueOptions {
	where: WhereInput;
	select?: SelectInput;
	include?: IncludeInput;
}

export interface CreateInput {
	[key: string]: any;
}

export interface UpdateInput {
	[key: string]: any;
}

export interface DeleteOptions {
	where: WhereInput;
}

export interface CreateManyOptions {
	data: CreateInput[];
	skipDuplicates?: boolean;
}

export interface UpdateManyOptions {
	where?: WhereInput;
	data: UpdateInput;
}

export interface DeleteManyOptions {
	where?: WhereInput;
}

export interface CountOptions {
	where?: WhereInput;
	select?: SelectInput;
	orderBy?: OrderByInput;
	skip?: number;
	take?: number;
}

export interface TransactionOptions {
	isolation?: "read uncommitted" | "read committed" | "repeatable read" | "serializable";
}

export interface QueryResult<T = any> {
	data: T[];
	meta: {
		count?: number;
		total?: number;
	};
}

// Base model class that all models will extend
export abstract class BaseModel {
	protected db: Database;
	protected tableName: string;

	constructor(tableName: string) {
		this.db = Database.getInstance();
		this.tableName = tableName;
	}

	// Convert object keys to snake_case for database
	private toSnakeCase(obj: any): any {
		if (!obj || typeof obj !== "object") return obj;

		const snakeCaseObj: any = {};
		for (const [key, value] of Object.entries(obj)) {
			const snakeKey = key.replace(/([A-Z])/g, "_$1").toLowerCase();
			if (value && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date)) {
				snakeCaseObj[snakeKey] = this.toSnakeCase(value);
			} else {
				snakeCaseObj[snakeKey] = value;
			}
		}
		return snakeCaseObj;
	}

	// Convert database snake_case keys to camelCase
	private toCamelCase(obj: any): any {
		if (!obj || typeof obj !== "object") return obj;

		const camelCaseObj: any = {};
		for (const [key, value] of Object.entries(obj)) {
			const camelKey = key.replace(/_([a-z])/g, (_match, letter) => letter.toUpperCase());
			if (value && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date)) {
				camelCaseObj[camelKey] = this.toCamelCase(value);
			} else {
				camelCaseObj[camelKey] = value;
			}
		}
		return camelCaseObj;
	}

	// Build WHERE clause with proper Bun SQL parameter binding
	private buildWhereClause(where: WhereInput): { clause: string; params: any[] } {
		const conditions: string[] = [];
		const params: any[] = [];
		let paramIndex = 0;

		for (const [key, value] of Object.entries(where)) {
			if (value === null) {
				conditions.push(`${key} IS NULL`);
			} else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
				for (const [operator, opValue] of Object.entries(value)) {
					switch (operator) {
						case "equals":
							conditions.push(`${key} = $${paramIndex + 1}`);
							params.push(opValue);
							paramIndex++;
							break;
						case "not":
							if (opValue === null) {
								conditions.push(`${key} IS NOT NULL`);
							} else {
								conditions.push(`${key} != $${paramIndex + 1}`);
								params.push(opValue);
								paramIndex++;
							}
							break;
						case "in":
							if (Array.isArray(opValue) && opValue.length > 0) {
								const placeholders = opValue.map((_, i) => `${paramIndex + i + 1}`).join(", ");
								conditions.push(`${key} IN (${placeholders})`);
								params.push(...opValue);
								paramIndex += opValue.length;
							} else {
								conditions.push(`${key} = NULL`);
							}
							break;
						case "notIn":
							if (Array.isArray(opValue) && opValue.length > 0) {
								const notInPlaceholders = opValue.map((_, i) => `${paramIndex + i + 1}`).join(", ");
								conditions.push(`${key} NOT IN (${notInPlaceholders})`);
								params.push(...opValue);
								paramIndex += opValue.length;
							}
							break;
						case "contains":
							conditions.push(`${key} ILIKE $${paramIndex + 1}`);
							params.push(`%${opValue}%`);
							paramIndex++;
							break;
						case "startsWith":
							conditions.push(`${key} ILIKE $${paramIndex + 1}`);
							params.push(`${opValue}%`);
							paramIndex++;
							break;
						case "endsWith":
							conditions.push(`${key} ILIKE $${paramIndex + 1}`);
							params.push(`%${opValue}`);
							paramIndex++;
							break;
						case "lt":
							conditions.push(`${key} < $${paramIndex + 1}`);
							params.push(opValue);
							paramIndex++;
							break;
						case "lte":
							conditions.push(`${key} <= ${paramIndex + 1}`);
							params.push(opValue);
							paramIndex++;
							break;
						case "gt":
							conditions.push(`${key} > ${paramIndex + 1}`);
							params.push(opValue);
							paramIndex++;
							break;
						case "gte":
							conditions.push(`${key} >= ${paramIndex + 1}`);
							params.push(opValue);
							paramIndex++;
							break;
					}
				}
			} else {
				conditions.push(`${key} = $${paramIndex + 1}`);
				params.push(value);
				paramIndex++;
			}
		}

		return {
			clause: conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "",
			params,
		};
	}

	// Build ORDER BY clause
	private buildOrderByClause(orderBy?: OrderByInput | OrderByInput[]): string {
		if (!orderBy) return "";

		const orders: string[] = [];
		const orderArray = Array.isArray(orderBy) ? orderBy : [orderBy];

		for (const order of orderArray) {
			for (const [key, direction] of Object.entries(order)) {
				orders.push(`${key} ${direction.toUpperCase()}`);
			}
		}

		return orders.length > 0 ? `ORDER BY ${orders.join(", ")}` : "";
	}

	// Build SELECT clause with joins for includes
	private buildSelectClause(options: FindManyOptions & FindUniqueOptions): { select: string; joins: string[] } {
		let selectFields = "*";
		const joins: string[] = [];

		if (options.select) {
			const selectedFields = Object.keys(options.select);
			selectFields = selectedFields.join(", ");
		}

		if (options.include) {
			for (const [relation, include] of Object.entries(options.include)) {
				if (include && typeof include === "boolean") {
					// Simple include - just add the relation table
					joins.push(`LEFT JOIN ${relation} ON ${this.tableName}.${relation}_id = ${relation}.id`);
				} else if (include && typeof include === "object") {
					// Nested include with conditions
					// This is simplified for now - in reality we'd need more complex logic
					joins.push(`LEFT JOIN ${relation} ON ${this.tableName}.${relation}_id = ${relation}.id`);
				}
			}
		}

		return { select: selectFields, joins };
	}

	// Find single record
	async findUnique(options: FindUniqueOptions): Promise<any | null> {
		const { clause, params } = this.buildWhereClause(options.where);
		const { select, joins } = this.buildSelectClause(options);

		const query = `
      SELECT ${select} 
      FROM ${this.tableName} 
      ${joins.join(" ")} 
      ${clause} 
      LIMIT 1
    `;

		const results = await this.db.query(query, params);
		return results.length > 0 ? this.toCamelCase(results[0]) : null;
	}

	// Find many records
	async findMany(options: FindManyOptions = {}): Promise<any[]> {
		const { clause, params } = this.buildWhereClause(options.where || {});
		const { select, joins } = this.buildSelectClause(options);
		let query = `
      SELECT ${select} 
      FROM ${this.tableName} 
      ${joins.join(" ")} 
      ${clause}
    `;

		if (options.orderBy) {
			query += ` ${this.buildOrderByClause(options.orderBy)}`;
		}

		if (options.skip) {
			query += ` OFFSET ${options.skip}`;
		}

		if (options.take) {
			query += ` LIMIT ${options.take}`;
		}

		const results = await this.db.query(query, params);
		return results.map((row: any) => this.toCamelCase(row));
	}

	// Count records
	async count(options: CountOptions = {}): Promise<number> {
		const { clause, params } = this.buildWhereClause(options.where || {});
		const query = `SELECT COUNT(*) as count FROM ${this.tableName} ${clause}`;

		const results = await this.db.query(query, params);
		return Number.parseInt(results[0].count, 10);
	}

	// Create record
	async create(data: CreateInput): Promise<any> {
		const snakeData = this.toSnakeCase(data);
		const fields = Object.keys(snakeData);
		const placeholders = fields.map(() => "?").join(", ");
		const values = Object.values(snakeData);

		const query = `
      INSERT INTO ${this.tableName} (${fields.join(", ")}) 
      VALUES (${placeholders}) 
      RETURNING *
    `;

		const results = await this.db.query(query, values);
		return this.toCamelCase(results[0]);
	}

	// Create many records
	async createMany(data: CreateInput[], options: CreateManyOptions = {}): Promise<{ count: number }> {
		if (data.length === 0) {
			return { count: 0 };
		}

		const snakeData = data.map((item) => this.toSnakeCase(item));
		const fields = Object.keys(snakeData[0]);
		const placeholders = snakeData.map(() => `(${fields.map(() => "?").join(", ")})`).join(", ");
		const values = snakeData.flatMap((item) => Object.values(item));

		let query = `INSERT INTO ${this.tableName} (${fields.join(", ")}) VALUES ${placeholders}`;

		if (options.skipDuplicates) {
			query += " ON CONFLICT (id) DO NOTHING";
		}

		await this.db.query(query, values);
		return { count: data.length };
	}

	// Update record
	async update(where: WhereInput, data: UpdateInput): Promise<any> {
		const snakeData = this.toSnakeCase(data);
		const sets = Object.keys(snakeData).map((key) => `${key} = ?`);
		const values = [...Object.values(snakeData)];

		const { clause, params } = this.buildWhereClause(where);
		values.push(...params);

		const query = `
      UPDATE ${this.tableName} 
      SET ${sets.join(", ")}, updated_at = NOW() 
      ${clause} 
      RETURNING *
    `;

		const results = await this.db.query(query, values);
		return this.toCamelCase(results[0]);
	}

	// Delete record
	async delete(where: WhereInput): Promise<any> {
		const { clause, params } = this.buildWhereClause(where);

		const query = `
      DELETE FROM ${this.tableName} 
      ${clause} 
      RETURNING *
    `;

		const results = await this.db.query(query, params);
		return this.toCamelCase(results[0]);
	}

	// Delete many records
	async deleteMany(options: DeleteManyOptions = {}): Promise<{ count: number }> {
		const { clause, params } = this.buildWhereClause(options.where || {});
		const query = `DELETE FROM ${this.tableName} ${clause}`;

		// Note: In real implementation, we'd need to count before delete or use RETURNING
		await this.db.query(query, params);
		return { count: 0 }; // Simplified
	}

	// Update many records
	async updateMany(where: WhereInput, data: UpdateInput): Promise<{ count: number }> {
		const snakeData = this.toSnakeCase(data);
		const sets = Object.keys(snakeData).map((key) => `${key} = ?`);
		const values = [...Object.values(snakeData)];

		const { clause, params } = this.buildWhereClause(where);
		values.push(...params);

		const query = `
      UPDATE ${this.tableName} 
      SET ${sets.join(", ")}, updated_at = NOW() 
      ${clause}
    `;

		// Note: In real implementation, we'd use RETURNING to get actual count
		await this.db.query(query, values);
		return { count: 0 }; // Simplified
	}

	// Find first record
	async findFirst(options: FindManyOptions = {}): Promise<any | null> {
		const results = await this.findMany({ ...options, take: 1 });
		return results.length > 0 ? results[0] : null;
	}

	// Find or throw
	async findUniqueOrThrow(options: FindUniqueOptions): Promise<any> {
		const result = await this.findUnique(options);
		if (!result) {
			throw new Error("Record not found");
		}
		return result;
	}
}

// Factory function to create models with the exact same API as Prisma
export function createModel<T extends BaseModel>(ModelClass: new (tableName: string) => T, tableName: string): T {
	return new ModelClass(tableName);
}

// Transaction wrapper to mimic Prisma's $transaction
export async function transaction<T>(
	callback: (trx: Database) => Promise<T>,
	options?: TransactionOptions,
): Promise<T> {
	const db = Database.getInstance();
	return await db.transaction(callback, options);
}

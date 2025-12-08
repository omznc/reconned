#!/usr/bin/env bun

/**
 * Migration script to generate SQL migrations from Prisma schema
 * This script reads Prisma schema files and converts them to SQL DDL
 */

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

// Prisma schema to SQL mapping
const typeMapping: Record<string, string> = {
    String: "VARCHAR(255)",
    "String?": "VARCHAR(255)",
    "String[]": "TEXT[]",
    Int: "INTEGER",
    "Int?": "INTEGER",
    "Int[]": "INTEGER[]",
    Float: "DECIMAL(10,2)",
    "Float?": "DECIMAL(10,2)",
    "Float[]": "DECIMAL(10,2)[]",
    Boolean: "BOOLEAN",
    "Boolean?": "BOOLEAN",
    "Boolean[]": "BOOLEAN[]",
    DateTime: "TIMESTAMPTZ",
    "DateTime?": "TIMESTAMPTZ",
    Json: "JSONB",
    "Json?": "JSONB",
    "Json[]": "JSONB[]",
};

// Read all Prisma schema files
const schemaFiles = [
    "prisma/schema.prisma",
    "prisma/users.prisma",
    "prisma/clubs.prisma",
    "prisma/events.prisma",
    "prisma/auth.prisma",
    "prisma/social.prisma",
    "prisma/audit.prisma",
    "prisma/countries.prisma",
];

async function generateMigrations() {
    console.log("🚀 Generating SQL migrations from Prisma schema...");

    // Ensure migrations directory exists
    const migrationsDir = "migrations";
    if (!existsSync(migrationsDir)) {
        await mkdir(migrationsDir);
    }

    let allModels = "";
    let allEnums = "";

    // Read and parse schema files
    for (const file of schemaFiles) {
        try {
            const content = await readFile(file, "utf-8");
            console.log(`📖 Reading ${file}...`);

            // Extract enums
            const enumMatches = content.match(/enum\s+(\w+)\s*{[^}]+}/g);
            if (enumMatches) {
                for (const enumMatch of enumMatches) {
                    const enumName = enumMatch.match(/enum\s+(\w+)/)?.[1];
                    if (enumName) {
                        const values = enumMatch.match(/\s+(\w+)/g)?.map((v) => v.trim()) || [];
                        allEnums += `CREATE TYPE ${enumName} AS ENUM (${values.map((v) => `'${v}'`).join(", ")});\n\n`;
                    }
                }
            }

            // Extract models
            const modelMatches = content.match(/model\s+(\w+)\s*{[^}]+}/g);
            if (modelMatches) {
                for (const modelMatch of modelMatches) {
                    const modelName = modelMatch.match(/model\s+(\w+)/)?.[1];
                    if (modelName) {
                        console.log(`🔄 Processing model: ${modelName}`);
                        const sql = await convertModelToSQL(modelMatch, modelName);
                        allModels += `${sql}\n\n`;
                    }
                }
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.warn(`⚠️ Could not read ${file}:`, message);
        }
    }

    // Write SQL files
    const timestamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
    const migrationNumber = Math.floor(Math.random() * 1000)
        .toString()
        .padStart(3, "0");
    const migrationName = `${timestamp}_${migrationNumber}_initial_schema`;

    // Main migration file
    const migrationSQL = `-- Initial migration from Prisma schema
-- Generated on ${new Date().toISOString()}

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

${allEnums}

${allModels}
`;

    const migrationFile = join(migrationsDir, `${migrationName}.sql`);
    await writeFile(migrationFile, migrationSQL);
    console.log(`✅ Created migration: ${migrationFile}`);

    // Create schema documentation
    const schemaDoc = `# Database Schema

Generated from Prisma schema on ${new Date().toISOString()}

## Enums
${allEnums}

## Tables
${allModels}
`;

    await writeFile(join(migrationsDir, "schema.md"), schemaDoc);
    console.log("✅ Created schema documentation");

    // Create seed script
    const seedScript = `#!/usr/bin/env bun

import { Database } from '../src/lib/database';

const db = Database.getInstance();

async function seed() {
  console.log("🌱 Seeding database...");
  
  // Add sample data here
  console.log("✅ Database seeded successfully");
}

if (import.meta.main) {
  seed().catch(console.error);
}
`;

    await writeFile(join(migrationsDir, "seed.ts"), seedScript);
    console.log("✅ Created seed script");

    console.log("🎉 Migration generation complete!");
}

async function convertModelToSQL(modelMatch: string, modelName: string): Promise<string> {
    let sql = `CREATE TABLE ${modelName.toLowerCase()} (\n`;
    const fields: string[] = [];
    const tableName = modelName.toLowerCase();

    // Remove model declaration and braces
    const content = modelMatch.replace(/model\s+\w+\s*{/, "").replace(/}$/, "");

    // Split into lines and process each field
    const lines = content.split("\n").filter((line) => line.trim());

    for (const line of lines) {
        const trimmed = line.trim();

        // Skip comments
        if (trimmed.startsWith("//")) continue;

        // Parse field definition
        const fieldMatch = trimmed.match(/^(\w+)\s+(\w+(?:\?)?(?:\[?\]?)?)(.*)$/);
        if (fieldMatch) {
            const [, fieldName, fieldType, rest = ""] = fieldMatch;

            // Skip relation fields for now (they'll be handled separately)
            if (rest && (rest.includes("@relation") || rest.includes("@@relation"))) {
                continue;
            }

            // Map field type to SQL type
                    let sqlType = typeMapping[fieldType ?? ""] || "TEXT";

            // Handle special cases
            if (fieldType === "String" && fieldName.toLowerCase().includes("id")) {
                sqlType = "UUID";
            }

            // Build field definition
            let fieldDef = `  ${fieldName.toLowerCase()} ${sqlType}`;

            // Add constraints from @ directives
            if (rest.includes("@id")) {
                fieldDef += " PRIMARY KEY";
            }
            if (rest.includes("@default(ulid())")) {
                fieldDef += " DEFAULT uuid_generate_v4()";
            }
            if (rest.includes("@default(cuid())")) {
                fieldDef += " DEFAULT gen_random_uuid()";
            }
            if (rest.includes("@default(uuid())")) {
                fieldDef += " DEFAULT uuid_generate_v4()";
            }
            if (rest.includes("@default(now())")) {
                fieldDef += " DEFAULT NOW()";
            }
            if (rest.includes("@unique")) {
                fieldDef += " UNIQUE";
            }
            if (rest.includes("@default")) {
                const defaultMatch = rest.match(/@default\(([^)]+)\)/);
                if (defaultMatch && !defaultMatch[1].includes("now()")) {
                    const defaultValue = defaultMatch[1];
                    if (defaultValue === '""' || defaultValue === "''") {
                        fieldDef += ` DEFAULT ''`;
                    } else if (defaultValue === "true") {
                        fieldDef += " DEFAULT true";
                    } else if (defaultValue === "false") {
                        fieldDef += " DEFAULT false";
                    } else if (!Number.isNaN(Number(defaultValue))) {
                        fieldDef += ` DEFAULT ${defaultValue}`;
                    }
                }
            }

            fields.push(fieldDef);
        }

        // Handle index definitions
        const indexMatch = trimmed.match(/@@index\(\[(.*?)\]\)/);
        if (indexMatch) {
            const indexFields = indexMatch[1].split(",").map((f) => f.trim().replace(/"/g, ""));
            const indexName = `${tableName}_${indexFields.join("_")}_idx`;
            fields.push(`  -- Index: ${indexName} on (${indexFields.join(", ")})`);
        }

        // Handle unique constraints
        const uniqueMatch = trimmed.match(/@@unique\(\[(.*?)\]\)/);
        if (uniqueMatch) {
            const uniqueFields = uniqueMatch[1].split(",").map((f) => f.trim().replace(/"/g, ""));
            const constraintName = `${tableName}_${uniqueFields.join("_")}_key`;
            fields.push(`  -- Unique constraint: ${constraintName} on (${uniqueFields.join(", ")})`);
        }
    }

    sql += fields.join(",\n");
    sql += "\n);";

    // Add foreign key constraints (simplified)
    // In a real implementation, you'd parse @relation directives
    sql += `\n\n-- Foreign key constraints for ${tableName}`;
    sql += "\n-- TODO: Add proper foreign key constraints based on @relation directives";

    return sql;
}

// Run the migration generator
generateMigrations().catch(console.error);

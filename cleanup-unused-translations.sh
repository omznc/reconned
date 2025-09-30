#!/bin/bash

# Script to find and remove unused translation keys from messages/en.json
# This script analyzes TypeScript/TSX files to determine which translation keys are actually used

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
TRANSLATIONS_FILE="messages/en.json"
BACKUP_FILE="messages/en.json.backup"
SRC_DIR="src"
TEMP_FILE=$(mktemp)
USED_KEYS_FILE=$(mktemp)
ALL_KEYS_FILE=$(mktemp)

echo -e "${BLUE}🔍 Translation Key Cleanup Tool${NC}"
echo "=================================================="

# Check if translation file exists
if [ ! -f "$TRANSLATIONS_FILE" ]; then
    echo -e "${RED}❌ Translation file not found: $TRANSLATIONS_FILE${NC}"
    exit 1
fi

# Create backup
echo -e "${YELLOW}📋 Creating backup...${NC}"
cp "$TRANSLATIONS_FILE" "$BACKUP_FILE"
echo -e "${GREEN}✅ Backup created: $BACKUP_FILE${NC}"

# Extract all translation keys from en.json
echo -e "${YELLOW}📝 Extracting all translation keys...${NC}"
node -e "
const fs = require('fs');
const translations = JSON.parse(fs.readFileSync('$TRANSLATIONS_FILE', 'utf8'));

function extractKeys(obj, prefix = '') {
    const keys = [];
    for (const [key, value] of Object.entries(obj)) {
        const fullKey = prefix ? \`\${prefix}.\${key}\` : key;
        if (typeof value === 'object' && value !== null) {
            keys.push(...extractKeys(value, fullKey));
        } else {
            keys.push(fullKey);
        }
    }
    return keys;
}

const allKeys = extractKeys(translations);
console.log(allKeys.join('\n'));
" > "$ALL_KEYS_FILE"

TOTAL_KEYS=$(wc -l < "$ALL_KEYS_FILE")
echo -e "${BLUE}📊 Found $TOTAL_KEYS total translation keys${NC}"

# Find used translation keys in source files
echo -e "${YELLOW}🔎 Scanning source files for used translation keys...${NC}"

# Create temporary file for all patterns
TEMP_PATTERNS=$(mktemp)

# Pattern 1: t("key.path") - most common pattern in components (handles parameters)
echo "Scanning for t() calls..."
find "$SRC_DIR" -name "*.tsx" -o -name "*.ts" | xargs grep -ho 't("[^"]*"' 2>/dev/null | \
    sed 's/t("\([^"]*\)".*/\1/' >> "$TEMP_PATTERNS"

# Pattern 2: useTranslations()("key.path") - direct hook usage
echo "Scanning for useTranslations() calls..."
find "$SRC_DIR" -name "*.tsx" -o -name "*.ts" | xargs grep -ho 'useTranslations()("[^"]*")' 2>/dev/null | \
    sed 's/useTranslations()("\([^"]*\)").*/\1/' >> "$TEMP_PATTERNS"

# Pattern 3: getTranslations()("key.path") - server component usage
echo "Scanning for getTranslations() calls..."
find "$SRC_DIR" -name "*.tsx" -o -name "*.ts" | xargs grep -ho 'getTranslations()("[^"]*")' 2>/dev/null | \
    sed 's/getTranslations()("\([^"]*\)").*/\1/' >> "$TEMP_PATTERNS"

# Pattern 4: Check for any string that looks like a translation key in quotes
echo "Scanning for potential translation key strings..."
find "$SRC_DIR" -name "*.tsx" -o -name "*.ts" | xargs grep -ho '"[a-zA-Z][a-zA-Z0-9]*\.[a-zA-Z0-9.]*"' 2>/dev/null | \
    sed 's/"\([^"]*\)"/\1/' | \
    grep -E '^[a-zA-Z][a-zA-Z0-9]*(\.[a-zA-Z0-9]+)+$' >> "$TEMP_PATTERNS"

# Remove duplicates and empty lines
grep -v '^$' "$TEMP_PATTERNS" | sort -u > "$USED_KEYS_FILE"
rm -f "$TEMP_PATTERNS"

USED_KEYS_COUNT=$(wc -l < "$USED_KEYS_FILE")
echo -e "${BLUE}📊 Found $USED_KEYS_COUNT used translation keys${NC}"

# Find unused keys
echo -e "${YELLOW}🔍 Identifying unused keys...${NC}"
UNUSED_KEYS_FILE=$(mktemp)

# Simple approach: check if each key is directly used or if it's a parent of a used key
while IFS= read -r key; do
    key_used=false
    
    # Check if this exact key is used
    if grep -q "^$key$" "$USED_KEYS_FILE"; then
        key_used=true
    else
        # Check if this is a parent key (e.g., "common" is used if "common.actions.save" is used)
        if grep -q "^$key\." "$USED_KEYS_FILE"; then
            key_used=true
        fi
    fi
    
    if [ "$key_used" = false ]; then
        echo "$key" >> "$UNUSED_KEYS_FILE"
    fi
done < "$ALL_KEYS_FILE"

if [ ! -f "$UNUSED_KEYS_FILE" ] || [ ! -s "$UNUSED_KEYS_FILE" ]; then
    echo -e "${GREEN}🎉 No unused translation keys found!${NC}"
    rm -f "$TEMP_FILE" "$USED_KEYS_FILE" "$ALL_KEYS_FILE"
    exit 0
fi

UNUSED_COUNT=$(wc -l < "$UNUSED_KEYS_FILE")
echo -e "${RED}❌ Found $UNUSED_COUNT potentially unused translation keys:${NC}"
echo

# Display unused keys
echo -e "${YELLOW}Unused keys:${NC}"
cat "$UNUSED_KEYS_FILE" | head -20
if [ "$UNUSED_COUNT" -gt 20 ]; then
    echo -e "${YELLOW}... and $((UNUSED_COUNT - 20)) more${NC}"
fi
echo

# Ask user if they want to proceed
read -p "Do you want to remove these unused keys? (y/N): " -n 1 -r
echo
if [ "$REPLY" != "y" ] && [ "$REPLY" != "Y" ]; then
    echo -e "${YELLOW}⏹️  Operation cancelled${NC}"
    rm -f "$TEMP_FILE" "$USED_KEYS_FILE" "$ALL_KEYS_FILE" "$UNUSED_KEYS_FILE"
    exit 0
fi

# Create new translation file without unused keys
echo -e "${YELLOW}🗑️  Removing unused keys...${NC}"

node -e "
const fs = require('fs');
const translations = JSON.parse(fs.readFileSync('$TRANSLATIONS_FILE', 'utf8'));
const unusedKeys = fs.readFileSync('$UNUSED_KEYS_FILE', 'utf8').trim().split('\n').filter(k => k);

function removeKeys(obj, keysToRemove, currentPath = '') {
    const result = {};
    
    for (const [key, value] of Object.entries(obj)) {
        const fullPath = currentPath ? \`\${currentPath}.\${key}\` : key;
        
        // Skip if this key should be removed
        if (keysToRemove.includes(fullPath)) {
            continue;
        }
        
        if (typeof value === 'object' && value !== null) {
            const nested = removeKeys(value, keysToRemove, fullPath);
            // Only include nested object if it has content
            if (Object.keys(nested).length > 0) {
                result[key] = nested;
            }
        } else {
            result[key] = value;
        }
    }
    
    return result;
}

const cleanedTranslations = removeKeys(translations, unusedKeys);
fs.writeFileSync('$TRANSLATIONS_FILE', JSON.stringify(cleanedTranslations, null, '\t') + '\n');

console.log('Removed ' + unusedKeys.length + ' unused translation keys');
"

# Cleanup temp files
rm -f "$TEMP_FILE" "$USED_KEYS_FILE" "$ALL_KEYS_FILE" "$UNUSED_KEYS_FILE"

echo -e "${GREEN}✅ Successfully removed unused translation keys!${NC}"
echo -e "${BLUE}📋 Original file backed up to: $BACKUP_FILE${NC}"
echo -e "${YELLOW}⚠️  Please review the changes and test your application before committing.${NC}"

# Show summary
NEW_TOTAL=$(node -e "
const fs = require('fs');
const translations = JSON.parse(fs.readFileSync('$TRANSLATIONS_FILE', 'utf8'));
function countKeys(obj) {
    let count = 0;
    for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'object' && value !== null) {
            count += countKeys(value);
        } else {
            count++;
        }
    }
    return count;
}
console.log(countKeys(translations));
")

echo
echo -e "${BLUE}📊 Summary:${NC}"
echo -e "   Original keys: $TOTAL_KEYS"
echo -e "   Remaining keys: $NEW_TOTAL"
echo -e "   Removed keys: $((TOTAL_KEYS - NEW_TOTAL))"

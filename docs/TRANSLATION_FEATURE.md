# Automatic Description Translation Feature

This document describes the automatic translation feature for user bios, club descriptions, and event descriptions.

## Overview

When users save their bio, club description, or event description, the system automatically:
1. Detects the language of the input text
2. Translates it to all supported languages (currently: Bosnian and English)
3. Stores translations in a JSON field for fast access

## Architecture

### Database Schema

Three new JSON fields were added:
- `User.bioJson` - Stores translated bios
- `Club.descriptionJson` - Stores translated club descriptions
- `Event.descriptionJson` - Stores translated event descriptions

### Translation Flow

```
User saves description
    ↓
Action saves to database
    ↓
after() queues translation job (non-blocking)
    ↓
LLM detects source language
    ↓
LLM translates to all other languages
    ↓
Translations saved to JSON field
```

### Key Files

**OpenRouter Integration:**
- `src/lib/openrouter.ts` - API client for OpenRouter (using Grok Beta model)
- `src/lib/description-translator.ts` - Queue and process translation jobs using `after()`

**Database Migration:**
- `prisma/migrations/20241129120000_add_description_json_fields/migration.sql`
- `scripts/migrate-descriptions.ts` - One-time migration script for existing data

**Updated Actions:**
- `src/app/[locale]/dashboard/(club)/[clubId]/club/information/_components/club-info.action.ts`
- `src/app/[locale]/dashboard/(club)/[clubId]/events/create/_components/events.action.ts`
- `src/app/[locale]/dashboard/(user)/user/settings/_components/user-info.action.ts`

**Helpers:**
- `src/lib/get-translated-text.ts` - Helper to retrieve translations in the correct locale

## Environment Setup

Add to your `.env` file:

```
OPENROUTER_API_KEY="your-openrouter-api-key"
```

Get your API key from: https://openrouter.ai/

## Running the Migration

To migrate existing descriptions to the new JSON format:

```bash
bun migrate:descriptions
```

This script will:
1. Find all users, clubs, and events with existing descriptions
2. Detect the language of each description
3. Store the description in the appropriate locale within the JSON field

## Usage in Display Components

When displaying descriptions, use the `getTranslatedText()` helper:

```typescript
import { getTranslatedText } from "@/lib/get-translated-text";
import { getLocale } from "next-intl/server";

const locale = await getLocale();
const description = getTranslatedText(
  club.descriptionJson,
  club.description,
  locale
);
```

This will:
1. Try to get the translation for the current locale
2. Fall back to the first available translation
3. Fall back to the original description field

## Translation Model

The system uses OpenRouter with the Grok Beta model (`x-ai/grok-beta`), which provides:
- High-quality translations
- Support for multiple languages
- Fast response times
- Cost-effective pricing

## Performance Considerations

- Translations run asynchronously using Next.js `after()` function
- Users don't wait for translations to complete
- Original description is immediately available
- Translations appear within seconds to minutes depending on text length

## Avoiding Redundant Translations

The system only triggers translation when:
- A new description is created
- An existing description is modified
- The description content actually changed (not just form submission)

This prevents unnecessary API calls and costs.

## Supported Languages

Currently:
- Bosnian (`bs`)
- English (`en`)

To add more languages:
1. Add locale to `src/i18n/valid-locales.ts`
2. Update language names in `src/lib/openrouter.ts`
3. Add translation files in `messages/`

## Monitoring

Translation success/failure is logged to console. Consider adding:
- Error tracking (e.g., Sentry)
- Success metrics (e.g., how many translations completed)
- Cost tracking (API usage)

## Fallback Behavior

If OpenRouter API is unavailable:
- System continues to work normally
- Original descriptions are used
- No translations are stored
- User experience is not affected

## Future Improvements

Potential enhancements:
- Show translation status to users ("Translating...")
- Allow users to edit individual translations
- Add more languages
- Use different models for different language pairs
- Batch translation requests for efficiency

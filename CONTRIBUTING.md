# Contributing

## Structure
### Components

Components should:
 - Always be in PascalCase
 - Always be in a file that's lowercase kebab-case
 - If only used in a single place, co-locate it into a `_components` folder. 
 - If only applied to the current layout and sublayouts, co-locate it into `_components` folder on the same level as the highest parent layout.
 - Props shouldn't be inline-defined.


Components should **not**:
 - be default exported


Here are some examples

```tsx
# In file cool-table.tsx

interface CoolTableProps {
    params: {...},
    searchParams: {...}
}

export function CoolTable(props: CoolTableProps) # Function name uses PascalCase
```


 
```
    app/
        layout.tsx
        page.tsx
        profile/
            page.tsx
            _components/profile-photo.tsx
                page.tsx # Uses ProfilePhoto
                edit/page.tsx # Uses ProfilePhoto
        about/page.tsx # Doesn't use profile-photo, so no need to have it on its level

    components/ # Components that either don't fit in the above structure, or that are used app-wide. Examples:
        header.tsx
        footer.tsx
        theme-changer.tsx
        logo.tsx
```

## Other folders

If applicable, create other folders in the src dir and map them to @foldername

Example
```
    src/
        lib/ # @lib
        utils/ # @utils
        providers/ #@providers
```

## Formatting

We have a `biome.json` file in the root, always format with that configuration. No eslint, no prettier. Ever.

## Server actions

To have something modify something else, we're probably using a schema-form-action combo.
Let's say we have to change a password. We'd have this folder setup.
```
    _components/
        change-password.form.tsx // The form itself
        change-password.action.ts // Action(s) it requires
        change-password.schema.ts // Zod schema we can use on both client and server
```

## Tables

Use the `GenericDataTable` component for all tables in the application. It provides built-in sorting, filtering, searching, and pagination with URL state management.

There are 2 ways of it being used, read-only (server component compatible),
or with custom fields that use the cell value or row data.

### Read-only
A read-only table can be completely rendered server-side, so no reason to create a new component for it, like we do below.

### With actions
Can be found in `members/invitations/page.tsx` and the accompanying `members/invitations/_components/invitations-table.tsx`.

As you can see, if we're passing a `component` field in the config, it provides us with 2 elements, the cell value, and the row value. You can use those to do pretty much any logic you can think of. It needs to be a client component because we're using callbacks.

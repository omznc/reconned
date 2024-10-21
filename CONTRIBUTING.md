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

TODO, but

- We'll probably want to use https://next-safe-action.dev.
- Functions that take more than 1 parameter should have an object as their parameter.

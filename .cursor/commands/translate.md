# translate

Translation files live under apps/web/messages

When translate is triggered, that means I've run next dev which automatically generated all the keys from
the in-code usage of english strings. All the keys will exist in all language files, but everything other
than english will have empty values. You have to get the empty values, then compare those to the english values to get the original string you're translating, then translate it.
Note: serbian uses cyrllic.

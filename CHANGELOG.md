# Changelog

## master

## Breaking changes

- Changed store's event signature, from now on store events will be returned with signature `event, error, options`.
Options will always include `store` key that has the related storeId as value.
This change will make listening changes much easier as you can now re-render by just listening `expire` instead of adding separate `expire:storeId` listeners for all stores.
Events are still dispatched with previous signature `event:storeId, error, extra` but that format will be removed in the future.

## Other changes

- Fixed array merging in store's fetch

## Version `0.10.0`

## Breaking changes

- Dropped immstruct, Cerebellum's store now uses vanilla Immutable.js

## Other changes

- Added `identifier` option, by default Store assumes that `id` field defines the identity of model. It's currently only used in Store's fetch when merging changes.
- Store's fetch now properly merges Immutable.Lists, only changed items will be re-rendered when using pure render mixin with React.

## Version `0.9.0`

### Breaking changes

- Client's render now has a matching signature to server's render, they both
call the given render method with document, options & params/query.

## Version `0.8.0`

### Breaking changes

- Store's dispatch now returns promise, allows for easy error handling in view components
- Store's `trigger` is now deprecated, use `dispatch` instead.

### Other changes

- You can now define entry .html files per route pattern, e.g. /admin can use admin.html

## Version `0.7.0`

### Breaking changes
- Store's state is now held in [immstruct](https://github.com/omniscientjs/immstruct)
- Store's autoToJSON option was deprecated, all stores are now automatically converted to JSON for immstruct
- Store's autoClearCaches option is now enabled by default
- Store now marks caches as stale instead of immediately expiring them
- Store now performs optimistic creates, updates & deletes and automatically rolls back in case of API errors

### Other changes
- Store now tracks ongoing fetch requests to prevent multiple identical API calls
- Collection & model are now exported as standalone modules
- Server's fallback error handler now prints the stack trace
- Now written in ES6, build with `npm run build` & watch changes with `npm run watch`
- Fixed client side tests

## Version `0.6.0`

- Now uses [vertebrae](https://www.npmjs.com/package/vertebrae) instead of exoskeleton.
- Moved main modules from lib/ to root. It's now easier to `require('cerebellum/server')`

## Version `0.5.0`

- Easier cache clearing
- Added **relatedCaches**
- Added query string as last argument for route handlers
- Route context can also be a promise that resolves with object

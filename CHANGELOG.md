# Changelog

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

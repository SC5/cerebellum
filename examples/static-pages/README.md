# Static pages with cerebellum

Example implementation of static pages single-page app with cerebellum & React.js.

Acts as a single-page app after initial bootstrap from server, all routes are shared between server & client.

As server will always render the same thing as client and all the links are regular anchors, pages will work even with JavaScript disabled, try it :)

## Initial steps
Install dependencies:

    npm install

Build:

    npm build

Start (& reload server with nodemon on changes):

    npm start

Watch for changes (and rebuild public/js/app.js with source maps):

    npm watch
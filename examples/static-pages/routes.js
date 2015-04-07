var React = require('react/addons');
var NotFound = require('./components/not-found.jsx');
var Page = require('./components/page.jsx');

module.exports = {
  "/:page?": function(page) {
    page = page || "index";

    return this.store.fetch("page", {id: page}).then(function(pageStore) {
      return {
        title: pageStore.get("title"),
        component: React.createElement(Page, {
          title: pageStore.get("title"),
          content: pageStore.get("content") || {}
        })
      };
    }).catch(function(err) {
      // we could render different error message based on
      // err.status, but let's stick to "Not found" here
      return {
        title: "Not found",
        component: React.createElement(NotFound, {
          title: "Not found",
          content: "Page you requested was not found"
        })
      };
    });
  }
};

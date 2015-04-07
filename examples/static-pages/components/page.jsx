var React = require('react/addons');
var Jumbotron = require('react-bootstrap/Jumbotron');
var Panel = require('react-bootstrap/Panel');
var Navigation = require('./navigation.jsx');

var Page = React.createClass({
  render: function() {
    var content = this.props.content;
    return (
      <div>
        <Navigation />

        <Jumbotron>
          <h1>{this.props.title}</h1>
          <p>{content.get("subTitle")}</p>
        </Jumbotron>

        <Panel>
          {content.get("body")}
        </Panel>
      </div>
    );
  }
});

module.exports = Page;
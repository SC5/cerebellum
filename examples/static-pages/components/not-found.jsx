var React = require('react/addons');
var Jumbotron = require('react-bootstrap/Jumbotron');
var Panel = require('react-bootstrap/Panel');
var Navigation = require('./navigation.jsx');

var NotFound = React.createClass({
  render: function() {
    var content = this.props.content;
    return (
      <div>
        <Navigation />

        <Jumbotron>
          <h1>{this.props.title}</h1>
        </Jumbotron>

        <Panel>
          {content}
        </Panel>
      </div>
    );
  }
});

module.exports = NotFound;
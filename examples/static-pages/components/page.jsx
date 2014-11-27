var React = require('react/addons');
var ReactBootstrap = require('react-bootstrap');

var Jumbotron = ReactBootstrap.Jumbotron;
var Panel = ReactBootstrap.Panel;
var Navigation = require('./navigation.jsx');

var Page = React.createClass({
  render: function() {
    var content = this.props.content;
    return (
      <div>
        <Navigation />

        <Jumbotron>
          <h1>{this.props.title}</h1>
          <p>{content.subTitle}</p>
        </Jumbotron>

        <Panel>
          {content.body}
        </Panel>
      </div>
    );
  }
});

module.exports = Page;
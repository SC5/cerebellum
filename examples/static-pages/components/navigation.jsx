var React = require('react/addons');
var Navbar = require('react-bootstrap/Navbar');
var NavItem = require('react-bootstrap/NavItem');
var Nav = require('react-bootstrap/Nav');

var Navigation = React.createClass({
  render: function() {
    var brand = <a href="/" className="navbar-brand">Cerebellum.js</a>;
    return (
      <Navbar brand={brand} fixedTop toggleNavKey={0}>
        <Nav className="bs-navbar-collapse" key={0} role="navigation">
          <NavItem href="/client">Client</NavItem>
          <NavItem href="/server">Server</NavItem>
          <NavItem href="/routes">Routes</NavItem>
          <NavItem href="/stores">Stores</NavItem>
        </Nav>
      </Navbar>
    );
  }
});

module.exports = Navigation;

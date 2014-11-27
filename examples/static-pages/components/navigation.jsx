var React = require('react/addons');
var ReactBootstrap = require('react-bootstrap');

var Navbar = ReactBootstrap.Navbar;
var NavItem = ReactBootstrap.NavItem;
var Nav = ReactBootstrap.Nav;

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

import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';

const Navbar = () => {
  const { currentUser, logout, isAdmin } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="navbar">
      <div className="nav-container">
        <Link to="/events" className="nav-logo">
          Tickets2000
        </Link>

        <div className="nav-links">
          {currentUser ? (
            <>
              <Link to="/events" className="nav-link">Events</Link>
              <Link to="/purchase-history" className="nav-link">My Tickets</Link>
              <Link to="/marketplace" className="nav-link">Marketplace</Link>
              <Link to="/group-purchase" className="nav-link">Group Purchase</Link>
              <Link to="/friends" className="nav-link">Friends</Link>
              {isAdmin && (
                <div className="admin-dropdown">
                  <span className="admin-menu-label">Admin</span>
                  <div className="admin-dropdown-content">
                    <Link to="/admin/users" className="admin-link">Users</Link>
                    <Link to="/admin/events" className="admin-link">Events</Link>
                  </div>
                </div>
              )}
              <div className="nav-user">
                <span>Hello, {currentUser.firstName}</span>
                <button onClick={handleLogout} className="logout-btn">
                  Logout
                </button>
              </div>
            </>
          ) : (
            <>
              <Link to="/login" className="nav-link">Login</Link>
              <Link to="/register" className="nav-link">Register</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
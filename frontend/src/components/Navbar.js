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

              {/* Tickets Dropdown */}
              <div className="nav-dropdown">
                <span className="nav-menu-label">My Tickets ▾</span>
                <div className="nav-dropdown-content">
                  <Link to="/purchase-history" className="nav-dropdown-link">Purchase History</Link>
                  <Link to="/marketplace" className="nav-dropdown-link">Marketplace</Link>
                </div>
              </div>

              {/* Social Dropdown */}
              <div className="nav-dropdown">
                <span className="nav-menu-label">Social ▾</span>
                <div className="nav-dropdown-content">
                  <Link to="/group-purchase" className="nav-dropdown-link">Group Purchase</Link>
                  <Link to="/friends" className="nav-dropdown-link">Friends</Link>
                </div>
              </div>

              {isAdmin && (
                <div className="nav-dropdown">
                  <span className="nav-menu-label">Admin ▾</span>
                  <div className="nav-dropdown-content">
                    <Link to="/admin/users" className="nav-dropdown-link">Users</Link>
                    <Link to="/admin/events" className="nav-dropdown-link">Events</Link>
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
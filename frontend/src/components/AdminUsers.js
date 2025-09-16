import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import './AdminUsers.css';

const AdminUsers = () => {
  const { token, isAdmin } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAdmin) {
      setError('Access denied. Admin privileges required.');
      setLoading(false);
      return;
    }
    fetchUsers();
  }, [isAdmin]);

  const fetchUsers = async () => {
    try {
      const response = await axios.get('http://localhost:3001/api/admin/users', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsers(response.data);
    } catch (error) {
      setError('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const toggleAdminStatus = async (userId, currentAdminStatus) => {
    try {
      await axios.put(
        `http://localhost:3001/api/admin/users/${userId}/admin`,
        { isAdmin: !currentAdminStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setUsers(users.map(user =>
        user.id === userId
          ? { ...user, isAdmin: !currentAdminStatus }
          : user
      ));
    } catch (error) {
      setError('Failed to update admin status');
    }
  };

  if (!isAdmin) {
    return (
      <div className="admin-users-container">
        <div className="error-message">
          Access denied. You must be an administrator to view this page.
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="admin-users-container">
        <div className="loading">Loading users...</div>
      </div>
    );
  }

  return (
    <div className="admin-users-container">
      <h1>User Management</h1>

      {error && <div className="error-message">{error}</div>}

      <div className="users-table-container">
        <table className="users-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Admin Status</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id}>
                <td>{user.firstName} {user.lastName}</td>
                <td>{user.email}</td>
                <td>
                  <span className={`admin-badge ${user.isAdmin ? 'admin' : 'regular'}`}>
                    {user.isAdmin ? 'Admin' : 'User'}
                  </span>
                </td>
                <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                <td>
                  <button
                    className={`admin-toggle-btn ${user.isAdmin ? 'demote' : 'promote'}`}
                    onClick={() => toggleAdminStatus(user.id, user.isAdmin)}
                  >
                    {user.isAdmin ? 'Remove Admin' : 'Make Admin'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminUsers;
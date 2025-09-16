import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { API_BASE_URL } from '../config/api';
import './Friends.css';

const Friends = () => {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState('friends');
  const [friends, setFriends] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchFriends();
    fetchFriendRequests();
  }, []);

  const fetchFriends = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/friends`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setFriends(response.data);
    } catch (error) {
      setError('Failed to fetch friends');
    }
  };

  const fetchFriendRequests = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/friends/requests`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setFriendRequests(response.data);
    } catch (error) {
      setError('Failed to fetch friend requests');
    }
  };

  const searchUsers = async (query) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/users/search?query=${encodeURIComponent(query)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSearchResults(response.data);
    } catch (error) {
      setError('Failed to search users');
    } finally {
      setLoading(false);
    }
  };

  const sendFriendRequest = async (recipientId) => {
    try {
      await axios.post(`${API_BASE_URL}/friends/request`,
        { recipientId },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Remove from search results
      setSearchResults(prev => prev.filter(user => user.id !== recipientId));
      setError('');
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to send friend request');
    }
  };

  const respondToRequest = async (requestId, action) => {
    try {
      await axios.put(`${API_BASE_URL}/friends/request/${requestId}`,
        { action },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Refresh data
      fetchFriendRequests();
      if (action === 'accept') {
        fetchFriends();
      }
      setError('');
    } catch (error) {
      setError('Failed to respond to friend request');
    }
  };

  const removeFriend = async (friendId) => {
    if (!window.confirm('Are you sure you want to remove this friend?')) {
      return;
    }

    try {
      await axios.delete(`${API_BASE_URL}/friends/${friendId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      fetchFriends();
      setError('');
    } catch (error) {
      setError('Failed to remove friend');
    }
  };

  const handleSearch = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    searchUsers(query);
  };

  return (
    <div className="friends-container">
      <div className="friends-header">
        <h1>Social</h1>
        <div className="tab-navigation">
          <button
            className={`tab ${activeTab === 'friends' ? 'active' : ''}`}
            onClick={() => setActiveTab('friends')}
          >
            My Friends ({friends.length})
          </button>
          <button
            className={`tab ${activeTab === 'requests' ? 'active' : ''}`}
            onClick={() => setActiveTab('requests')}
          >
            Requests ({friendRequests.length})
          </button>
          <button
            className={`tab ${activeTab === 'search' ? 'active' : ''}`}
            onClick={() => setActiveTab('search')}
          >
            Find Friends
          </button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      {activeTab === 'friends' && (
        <div className="friends-list">
          {friends.length === 0 ? (
            <div className="empty-state">
              <p>You don't have any friends yet. Search for users to send friend requests!</p>
            </div>
          ) : (
            friends.map(friend => (
              <div key={friend.friendId} className="friend-card">
                <div className="friend-info">
                  <h3>{friend.firstName} {friend.lastName}</h3>
                  <p>{friend.email}</p>
                  <button
                    className="remove-btn"
                    onClick={() => removeFriend(friend.friendId)}
                  >
                    Remove Friend
                  </button>
                </div>

                <div className="friend-events">
                  <h4>Upcoming Events ({friend.events.length})</h4>
                  {friend.events.length === 0 ? (
                    <p className="no-events">No upcoming events</p>
                  ) : (
                    <div className="events-list">
                      {friend.events.map(event => (
                        <div key={event.id} className="event-item">
                          <div className="event-info">
                            <strong>{event.title}</strong>
                            <p>{event.venueName}</p>
                            <p>{new Date(event.date).toLocaleDateString()}</p>
                          </div>
                          <div className="seat-info">
                            <span className="seat-badge">
                              {event.section} {event.row}-{event.seatNumber}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'requests' && (
        <div className="requests-list">
          {friendRequests.length === 0 ? (
            <div className="empty-state">
              <p>No pending friend requests</p>
            </div>
          ) : (
            friendRequests.map(request => (
              <div key={request.id} className="request-card">
                <div className="request-info">
                  <h3>{request.firstName} {request.lastName}</h3>
                  <p>{request.email}</p>
                  <p className="request-date">
                    Sent {new Date(request.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="request-actions">
                  <button
                    className="accept-btn"
                    onClick={() => respondToRequest(request.id, 'accept')}
                  >
                    Accept
                  </button>
                  <button
                    className="decline-btn"
                    onClick={() => respondToRequest(request.id, 'decline')}
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'search' && (
        <div className="search-section">
          <div className="search-input-container">
            <input
              type="text"
              placeholder="Search for users by name or email..."
              value={searchQuery}
              onChange={handleSearch}
              className="search-input"
            />
          </div>

          {loading && <div className="loading">Searching...</div>}

          <div className="search-results">
            {searchResults.map(user => (
              <div key={user.id} className="user-card">
                <div className="user-info">
                  <h3>{user.firstName} {user.lastName}</h3>
                  <p>{user.email}</p>
                </div>
                <button
                  className="send-request-btn"
                  onClick={() => sendFriendRequest(user.id)}
                >
                  Send Friend Request
                </button>
              </div>
            ))}
          </div>

          {searchQuery.length >= 2 && searchResults.length === 0 && !loading && (
            <div className="no-results">
              No users found matching "{searchQuery}"
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Friends;
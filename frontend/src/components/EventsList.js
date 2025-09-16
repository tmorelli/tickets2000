import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import './EventsList.css';

const EventsList = () => {
  const { token } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showFriendsModal, setShowFriendsModal] = useState(false);
  const [selectedEventFriends, setSelectedEventFriends] = useState([]);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const response = await axios.get('http://localhost:3001/api/events', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setEvents(response.data);
      } catch (error) {
        setError('Error loading events');
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, []);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isOnSaleNow = (onSaleDateString) => {
    if (!onSaleDateString) return true; // If no onSaleDate set, assume it's on sale
    const onSaleDate = new Date(onSaleDateString);
    const now = new Date();
    return now >= onSaleDate;
  };

  const formatOnSaleDate = (onSaleDateString) => {
    if (!onSaleDateString) return 'TBA';
    const date = new Date(onSaleDateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const showFriendsList = (friends) => {
    setSelectedEventFriends(friends);
    setShowFriendsModal(true);
  };

  if (loading) {
    return (
      <div className="events-container">
        <div className="loading">Loading events...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="events-container">
        <div className="error">{error}</div>
      </div>
    );
  }

  return (
    <div className="events-container">
      <h1>Upcoming Events</h1>
      <div className="events-grid">
        {events.map((event) => (
          <div key={event.id} className={`event-card ${event.isUserAttending ? 'user-attending' : ''}`}>
            {/* Social indicators */}
            <div className="social-indicators">
              {event.isUserAttending && (
                <div className="attending-badge">
                  ✓ You're Going!
                </div>
              )}
              {event.friendsAttending && event.friendsAttending.length > 0 && (
                <div
                  className="friends-attending-badge"
                  onClick={() => showFriendsList(event.friendsAttending)}
                >
                  👥 {event.friendsAttending.length} friend{event.friendsAttending.length > 1 ? 's' : ''} going
                </div>
              )}
            </div>

            <div className="event-image-container">
              {event.imageUrl ? (
                <img src={event.imageUrl} alt={event.title} className="event-image" />
              ) : (
                <div className="event-placeholder">
                  <h3>{event.title}</h3>
                </div>
              )}
            </div>
            <div className="event-details">
              <h2>{event.title}</h2>
              <p className="event-venue">{event.venueName}</p>
              <p className="event-address">{event.venueAddress}</p>
              <p className="event-date">{formatDate(event.date)}</p>
              <p className="event-description">{event.description}</p>
              {isOnSaleNow(event.onSaleDate) ? (
                <Link to={`/events/${event.id}`} className="select-seats-btn">
                  Select Seats
                </Link>
              ) : (
                <div className="on-sale-info">
                  <div className="on-sale-date">
                    On Sale: {formatOnSaleDate(event.onSaleDate)}
                  </div>
                  <button className="select-seats-btn disabled" disabled>
                    Tickets Not Available
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Friends Modal */}
      {showFriendsModal && (
        <div className="modal-overlay" onClick={() => setShowFriendsModal(false)}>
          <div className="friends-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Friends Attending</h3>
              <button
                className="close-btn"
                onClick={() => setShowFriendsModal(false)}
              >
                ×
              </button>
            </div>
            <div className="friends-list">
              {selectedEventFriends.map((friend, index) => (
                <div key={index} className="friend-item">
                  <div className="friend-info">
                    <strong>{friend.firstName} {friend.lastName}</strong>
                  </div>
                  <div className="friend-seat">
                    Seats: {friend.seats}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EventsList;
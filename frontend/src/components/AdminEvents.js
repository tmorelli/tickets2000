import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import './AdminEvents.css';

const AdminEvents = () => {
  const { token, isAdmin } = useAuth();
  const [events, setEvents] = useState([]);
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [formData, setFormData] = useState({
    venueId: '',
    title: '',
    description: '',
    date: '',
    imageUrl: '',
    onSale: true
  });

  useEffect(() => {
    if (!isAdmin) {
      setError('Access denied. Admin privileges required.');
      setLoading(false);
      return;
    }
    fetchEvents();
    fetchVenues();
  }, [isAdmin]);

  const fetchEvents = async () => {
    try {
      const response = await axios.get('http://localhost:3001/api/admin/events', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEvents(response.data);
    } catch (error) {
      setError('Failed to fetch events');
    } finally {
      setLoading(false);
    }
  };

  const fetchVenues = async () => {
    try {
      const response = await axios.get('http://localhost:3001/api/venues');
      setVenues(response.data);
    } catch (error) {
      console.error('Failed to fetch venues');
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      if (editingEvent) {
        await axios.put(
          `http://localhost:3001/api/admin/events/${editingEvent.id}`,
          formData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
      } else {
        await axios.post(
          'http://localhost:3001/api/admin/events',
          formData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }

      await fetchEvents();
      resetForm();
      setError('');
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to save event');
    }
  };

  const handleEdit = (event) => {
    setEditingEvent(event);
    setFormData({
      venueId: event.venueId,
      title: event.title,
      description: event.description || '',
      date: new Date(event.date).toISOString().slice(0, 16),
      imageUrl: event.imageUrl || '',
      onSale: event.onSale
    });
    setShowCreateForm(true);
  };

  const handleDelete = async (eventId) => {
    if (!window.confirm('Are you sure you want to delete this event?')) {
      return;
    }

    try {
      await axios.delete(
        `http://localhost:3001/api/admin/events/${eventId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await fetchEvents();
      setError('');
    } catch (error) {
      setError('Failed to delete event');
    }
  };

  const resetForm = () => {
    setFormData({
      venueId: '',
      title: '',
      description: '',
      date: '',
      imageUrl: '',
      onSale: true
    });
    setEditingEvent(null);
    setShowCreateForm(false);
  };

  if (!isAdmin) {
    return (
      <div className="admin-events-container">
        <div className="error-message">
          Access denied. You must be an administrator to view this page.
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="admin-events-container">
        <div className="loading">Loading events...</div>
      </div>
    );
  }

  return (
    <div className="admin-events-container">
      <div className="admin-header">
        <h1>Event Management</h1>
        <button
          className="create-btn"
          onClick={() => setShowCreateForm(true)}
        >
          Create New Event
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      {showCreateForm && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>{editingEvent ? 'Edit Event' : 'Create New Event'}</h2>
              <button className="close-btn" onClick={resetForm}>×</button>
            </div>

            <form onSubmit={handleSubmit} className="event-form">
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="venueId">Venue *</label>
                  <select
                    id="venueId"
                    name="venueId"
                    value={formData.venueId}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="">Select a venue</option>
                    {venues.map(venue => (
                      <option key={venue.id} value={venue.id}>
                        {venue.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="title">Title *</label>
                  <input
                    type="text"
                    id="title"
                    name="title"
                    value={formData.title}
                    onChange={handleInputChange}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="description">Description</label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows="3"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="date">Date & Time *</label>
                  <input
                    type="datetime-local"
                    id="date"
                    name="date"
                    value={formData.date}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="imageUrl">Image URL</label>
                  <input
                    type="url"
                    id="imageUrl"
                    name="imageUrl"
                    value={formData.imageUrl}
                    onChange={handleInputChange}
                    placeholder="https://example.com/image.jpg"
                  />
                </div>
              </div>

              <div className="form-group checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="onSale"
                    checked={formData.onSale}
                    onChange={handleInputChange}
                  />
                  Available for purchase (visible to users)
                </label>
              </div>

              <div className="form-actions">
                <button type="button" onClick={resetForm} className="cancel-btn">
                  Cancel
                </button>
                <button type="submit" className="save-btn">
                  {editingEvent ? 'Update Event' : 'Create Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="events-grid">
        {events.map(event => (
          <div key={event.id} className="admin-event-card">
            <div className="event-status">
              <span className={`status-badge ${event.onSale ? 'on-sale' : 'off-sale'}`}>
                {event.onSale ? 'On Sale' : 'Hidden'}
              </span>
            </div>

            <div className="event-image">
              {event.imageUrl ? (
                <img src={event.imageUrl} alt={event.title} />
              ) : (
                <div className="event-placeholder">
                  <h3>{event.title}</h3>
                </div>
              )}
            </div>

            <div className="event-details">
              <h3>{event.title}</h3>
              <p><strong>Venue:</strong> {event.venueName}</p>
              <p><strong>Date:</strong> {new Date(event.date).toLocaleString()}</p>
              <p><strong>Address:</strong> {event.venueAddress}</p>
              {event.description && (
                <p><strong>Description:</strong> {event.description}</p>
              )}
            </div>

            <div className="event-actions">
              <button
                className="edit-btn"
                onClick={() => handleEdit(event)}
              >
                Edit Event
              </button>
              <button
                className="delete-btn"
                onClick={() => handleDelete(event.id)}
              >
                Delete Event
              </button>
            </div>
          </div>
        ))}
      </div>

      {events.length === 0 && !loading && (
        <div className="no-events">
          No events found. Click "Create New Event" to add your first event!
        </div>
      )}
    </div>
  );
};

export default AdminEvents;
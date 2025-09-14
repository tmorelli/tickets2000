import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import './EventsList.css';

const EventsList = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const response = await axios.get('http://localhost:3001/api/events');
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
          <div key={event.id} className="event-card">
            <img src={event.imageUrl} alt={event.title} className="event-image" />
            <div className="event-details">
              <h2>{event.title}</h2>
              <p className="event-venue">{event.venueName}</p>
              <p className="event-address">{event.venueAddress}</p>
              <p className="event-date">{formatDate(event.date)}</p>
              <p className="event-description">{event.description}</p>
              <Link to={`/events/${event.id}`} className="select-seats-btn">
                Select Seats
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default EventsList;
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import './PurchaseHistory.css';

const PurchaseHistory = () => {
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { currentUser } = useAuth();

  useEffect(() => {
    const fetchPurchases = async () => {
      if (!currentUser) {
        setLoading(false);
        return;
      }

      try {
        const response = await axios.get('http://localhost:3001/api/purchases');
        setPurchases(response.data);
      } catch (error) {
        setError('Error loading purchase history');
      } finally {
        setLoading(false);
      }
    };

    fetchPurchases();
  }, [currentUser]);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatDateTime = (dateString) => {
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

  if (!currentUser) {
    return (
      <div className="purchase-history-container">
        <div className="error">Please log in to view your purchase history.</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="purchase-history-container">
        <div className="loading">Loading your tickets...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="purchase-history-container">
        <div className="error">{error}</div>
      </div>
    );
  }

  if (purchases.length === 0) {
    return (
      <div className="purchase-history-container">
        <h1>My Tickets</h1>
        <div className="no-purchases">
          <h3>No tickets found</h3>
          <p>You haven't purchased any tickets yet. Browse our events to get started!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="purchase-history-container">
      <h1>My Tickets</h1>
      <div className="purchases-grid">
        {purchases.map((purchase) => (
          <div key={purchase.id} className="ticket-card">
            <div className="ticket-header">
              <h2>{purchase.eventTitle}</h2>
              <div className="purchase-date">
                Purchased: {formatDate(purchase.purchaseDate)}
              </div>
            </div>

            <div className="ticket-details">
              <div className="venue-info">
                <strong>{purchase.venueName}</strong>
              </div>

              <div className="event-date">
                {formatDateTime(purchase.eventDate)}
              </div>

              <div className="seat-info">
                <div className="seat-location">
                  <span className="label">Section:</span>
                  <span className="value">{purchase.section}</span>
                </div>
                <div className="seat-location">
                  <span className="label">Row:</span>
                  <span className="value">{purchase.row}</span>
                </div>
                <div className="seat-location">
                  <span className="label">Seat:</span>
                  <span className="value">{purchase.seatNumber}</span>
                </div>
              </div>

              <div className="price-info">
                <span className="price">${parseFloat(purchase.price).toFixed(2)}</span>
              </div>
            </div>

            <div className="ticket-footer">
              <div className="ticket-id">
                Ticket ID: {purchase.id.slice(0, 8)}...
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="purchase-summary">
        <h3>Summary</h3>
        <p>Total Tickets: {purchases.length}</p>
        <p>Total Spent: ${purchases.reduce((sum, purchase) => sum + parseFloat(purchase.price), 0).toFixed(2)}</p>
      </div>
    </div>
  );
};

export default PurchaseHistory;
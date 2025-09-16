import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { API_BASE_URL } from '../config/api';
import PaymentForm from './PaymentForm';
import './Marketplace.css';

const Marketplace = () => {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState('my-listings');
  const [myListings, setMyListings] = useState([]);
  const [myTickets, setMyTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showListingForm, setShowListingForm] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [listingPrice, setListingPrice] = useState('');
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [selectedListing, setSelectedListing] = useState(null);

  useEffect(() => {
    if (activeTab === 'my-listings') {
      fetchMyListings();
    } else if (activeTab === 'list-tickets') {
      fetchMyTickets();
    }
  }, [activeTab]);

  const fetchMyListings = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/marketplace/listings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMyListings(response.data);
    } catch (error) {
      setError('Failed to fetch marketplace listings');
    } finally {
      setLoading(false);
    }
  };

  const fetchMyTickets = async () => {
    setLoading(true);
    try {
      // First get listings to filter out already listed tickets
      const [ticketsResponse, listingsResponse] = await Promise.all([
        axios.get(`${API_BASE_URL}/purchases`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_BASE_URL}/marketplace/listings`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      // Filter for tickets that aren't already listed
      const listedSeatIds = listingsResponse.data.map(listing => listing.seatId);
      const availableTickets = ticketsResponse.data.filter(ticket =>
        !listedSeatIds.includes(ticket.seatId)
      );

      setMyTickets(availableTickets);
    } catch (error) {
      setError('Failed to fetch tickets');
    } finally {
      setLoading(false);
    }
  };

  const handleListTicket = (ticket) => {
    setSelectedTicket(ticket);
    setListingPrice((ticket.price || '0').toString());
    setShowListingForm(true);
  };

  const submitListing = async () => {
    if (!selectedTicket || !listingPrice) return;

    try {
      await axios.post(`${API_BASE_URL}/marketplace/listings`, {
        eventId: selectedTicket.eventId,
        seatId: selectedTicket.seatId,
        price: parseFloat(listingPrice)
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      alert('Ticket listed on marketplace successfully!');
      setShowListingForm(false);
      setSelectedTicket(null);
      setListingPrice('');

      // Refresh data
      fetchMyListings();
      if (activeTab === 'list-tickets') {
        fetchMyTickets();
      }
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to list ticket');
    }
  };

  const removeListing = async (listingId) => {
    if (!window.confirm('Are you sure you want to remove this listing?')) return;

    try {
      await axios.delete(`${API_BASE_URL}/marketplace/listings/${listingId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      alert('Listing removed successfully!');
      fetchMyListings();
      if (activeTab === 'list-tickets') {
        fetchMyTickets();
      }
    } catch (error) {
      setError('Failed to remove listing');
    }
  };

  const handleBuyTicket = (listing) => {
    setSelectedListing(listing);
    setShowPaymentForm(true);
  };

  const handlePaymentSubmit = async (paymentInfo) => {
    if (!selectedListing) return;

    try {
      await axios.post(`${API_BASE_URL}/marketplace/purchase/${selectedListing.id}`, {
        paymentInfo
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      alert('Marketplace ticket purchased successfully!');
      setShowPaymentForm(false);
      setSelectedListing(null);
    } catch (error) {
      alert(error.response?.data?.message || 'Error purchasing ticket');
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="marketplace-container">
      <div className="marketplace-header">
        <h1>Marketplace</h1>
        <div className="tab-navigation">
          <button
            className={`tab ${activeTab === 'my-listings' ? 'active' : ''}`}
            onClick={() => setActiveTab('my-listings')}
          >
            My Listings
          </button>
          <button
            className={`tab ${activeTab === 'list-tickets' ? 'active' : ''}`}
            onClick={() => setActiveTab('list-tickets')}
          >
            List Tickets
          </button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      {activeTab === 'my-listings' && (
        <div className="listings-section">
          {loading ? (
            <div className="loading">Loading listings...</div>
          ) : myListings.length === 0 ? (
            <div className="empty-state">
              <p>You haven't listed any tickets yet. Go to "List Tickets" to sell your tickets!</p>
            </div>
          ) : (
            <div className="listings-grid">
              {myListings.map(listing => (
                <div key={listing.id} className={`listing-card ${listing.status}`}>
                  <div className="listing-status">
                    <span className={`status-badge ${listing.status}`}>
                      {listing.status === 'available' ? 'For Sale' : 'SOLD'}
                    </span>
                  </div>

                  <div className="listing-details">
                    <h3>{listing.eventTitle}</h3>
                    <p><strong>Venue:</strong> {listing.venueName}</p>
                    <p><strong>Date:</strong> {formatDate(listing.eventDate)}</p>
                    <p><strong>Seat:</strong> {listing.section} - Row {listing.row}, Seat {listing.number}</p>
                    <p><strong>Price:</strong> ${parseFloat(listing.price).toFixed(2)}</p>
                    {listing.status === 'sold' && listing.soldAt && (
                      <p><strong>Sold:</strong> {formatDate(listing.soldAt)}</p>
                    )}
                  </div>

                  {listing.status === 'available' && (
                    <div className="listing-actions">
                      <button
                        className="remove-btn"
                        onClick={() => removeListing(listing.id)}
                      >
                        Remove Listing
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'list-tickets' && (
        <div className="tickets-section">
          {loading ? (
            <div className="loading">Loading tickets...</div>
          ) : myTickets.length === 0 ? (
            <div className="empty-state">
              <p>You don't have any tickets available to list. Purchase some tickets first!</p>
            </div>
          ) : (
            <div className="tickets-grid">
              {myTickets.map(ticket => (
                <div key={`${ticket.eventId}-${ticket.seatId}`} className="ticket-card">
                  <div className="ticket-details">
                    <h3>{ticket.eventTitle}</h3>
                    <p><strong>Venue:</strong> {ticket.venueName}</p>
                    <p><strong>Date:</strong> {formatDate(ticket.eventDate)}</p>
                    <p><strong>Seat:</strong> {ticket.section} - Row {ticket.row}, Seat {ticket.number}</p>
                    <p><strong>Original Price:</strong> ${parseFloat(ticket.price).toFixed(2)}</p>
                  </div>

                  <div className="ticket-actions">
                    <button
                      className="list-btn"
                      onClick={() => handleListTicket(ticket)}
                    >
                      List for Sale
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Listing Form Modal */}
      {showListingForm && selectedTicket && (
        <div className="modal-overlay" onClick={() => setShowListingForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>List Ticket for Sale</h2>
              <button className="close-btn" onClick={() => setShowListingForm(false)}>×</button>
            </div>

            <div className="listing-form">
              <div className="ticket-info">
                <h3>{selectedTicket.eventTitle}</h3>
                <p><strong>Venue:</strong> {selectedTicket.venueName}</p>
                <p><strong>Date:</strong> {formatDate(selectedTicket.eventDate)}</p>
                <p><strong>Seat:</strong> {selectedTicket.section} - Row {selectedTicket.row}, Seat {selectedTicket.number}</p>
                <p><strong>Original Price:</strong> ${parseFloat(selectedTicket.price).toFixed(2)}</p>
              </div>

              <div className="form-group">
                <label htmlFor="listingPrice">Listing Price *</label>
                <input
                  type="number"
                  id="listingPrice"
                  value={listingPrice}
                  onChange={(e) => setListingPrice(e.target.value)}
                  min="0"
                  step="0.01"
                  placeholder="Enter your listing price"
                />
                <small>Note: You can only list tickets at face value (original price)</small>
              </div>

              <div className="form-actions">
                <button onClick={() => setShowListingForm(false)} className="cancel-btn">
                  Cancel
                </button>
                <button onClick={submitListing} className="list-btn">
                  List Ticket
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Form Modal for buying marketplace tickets */}
      {showPaymentForm && selectedListing && (
        <PaymentForm
          onSubmit={handlePaymentSubmit}
          onCancel={() => {
            setShowPaymentForm(false);
            setSelectedListing(null);
          }}
          totalPrice={parseFloat(selectedListing.price).toFixed(2)}
          selectedSeats={[{
            section: selectedListing.section,
            row: selectedListing.row,
            number: selectedListing.number
          }]}
        />
      )}
    </div>
  );
};

export default Marketplace;
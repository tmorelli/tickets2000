import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import PaymentForm from './PaymentForm';
import './SeatMap.css';

const SeatMap = () => {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { currentUser, token } = useAuth();

  const [event, setEvent] = useState(null);
  const [seats, setSeats] = useState([]);
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState('');
  const [showPaymentForm, setShowPaymentForm] = useState(false);

  useEffect(() => {
    const fetchEventAndSeats = async () => {
      try {
        const [eventResponse, seatsResponse] = await Promise.all([
          axios.get(`http://localhost:3001/api/events/${eventId}`),
          axios.get(`http://localhost:3001/api/events/${eventId}/seats`)
        ]);

        setEvent(eventResponse.data);
        setSeats(seatsResponse.data);
      } catch (error) {
        setError('Error loading event details');
      } finally {
        setLoading(false);
      }
    };

    fetchEventAndSeats();
  }, [eventId]);

  const handleSeatClick = (seat) => {
    if (seat.isPurchased) return;

    const isSelected = selectedSeats.find(s => s.id === seat.id);

    if (isSelected) {
      // Remove seat from selection
      setSelectedSeats(selectedSeats.filter(s => s.id !== seat.id));
    } else {
      // Add seat to selection (max 8 seats)
      if (selectedSeats.length < 8) {
        setSelectedSeats([...selectedSeats, seat]);
      } else {
        alert('You can select a maximum of 8 seats');
      }
    }
  };

  const handlePurchaseClick = () => {
    if (selectedSeats.length === 0 || !currentUser) return;
    setShowPaymentForm(true);
  };

  const handlePaymentSubmit = async (paymentInfo) => {
    setPurchasing(true);
    try {
      const seatIds = selectedSeats.map(seat => seat.id);

      const response = await axios.post('http://localhost:3001/api/purchase', {
        eventId,
        seatIds,
        paymentInfo
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      alert(`${selectedSeats.length} ticket(s) purchased successfully!`);
      setShowPaymentForm(false);
      navigate('/purchase-history');
    } catch (error) {
      alert(error.response?.data?.message || 'Error purchasing tickets');
    } finally {
      setPurchasing(false);
    }
  };

  const handlePaymentCancel = () => {
    setShowPaymentForm(false);
  };

  const getSeatColor = (seat) => {
    if (seat.isPurchased) return '#ff6b6b';
    if (selectedSeats.find(s => s.id === seat.id)) return '#51cf66';
    return '#339af0';
  };

  const getSeatPrice = (seat) => {
    return (seat.basePrice * seat.multiplier).toFixed(2);
  };

  if (loading) {
    return <div className="seat-map-container"><div className="loading">Loading seat map...</div></div>;
  }

  if (error) {
    return <div className="seat-map-container"><div className="error">{error}</div></div>;
  }

  return (
    <div className="seat-map-container">
      <div className="event-header">
        <h1>{event.title}</h1>
        <p className="venue-info">{event.venueName} - {event.venueAddress}</p>
        <p className="event-date">{new Date(event.date).toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })}</p>
      </div>

      <div className="seat-map-content">
        <div className="seat-map">
          <div className="seats-container">
            <svg width="800" height="600" viewBox="0 0 800 600">
              {/* Stage area at top */}
              <rect
                x="200"
                y="40"
                width="400"
                height="60"
                fill="#333"
                stroke="#222"
                strokeWidth="2"
                rx="5"
              />
              <text
                x="400"
                y="75"
                textAnchor="middle"
                fontSize="16"
                fill="white"
                fontWeight="bold"
              >
                STAGE
              </text>

              {/* Render seats */}
              {seats.map((seat) => (
                <g key={seat.id}>
                  <circle
                    cx={seat.x}
                    cy={seat.y}
                    r="6"
                    fill={getSeatColor(seat)}
                    stroke="#333"
                    strokeWidth="0.5"
                    style={{
                      cursor: seat.isPurchased ? 'not-allowed' : 'pointer',
                      opacity: seat.isPurchased ? 0.4 : 0.9,
                      transition: 'all 0.2s ease'
                    }}
                    onClick={() => handleSeatClick(seat)}
                  />
                  {selectedSeats.find(s => s.id === seat.id) && (
                    <circle
                      cx={seat.x}
                      cy={seat.y}
                      r="9"
                      fill="none"
                      stroke="#51cf66"
                      strokeWidth="2"
                      style={{ pointerEvents: 'none' }}
                    />
                  )}
                </g>
              ))}

              {/* Section labels */}
              <text x="50" y="180" fontSize="12" fill="#666" fontWeight="bold">VIP Front (Rows A-E)</text>
              <text x="50" y="280" fontSize="12" fill="#666" fontWeight="bold">Premium (Rows F-J)</text>
              <text x="50" y="400" fontSize="12" fill="#666" fontWeight="bold">Main Floor (Rows K-R)</text>
              <text x="50" y="520" fontSize="12" fill="#666" fontWeight="bold">General (Rows S-Y)</text>
            </svg>
          </div>

          <div className="legend">
            <div className="legend-item">
              <div className="legend-color available"></div>
              <span>Available</span>
            </div>
            <div className="legend-item">
              <div className="legend-color selected"></div>
              <span>Selected</span>
            </div>
            <div className="legend-item">
              <div className="legend-color sold"></div>
              <span>Sold</span>
            </div>
          </div>
        </div>

        <div className="seat-info-panel">
          {selectedSeats.length > 0 ? (
            <div className="selected-seat-info">
              <h3>Selected Seats ({selectedSeats.length}/8)</h3>
              <div className="selected-seats-list">
                {selectedSeats.map((seat, index) => (
                  <div key={seat.id} className="seat-item">
                    <span>{seat.section} - Row {seat.row}, Seat {seat.number}</span>
                    <span>${getSeatPrice(seat)}</span>
                  </div>
                ))}
              </div>

              <div className="total-price">
                <strong>Total: ${selectedSeats.reduce((total, seat) => total + parseFloat(getSeatPrice(seat)), 0).toFixed(2)}</strong>
              </div>

              {currentUser ? (
                <button
                  onClick={handlePurchaseClick}
                  disabled={purchasing}
                  className="purchase-btn"
                >
                  {purchasing ? 'Processing...' : `Purchase ${selectedSeats.length} Ticket${selectedSeats.length > 1 ? 's' : ''}`}
                </button>
              ) : (
                <p className="login-message">Please log in to purchase tickets</p>
              )}

              <button
                onClick={() => setSelectedSeats([])}
                className="clear-selection-btn"
              >
                Clear Selection
              </button>
            </div>
          ) : (
            <div className="no-selection">
              <h3>Select Seats</h3>
              <p>Click on any available seats to select them. You can select up to 8 seats at once.</p>

              <div className="section-prices">
                <h4>Pricing by Section:</h4>
                <div className="price-list">
                  <div className="price-item">
                    <span>VIP Front (Rows A-E):</span>
                    <span>$500.00</span>
                  </div>
                  <div className="price-item">
                    <span>Premium (Rows F-J):</span>
                    <span>$360.00</span>
                  </div>
                  <div className="price-item">
                    <span>Main Floor (Rows K-R):</span>
                    <span>$225.00</span>
                  </div>
                  <div className="price-item">
                    <span>General (Rows S-Y):</span>
                    <span>$75.00</span>
                  </div>
                </div>
                <div className="stadium-info">
                  <p><small>Theater-style seating with 25 rows facing the stage. Closer rows have fewer seats and higher prices.</small></p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {showPaymentForm && (
        <PaymentForm
          onSubmit={handlePaymentSubmit}
          onCancel={handlePaymentCancel}
          totalPrice={selectedSeats.reduce((total, seat) => total + parseFloat(getSeatPrice(seat)), 0).toFixed(2)}
          selectedSeats={selectedSeats}
        />
      )}
    </div>
  );
};

export default SeatMap;
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import PaymentForm from './PaymentForm';
import { API_BASE_URL } from '../config/api';
import './SeatMap.css';

const SeatMap = () => {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { currentUser, token } = useAuth();
  const [searchParams] = useSearchParams();

  const [event, setEvent] = useState(null);
  const [seats, setSeats] = useState([]);
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState('');
  const [showPaymentForm, setShowPaymentForm] = useState(false);

  // Group purchase state
  const [isGroupPurchase, setIsGroupPurchase] = useState(false);
  const [groupPurchaseData, setGroupPurchaseData] = useState(null);
  const [requiredSeats, setRequiredSeats] = useState(0);

  // Available groups for invited users
  const [availableGroups, setAvailableGroups] = useState([]);
  const [showGroupJoinModal, setShowGroupJoinModal] = useState(false);

  useEffect(() => {
    const fetchEventAndSeats = async () => {
      try {
        const groupId = searchParams.get('groupId');

        const promises = [
          axios.get(`${API_BASE_URL}/events/${eventId}`),
          axios.get(`${API_BASE_URL}/events/${eventId}/seats`)
        ];

        // If this is a group purchase, fetch group data
        if (groupId) {
          promises.push(
            axios.get(`${API_BASE_URL}/groups/${groupId}`, {
              headers: { Authorization: `Bearer ${token}` }
            })
          );
        }

        const responses = await Promise.all(promises);

        setEvent(responses[0].data);
        setSeats(responses[1].data);

        // Handle group purchase data
        if (groupId && responses[2]) {
          const groupData = responses[2].data;
          setIsGroupPurchase(true);
          setGroupPurchaseData(groupData);

          // Calculate required seats (leader + joined members)
          const memberCount = groupData.members ? groupData.members.filter(m => m.status === 'joined').length : 0;
          const totalRequired = memberCount + 1; // +1 for leader
          setRequiredSeats(totalRequired);

          // Verify user is the group leader
          if (groupData.leaderId !== currentUser?.id) {
            setError('Only the group leader can purchase tickets for the group');
            return;
          }
        } else {
          // If not a group purchase, check for available groups to join
          try {
            const groupsResponse = await axios.get(`${API_BASE_URL}/events/${eventId}/groups`, {
              headers: { Authorization: `Bearer ${token}` }
            });

            // Filter groups where user is invited
            const invitedGroups = groupsResponse.data.filter(group =>
              group.members && group.members.some(member =>
                member.userId === currentUser?.id && member.status === 'invited'
              )
            );

            setAvailableGroups(invitedGroups);

            // If user has invites, show join modal
            if (invitedGroups.length > 0) {
              setShowGroupJoinModal(true);
            }
          } catch (error) {
            console.error('Error fetching groups for event:', error);
          }
        }
      } catch (error) {
        setError('Error loading event details');
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchEventAndSeats();
  }, [eventId, searchParams, token, currentUser]);

  const handleSeatClick = (seat) => {
    if (seat.isPurchased) return;
    if (seat.isReserved && seat.reservedByUserId !== currentUser?.id) return;

    const isSelected = selectedSeats.find(s => s.id === seat.id);
    let newSelectedSeats;

    if (isSelected) {
      // Remove seat from selection
      newSelectedSeats = selectedSeats.filter(s => s.id !== seat.id);
      setSelectedSeats(newSelectedSeats);
    } else {
      // For group purchases, enforce exact seat count
      const maxSeats = isGroupPurchase ? requiredSeats : 8;
      const seatLimitMessage = isGroupPurchase
        ? `You must select exactly ${requiredSeats} seats for your group (${requiredSeats - 1} members + you)`
        : 'You can select a maximum of 8 seats';

      if (selectedSeats.length < maxSeats) {
        newSelectedSeats = [...selectedSeats, seat];
        setSelectedSeats(newSelectedSeats);
      } else {
        alert(seatLimitMessage);
        return;
      }
    }

    // Make reservation API call
    if (newSelectedSeats.length > 0) {
      const seatIds = newSelectedSeats.map(s => s.id);
      reserveSeats(seatIds);
    } else {
      // Release reservations if no seats selected
      releaseReservations();
    }
  };

  const reserveSeats = async (seatIds) => {
    try {
      await axios.post(`${API_BASE_URL}/events/${eventId}/seats/reserve`, {
        seatIds
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (error) {
      console.error('Error reserving seats:', error);
      if (error.response?.status === 409) {
        // Some seats are not available, refresh the seat map
        const [eventResponse, seatsResponse] = await Promise.all([
          axios.get(`${API_BASE_URL}/events/${eventId}`),
          axios.get(`${API_BASE_URL}/events/${eventId}/seats`)
        ]);
        setEvent(eventResponse.data);
        setSeats(seatsResponse.data);
        setSelectedSeats([]);
        alert('Some selected seats are no longer available. Please select different seats.');
      }
    }
  };

  const releaseReservations = async () => {
    try {
      await axios.delete(`${API_BASE_URL}/events/${eventId}/seats/reserve`, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (error) {
      console.error('Error releasing reservations:', error);
    }
  };

  const handlePurchaseClick = () => {
    if (selectedSeats.length === 0 || !currentUser) return;

    // For group purchases, enforce exact seat count
    if (isGroupPurchase && selectedSeats.length !== requiredSeats) {
      alert(`You must select exactly ${requiredSeats} seats for your group (${requiredSeats - 1} members + you)`);
      return;
    }

    setShowPaymentForm(true);
  };

  const handlePaymentSubmit = async (paymentInfo) => {
    setPurchasing(true);
    try {
      let response;

      if (isGroupPurchase) {
        // Group purchase
        const groupId = searchParams.get('groupId');
        const seats = selectedSeats.map(seat => ({
          seatId: seat.id,
          price: seat.finalPrice
        }));

        response = await axios.post(`${API_BASE_URL}/groups/${groupId}/purchase`, {
          seats,
          paymentInfo
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });

        alert(`Group tickets purchased successfully! ${seats.length} seats assigned to group members.`);
        setShowPaymentForm(false);
        navigate('/group-purchase');
      } else {
        // Individual purchase
        const seatIds = selectedSeats.map(seat => seat.id);

        response = await axios.post(`${API_BASE_URL}/purchase`, {
          eventId,
          seatIds,
          paymentInfo
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });

        alert(`${selectedSeats.length} ticket(s) purchased successfully!`);
        setShowPaymentForm(false);
        navigate('/purchase-history');
      }
    } catch (error) {
      alert(error.response?.data?.message || 'Error purchasing tickets');
    } finally {
      setPurchasing(false);
    }
  };

  const handlePaymentCancel = () => {
    setShowPaymentForm(false);
  };

  const handleJoinGroup = async (groupId) => {
    try {
      await axios.post(`${API_BASE_URL}/groups/${groupId}/join`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('Successfully joined group!');
      setShowGroupJoinModal(false);
      navigate('/group-purchase');
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to join group');
    }
  };

  const getSeatColor = (seat) => {
    if (seat.isPurchased && !seat.isMarketplace) return '#ff6b6b';
    if (seat.isMarketplace) return '#9c88ff';
    if (seat.isReserved && seat.reservedByUserId !== currentUser?.id) return '#ffa500';
    if (selectedSeats.find(s => s.id === seat.id)) return '#51cf66';
    return '#339af0';
  };

  const getSeatPrice = (seat) => {
    if (seat.isMarketplace && seat.marketplacePrice) {
      return parseFloat(seat.marketplacePrice).toFixed(2);
    }
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
              <div className="legend-color reserved"></div>
              <span>Reserved</span>
            </div>
            <div className="legend-item">
              <div className="legend-color marketplace"></div>
              <span>Marketplace</span>
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

      {/* Group Join Modal */}
      {showGroupJoinModal && availableGroups.length > 0 && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Group Invitations</h3>
            <p>You've been invited to join the following groups for this event:</p>
            <div className="groups-list">
              {availableGroups.map(group => (
                <div key={group.id} className="group-invitation">
                  <div className="group-info">
                    <h4>{group.groupName}</h4>
                    <p><strong>Leader:</strong> {group.leaderFirstName} {group.leaderLastName}</p>
                    <p><strong>Target Seats:</strong> {group.targetSeats}</p>
                    <p><strong>Current Members:</strong> {group.currentMembers || 0}</p>
                    {group.estimatedPricePerSeat && (
                      <p><strong>Estimated Price:</strong> ${group.estimatedPricePerSeat}</p>
                    )}
                  </div>
                  <div className="group-actions">
                    <button
                      onClick={() => handleJoinGroup(group.id)}
                      className="join-group-btn"
                    >
                      Join Group
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="modal-actions">
              <button
                onClick={() => setShowGroupJoinModal(false)}
                className="skip-btn"
              >
                Skip & Purchase Individual Tickets
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SeatMap;
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../config/api';
import PaymentForm from './PaymentForm';
import './GroupPurchase.css';

const GroupPurchase = () => {
  const { token, currentUser } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('my-groups');
  const [myGroups, setMyGroups] = useState([]);
  const [friends, setFriends] = useState([]);
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [expandedGroup, setExpandedGroup] = useState(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteGroupId, setInviteGroupId] = useState(null);

  // Form states
  const [groupName, setGroupName] = useState('');
  const [targetSeats, setTargetSeats] = useState('');
  const [maxMembers, setMaxMembers] = useState('10');
  const [estimatedPrice, setEstimatedPrice] = useState('');

  useEffect(() => {
    if (activeTab === 'my-groups') {
      fetchMyGroups();
    } else if (activeTab === 'create-group') {
      fetchEvents();
      fetchFriends();
    }
  }, [activeTab]);

  const fetchMyGroups = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/groups`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMyGroups(response.data);
    } catch (error) {
      setError('Failed to fetch groups');
    } finally {
      setLoading(false);
    }
  };

  const fetchEvents = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/events`);
      setEvents(response.data);
    } catch (error) {
      setError('Failed to fetch events');
    }
  };

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

  const fetchGroupDetails = async (groupId) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/groups/${groupId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.data;
    } catch (error) {
      setError('Failed to fetch group details');
      return null;
    }
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();

    if (!selectedEvent || !groupName || !targetSeats) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      const response = await axios.post(`${API_BASE_URL}/groups`, {
        eventId: selectedEvent.id,
        groupName,
        targetSeats: parseInt(targetSeats),
        maxMembers: parseInt(maxMembers),
        estimatedPricePerSeat: estimatedPrice ? parseFloat(estimatedPrice) : null
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      alert('Group created successfully!');
      setShowCreateForm(false);
      setGroupName('');
      setTargetSeats('');
      setMaxMembers('10');
      setEstimatedPrice('');
      setSelectedEvent(null);
      setActiveTab('my-groups');
      fetchMyGroups();
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to create group');
    }
  };

  const handleJoinGroup = async (groupId) => {
    try {
      await axios.post(`${API_BASE_URL}/groups/${groupId}/join`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('Successfully joined group!');
      fetchMyGroups();
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to join group');
    }
  };

  const handleMakePayment = (group) => {
    setSelectedGroup(group);
    setShowPaymentForm(true);
  };

  const handlePaymentSubmit = async (paymentInfo) => {
    if (!selectedGroup) return;

    try {
      await axios.post(`${API_BASE_URL}/groups/${selectedGroup.id}/payment`, {
        amount: paymentInfo.amount,
        paymentMethod: 'card'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      alert('Payment processed successfully!');
      setShowPaymentForm(false);
      setSelectedGroup(null);
      fetchMyGroups();
    } catch (error) {
      alert(error.response?.data?.message || 'Error processing payment');
    }
  };

  const handlePurchaseForGroup = (group) => {
    navigate(`/events/${group.eventId}?groupId=${group.id}`);
  };

  const handleInviteFriend = async (groupId, friendId) => {
    try {
      await axios.post(`${API_BASE_URL}/groups/${groupId}/invite`, {
        friendIds: [friendId]
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('Friend invited successfully!');
      setShowInviteModal(false);
      setInviteGroupId(null);
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to invite friend');
    }
  };

  const openInviteModal = async (groupId) => {
    setInviteGroupId(groupId);

    // Ensure friends are loaded before showing modal
    if (friends.length === 0) {
      await fetchFriends();
    }

    setShowInviteModal(true);
  };

  const toggleGroupDetails = async (groupId) => {
    if (expandedGroup === groupId) {
      setExpandedGroup(null);
    } else {
      const details = await fetchGroupDetails(groupId);
      if (details) {
        // Update the group in myGroups with detailed info
        setMyGroups(prevGroups =>
          prevGroups.map(group =>
            group.id === groupId ? { ...group, ...details } : group
          )
        );
        setExpandedGroup(groupId);
      }
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
    <div className="group-purchase-container">
      <div className="group-purchase-header">
        <h1>Group Purchases</h1>
        <div className="tab-navigation">
          <button
            className={`tab ${activeTab === 'my-groups' ? 'active' : ''}`}
            onClick={() => setActiveTab('my-groups')}
          >
            My Groups
          </button>
          <button
            className={`tab ${activeTab === 'create-group' ? 'active' : ''}`}
            onClick={() => setActiveTab('create-group')}
          >
            Create Group
          </button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      {activeTab === 'my-groups' && (
        <div className="my-groups-section">
          {loading ? (
            <div className="loading">Loading groups...</div>
          ) : myGroups.length === 0 ? (
            <div className="empty-state">
              <p>You haven't joined any groups yet. Create a group or ask friends to invite you!</p>
            </div>
          ) : (
            <div className="groups-list">
              {myGroups.map(group => (
                <div key={group.id} className="group-card">
                  <div className="group-header">
                    <div className="group-info">
                      <h3>{group.groupName}</h3>
                      <p><strong>Event:</strong> {group.eventTitle}</p>
                      <p><strong>Venue:</strong> {group.venueName}</p>
                      <p><strong>Date:</strong> {formatDate(group.eventDate)}</p>
                      <p><strong>Leader:</strong> {group.leaderFirstName} {group.leaderLastName}</p>
                      <p><strong>Status:</strong> <span className={`status ${group.status}`}>{group.status}</span></p>
                    </div>
                    <div className="group-stats">
                      <div className="stat">
                        <span className="stat-number">{group.currentMembers || 0}</span>
                        <span className="stat-label">Members</span>
                      </div>
                      <div className="stat">
                        <span className="stat-number">{group.targetSeats}</span>
                        <span className="stat-label">Target Seats</span>
                      </div>
                      {group.totalPrepaid > 0 && (
                        <div className="stat">
                          <span className="stat-number">${group.totalPrepaid}</span>
                          <span className="stat-label">Prepaid</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="group-actions">
                    <button
                      className="details-btn"
                      onClick={() => toggleGroupDetails(group.id)}
                    >
                      {expandedGroup === group.id ? 'Hide Details' : 'Show Details'}
                    </button>
                    {/* Temporarily commented out to fix compilation */}
                    {/*group.status === 'forming' && group.leaderId === currentUser?.id && (
                      <button
                        className="purchase-btn"
                        onClick={() => handlePurchaseForGroup(group)}
                      >
                        Purchase Tickets
                      </button>
                    )*/}
                    {group.status === 'forming' && group.leaderId === currentUser?.id && (
                      <button
                        className="invite-btn"
                        onClick={() => openInviteModal(group.id)}
                      >
                        Invite Friends
                      </button>
                    )}
                    {group.status === 'forming' && (
                      <button
                        className="payment-btn"
                        onClick={() => handleMakePayment(group)}
                      >
                        Make Pre-payment
                      </button>
                    )}
                  </div>

                  {expandedGroup === group.id && group.members && (
                    <div className="group-details">
                      <h4>Group Members</h4>
                      {group.members.length === 0 ? (
                        <p>No members yet</p>
                      ) : (
                        <div className="members-list">
                          {group.members.map(member => (
                            <div key={member.id} className="member-card">
                              <div className="member-info">
                                <span className="member-name">
                                  {member.firstName} {member.lastName}
                                </span>
                                <span className={`member-status ${member.status}`}>
                                  {member.status}
                                </span>
                              </div>
                              {member.paidAmount > 0 && (
                                <div className="member-payment">
                                  Paid: ${member.paidAmount}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'create-group' && (
        <div className="create-group-section">
          {!showCreateForm ? (
            <div className="create-group-intro">
              <h2>Create a New Group Purchase</h2>
              <p>
                Start a group to coordinate ticket purchases with your friends.
                As the group leader, you'll handle the final purchase when tickets go on sale.
              </p>
              <button
                className="create-group-btn"
                onClick={() => setShowCreateForm(true)}
              >
                Create New Group
              </button>
            </div>
          ) : (
            <form onSubmit={handleCreateGroup} className="create-group-form">
              <h2>Create Group Purchase</h2>

              <div className="form-group">
                <label htmlFor="event">Event *</label>
                <select
                  id="event"
                  value={selectedEvent?.id || ''}
                  onChange={(e) => {
                    const event = events.find(ev => ev.id === e.target.value);
                    setSelectedEvent(event);
                  }}
                  required
                >
                  <option value="">Select an event</option>
                  {events.map(event => (
                    <option key={event.id} value={event.id}>
                      {event.title} - {formatDate(event.date)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="groupName">Group Name *</label>
                <input
                  type="text"
                  id="groupName"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="e.g., Friends Concert Group"
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="targetSeats">Target Seats *</label>
                  <input
                    type="number"
                    id="targetSeats"
                    value={targetSeats}
                    onChange={(e) => setTargetSeats(e.target.value)}
                    min="2"
                    max="20"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="maxMembers">Max Members</label>
                  <input
                    type="number"
                    id="maxMembers"
                    value={maxMembers}
                    onChange={(e) => setMaxMembers(e.target.value)}
                    min="2"
                    max="50"
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="estimatedPrice">Estimated Price per Seat</label>
                <input
                  type="number"
                  id="estimatedPrice"
                  value={estimatedPrice}
                  onChange={(e) => setEstimatedPrice(e.target.value)}
                  min="0"
                  step="0.01"
                  placeholder="Optional"
                />
                <small>Help members know how much to expect to pay</small>
              </div>

              <div className="form-actions">
                <button type="button" onClick={() => setShowCreateForm(false)} className="cancel-btn">
                  Cancel
                </button>
                <button type="submit" className="create-btn">
                  Create Group
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Payment Form Modal */}
      {showPaymentForm && selectedGroup && (
        <PaymentForm
          onSubmit={handlePaymentSubmit}
          onCancel={() => {
            setShowPaymentForm(false);
            setSelectedGroup(null);
          }}
          totalPrice={selectedGroup.estimatedPricePerSeat || 50}
          selectedSeats={[{ section: 'Group', row: 'Pre', number: 'Payment' }]}
          isGroupPayment={true}
        />
      )}

      {/* Invite Friends Modal */}
      {showInviteModal && inviteGroupId && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Invite Friends to Group</h3>
            <div className="friends-list">
              {friends.length === 0 ? (
                <p>No friends to invite. Add friends first!</p>
              ) : (
                friends.map(friend => (
                  <div key={`friend-${friend.friendId}`} className="friend-item">
                    <span>{friend.firstName} {friend.lastName}</span>
                    <button
                      onClick={() => handleInviteFriend(inviteGroupId, friend.friendId)}
                      className="invite-friend-btn"
                    >
                      Invite
                    </button>
                  </div>
                ))
              )}
            </div>
            <div className="modal-actions">
              <button
                onClick={() => {
                  setShowInviteModal(false);
                  setInviteGroupId(null);
                }}
                className="cancel-btn"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupPurchase;
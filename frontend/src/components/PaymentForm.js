import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { API_BASE_URL } from '../config/api';
import './PaymentForm.css';

const PaymentForm = ({ onSubmit, onCancel, totalPrice, selectedSeats = [], isGroupPayment = false }) => {
  const { token } = useAuth();
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null);
  const [useNewCard, setUseNewCard] = useState(true);

  const [formData, setFormData] = useState({
    cardholderName: '',
    cardNumber: '',
    expirationMonth: '',
    expirationYear: '',
    cvv: '',
    billingAddress: '',
    billingCity: '',
    billingState: '',
    billingZip: '',
    savePaymentInfo: false,
    amount: isGroupPayment ? '' : totalPrice
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    fetchPaymentMethods();
  }, []);

  const fetchPaymentMethods = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/payment-methods`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPaymentMethods(response.data);
      if (response.data.length > 0) {
        setUseNewCard(false);
      }
    } catch (error) {
      console.error('Error fetching payment methods:', error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (useNewCard) {
      if (!formData.cardholderName.trim()) newErrors.cardholderName = 'Cardholder name is required';
      if (!formData.cardNumber.trim()) newErrors.cardNumber = 'Card number is required';
      if (!formData.expirationMonth) newErrors.expirationMonth = 'Expiration month is required';
      if (!formData.expirationYear) newErrors.expirationYear = 'Expiration year is required';
      if (!formData.billingAddress.trim()) newErrors.billingAddress = 'Billing address is required';
      if (!formData.billingCity.trim()) newErrors.billingCity = 'Billing city is required';
      if (!formData.billingState.trim()) newErrors.billingState = 'Billing state is required';
      if (!formData.billingZip.trim()) newErrors.billingZip = 'Billing zip code is required';
    } else if (selectedPaymentMethod) {
      // For saved cards, just need CVV
      if (!formData.cvv.trim()) newErrors.cvv = 'CVV is required for saved cards';
    }

    if (!formData.cvv.trim()) newErrors.cvv = 'CVV is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    let paymentInfo;

    if (useNewCard) {
      paymentInfo = {
        cardholderName: formData.cardholderName,
        cardNumber: formData.cardNumber,
        expirationMonth: formData.expirationMonth,
        expirationYear: formData.expirationYear,
        cvv: formData.cvv,
        billingAddress: formData.billingAddress,
        billingCity: formData.billingCity,
        billingState: formData.billingState,
        billingZip: formData.billingZip,
        savePaymentInfo: formData.savePaymentInfo
      };
    } else {
      // Use saved payment method
      paymentInfo = {
        paymentMethodId: selectedPaymentMethod.id,
        cardholderName: selectedPaymentMethod.cardholderName,
        cardNumber: `****-****-****-${selectedPaymentMethod.lastFourDigits}`,
        expirationMonth: selectedPaymentMethod.expirationMonth,
        expirationYear: selectedPaymentMethod.expirationYear,
        cvv: formData.cvv,
        billingAddress: selectedPaymentMethod.address,
        billingCity: selectedPaymentMethod.city,
        billingState: selectedPaymentMethod.state,
        billingZip: selectedPaymentMethod.zipCode,
        savePaymentInfo: false
      };
    }

    onSubmit(paymentInfo);
  };

  const formatCardNumber = (value) => {
    // Remove all non-digit characters
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    // Add spaces every 4 characters
    const matches = v.match(/\d{4,16}/g);
    const match = matches && matches[0] || '';
    const parts = [];
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }
    if (parts.length) {
      return parts.join(' ');
    } else {
      return v;
    }
  };

  const handleCardNumberChange = (e) => {
    const formatted = formatCardNumber(e.target.value);
    setFormData(prev => ({ ...prev, cardNumber: formatted }));
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({length: 10}, (_, i) => currentYear + i);
  const months = [
    { value: '01', label: '01 - January' },
    { value: '02', label: '02 - February' },
    { value: '03', label: '03 - March' },
    { value: '04', label: '04 - April' },
    { value: '05', label: '05 - May' },
    { value: '06', label: '06 - June' },
    { value: '07', label: '07 - July' },
    { value: '08', label: '08 - August' },
    { value: '09', label: '09 - September' },
    { value: '10', label: '10 - October' },
    { value: '11', label: '11 - November' },
    { value: '12', label: '12 - December' }
  ];

  return (
    <div className="payment-form-container">
      <div className="payment-form">
        <h2>Payment Information</h2>

        <div className="order-summary">
          <h3>{isGroupPayment ? 'Group Pre-Payment' : 'Order Summary'}</h3>
          {isGroupPayment ? (
            <>
              <p>Making a pre-payment for group purchase</p>
              <div className="form-group">
                <label htmlFor="amount">Payment Amount *</label>
                <input
                  type="number"
                  id="amount"
                  name="amount"
                  value={formData.amount}
                  onChange={handleInputChange}
                  min="1"
                  step="0.01"
                  placeholder="Enter amount to pay"
                  required
                />
                {errors.amount && <span className="error">{errors.amount}</span>}
              </div>
            </>
          ) : (
            <>
              <p>Selected Seats: {selectedSeats.length} seat{selectedSeats.length !== 1 ? 's' : ''}</p>
              <p className="total-price">Total: ${totalPrice}</p>
            </>
          )}
        </div>

        {paymentMethods.length > 0 && (
          <div className="payment-method-selector">
            <h3>Payment Method</h3>
            <div className="payment-options">
              <label className="payment-option">
                <input
                  type="radio"
                  name="paymentOption"
                  checked={!useNewCard}
                  onChange={() => setUseNewCard(false)}
                />
                Use saved card
              </label>
              <label className="payment-option">
                <input
                  type="radio"
                  name="paymentOption"
                  checked={useNewCard}
                  onChange={() => setUseNewCard(true)}
                />
                Use new card
              </label>
            </div>

            {!useNewCard && (
              <div className="saved-cards">
                {paymentMethods.map((method) => (
                  <label key={method.id} className="saved-card">
                    <input
                      type="radio"
                      name="savedCard"
                      checked={selectedPaymentMethod?.id === method.id}
                      onChange={() => setSelectedPaymentMethod(method)}
                    />
                    <div className="card-info">
                      <div>**** **** **** {method.lastFourDigits}</div>
                      <div>{method.cardholderName}</div>
                      <div>Expires {method.expirationMonth}/{method.expirationYear}</div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {useNewCard && (
            <>
              <div className="form-group">
                <label htmlFor="cardholderName">Cardholder Name *</label>
                <input
                  type="text"
                  id="cardholderName"
                  name="cardholderName"
                  value={formData.cardholderName}
                  onChange={handleInputChange}
                  className={errors.cardholderName ? 'error' : ''}
                />
                {errors.cardholderName && <span className="error-message">{errors.cardholderName}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="cardNumber">Card Number *</label>
                <input
                  type="text"
                  id="cardNumber"
                  name="cardNumber"
                  value={formData.cardNumber}
                  onChange={handleCardNumberChange}
                  maxLength="19"
                  placeholder="1234 5678 9012 3456"
                  className={errors.cardNumber ? 'error' : ''}
                />
                {errors.cardNumber && <span className="error-message">{errors.cardNumber}</span>}
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="expirationMonth">Expiration Month *</label>
                  <select
                    id="expirationMonth"
                    name="expirationMonth"
                    value={formData.expirationMonth}
                    onChange={handleInputChange}
                    className={errors.expirationMonth ? 'error' : ''}
                  >
                    <option value="">Select Month</option>
                    {months.map(month => (
                      <option key={month.value} value={month.value}>{month.label}</option>
                    ))}
                  </select>
                  {errors.expirationMonth && <span className="error-message">{errors.expirationMonth}</span>}
                </div>

                <div className="form-group">
                  <label htmlFor="expirationYear">Expiration Year *</label>
                  <select
                    id="expirationYear"
                    name="expirationYear"
                    value={formData.expirationYear}
                    onChange={handleInputChange}
                    className={errors.expirationYear ? 'error' : ''}
                  >
                    <option value="">Select Year</option>
                    {years.map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                  {errors.expirationYear && <span className="error-message">{errors.expirationYear}</span>}
                </div>
              </div>

              <h3>Billing Address</h3>

              <div className="form-group">
                <label htmlFor="billingAddress">Address *</label>
                <input
                  type="text"
                  id="billingAddress"
                  name="billingAddress"
                  value={formData.billingAddress}
                  onChange={handleInputChange}
                  className={errors.billingAddress ? 'error' : ''}
                />
                {errors.billingAddress && <span className="error-message">{errors.billingAddress}</span>}
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="billingCity">City *</label>
                  <input
                    type="text"
                    id="billingCity"
                    name="billingCity"
                    value={formData.billingCity}
                    onChange={handleInputChange}
                    className={errors.billingCity ? 'error' : ''}
                  />
                  {errors.billingCity && <span className="error-message">{errors.billingCity}</span>}
                </div>

                <div className="form-group">
                  <label htmlFor="billingState">State *</label>
                  <input
                    type="text"
                    id="billingState"
                    name="billingState"
                    value={formData.billingState}
                    onChange={handleInputChange}
                    className={errors.billingState ? 'error' : ''}
                  />
                  {errors.billingState && <span className="error-message">{errors.billingState}</span>}
                </div>

                <div className="form-group">
                  <label htmlFor="billingZip">Zip Code *</label>
                  <input
                    type="text"
                    id="billingZip"
                    name="billingZip"
                    value={formData.billingZip}
                    onChange={handleInputChange}
                    className={errors.billingZip ? 'error' : ''}
                  />
                  {errors.billingZip && <span className="error-message">{errors.billingZip}</span>}
                </div>
              </div>

              <div className="form-group checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="savePaymentInfo"
                    checked={formData.savePaymentInfo}
                    onChange={handleInputChange}
                  />
                  Save payment information for future purchases
                </label>
              </div>
            </>
          )}

          <div className="form-group">
            <label htmlFor="cvv">CVV *</label>
            <input
              type="text"
              id="cvv"
              name="cvv"
              value={formData.cvv}
              onChange={handleInputChange}
              maxLength="4"
              placeholder="123"
              className={errors.cvv ? 'error' : ''}
            />
            {errors.cvv && <span className="error-message">{errors.cvv}</span>}
          </div>

          <div className="form-actions">
            <button type="button" onClick={onCancel} className="cancel-btn">
              Cancel
            </button>
            <button type="submit" className="submit-btn">
              Complete Purchase - ${totalPrice}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PaymentForm;
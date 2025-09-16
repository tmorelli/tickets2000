import React, { useState, useEffect } from 'react';
import './CountdownTimer.css';

const CountdownTimer = ({ targetDate }) => {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    expired: false
  });

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const target = new Date(targetDate).getTime();
      const difference = target - now;

      if (difference <= 0) {
        return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
      }

      return {
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((difference % (1000 * 60)) / 1000),
        expired: false
      };
    };

    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    setTimeLeft(calculateTimeLeft());

    return () => clearInterval(timer);
  }, [targetDate]);

  if (timeLeft.expired) {
    return (
      <div className="countdown-expired">
        <span>🎉 Tickets are now available!</span>
      </div>
    );
  }

  return (
    <div className="countdown-timer">
      <div className="countdown-label">Tickets available in:</div>
      <div className="countdown-display">
        {timeLeft.days > 0 && (
          <div className="countdown-unit">
            <span className="countdown-number">{timeLeft.days}</span>
            <span className="countdown-text">day{timeLeft.days !== 1 ? 's' : ''}</span>
          </div>
        )}
        <div className="countdown-unit">
          <span className="countdown-number">{timeLeft.hours.toString().padStart(2, '0')}</span>
          <span className="countdown-text">hours</span>
        </div>
        <div className="countdown-unit">
          <span className="countdown-number">{timeLeft.minutes.toString().padStart(2, '0')}</span>
          <span className="countdown-text">minutes</span>
        </div>
        <div className="countdown-unit">
          <span className="countdown-number">{timeLeft.seconds.toString().padStart(2, '0')}</span>
          <span className="countdown-text">seconds</span>
        </div>
      </div>
    </div>
  );
};

export default CountdownTimer;
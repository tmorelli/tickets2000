const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

app.use(cors());
app.use(express.json());

const db = new sqlite3.Database('./tickets.db');

// Initialize database tables
db.serialize(() => {
  // Users table
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    firstName TEXT NOT NULL,
    lastName TEXT NOT NULL,
    isAdmin BOOLEAN DEFAULT FALSE,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Venues table
  db.run(`CREATE TABLE IF NOT EXISTS venues (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    capacity INTEGER NOT NULL
  )`);

  // Events table
  db.run(`CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    venueId TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    date DATETIME NOT NULL,
    imageUrl TEXT,
    FOREIGN KEY (venueId) REFERENCES venues (id)
  )`);

  // Seats table
  db.run(`CREATE TABLE IF NOT EXISTS seats (
    id TEXT PRIMARY KEY,
    venueId TEXT NOT NULL,
    section TEXT NOT NULL,
    row TEXT NOT NULL,
    number INTEGER NOT NULL,
    basePrice DECIMAL(10,2) NOT NULL,
    multiplier DECIMAL(3,2) DEFAULT 1.0,
    x INTEGER NOT NULL,
    y INTEGER NOT NULL,
    FOREIGN KEY (venueId) REFERENCES venues (id)
  )`);

  // Purchases table
  db.run(`CREATE TABLE IF NOT EXISTS purchases (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    eventId TEXT NOT NULL,
    seatId TEXT NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    purchaseDate DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users (id),
    FOREIGN KEY (eventId) REFERENCES events (id),
    FOREIGN KEY (seatId) REFERENCES seats (id)
  )`);

  // Create seat_reservations table
  db.run(`CREATE TABLE IF NOT EXISTS seat_reservations (
    seatId TEXT NOT NULL,
    userId TEXT NOT NULL,
    eventId TEXT NOT NULL,
    expiresAt DATETIME NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (seatId, eventId),
    FOREIGN KEY (seatId) REFERENCES seats (id),
    FOREIGN KEY (userId) REFERENCES users (id),
    FOREIGN KEY (eventId) REFERENCES events (id)
  )`);

  // Create marketplace_listings table
  db.run(`CREATE TABLE IF NOT EXISTS marketplace_listings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sellerId TEXT NOT NULL,
    eventId TEXT NOT NULL,
    seatId TEXT NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'available',
    buyerId TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    soldAt DATETIME,
    FOREIGN KEY (sellerId) REFERENCES users (id),
    FOREIGN KEY (eventId) REFERENCES events (id),
    FOREIGN KEY (seatId) REFERENCES seats (id),
    FOREIGN KEY (buyerId) REFERENCES users (id)
  )`);

  // Create friends table
  db.run(`CREATE TABLE IF NOT EXISTS friends (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId TEXT NOT NULL,
    friendId TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users (id),
    FOREIGN KEY (friendId) REFERENCES users (id),
    UNIQUE(userId, friendId)
  )`);

  // Create group_purchases table
  db.run(`CREATE TABLE IF NOT EXISTS group_purchases (
    id TEXT PRIMARY KEY,
    eventId TEXT NOT NULL,
    leaderId TEXT NOT NULL,
    groupName TEXT NOT NULL,
    maxMembers INTEGER NOT NULL DEFAULT 10,
    targetSeats INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'forming',
    totalPrepaid DECIMAL(10,2) DEFAULT 0,
    estimatedPricePerSeat DECIMAL(10,2),
    actualTotalCost DECIMAL(10,2),
    purchaseAttemptAt DATETIME,
    successfulPurchaseAt DATETIME,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (eventId) REFERENCES events (id),
    FOREIGN KEY (leaderId) REFERENCES users (id)
  )`);

  // Create group_members table
  db.run(`CREATE TABLE IF NOT EXISTS group_members (
    id TEXT PRIMARY KEY,
    groupId TEXT NOT NULL,
    userId TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'invited',
    joinedAt DATETIME,
    seatAssignedId TEXT,
    finalPrice DECIMAL(10,2),
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (groupId) REFERENCES group_purchases (id),
    FOREIGN KEY (userId) REFERENCES users (id),
    FOREIGN KEY (seatAssignedId) REFERENCES seats (id),
    UNIQUE(groupId, userId)
  )`);

  // Create group_payments table
  db.run(`CREATE TABLE IF NOT EXISTS group_payments (
    id TEXT PRIMARY KEY,
    groupId TEXT NOT NULL,
    userId TEXT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    paymentMethod TEXT NOT NULL,
    paymentStatus TEXT NOT NULL DEFAULT 'pending',
    refundAmount DECIMAL(10,2) DEFAULT 0,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    processedAt DATETIME,
    FOREIGN KEY (groupId) REFERENCES group_purchases (id),
    FOREIGN KEY (userId) REFERENCES users (id)
  )`);
});

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Middleware to verify admin access
const requireAdmin = (req, res, next) => {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

// Auth Routes
app.post('/api/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName } = req.body;

    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = uuidv4();
    const isAdmin = email === 'tony@tonymorelli.com';

    db.run(
      'INSERT INTO users (id, email, password, firstName, lastName, isAdmin) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, email, hashedPassword, firstName, lastName, isAdmin],
      function(err) {
        if (err) {
          if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return res.status(409).json({ message: 'Email already exists' });
          }
          return res.status(500).json({ message: 'Error creating user' });
        }

        const token = jwt.sign({ userId, email, isAdmin }, JWT_SECRET, { expiresIn: '24h' });
        res.status(201).json({
          token,
          user: { id: userId, email, firstName, lastName, isAdmin }
        });
      }
    );
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/login', (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    db.get(
      'SELECT * FROM users WHERE email = ?',
      [email],
      async (err, user) => {
        if (err) {
          return res.status(500).json({ message: 'Server error' });
        }

        if (!user) {
          return res.status(401).json({ message: 'Invalid credentials' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
          return res.status(401).json({ message: 'Invalid credentials' });
        }

        const token = jwt.sign({ userId: user.id, email: user.email, isAdmin: user.isAdmin }, JWT_SECRET, { expiresIn: '24h' });
        res.json({
          token,
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            isAdmin: user.isAdmin
          }
        });
      }
    );
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Venues Routes
app.get('/api/venues', (req, res) => {
  db.all('SELECT * FROM venues', (err, venues) => {
    if (err) {
      return res.status(500).json({ message: 'Error fetching venues' });
    }
    res.json(venues);
  });
});

// Events Routes
app.get('/api/events', authenticateToken, (req, res) => {
  const userId = req.user.userId;

  const query = `
    SELECT e.*, v.name as venueName, v.address as venueAddress
    FROM events e
    JOIN venues v ON e.venueId = v.id
    WHERE e.onSale = 1
    ORDER BY e.date ASC
  `;

  db.all(query, (err, events) => {
    if (err) {
      return res.status(500).json({ message: 'Error fetching events' });
    }

    // For each event, get social information
    const eventsWithSocialInfo = [];
    let processed = 0;

    if (events.length === 0) {
      return res.json([]);
    }

    events.forEach(event => {
      // Check if current user is attending
      db.get(
        'SELECT id FROM purchases WHERE userId = ? AND eventId = ?',
        [userId, event.id],
        (err, userPurchase) => {
          event.isUserAttending = !!userPurchase;

          // Get friends attending this event (grouped by friend to show all their seats)
          const friendsQuery = `
            SELECT
              friendId,
              firstName,
              lastName,
              GROUP_CONCAT(section || ' ' || row || '-' || seatNumber, ', ') as seats
            FROM (
              SELECT DISTINCT
                CASE
                  WHEN f.requesterId = ? THEN f.recipientId
                  ELSE f.requesterId
                END as friendId,
                CASE
                  WHEN f.requesterId = ? THEN ru.firstName
                  ELSE su.firstName
                END as firstName,
                CASE
                  WHEN f.requesterId = ? THEN ru.lastName
                  ELSE su.lastName
                END as lastName,
                s.section, s.row, s.number as seatNumber
              FROM friends f
              LEFT JOIN users su ON f.requesterId = su.id
              LEFT JOIN users ru ON f.recipientId = ru.id
              JOIN purchases p ON (
                (f.requesterId = ? AND p.userId = f.recipientId) OR
                (f.recipientId = ? AND p.userId = f.requesterId)
              )
              JOIN seats s ON p.seatId = s.id
              WHERE (f.requesterId = ? OR f.recipientId = ?)
              AND f.status = 'accepted'
              AND p.eventId = ?
              ORDER BY s.section, s.row, s.number
            )
            GROUP BY friendId, firstName, lastName
          `;

          db.all(friendsQuery, [userId, userId, userId, userId, userId, userId, userId, event.id], (err, friends) => {
            processed++;

            if (!err) {
              event.friendsAttending = friends;
            } else {
              event.friendsAttending = [];
            }

            eventsWithSocialInfo.push(event);

            if (processed === events.length) {
              // Sort events by priority:
              // 1. Events user is attending (highest priority)
              // 2. Events friends are attending (medium priority)
              // 3. Remaining events chronologically (lowest priority)
              const sortedEvents = eventsWithSocialInfo.sort((a, b) => {
                // Priority 1: User attending vs not attending
                if (a.isUserAttending && !b.isUserAttending) return -1;
                if (!a.isUserAttending && b.isUserAttending) return 1;

                // If both or neither user attending, check friends
                const aHasFriends = a.friendsAttending && a.friendsAttending.length > 0;
                const bHasFriends = b.friendsAttending && b.friendsAttending.length > 0;

                // Priority 2: Events with friends vs without friends
                if (aHasFriends && !bHasFriends) return -1;
                if (!aHasFriends && bHasFriends) return 1;

                // Priority 3: Sort chronologically by date (earliest first)
                return new Date(a.date) - new Date(b.date);
              });

              res.json(sortedEvents);
            }
          });
        }
      );
    });
  });
});

app.get('/api/events/:id', (req, res) => {
  const query = `
    SELECT e.*, v.name as venueName, v.address as venueAddress, v.capacity
    FROM events e
    JOIN venues v ON e.venueId = v.id
    WHERE e.id = ?
  `;

  db.get(query, [req.params.id], (err, event) => {
    if (err) {
      return res.status(500).json({ message: 'Error fetching event' });
    }
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    res.json(event);
  });
});

// Seats Routes
// Clean up expired reservations
const cleanupExpiredReservations = () => {
  db.run('DELETE FROM seat_reservations WHERE expiresAt < datetime("now")', (err) => {
    if (err) {
      console.error('Error cleaning up expired reservations:', err);
    }
  });
};

app.get('/api/events/:eventId/seats', (req, res) => {
  const eventId = req.params.eventId;

  console.log('[SEATS] Fetching seats for event:', eventId);

  // Clean up expired reservations first
  cleanupExpiredReservations();

  // First get the venue for this event
  db.get('SELECT venueId FROM events WHERE id = ?', [eventId], (err, event) => {
    if (err || !event) {
      console.error('[SEATS] Event not found or error:', err);
      return res.status(404).json({ message: 'Event not found' });
    }

    console.log('[SEATS] Found event with venueId:', event.venueId);

    // Get all seats for this venue with purchase and reservation status
    const query = `
      SELECT
        s.*,
        CASE
          WHEN p.id IS NOT NULL THEN 1
          ELSE 0
        END as isPurchased,
        CASE
          WHEN r.seatId IS NOT NULL AND r.expiresAt > datetime("now") THEN 1
          ELSE 0
        END as isReserved,
        r.userId as reservedByUserId,
        CASE
          WHEN ml.id IS NOT NULL AND ml.status = 'active' THEN 1
          ELSE 0
        END as isMarketplace,
        ml.listPrice as marketplacePrice,
        ml.sellerId as marketplaceSellerId
      FROM seats s
      LEFT JOIN purchases p ON s.id = p.seatId AND p.eventId = ?
      LEFT JOIN seat_reservations r ON s.id = r.seatId AND r.eventId = ? AND r.expiresAt > datetime("now")
      LEFT JOIN marketplace_listings ml ON s.id = ml.seatId AND ml.eventId = ? AND ml.status = 'active'
      WHERE s.venueId = ?
      ORDER BY s.section, s.row, s.number
    `;

    db.all(query, [eventId, eventId, eventId, event.venueId], (err, seats) => {
      if (err) {
        return res.status(500).json({ message: 'Error fetching seats' });
      }
      res.json(seats);
    });
  });
});

// Seat Reservations Routes
app.post('/api/events/:eventId/seats/reserve', authenticateToken, (req, res) => {
  const { eventId } = req.params;
  const { seatIds } = req.body;
  const userId = req.user.userId;

  console.log(`[RESERVATION] User ${userId} attempting to reserve seats ${seatIds.join(', ')} for event ${eventId}`);

  if (!seatIds || !Array.isArray(seatIds) || seatIds.length === 0) {
    console.log('[RESERVATION] Error: Missing or invalid seat IDs');
    return res.status(400).json({ message: 'Seat IDs are required' });
  }

  // Clean up expired reservations
  cleanupExpiredReservations();

  // Set reservation expiry to 15 minutes from now using SQLite datetime format
  const expiresAt = `datetime('now', '+15 minutes')`;

  // First, remove existing reservations by this user for this event
  console.log(`[RESERVATION] Clearing existing reservations for user ${userId} on event ${eventId}`);
  db.run('DELETE FROM seat_reservations WHERE userId = ? AND eventId = ?', [userId, eventId], (err) => {
    if (err) {
      console.log('[RESERVATION] Error clearing existing reservations:', err);
      return res.status(500).json({ message: 'Error clearing existing reservations' });
    }

    // Now check if seats are available (not purchased or reserved by others)
    const checkQuery = `
      SELECT s.id
      FROM seats s
      LEFT JOIN purchases p ON s.id = p.seatId AND p.eventId = ?
      LEFT JOIN seat_reservations r ON s.id = r.seatId AND r.eventId = ? AND r.expiresAt > datetime("now")
      WHERE s.id IN (${seatIds.map(() => '?').join(',')})
      AND (p.id IS NOT NULL OR r.seatId IS NOT NULL)
    `;

    db.all(checkQuery, [eventId, eventId, ...seatIds], (err, unavailableSeats) => {
      if (err) {
        console.log('[RESERVATION] Error checking seat availability:', err);
        return res.status(500).json({ message: 'Error checking seat availability' });
      }

      if (unavailableSeats.length > 0) {
        console.log(`[RESERVATION] ${unavailableSeats.length} seats unavailable:`, unavailableSeats.map(s => s.id));
        return res.status(409).json({
          message: 'Some seats are not available',
          unavailableSeats: unavailableSeats.map(s => s.id)
        });
      }

      // Create new reservations for all selected seats
      if (err) {
        return res.status(500).json({ message: 'Error clearing existing reservations' });
      }

      // Create new reservations
      const reservationPromises = seatIds.map(seatId => {
        return new Promise((resolve, reject) => {
          db.run(
            `INSERT OR REPLACE INTO seat_reservations (seatId, userId, eventId, expiresAt) VALUES (?, ?, ?, ${expiresAt})`,
            [seatId, userId, eventId],
            function(err) {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      });

      Promise.all(reservationPromises)
        .then(() => {
          console.log(`[RESERVATION] Successfully reserved ${seatIds.length} seats for user ${userId}`);
          // Calculate the actual expiration time for the response
          const actualExpiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
          res.json({
            message: 'Seats reserved successfully',
            expiresAt: actualExpiresAt,
            reservedSeats: seatIds
          });
        })
        .catch(err => {
          res.status(500).json({ message: 'Error creating reservations' });
        });
    });
  });
});

app.delete('/api/events/:eventId/seats/reserve', authenticateToken, (req, res) => {
  const { eventId } = req.params;
  const userId = req.user.userId;

  db.run('DELETE FROM seat_reservations WHERE userId = ? AND eventId = ?', [userId, eventId], (err) => {
    if (err) {
      return res.status(500).json({ message: 'Error releasing reservations' });
    }
    res.json({ message: 'Reservations released successfully' });
  });
});

// Payment Methods Routes
app.get('/api/payment-methods', authenticateToken, (req, res) => {
  const userId = req.user.userId;

  db.all(
    'SELECT id, cardholderName, lastFourDigits, expirationMonth, expirationYear, address, city, state, zipCode, isDefault FROM payment_methods WHERE userId = ? ORDER BY isDefault DESC, createdAt DESC',
    [userId],
    (err, paymentMethods) => {
      if (err) {
        return res.status(500).json({ message: 'Error fetching payment methods' });
      }
      res.json(paymentMethods);
    }
  );
});

app.post('/api/payment-methods', authenticateToken, (req, res) => {
  const { cardholderName, cardNumber, expirationMonth, expirationYear, cvv, address, city, state, zipCode, savePaymentInfo } = req.body;
  const userId = req.user.userId;

  if (!savePaymentInfo) {
    return res.json({ message: 'Payment processed without saving' });
  }

  const lastFourDigits = cardNumber.slice(-4);
  const paymentMethodId = uuidv4();

  // If this is being set as default, update existing default to false
  db.run('UPDATE payment_methods SET isDefault = FALSE WHERE userId = ?', [userId], (err) => {
    if (err) {
      return res.status(500).json({ message: 'Error updating existing payment methods' });
    }

    db.run(
      'INSERT INTO payment_methods (id, userId, cardholderName, lastFourDigits, expirationMonth, expirationYear, address, city, state, zipCode, isDefault) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [paymentMethodId, userId, cardholderName, lastFourDigits, expirationMonth, expirationYear, address, city, state, zipCode, true],
      function(err) {
        if (err) {
          return res.status(500).json({ message: 'Error saving payment method' });
        }

        res.status(201).json({
          id: paymentMethodId,
          message: 'Payment method saved successfully'
        });
      }
    );
  });
});

// Purchase Routes
app.post('/api/purchase', authenticateToken, (req, res) => {
  const { eventId, seatIds, paymentInfo } = req.body;
  const userId = req.user.userId;

  // Validate payment info is provided
  if (!paymentInfo || !paymentInfo.cardholderName || !paymentInfo.cardNumber || !paymentInfo.cvv ||
      !paymentInfo.billingAddress || !paymentInfo.billingCity || !paymentInfo.billingState || !paymentInfo.billingZip ||
      !paymentInfo.expirationMonth || !paymentInfo.expirationYear) {
    return res.status(400).json({ message: 'All payment information fields are required' });
  }

  // Handle both single seat and multiple seats
  const seatsToProcess = Array.isArray(seatIds) ? seatIds : [seatIds || seatId];

  if (seatsToProcess.length === 0) {
    return res.status(400).json({ message: 'At least one seat must be selected' });
  }

  // Check if tickets are on sale yet (server-side validation)
  db.get('SELECT onSaleDate FROM events WHERE id = ?', [eventId], (err, event) => {
    if (err) {
      return res.status(500).json({ message: 'Error checking event details' });
    }

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    if (event.onSaleDate) {
      const onSaleDate = new Date(event.onSaleDate);
      const now = new Date();

      if (now < onSaleDate) {
        return res.status(403).json({
          message: 'Tickets are not yet available for sale',
          onSaleDate: event.onSaleDate
        });
      }
    }

    // Clean up expired reservations
    cleanupExpiredReservations();

    // Check if any seats are already purchased or reserved by others
    const seatCheckQuery = `
      SELECT s.id as seatId,
             CASE WHEN p.id IS NOT NULL THEN 'purchased' ELSE 'reserved_by_other' END as status
      FROM seats s
      LEFT JOIN purchases p ON s.id = p.seatId AND p.eventId = ?
      LEFT JOIN seat_reservations r ON s.id = r.seatId AND r.eventId = ? AND r.expiresAt > datetime("now") AND r.userId != ?
      WHERE s.id IN (${seatsToProcess.map(() => '?').join(',')})
      AND (p.id IS NOT NULL OR r.seatId IS NOT NULL)
    `;

    db.all(seatCheckQuery, [eventId, eventId, userId, ...seatsToProcess], (err, unavailableSeats) => {
    if (err) {
      return res.status(500).json({ message: 'Error checking seat availability' });
    }

    if (unavailableSeats.length > 0) {
      return res.status(409).json({
        message: 'Some seats are not available',
        unavailableSeats: unavailableSeats.map(s => ({ seatId: s.seatId, status: s.status }))
      });
    }

    // Get seat details to calculate total price
    const seatQuery = `
      SELECT s.*, e.title as eventTitle
      FROM seats s
      JOIN events e ON s.venueId = e.venueId
      WHERE s.id IN (${seatsToProcess.map(() => '?').join(',')}) AND e.id = ?
    `;

    db.all(seatQuery, [...seatsToProcess, eventId], (err, seats) => {
      if (err || seats.length !== seatsToProcess.length) {
        return res.status(404).json({ message: 'Some seats or event not found' });
      }

      let totalPrice = 0;
      seats.forEach(seat => {
        totalPrice += seat.basePrice * seat.multiplier;
      });
      totalPrice = totalPrice.toFixed(2);

      // Save payment method if requested
      const savePaymentAndPurchase = (paymentMethodId = null) => {
        // Create purchases for all seats
        const purchasePromises = seatsToProcess.map(seatId => {
          const seat = seats.find(s => s.id === seatId);
          const seatPrice = (seat.basePrice * seat.multiplier).toFixed(2);
          const purchaseId = uuidv4();

          return new Promise((resolve, reject) => {
            db.run(
              'INSERT INTO purchases (id, userId, eventId, seatId, price) VALUES (?, ?, ?, ?, ?)',
              [purchaseId, userId, eventId, seatId, seatPrice],
              function(err) {
                if (err) reject(err);
                else resolve({ id: purchaseId, seatId, price: seatPrice });
              }
            );
          });
        });

        Promise.all(purchasePromises)
          .then(purchases => {
            // Clear user's reservations for this event after successful purchase
            db.run('DELETE FROM seat_reservations WHERE userId = ? AND eventId = ?', [userId, eventId], (err) => {
              if (err) {
                console.error('Error clearing reservations after purchase:', err);
              }
            });

            res.status(201).json({
              purchases,
              eventId,
              totalPrice,
              message: 'Purchase successful'
            });
          })
          .catch(err => {
            res.status(500).json({ message: 'Error processing purchase' });
          });
      };

      // Save payment method if savePaymentInfo is true
      if (paymentInfo.savePaymentInfo) {
        const lastFourDigits = paymentInfo.cardNumber.slice(-4);
        db.run(
          `INSERT INTO payment_methods
           (userId, cardholderName, lastFourDigits, expirationMonth, expirationYear,
            address, city, state, zipCode)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [userId, paymentInfo.cardholderName, lastFourDigits, paymentInfo.expirationMonth,
           paymentInfo.expirationYear, paymentInfo.billingAddress, paymentInfo.billingCity,
           paymentInfo.billingState, paymentInfo.billingZip],
          function(err) {
            if (err) {
              console.error('Error saving payment method:', err);
            }
            savePaymentAndPurchase(err ? null : this.lastID);
          }
        );
      } else {
        savePaymentAndPurchase();
      }
    });
  });
  });
});

app.get('/api/purchases', authenticateToken, (req, res) => {
  const userId = req.user.userId;

  const query = `
    SELECT
      p.*,
      e.title as eventTitle,
      e.date as eventDate,
      e.imageUrl as eventImage,
      v.name as venueName,
      s.section,
      s.row,
      s.number as seatNumber
    FROM purchases p
    JOIN events e ON p.eventId = e.id
    JOIN venues v ON e.venueId = v.id
    JOIN seats s ON p.seatId = s.id
    WHERE p.userId = ?
    ORDER BY p.purchaseDate DESC
  `;

  db.all(query, [userId], (err, purchases) => {
    if (err) {
      return res.status(500).json({ message: 'Error fetching purchase history' });
    }
    res.json(purchases);
  });
});

// Marketplace Routes
app.post('/api/marketplace/listings', authenticateToken, (req, res) => {
  const { eventId, seatId, price } = req.body;
  const sellerId = req.user.userId;

  console.log('[MARKETPLACE POST] Creating listing:', { eventId, seatId, price, sellerId });

  // Verify the user owns this ticket
  const checkQuery = `
    SELECT * FROM purchases
    WHERE userId = ? AND eventId = ? AND seatId = ?
  `;

  db.get(checkQuery, [sellerId, eventId, seatId], (err, purchase) => {
    if (err) {
      console.error('[MARKETPLACE POST] Database error checking purchase:', err);
      return res.status(500).json({ message: 'Database error' });
    }

    if (!purchase) {
      return res.status(403).json({ message: 'You do not own this ticket' });
    }

    console.log('[MARKETPLACE POST] Found purchase:', purchase);

    // Check if already listed
    const existingQuery = `
      SELECT * FROM marketplace_listings
      WHERE sellerId = ? AND eventId = ? AND seatId = ? AND status = 'active'
    `;

    db.get(existingQuery, [sellerId, eventId, seatId], (err, existing) => {
      if (err) {
        console.error('[MARKETPLACE POST] Database error checking existing listing:', err);
        return res.status(500).json({ message: 'Database error' });
      }

      if (existing) {
        console.log('[MARKETPLACE POST] Ticket already listed:', existing);
        return res.status(400).json({ message: 'Ticket is already listed on marketplace' });
      }

      // Create marketplace listing
      const insertQuery = `
        INSERT INTO marketplace_listings (purchaseId, sellerId, eventId, seatId, listPrice, status, listedAt)
        VALUES (?, ?, ?, ?, ?, 'active', datetime('now'))
      `;

      console.log('[MARKETPLACE POST] Inserting listing with params:', [purchase.id, sellerId, eventId, seatId, price]);

      db.run(insertQuery, [purchase.id, sellerId, eventId, seatId, price], function(err) {
        if (err) {
          console.error('[MARKETPLACE POST] Database error creating listing:', err);
          return res.status(500).json({ message: 'Error creating marketplace listing' });
        }
        console.log('[MARKETPLACE POST] Listing created successfully, ID:', this.lastID);
        res.json({ message: 'Ticket listed on marketplace successfully', listingId: this.lastID });
      });
    });
  });
});

app.get('/api/marketplace/listings', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  console.log('[MARKETPLACE] Fetching listings for user:', userId);

  const query = `
    SELECT
      ml.*,
      ml.listPrice as price,
      ml.listedAt as createdAt,
      ml.soldAt,
      CASE ml.status
        WHEN 'active' THEN 'available'
        WHEN 'sold' THEN 'sold'
        WHEN 'removed' THEN 'removed'
        ELSE ml.status
      END as status,
      e.title as eventTitle,
      e.date as eventDate,
      v.name as venueName,
      v.address as venueAddress,
      s.section, s.row, s.number
    FROM marketplace_listings ml
    JOIN events e ON ml.eventId = e.id
    JOIN venues v ON e.venueId = v.id
    JOIN seats s ON ml.seatId = s.id
    WHERE ml.sellerId = ?
    ORDER BY ml.listedAt DESC
  `;

  db.all(query, [userId], (err, listings) => {
    if (err) {
      console.error('[MARKETPLACE] Error fetching listings:', err);
      return res.status(500).json({ message: 'Error fetching marketplace listings' });
    }
    console.log('[MARKETPLACE] Found', listings.length, 'listings');
    res.json(listings);
  });
});

app.delete('/api/marketplace/listings/:listingId', authenticateToken, (req, res) => {
  const { listingId } = req.params;
  const userId = req.user.userId;

  // Check ownership and that it's not sold
  const checkQuery = `
    SELECT * FROM marketplace_listings
    WHERE id = ? AND sellerId = ? AND status = 'active'
  `;

  db.get(checkQuery, [listingId, userId], (err, listing) => {
    if (err) {
      return res.status(500).json({ message: 'Database error' });
    }

    if (!listing) {
      return res.status(404).json({ message: 'Listing not found or already sold' });
    }

    const deleteQuery = `DELETE FROM marketplace_listings WHERE id = ?`;

    db.run(deleteQuery, [listingId], (err) => {
      if (err) {
        return res.status(500).json({ message: 'Error removing listing' });
      }
      res.json({ message: 'Listing removed from marketplace' });
    });
  });
});

app.post('/api/marketplace/purchase/:listingId', authenticateToken, (req, res) => {
  const { listingId } = req.params;
  const { paymentInfo } = req.body;
  const buyerId = req.user.userId;

  // Validate payment info
  if (!paymentInfo || !paymentInfo.cardholderName || !paymentInfo.cardNumber || !paymentInfo.cvv ||
      !paymentInfo.billingAddress || !paymentInfo.billingCity || !paymentInfo.billingState || !paymentInfo.billingZip ||
      !paymentInfo.expirationMonth || !paymentInfo.expirationYear) {
    return res.status(400).json({ message: 'All payment information fields are required' });
  }

  // Get marketplace listing
  const listingQuery = `
    SELECT * FROM marketplace_listings
    WHERE id = ? AND status = 'active'
  `;

  db.get(listingQuery, [listingId], (err, listing) => {
    if (err) {
      return res.status(500).json({ message: 'Database error' });
    }

    if (!listing) {
      return res.status(404).json({ message: 'Listing not found or no longer available' });
    }

    if (listing.sellerId === buyerId) {
      return res.status(400).json({ message: 'Cannot buy your own ticket' });
    }

    db.serialize(() => {
      db.run('BEGIN TRANSACTION');

      // Update original purchase to new buyer
      const updatePurchaseQuery = `
        UPDATE purchases
        SET userId = ?
        WHERE eventId = ? AND seatId = ? AND userId = ?
      `;

      db.run(updatePurchaseQuery, [buyerId, listing.eventId, listing.seatId, listing.sellerId], function(err) {
        if (err) {
          db.run('ROLLBACK');
          return res.status(500).json({ message: 'Error transferring ticket' });
        }

        // Mark listing as sold
        const updateListingQuery = `
          UPDATE marketplace_listings
          SET status = 'sold', buyerId = ?, soldAt = datetime('now')
          WHERE id = ?
        `;

        db.run(updateListingQuery, [buyerId, listingId], function(err) {
          if (err) {
            db.run('ROLLBACK');
            return res.status(500).json({ message: 'Error updating listing' });
          }

          db.run('COMMIT');
          res.json({ message: 'Marketplace ticket purchased successfully!' });
        });
      });
    });
  });
});

// Admin Routes

// Admin Events Routes
app.get('/api/admin/events', authenticateToken, requireAdmin, (req, res) => {
  const query = `
    SELECT e.*, v.name as venueName, v.address as venueAddress
    FROM events e
    JOIN venues v ON e.venueId = v.id
    ORDER BY e.date ASC
  `;

  db.all(query, (err, events) => {
    if (err) {
      return res.status(500).json({ message: 'Error fetching events' });
    }
    res.json(events);
  });
});

app.post('/api/admin/events', authenticateToken, requireAdmin, (req, res) => {
  const { venueId, title, description, date, imageUrl, onSale } = req.body;

  if (!venueId || !title || !date) {
    return res.status(400).json({ message: 'Venue, title, and date are required' });
  }

  const eventId = uuidv4();

  db.run(
    'INSERT INTO events (id, venueId, title, description, date, imageUrl, onSale) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [eventId, venueId, title, description, date, imageUrl || null, onSale !== false],
    function(err) {
      if (err) {
        return res.status(500).json({ message: 'Error creating event' });
      }

      res.status(201).json({
        id: eventId,
        venueId,
        title,
        description,
        date,
        imageUrl,
        onSale: onSale !== false,
        message: 'Event created successfully'
      });
    }
  );
});

app.put('/api/admin/events/:eventId', authenticateToken, requireAdmin, (req, res) => {
  const { eventId } = req.params;
  const { venueId, title, description, date, imageUrl, onSale } = req.body;

  if (!venueId || !title || !date) {
    return res.status(400).json({ message: 'Venue, title, and date are required' });
  }

  db.run(
    'UPDATE events SET venueId = ?, title = ?, description = ?, date = ?, imageUrl = ?, onSale = ? WHERE id = ?',
    [venueId, title, description, date, imageUrl, onSale ? 1 : 0, eventId],
    function(err) {
      if (err) {
        return res.status(500).json({ message: 'Error updating event' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ message: 'Event not found' });
      }

      res.json({ message: 'Event updated successfully' });
    }
  );
});

app.delete('/api/admin/events/:eventId', authenticateToken, requireAdmin, (req, res) => {
  const { eventId } = req.params;

  db.run('DELETE FROM events WHERE id = ?', [eventId], function(err) {
    if (err) {
      return res.status(500).json({ message: 'Error deleting event' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ message: 'Event not found' });
    }

    res.json({ message: 'Event deleted successfully' });
  });
});

app.get('/api/admin/users', authenticateToken, requireAdmin, (req, res) => {
  db.all(
    'SELECT id, email, firstName, lastName, isAdmin, createdAt FROM users ORDER BY createdAt DESC',
    (err, users) => {
      if (err) {
        return res.status(500).json({ message: 'Error fetching users' });
      }
      res.json(users);
    }
  );
});

app.put('/api/admin/users/:userId/admin', authenticateToken, requireAdmin, (req, res) => {
  const { userId } = req.params;
  const { isAdmin } = req.body;

  db.run(
    'UPDATE users SET isAdmin = ? WHERE id = ?',
    [isAdmin, userId],
    function(err) {
      if (err) {
        return res.status(500).json({ message: 'Error updating user admin status' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.json({ message: 'User admin status updated successfully' });
    }
  );
});

// Social Features Routes

// Search users
app.get('/api/users/search', authenticateToken, (req, res) => {
  const { query } = req.query;
  const currentUserId = req.user.userId;

  if (!query || query.trim().length < 2) {
    return res.status(400).json({ message: 'Search query must be at least 2 characters' });
  }

  const searchQuery = `
    SELECT id, email, firstName, lastName
    FROM users
    WHERE (firstName LIKE ? OR lastName LIKE ? OR email LIKE ?)
    AND id != ?
    ORDER BY firstName, lastName
    LIMIT 20
  `;

  const searchTerm = `%${query.trim()}%`;

  db.all(searchQuery, [searchTerm, searchTerm, searchTerm, currentUserId], (err, users) => {
    if (err) {
      return res.status(500).json({ message: 'Error searching users' });
    }
    res.json(users);
  });
});

// Send friend request
app.post('/api/friends/request', authenticateToken, (req, res) => {
  const { recipientId } = req.body;
  const requesterId = req.user.userId;

  if (requesterId === recipientId) {
    return res.status(400).json({ message: 'Cannot send friend request to yourself' });
  }

  // Check if request already exists
  db.get(
    'SELECT id FROM friends WHERE (requesterId = ? AND recipientId = ?) OR (requesterId = ? AND recipientId = ?)',
    [requesterId, recipientId, recipientId, requesterId],
    (err, existingRequest) => {
      if (err) {
        return res.status(500).json({ message: 'Error checking existing requests' });
      }

      if (existingRequest) {
        return res.status(409).json({ message: 'Friend request already exists' });
      }

      const friendRequestId = uuidv4();

      db.run(
        'INSERT INTO friends (id, requesterId, recipientId, status) VALUES (?, ?, ?, ?)',
        [friendRequestId, requesterId, recipientId, 'pending'],
        function(err) {
          if (err) {
            return res.status(500).json({ message: 'Error sending friend request' });
          }

          res.status(201).json({
            id: friendRequestId,
            message: 'Friend request sent successfully'
          });
        }
      );
    }
  );
});

// Get pending friend requests (received)
app.get('/api/friends/requests', authenticateToken, (req, res) => {
  const userId = req.user.userId;

  const query = `
    SELECT f.id, f.requesterId, f.createdAt,
           u.firstName, u.lastName, u.email
    FROM friends f
    JOIN users u ON f.requesterId = u.id
    WHERE f.recipientId = ? AND f.status = 'pending'
    ORDER BY f.createdAt DESC
  `;

  db.all(query, [userId], (err, requests) => {
    if (err) {
      return res.status(500).json({ message: 'Error fetching friend requests' });
    }
    res.json(requests);
  });
});

// Respond to friend request
app.put('/api/friends/request/:requestId', authenticateToken, (req, res) => {
  const { requestId } = req.params;
  const { action } = req.body; // 'accept' or 'decline'
  const userId = req.user.userId;

  if (!['accept', 'decline'].includes(action)) {
    return res.status(400).json({ message: 'Invalid action' });
  }

  const status = action === 'accept' ? 'accepted' : 'declined';

  db.run(
    'UPDATE friends SET status = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ? AND recipientId = ? AND status = "pending"',
    [status, requestId, userId],
    function(err) {
      if (err) {
        return res.status(500).json({ message: 'Error updating friend request' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ message: 'Friend request not found' });
      }

      res.json({ message: `Friend request ${action}ed successfully` });
    }
  );
});

// Get friends list with their events
app.get('/api/friends', authenticateToken, (req, res) => {
  const userId = req.user.userId;

  const query = `
    SELECT DISTINCT
      CASE
        WHEN f.requesterId = ? THEN f.recipientId
        ELSE f.requesterId
      END as friendId,
      CASE
        WHEN f.requesterId = ? THEN ru.firstName
        ELSE su.firstName
      END as firstName,
      CASE
        WHEN f.requesterId = ? THEN ru.lastName
        ELSE su.lastName
      END as lastName,
      CASE
        WHEN f.requesterId = ? THEN ru.email
        ELSE su.email
      END as email
    FROM friends f
    LEFT JOIN users su ON f.requesterId = su.id
    LEFT JOIN users ru ON f.recipientId = ru.id
    WHERE (f.requesterId = ? OR f.recipientId = ?)
    AND f.status = 'accepted'
    ORDER BY firstName, lastName
  `;

  db.all(query, [userId, userId, userId, userId, userId, userId], (err, friends) => {
    if (err) {
      return res.status(500).json({ message: 'Error fetching friends' });
    }

    // Get events for each friend
    const friendsWithEvents = [];
    let processed = 0;

    if (friends.length === 0) {
      return res.json([]);
    }

    friends.forEach(friend => {
      const eventQuery = `
        SELECT
          e.id, e.title, e.date, e.imageUrl,
          v.name as venueName,
          MIN(s.section) as section, MIN(s.row) as row, MIN(s.number) as seatNumber,
          MIN(p.purchaseDate) as purchaseDate,
          COUNT(p.id) as ticketCount
        FROM purchases p
        JOIN events e ON p.eventId = e.id
        JOIN venues v ON e.venueId = v.id
        JOIN seats s ON p.seatId = s.id
        WHERE p.userId = ?
        GROUP BY e.id, e.title, e.date, e.imageUrl, v.name
        ORDER BY e.date ASC
      `;

      db.all(eventQuery, [friend.friendId], (err, events) => {
        processed++;

        if (!err) {
          friend.events = events;
        } else {
          friend.events = [];
        }

        friendsWithEvents.push(friend);

        if (processed === friends.length) {
          res.json(friendsWithEvents);
        }
      });
    });
  });
});

// Remove friend
app.delete('/api/friends/:friendId', authenticateToken, (req, res) => {
  const { friendId } = req.params;
  const userId = req.user.userId;

  db.run(
    'DELETE FROM friends WHERE ((requesterId = ? AND recipientId = ?) OR (requesterId = ? AND recipientId = ?)) AND status = "accepted"',
    [userId, friendId, friendId, userId],
    function(err) {
      if (err) {
        return res.status(500).json({ message: 'Error removing friend' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ message: 'Friend relationship not found' });
      }

      res.json({ message: 'Friend removed successfully' });
    }
  );
});

// Get user's saved payment methods
app.get('/api/payment-methods', authenticateToken, (req, res) => {
  const userId = req.user.userId;

  db.all(
    'SELECT id, cardholderName, lastFourDigits, expirationMonth, expirationYear, address, city, state, zipCode FROM payment_methods WHERE userId = ?',
    [userId],
    (err, paymentMethods) => {
      if (err) {
        return res.status(500).json({ message: 'Error fetching payment methods' });
      }
      res.json(paymentMethods);
    }
  );
});

// Save new payment method
app.post('/api/payment-methods', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const {
    cardholderName,
    cardNumber,
    expirationMonth,
    expirationYear,
    cvv,
    billingAddress,
    billingCity,
    billingState,
    billingZip
  } = req.body;

  // Get last 4 digits of card
  const lastFourDigits = cardNumber.slice(-4);

  db.run(
    `INSERT INTO payment_methods
     (userId, cardholderName, lastFourDigits, expirationMonth, expirationYear,
      address, city, state, zipCode)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, cardholderName, lastFourDigits, expirationMonth, expirationYear,
     billingAddress, billingCity, billingState, billingZip],
    function(err) {
      if (err) {
        return res.status(500).json({ message: 'Error saving payment method' });
      }
      res.json({
        message: 'Payment method saved successfully',
        paymentMethodId: this.lastID
      });
    }
  );
});

// Group Purchase Routes

// Create a new group purchase
app.post('/api/groups', authenticateToken, (req, res) => {
  const { eventId, groupName, maxMembers = 10, targetSeats, estimatedPricePerSeat } = req.body;
  const leaderId = req.user.userId;
  const groupId = uuidv4();

  if (!eventId || !groupName || !targetSeats) {
    return res.status(400).json({ message: 'Event ID, group name, and target seats are required' });
  }

  db.run(
    `INSERT INTO group_purchases (id, eventId, leaderId, groupName, maxMembers, targetSeats, estimatedPricePerSeat)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [groupId, eventId, leaderId, groupName, maxMembers, targetSeats, estimatedPricePerSeat],
    function(err) {
      if (err) {
        console.error('Error creating group:', err);
        return res.status(500).json({ message: 'Error creating group purchase' });
      }
      res.status(201).json({
        id: groupId,
        eventId,
        leaderId,
        groupName,
        maxMembers,
        targetSeats,
        estimatedPricePerSeat,
        status: 'forming'
      });
    }
  );
});

// Get user's groups (as leader or member)
app.get('/api/groups', authenticateToken, (req, res) => {
  const userId = req.user.userId;

  const query = `
    SELECT DISTINCT
      gp.*,
      e.title as eventTitle,
      e.date as eventDate,
      v.name as venueName,
      u.firstName as leaderFirstName,
      u.lastName as leaderLastName,
      (SELECT COUNT(*) FROM group_members gm WHERE gm.groupId = gp.id AND gm.status = 'joined') as currentMembers
    FROM group_purchases gp
    JOIN events e ON gp.eventId = e.id
    JOIN venues v ON e.venueId = v.id
    JOIN users u ON gp.leaderId = u.id
    LEFT JOIN group_members gm ON gp.id = gm.groupId
    WHERE gp.leaderId = ? OR (gm.userId = ? AND gm.status IN ('joined', 'invited'))
    ORDER BY gp.createdAt DESC
  `;

  db.all(query, [userId, userId], (err, groups) => {
    if (err) {
      console.error('Error fetching groups:', err);
      return res.status(500).json({ message: 'Error fetching groups' });
    }
    res.json(groups);
  });
});

// Get specific group details
app.get('/api/groups/:groupId', authenticateToken, (req, res) => {
  const { groupId } = req.params;
  const userId = req.user.userId;

  const query = `
    SELECT
      gp.*,
      e.title as eventTitle,
      e.date as eventDate,
      v.name as venueName,
      u.firstName as leaderFirstName,
      u.lastName as leaderLastName
    FROM group_purchases gp
    JOIN events e ON gp.eventId = e.id
    JOIN venues v ON e.venueId = v.id
    JOIN users u ON gp.leaderId = u.id
    WHERE gp.id = ?
  `;

  db.get(query, [groupId], (err, group) => {
    if (err) {
      console.error('Error fetching group:', err);
      return res.status(500).json({ message: 'Error fetching group' });
    }

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Check if user is leader or member
    const memberQuery = `
      SELECT userId FROM group_members WHERE groupId = ? AND userId = ?
      UNION
      SELECT leaderId as userId FROM group_purchases WHERE id = ? AND leaderId = ?
    `;

    db.get(memberQuery, [groupId, userId, groupId, userId], (err, access) => {
      if (err) {
        console.error('Error checking access:', err);
        return res.status(500).json({ message: 'Error checking access' });
      }

      if (!access) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Get group members
      const membersQuery = `
        SELECT
          gm.*,
          u.firstName,
          u.lastName,
          u.email,
          (SELECT SUM(amount) FROM group_payments gp WHERE gp.groupId = ? AND gp.userId = gm.userId AND gp.paymentStatus = 'completed') as paidAmount
        FROM group_members gm
        JOIN users u ON gm.userId = u.id
        WHERE gm.groupId = ?
        ORDER BY gm.createdAt ASC
      `;

      db.all(membersQuery, [groupId, groupId], (err, members) => {
        if (err) {
          console.error('Error fetching members:', err);
          return res.status(500).json({ message: 'Error fetching members' });
        }

        res.json({
          ...group,
          members: members || []
        });
      });
    });
  });
});

// Invite friends to group
app.post('/api/groups/:groupId/invite', authenticateToken, (req, res) => {
  const { groupId } = req.params;
  const { friendIds } = req.body;
  const userId = req.user.userId;

  if (!friendIds || !Array.isArray(friendIds)) {
    return res.status(400).json({ message: 'Friend IDs array is required' });
  }

  // Check if user is the group leader
  db.get(
    'SELECT * FROM group_purchases WHERE id = ? AND leaderId = ?',
    [groupId, userId],
    (err, group) => {
      if (err) {
        console.error('Error checking group leadership:', err);
        return res.status(500).json({ message: 'Error checking group access' });
      }

      if (!group) {
        return res.status(403).json({ message: 'Only group leaders can invite members' });
      }

      // Add members to group
      const insertPromises = friendIds.map(friendId => {
        return new Promise((resolve, reject) => {
          const memberId = uuidv4();
          db.run(
            'INSERT INTO group_members (id, groupId, userId, status) VALUES (?, ?, ?, ?)',
            [memberId, groupId, friendId, 'invited'],
            function(err) {
              if (err) {
                if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                  resolve({ friendId, status: 'already_invited' });
                } else {
                  reject(err);
                }
              } else {
                resolve({ friendId, status: 'invited' });
              }
            }
          );
        });
      });

      Promise.all(insertPromises)
        .then(results => {
          res.json({ message: 'Invitations sent', results });
        })
        .catch(err => {
          console.error('Error sending invitations:', err);
          res.status(500).json({ message: 'Error sending invitations' });
        });
    }
  );
});

// Join a group (accept invitation)
app.post('/api/groups/:groupId/join', authenticateToken, (req, res) => {
  const { groupId } = req.params;
  const userId = req.user.userId;

  db.run(
    'UPDATE group_members SET status = ?, joinedAt = datetime("now") WHERE groupId = ? AND userId = ? AND status = ?',
    ['joined', groupId, userId, 'invited'],
    function(err) {
      if (err) {
        console.error('Error joining group:', err);
        return res.status(500).json({ message: 'Error joining group' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ message: 'Invitation not found or already processed' });
      }

      res.json({ message: 'Successfully joined group' });
    }
  );
});

// Make pre-payment for group
app.post('/api/groups/:groupId/payment', authenticateToken, (req, res) => {
  const { groupId } = req.params;
  const { amount, paymentMethod } = req.body;
  const userId = req.user.userId;

  if (!amount || !paymentMethod) {
    return res.status(400).json({ message: 'Amount and payment method are required' });
  }

  // Check if user is a member of the group
  db.get(
    'SELECT * FROM group_members WHERE groupId = ? AND userId = ? AND status = ?',
    [groupId, userId, 'joined'],
    (err, member) => {
      if (err) {
        console.error('Error checking membership:', err);
        return res.status(500).json({ message: 'Error checking membership' });
      }

      if (!member) {
        return res.status(403).json({ message: 'Must be a group member to make payments' });
      }

      const paymentId = uuidv4();
      db.run(
        `INSERT INTO group_payments (id, groupId, userId, amount, paymentMethod, paymentStatus, processedAt)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
        [paymentId, groupId, userId, amount, paymentMethod, 'completed'],
        function(err) {
          if (err) {
            console.error('Error processing payment:', err);
            return res.status(500).json({ message: 'Error processing payment' });
          }

          // Update total prepaid amount
          db.run(
            'UPDATE group_purchases SET totalPrepaid = (SELECT SUM(amount) FROM group_payments WHERE groupId = ? AND paymentStatus = ?) WHERE id = ?',
            [groupId, 'completed', groupId],
            (err) => {
              if (err) {
                console.error('Error updating total prepaid:', err);
              }
            }
          );

          res.json({
            id: paymentId,
            message: 'Payment processed successfully',
            amount
          });
        }
      );
    }
  );
});

// Get available groups for an event that user can join
app.get('/api/events/:eventId/groups', authenticateToken, (req, res) => {
  const { eventId } = req.params;
  const userId = req.user.userId;

  const query = `
    SELECT
      gp.*,
      u.firstName as leaderFirstName,
      u.lastName as leaderLastName,
      (SELECT COUNT(*) FROM group_members gm WHERE gm.groupId = gp.id AND gm.status = 'joined') as currentMembers,
      EXISTS(
        SELECT 1 FROM group_members gm2
        WHERE gm2.groupId = gp.id AND gm2.userId = ?
      ) as userIsMember,
      EXISTS(
        SELECT 1 FROM friends f
        WHERE ((f.userId = ? AND f.friendId = gp.leaderId) OR (f.userId = gp.leaderId AND f.friendId = ?))
        AND f.status = 'accepted'
      ) as isLeaderFriend
    FROM group_purchases gp
    JOIN users u ON gp.leaderId = u.id
    WHERE gp.eventId = ? AND gp.status = 'forming'
    ORDER BY gp.createdAt DESC
  `;

  db.all(query, [userId, userId, userId, eventId], (err, groups) => {
    if (err) {
      console.error('Error fetching event groups:', err);
      return res.status(500).json({ message: 'Error fetching groups' });
    }
    res.json(groups);
  });
});

// Purchase tickets for a group (group leader only)
app.post('/api/groups/:groupId/purchase', authenticateToken, (req, res) => {
  const { groupId } = req.params;
  const { seats, paymentInfo } = req.body;
  const userId = req.user.userId;

  if (!seats || !Array.isArray(seats) || seats.length === 0) {
    return res.status(400).json({ message: 'Seats are required' });
  }

  // Check if user is the group leader
  db.get(
    'SELECT * FROM group_purchases WHERE id = ? AND leaderId = ?',
    [groupId, userId],
    async (err, group) => {
      if (err) {
        console.error('Error checking group leadership:', err);
        return res.status(500).json({ message: 'Error checking group access' });
      }

      if (!group) {
        return res.status(403).json({ message: 'Only group leaders can purchase tickets' });
      }

      // Get group members count (including leader)
      db.get(
        'SELECT COUNT(*) + 1 as totalMembers FROM group_members WHERE groupId = ? AND status = ?',
        [groupId, 'joined'],
        (err, memberCount) => {
          if (err) {
            console.error('Error counting members:', err);
            return res.status(500).json({ message: 'Error counting group members' });
          }

          if (seats.length !== memberCount.totalMembers) {
            return res.status(400).json({
              message: `You must select exactly ${memberCount.totalMembers} seats for your group members`
            });
          }

          // Start transaction to purchase seats
          db.serialize(() => {
            db.run('BEGIN TRANSACTION');

            let totalCost = 0;
            let purchaseIds = [];
            let completedPurchases = 0;
            let hasError = false;

            // Purchase each seat
            seats.forEach((seat, index) => {
              const purchaseId = require('uuid').v4();

              db.run(
                'INSERT INTO purchases (id, userId, eventId, seatId, price, purchaseDate) VALUES (?, ?, ?, ?, ?, datetime("now"))',
                [purchaseId, userId, group.eventId, seat.seatId, seat.price],
                function(err) {
                  if (err) {
                    console.error('Error purchasing seat:', err);
                    hasError = true;
                    return;
                  }

                  purchaseIds.push(purchaseId);
                  totalCost += parseFloat(seat.price);
                  completedPurchases++;

                  // If this is the last seat, finalize the transaction
                  if (completedPurchases === seats.length) {
                    if (hasError) {
                      db.run('ROLLBACK');
                      return res.status(500).json({ message: 'Error purchasing tickets' });
                    }

                    // Update group status and assign seats to members
                    db.run(
                      'UPDATE group_purchases SET status = ?, actualTotalCost = ?, successfulPurchaseAt = datetime("now") WHERE id = ?',
                      ['completed', totalCost, groupId],
                      (err) => {
                        if (err) {
                          console.error('Error updating group:', err);
                          db.run('ROLLBACK');
                          return res.status(500).json({ message: 'Error finalizing group purchase' });
                        }

                        // Assign seats to group members (simplified - assign in order)
                        let assignmentIndex = 0;

                        // Assign first seat to leader
                        if (seats[assignmentIndex]) {
                          db.run(
                            'UPDATE group_members SET seatAssignedId = ?, finalPrice = ? WHERE groupId = ? AND userId = ?',
                            [seats[assignmentIndex].seatId, seats[assignmentIndex].price, groupId, userId],
                            () => assignmentIndex++
                          );
                        }

                        // Get group members and assign remaining seats
                        db.all(
                          'SELECT userId FROM group_members WHERE groupId = ? AND status = ? ORDER BY joinedAt ASC',
                          [groupId, 'joined'],
                          (err, members) => {
                            if (err) {
                              console.error('Error fetching members for seat assignment:', err);
                            } else {
                              members.forEach((member, memberIndex) => {
                                const seatIndex = assignmentIndex + memberIndex;
                                if (seats[seatIndex]) {
                                  db.run(
                                    'UPDATE group_members SET seatAssignedId = ?, finalPrice = ? WHERE groupId = ? AND userId = ?',
                                    [seats[seatIndex].seatId, seats[seatIndex].price, groupId, member.userId]
                                  );
                                }
                              });
                            }

                            db.run('COMMIT');
                            res.json({
                              message: 'Group tickets purchased successfully!',
                              purchaseIds,
                              totalCost,
                              seatsAssigned: seats.length
                            });
                          }
                        );
                      }
                    );
                  }
                }
              );
            });
          });
        }
      );
    }
  );
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
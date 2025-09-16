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
app.get('/api/events/:eventId/seats', (req, res) => {
  const eventId = req.params.eventId;

  // First get the venue for this event
  db.get('SELECT venueId FROM events WHERE id = ?', [eventId], (err, event) => {
    if (err || !event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Get all seats for this venue with purchase status
    const query = `
      SELECT
        s.*,
        CASE
          WHEN p.id IS NOT NULL THEN 1
          ELSE 0
        END as isPurchased
      FROM seats s
      LEFT JOIN purchases p ON s.id = p.seatId AND p.eventId = ?
      WHERE s.venueId = ?
      ORDER BY s.section, s.row, s.number
    `;

    db.all(query, [eventId, event.venueId], (err, seats) => {
      if (err) {
        return res.status(500).json({ message: 'Error fetching seats' });
      }
      res.json(seats);
    });
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

    // Check if any seats are already purchased for this event
    const seatCheckQuery = `SELECT seatId FROM purchases WHERE eventId = ? AND seatId IN (${seatsToProcess.map(() => '?').join(',')})`;
    db.all(seatCheckQuery, [eventId, ...seatsToProcess], (err, existingPurchases) => {
    if (err) {
      return res.status(500).json({ message: 'Error checking seat availability' });
    }

    if (existingPurchases.length > 0) {
      const unavailableSeats = existingPurchases.map(p => p.seatId);
      return res.status(409).json({
        message: 'Some seats are already purchased',
        unavailableSeats
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
          s.section, s.row, s.number as seatNumber,
          p.purchaseDate
        FROM purchases p
        JOIN events e ON p.eventId = e.id
        JOIN venues v ON e.venueId = v.id
        JOIN seats s ON p.seatId = s.id
        WHERE p.userId = ?
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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
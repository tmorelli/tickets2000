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
app.get('/api/events', (req, res) => {
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
    res.json(events);
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

// Purchase Routes
app.post('/api/purchase', authenticateToken, (req, res) => {
  const { eventId, seatId } = req.body;
  const userId = req.user.userId;

  // Check if seat is already purchased for this event
  db.get(
    'SELECT id FROM purchases WHERE eventId = ? AND seatId = ?',
    [eventId, seatId],
    (err, existingPurchase) => {
      if (err) {
        return res.status(500).json({ message: 'Error checking seat availability' });
      }

      if (existingPurchase) {
        return res.status(409).json({ message: 'Seat already purchased' });
      }

      // Get seat details to calculate price
      const seatQuery = `
        SELECT s.*, e.title as eventTitle
        FROM seats s, events e
        WHERE s.id = ? AND e.id = ?
      `;

      db.get(seatQuery, [seatId, eventId], (err, seat) => {
        if (err || !seat) {
          return res.status(404).json({ message: 'Seat or event not found' });
        }

        const finalPrice = (seat.basePrice * seat.multiplier).toFixed(2);
        const purchaseId = uuidv4();

        db.run(
          'INSERT INTO purchases (id, userId, eventId, seatId, price) VALUES (?, ?, ?, ?, ?)',
          [purchaseId, userId, eventId, seatId, finalPrice],
          function(err) {
            if (err) {
              return res.status(500).json({ message: 'Error processing purchase' });
            }

            res.status(201).json({
              id: purchaseId,
              eventId,
              seatId,
              price: finalPrice,
              message: 'Purchase successful'
            });
          }
        );
      });
    }
  );
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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
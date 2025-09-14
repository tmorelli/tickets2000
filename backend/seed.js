const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');

const db = new sqlite3.Database('./tickets.db');

console.log('Seeding database...');

db.serialize(() => {
  // Clear existing data
  db.run('DELETE FROM purchases');
  db.run('DELETE FROM seats');
  db.run('DELETE FROM events');
  db.run('DELETE FROM venues');

  // Insert venue
  const venueId = uuidv4();
  db.run(
    'INSERT INTO venues (id, name, address, capacity) VALUES (?, ?, ?, ?)',
    [venueId, 'Madison Square Garden', '4 Pennsylvania Plaza, New York, NY 10001', 20000]
  );

  // Insert events
  const events = [
    {
      id: uuidv4(),
      title: 'NBA Finals Game 7',
      description: 'The ultimate showdown in basketball history',
      date: '2025-06-20 20:00:00',
      imageUrl: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect width="400" height="300" fill="%23FF6B35"/><circle cx="200" cy="120" r="40" fill="white" stroke="%23FF6B35" stroke-width="3"/><text x="50%" y="200" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="white">NBA FINALS</text><text x="50%" y="230" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" fill="white">GAME 7</text></svg>'
    },
    {
      id: uuidv4(),
      title: 'Taylor Swift - Eras Tour',
      description: 'An unforgettable night of music spanning all eras',
      date: '2025-12-15 19:30:00',
      imageUrl: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><defs><linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:%236A994E;stop-opacity:1" /><stop offset="100%" style="stop-color:%234A6741;stop-opacity:1" /></linearGradient></defs><rect width="400" height="300" fill="url(%23grad)"/><path d="M150 80 L250 80 L270 120 L230 120 L250 160 L150 160 L170 120 L130 120 Z" fill="white" opacity="0.8"/><text x="50%" y="200" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="white">TAYLOR SWIFT</text><text x="50%" y="230" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" fill="white">THE ERAS TOUR</text></svg>'
    },
    {
      id: uuidv4(),
      title: 'Billy Joel Concert',
      description: 'The Piano Man returns to the Garden',
      date: '2025-10-25 20:00:00',
      imageUrl: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect width="400" height="300" fill="%23386641"/><rect x="120" y="80" width="160" height="100" fill="white" rx="5"/><rect x="130" y="90" width="20" height="80" fill="%23333"/><rect x="150" y="90" width="15" height="50" fill="%23333"/><rect x="165" y="90" width="20" height="80" fill="%23333"/><rect x="185" y="90" width="15" height="50" fill="%23333"/><rect x="200" y="90" width="20" height="80" fill="%23333"/><rect x="220" y="90" width="15" height="50" fill="%23333"/><rect x="235" y="90" width="20" height="80" fill="%23333"/><rect x="255" y="90" width="15" height="50" fill="%23333"/><text x="50%" y="220" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="white">BILLY JOEL</text><text x="50%" y="250" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" fill="white">PIANO MAN</text></svg>'
    }
  ];

  events.forEach(event => {
    db.run(
      'INSERT INTO events (id, venueId, title, description, date, imageUrl) VALUES (?, ?, ?, ?, ?, ?)',
      [event.id, venueId, event.title, event.description, event.date, event.imageUrl]
    );
  });

  // Generate seats for venue - simple theater layout with stage at top
  const centerX = 400;
  const stageY = 80;
  const firstRowY = 150;

  // Create 25 rows facing the stage, more seats in back rows
  for (let row = 1; row <= 25; row++) {
    let seatsInRow, seatSpacing, basePrice, multiplier, section;

    // Determine seats per row, pricing, and section based on distance from stage
    if (row <= 5) {
      // VIP Front rows (1-5): fewest seats, highest price
      seatsInRow = 12;
      seatSpacing = 20;
      basePrice = 250;
      multiplier = 2.0;
      section = 'VIP Front';
    } else if (row <= 10) {
      // Premium rows (6-10)
      seatsInRow = 16;
      seatSpacing = 18;
      basePrice = 200;
      multiplier = 1.8;
      section = 'Premium';
    } else if (row <= 18) {
      // Main Floor rows (11-18)
      seatsInRow = 22;
      seatSpacing = 16;
      basePrice = 150;
      multiplier = 1.5;
      section = 'Main Floor';
    } else {
      // Back rows (19-25): most seats, lowest price
      seatsInRow = 28;
      seatSpacing = 14;
      basePrice = 75;
      multiplier = 1.0;
      section = 'General';
    }

    // Calculate starting X to center the row
    const rowWidth = (seatsInRow - 1) * seatSpacing;
    const startX = centerX - (rowWidth / 2);
    const rowY = firstRowY + (row - 1) * 20;

    // Create seats in this row
    for (let seatNum = 1; seatNum <= seatsInRow; seatNum++) {
      const seatId = uuidv4();
      const rowLetter = String.fromCharCode(64 + row); // A, B, C, etc.

      const x = startX + (seatNum - 1) * seatSpacing;
      const y = rowY;

      db.run(
        'INSERT INTO seats (id, venueId, section, row, number, basePrice, multiplier, x, y) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [seatId, venueId, section, rowLetter, seatNum, basePrice, multiplier, x, y]
      );
    }
  }

  console.log('Database seeded successfully!');
  console.log(`- Added 1 venue: Madison Square Garden`);
  console.log(`- Added ${events.length} events`);
  console.log(`- Generated seats for all sections`);
});

db.close();
# Tickets2000 - Event Ticketing App

A full-stack ticketing application similar to Ticketmaster, built with React and Node.js.

## Features

- **User Authentication**: Register and login system (no verification required)
- **Event Listings**: Browse fictitious events at Madison Square Garden
- **Interactive Seat Map**: Visual stadium layout with clickable seats
- **Dynamic Pricing**: Seats closer to the stage are more expensive
- **Purchase Flow**: Select and buy tickets
- **Purchase History**: View all your purchased tickets

## Technology Stack

### Backend
- Node.js + Express
- SQLite database
- JWT authentication
- bcryptjs for password hashing

### Frontend
- React with React Router
- Axios for API calls
- CSS for styling
- Context API for state management

## Getting Started

### Prerequisites
- Node.js installed on your system
- npm package manager

### Installation & Setup

1. **Clone and navigate to the project:**
   ```bash
   cd Tickets2000/tickets2000
   ```

2. **Start the Backend Server:**
   ```bash
   cd backend
   npm install  # if not already done
   node seed.js  # populate the database
   npm start
   ```
   Backend will run on `http://localhost:3001`

3. **Start the Frontend Server (in a new terminal):**
   ```bash
   cd frontend
   npm install  # if not already done
   npm start
   ```
   Frontend will run on `http://localhost:3000`

## Usage

1. **Register**: Create a new account with your name, email, and password
2. **Login**: Sign in to access the app
3. **Browse Events**: View the list of available events at Madison Square Garden
4. **Select Event**: Click "Select Seats" on any event
5. **Choose Seat**: Click on available seats in the interactive stadium map
6. **Purchase**: Complete your ticket purchase
7. **View History**: Check "My Tickets" to see your purchase history

## Database Schema

- **users**: User accounts
- **venues**: Event venues (Madison Square Garden)
- **events**: Available events
- **seats**: Stadium seats with pricing
- **purchases**: Ticket purchase records

## Seat Pricing

- **Floor A**: $500 (closest to stage)
- **Floor B**: $360
- **Lower Bowl**: $225
- **Upper Bowl**: $90
- **Nosebleeds**: $35 (furthest from stage)

## Sample Events

The app comes pre-loaded with 3 sample events:
- NBA Finals Game 7
- Taylor Swift - Eras Tour
- Billy Joel Concert

## API Endpoints

### Authentication
- `POST /api/register` - Register new user
- `POST /api/login` - User login

### Events
- `GET /api/events` - Get all events
- `GET /api/events/:id` - Get event details

### Seats & Purchases
- `GET /api/events/:eventId/seats` - Get seats for event
- `POST /api/purchase` - Purchase ticket (requires auth)
- `GET /api/purchases` - Get user's purchase history (requires auth)

## Development Notes

- The app uses SQLite for simplicity (file: `backend/tickets.db`)
- JWT tokens are stored in localStorage
- No email verification is implemented
- Seat positions are randomly generated around section centers
- All purchases are simulated (no payment processing)

Enjoy exploring the Tickets2000 app!
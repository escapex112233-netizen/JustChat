const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Pool setup for PostgreSQL (DATABASE_URL env required)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Create Room
app.post('/chat/create', async (req, res) => {
  const { chatName, secretCode, type } = req.body;
  if (!chatName || !secretCode) return res.status(400).json({ error: 'Missing fields' });

  try {
    const exists = await pool.query('SELECT * FROM chat_rooms WHERE secret_code = $1', [secretCode]);
    if (exists.rows.length > 0) return res.status(409).json({ error: 'Secret code already exists' });

    await pool.query(
      'INSERT INTO chat_rooms (chat_name, secret_code, type) VALUES ($1, $2, $3)',
      [chatName, secretCode, type || 'public']
    );
    return res.status(201).json({ message: 'Room created' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Join Room
app.post('/chat/join', async (req, res) => {
  const { secretCode } = req.body;
  if (!secretCode) return res.status(400).json({ error: 'Missing secret code' });

  try {
    const result = await pool.query(
      'SELECT chat_name FROM chat_rooms WHERE secret_code = $1',
      [secretCode]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Room not found' });

    res.json({ chatName: result.rows[0].chat_name });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Send Message
app.post('/chat/message', async (req, res) => {
  const { secretCode, userName, userLogo, text } = req.body;
  if (!secretCode || !userName || !text) return res.status(400).json({ error: 'Missing fields' });

  try {
    const room = await pool.query('SELECT * FROM chat_rooms WHERE secret_code = $1', [secretCode]);
    if (room.rows.length === 0) return res.status(404).json({ error: 'Room not found' });

    await pool.query(
      'INSERT INTO messages (secret_code, user_name, user_logo, text) VALUES ($1, $2, $3, $4)',
      [secretCode, userName, userLogo || '', text]
    );
    res.status(201).json({ message: 'Message saved' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Get all messages for a room (ordered)
app.get('/chat/messages/:secretCode', async (req, res) => {
  const secretCode = req.params.secretCode;

  try {
    const messages = await pool.query(
      'SELECT user_name, user_logo, text, created_at FROM messages WHERE secret_code = $1 ORDER BY created_at ASC',
      [secretCode]
    );
    res.json(messages.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Get all rooms (for "Rooms" list, shows type field too)
app.get('/chat/rooms', async (req, res) => {
  try {
    // If you don't have `type` column, use 'public' as type
    const result = await pool.query(
      'SELECT chat_name, secret_code, type FROM chat_rooms'
    );
    res.json(result.rows);
  } catch (err) {
    try {
      // fallback if no type column
      const result = await pool.query(
        "SELECT chat_name, secret_code, 'public' as type FROM chat_rooms"
      );
      res.json(result.rows);
    } catch (e2) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// Default route -- show plain message (not an error)
app.get('/', (req, res) => {
  res.send('JustCo backend is running!');
});

// Start server
app.listen(port, () => {
  console.log(`JustCo chat backend listening on port ${port}`);
});

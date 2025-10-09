const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const app = express();
const port = process.env.PORT || 10000;

// Middleware
app.use(cors());
app.use(express.json());

// PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Create room
app.post('/chat/create', async (req, res) => {
  const { chatName, secretCode, type } = req.body;
  if (!chatName || !secretCode)
    return res.status(400).json({ error: 'Missing fields' });
  try {
    const exists = await pool.query('SELECT * FROM chat_rooms WHERE secret_code = $1', [secretCode]);
    if (exists.rows.length > 0)
      return res.status(409).json({ error: 'Secret code already exists' });

    await pool.query(
      'INSERT INTO chat_rooms (chat_name, secret_code, type) VALUES ($1, $2, $3)',
      [chatName, secretCode, type || 'public']
    );
    return res.status(201).json({ message: 'Room created' });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Join room
app.post('/chat/join', async (req, res) => {
  const { secretCode } = req.body;
  if (!secretCode)
    return res.status(400).json({ error: 'Missing secret code' });

  try {
    const result = await pool.query(
      'SELECT chat_name FROM chat_rooms WHERE secret_code = $1',
      [secretCode]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: 'Room not found' });
    res.json({ chatName: result.rows[0].chat_name });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Send message
app.post('/chat/message', async (req, res) => {
  const { secretCode, userName, userLogo, text } = req.body;
  if (!secretCode || !userName || !text)
    return res.status(400).json({ error: 'Missing fields' });

  try {
    const room = await pool.query(
      'SELECT * FROM chat_rooms WHERE secret_code = $1',
      [secretCode]
    );
    if (room.rows.length === 0)
      return res.status(404).json({ error: 'Room not found' });

    await pool.query(
      'INSERT INTO messages (secret_code, user_name, user_logo, text) VALUES ($1, $2, $3, $4)',
      [secretCode, userName, userLogo || '', text]
    );
    res.status(201).json({ message: 'Message saved' });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Get all messages for a room
app.get('/chat/messages/:secretCode', async (req, res) => {
  const secretCode = req.params.secretCode;
  try {
    const messages = await pool.query(
      'SELECT user_name, user_logo, text, created_at FROM messages WHERE secret_code = $1 ORDER BY created_at ASC',
      [secretCode]
    );
    res.json(messages.rows);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// List all rooms
app.get('/chat/rooms', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT chat_name, secret_code, type FROM chat_rooms'
    );
    res.json(result.rows);
  } catch (err) {
    try {
      const result = await pool.query(
        "SELECT chat_name, secret_code, 'public' as type FROM chat_rooms"
      );
      res.json(result.rows);
    } catch (e2) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// DELETE any room (admin)
app.delete('/chat/room/:code', async (req,res)=>{
  try {
    await pool.query('DELETE FROM chat_rooms WHERE secret_code=$1',[req.params.code]);
    await pool.query('DELETE FROM messages WHERE secret_code=$1',[req.params.code]);
    res.json({ success:true });
  } catch(e) { res.status(500).json({error:'DB error'}); }
});

// Home route
app.get('/', (req, res) => {
  res.send('JustCo backend running!');
});

// Start server
app.listen(port, () => {
  console.log(`JustCo chat backend listening on port ${port}`);
});
        

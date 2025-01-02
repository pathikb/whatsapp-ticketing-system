const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../db');
const authMiddleware = require('../middleware/auth');
const whatsapp = require('../utils/whatsapp');

const router = express.Router();

// Generate pass for a user for an event
router.post('/', authMiddleware, [
  body('eventId').isInt().withMessage('Event ID must be a valid integer'),
  body('category').isIn(['Gold', 'Silver', 'Platinum']).withMessage('Invalid pass category')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { eventId, category } = req.body;
  const userId = req.user.id;

  try {
    // Check if user already has a pass for this event
    const existingPass = await new Promise((resolve, reject) => {
      db.get(
        `SELECT * FROM passes WHERE userId = ? AND eventId = ?`,
        [userId, eventId],
        (err, row) => {
          if (err) return reject(err);
          resolve(row);
        }
      );
    });

    if (existingPass) {
      return res.status(400).json({ error: 'User already has a pass for this event' });
    }

    // Insert new pass
    const result = await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO passes (userId, eventId, category) VALUES (?, ?, ?)`,
        [userId, eventId, category],
        function(err) {
          if (err) return reject(err);
          resolve(this.lastID);
        }
      );
    });

    return res.status(201).json({ id: result });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Test pass image generation (no auth required)
router.get('/test-image', async (req, res) => {
  try {
    const testDetails = {
      userName: 'John Doe',
      eventName: 'Sample Event',
      eventDate: new Date().toDateString(),
      passCategory: 'Gold'
    };

    const imageBuffer = await whatsapp.getPassImage(testDetails);
    
    res.set('Content-Type', 'image/png');
    return res.send(imageBuffer);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Send pass to single user
router.post('/send', authMiddleware, [
  body('passId').isInt().withMessage('Pass ID must be a valid integer')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { passId } = req.body;

  try {
    // Get pass details
    const pass = await new Promise((resolve, reject) => {
      db.get(
        `SELECT * FROM passes WHERE id = ?`,
        [passId],
        (err, row) => {
          if (err) return reject(err);
          if (!row) return reject({ status: 404, message: 'Pass not found' });
          resolve(row);
        }
      );
    });

    // Get user details
    const user = await new Promise((resolve, reject) => {
      db.get(
        `SELECT * FROM users WHERE id = ?`,
        [pass.userId],
        (err, row) => {
          if (err) return reject(err);
          if (!row) return reject({ status: 404, message: 'User not found' });
          resolve(row);
        }
      );
    });

    // Get event details
    const event = await new Promise((resolve, reject) => {
      db.get(
        `SELECT * FROM events WHERE id = ?`,
        [pass.eventId],
        (err, row) => {
          if (err) return reject(err);
          if (!row) return reject({ status: 404, message: 'Event not found' });
          resolve(row);
        }
      );
    });

    // Send pass via WhatsApp
    await whatsapp.sendPassToUser(user, event, pass);

    return res.json({ success: true });
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ error: err.message });
  }
});

// Send passes to all event users in batch
router.post('/send-batch', authMiddleware, [
  body('eventId').isInt().withMessage('Event ID must be a valid integer')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { eventId } = req.body;

  try {
    // Get event details
    const event = await new Promise((resolve, reject) => {
      db.get(
        `SELECT * FROM events WHERE id = ?`,
        [eventId],
        (err, row) => {
          if (err) return reject(err);
          if (!row) return reject({ status: 404, message: 'Event not found' });
          resolve(row);
        }
      );
    });

    // Get all passes for the event
    const passes = await new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM passes WHERE eventId = ?`,
        [eventId],
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows);
        }
      );
    });

    // Get all users for the passes
    const userIds = passes.map(p => p.userId);
    const users = await new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM users WHERE id IN (${userIds.map(() => '?').join(',')})`,
        userIds,
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows);
        }
      );
    });

    // Send passes via WhatsApp
    const results = await whatsapp.sendPassesToEventUsers(event, users, passes);

    return res.json({ results });
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ error: err.message });
  }
});

// Fetch pass details by ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const pass = await new Promise((resolve, reject) => {
      db.get(
        `SELECT * FROM passes WHERE id = ?`,
        [req.params.id],
        (err, row) => {
          if (err) return reject(err);
          if (!row) return reject({ status: 404, message: 'Pass not found' });
          resolve(row);
        }
      );
    });

    return res.json(pass);
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ error: err.message });
  }
});

// Fetch all passes for an event
router.get('/event/:eventId', authMiddleware, async (req, res) => {
  try {
    const passes = await new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM passes WHERE eventId = ?`,
        [req.params.eventId],
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows);
        }
      );
    });

    return res.json(passes);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Fetch all passes for a user
router.get('/user/:userId', authMiddleware, async (req, res) => {
  try {
    const passes = await new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM passes WHERE userId = ?`,
        [req.params.userId],
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows);
        }
      );
    });

    return res.json(passes);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
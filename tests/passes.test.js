const request = require('supertest');
const app = require('../index');
const db = require('../db');

describe('Pass API', () => {
  let authToken;
  let userId;
  let eventId;

  beforeAll(async () => {
    // Initialize test database and create a test user
    await new Promise((resolve) => {
      db.run('DELETE FROM users', () => {
        db.run('DELETE FROM events', () => {
          db.run('DELETE FROM passes', resolve);
        });
      });
    });

    // Register a test user
    const userRes = await request(app)
      .post('/users/register')
      .send({
        name: 'Test User',
        phone: '1234567890',
        email: 'user@test.com'
      });
    
    authToken = userRes.body.token;
    userId = userRes.body.id;

    // Create a test event
    const eventRes = await request(app)
      .post('/events')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Test Event',
        description: 'Test Description',
        date: '2025-12-31T23:59:59Z',
        location: 'Test Location',
        goldPassLimit: 10,
        silverPassLimit: 20,
        platinumPassLimit: 5
      });

    eventId = eventRes.body.id;
  });

  describe('POST /passes', () => {
    it('should generate a new pass', async () => {
      const res = await request(app)
        .post('/passes')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          eventId: eventId,
          category: 'Gold'
        });
      
      expect(res.statusCode).toEqual(201);
      expect(res.body).toHaveProperty('id');
    });

    it('should return 400 for invalid category', async () => {
      const res = await request(app)
        .post('/passes')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          eventId: eventId,
          category: 'Invalid'
        });
      
      expect(res.statusCode).toEqual(400);
    });

    it('should return 400 when pass limit is reached', async () => {
      // Generate maximum number of Platinum passes
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/passes')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            eventId: eventId,
            category: 'Platinum'
          });
      }

      const res = await request(app)
        .post('/passes')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          eventId: eventId,
          category: 'Platinum'
        });
      
      expect(res.statusCode).toEqual(400);
    });
  });

  describe('GET /passes', () => {
    it('should get user passes', async () => {
      const res = await request(app)
        .get('/passes')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(res.statusCode).toEqual(200);
      expect(Array.isArray(res.body)).toBeTruthy();
    });
  });

  describe('PUT /passes/:id/status', () => {
    it('should update pass status', async () => {
      // First create a pass
      const createRes = await request(app)
        .post('/passes')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          eventId: eventId,
          category: 'Silver'
        });

      const passId = createRes.body.id;
      
      const res = await request(app)
        .put(`/passes/${passId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'Used'
        });
      
      expect(res.statusCode).toEqual(200);
    });

    it('should return 404 for non-existent pass', async () => {
      const res = await request(app)
        .put('/passes/9999/status')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'Used'
        });
      
      expect(res.statusCode).toEqual(404);
    });
  });
});
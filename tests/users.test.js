const request = require('supertest');
const app = require('../index');
const db = require('../db');

describe('User API', () => {
  beforeAll(async () => {
    // Initialize test database
    await new Promise((resolve) => {
      db.run('DELETE FROM users', resolve);
    });
  });

  describe('POST /users/register', () => {
    it('should register a new user', async () => {
      const res = await request(app)
        .post('/users/register')
        .send({
          name: 'Test User',
          phone: '1234567890',
          email: 'test@example.com'
        });
      
      expect(res.statusCode).toEqual(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('token');
    });

    it('should return 400 for invalid input', async () => {
      const res = await request(app)
        .post('/users/register')
        .send({
          name: '',
          phone: '',
          email: 'invalid'
        });
      
      expect(res.statusCode).toEqual(400);
    });
  });

  describe('GET /users/:id', () => {
    it('should get user details', async () => {
      // First register a user
      const registerRes = await request(app)
        .post('/users/register')
        .send({
          name: 'Test User',
          phone: '1234567891',
          email: 'test2@example.com'
        });

      const userId = registerRes.body.id;
      
      const res = await request(app)
        .get(`/users/${userId}`);
      
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('id', userId);
      expect(res.body).toHaveProperty('name', 'Test User');
    });

    it('should return 404 for non-existent user', async () => {
      const res = await request(app)
        .get('/users/9999');
      
      expect(res.statusCode).toEqual(404);
    });
  });
});
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

// Ensure fetch is available in all Node environments
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const app = express();
const server = http.createServer(app);
const allowedOrigins = process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ["https://beautiful-vacherin-55c050.netlify.app/", "http://localhost:8082", "http://localhost:8083", "http://localhost:8084", "https://your-frontend-domain.com", "https://vra-league.netlify.app", "https://leafy-unicorn-9fee6f.netlify.app", "https://backendsite1-production.up.railway.app"];

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true
  }
});

// Add CORS headers for all routes
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
    res.header('Access-Control-Allow-Origin', origin || '*');
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

const PORT = process.env.PORT || 8080;

// Initialize YAML-based storage
const dataDir = './data';
const commentsFile = path.join(dataDir, 'comments.yaml');

// Ensure data directory exists
await fs.mkdir(dataDir, { recursive: true });

// Helper function to read comments from YAML
async function readComments(articleId) {
  try {
    const filePath = path.join(dataDir, `comments_${articleId}.yaml`);
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data); // Assuming YAML is stored as JSON for simplicity
  } catch (error) {
    return [];
  }
}

// Helper function to write comments to YAML
async function writeComments(articleId, comments) {
  const filePath = path.join(dataDir, `comments_${articleId}.yaml`);
  await fs.writeFile(filePath, JSON.stringify(comments, null, 2));
}

app.use(express.json());

// API endpoint to get comments
app.get('/api/comments/:articleId', async (req, res) => {
  try {
    console.log(`Getting comments for article: ${req.params.articleId}`);
    const { articleId } = req.params;
    const status = (req.query.status || 'approved').toString();
    const comments = await readComments(articleId);
    const filtered = comments.filter(c => (c.status || 'approved') === status);
    console.log(`Found ${filtered.length} ${status} comments for article ${articleId}`);
    res.json(filtered);
  } catch (error) {
    console.error('Error getting comments:', error);
    res.status(500).json({ error: 'Failed to load comments' });
  }
});

// API endpoint to post comment
app.post('/api/comments/:articleId', async (req, res) => {
  try {
    console.log(`Posting comment for article: ${req.params.articleId}`);
    console.log('Request body:', req.body);
    const { articleId } = req.params;
    const { author, content, email, website } = req.body;

    if (!author || !content) {
      console.log('Missing required fields');
      return res.status(400).json({ error: 'Author and content are required' });
    }

    const comments = await readComments(articleId);
    console.log(`Current comments count: ${comments.length}`);

    const newComment = {
      id: Date.now().toString(),
      articleId,
      author,
      email: email || '',
      website: website || '',
      content,
      date: new Date().toISOString(),
      status: 'pending',
      replies: []
    };

    comments.push(newComment);
    await writeComments(articleId, comments);
    console.log(`Comment queued for moderation, total count: ${comments.length}`);

    // Do not broadcast yet; only after approval

    // Notify bot for moderation via webhook if configured
    const botUrl = process.env.BOT_ENDPOINT_URL;
    const botAuth = process.env.BOT_SHARED_SECRET;
    if (botUrl && botAuth) {
      try {
        await fetch(botUrl.replace(/\/$/, '') + '/moderation/new', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${botAuth}` },
          body: JSON.stringify({ comment: { id: newComment.id, articleId, author: newComment.author, content: newComment.content, email: newComment.email, website: newComment.website, date: newComment.date } })
        });
      } catch (e) {
        console.error('Failed to notify bot for moderation:', e.message);
      }
    }

    res.json({
      message: 'Your comment is awaiting verification and will not be posted until acceptance by staff.',
      id: newComment.id,
      status: 'pending'
    });
  } catch (error) {
    console.error('Error posting comment:', error);
    res.status(500).json({ error: 'Failed to post comment' });
  }
});

// API endpoint to post reply
app.post('/api/comments/:articleId/reply/:commentId', async (req, res) => {
  try {
    const { articleId, commentId } = req.params;
    const { author, content, email, website } = req.body;

    if (!author || !content) {
      return res.status(400).json({ error: 'Author and content are required' });
    }

    const comments = await readComments(articleId);
    if (!comments) {
      return res.status(404).json({ error: 'Article not found' });
    }

    const commentIndex = comments.findIndex(c => c.id === commentId);
    if (commentIndex === -1) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    const newReply = {
      id: Date.now().toString(),
      author,
      email: email || '',
      website: website || '',
      content,
      date: new Date().toLocaleString()
    };

    if (!comments[commentIndex].replies) {
      comments[commentIndex].replies = [];
    }

    comments[commentIndex].replies.push(newReply);
    await writeComments(articleId, comments);

    // Broadcast to all connected clients
    io.emit('newReply', { articleId, commentId, reply: newReply });

    res.json(newReply);
  } catch (error) {
    console.error('Error posting reply:', error);
    res.status(500).json({ error: 'Failed to post reply' });
  }
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Add a simple health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Secure moderation endpoint for the bot to approve/decline
app.post('/api/moderate', async (req, res) => {
  try {
    const secret = process.env.WEBSITE_MODERATION_SECRET;
    const authHdr = req.headers.authorization || '';
    if (!secret || authHdr !== `Bearer ${secret}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const { articleId, id, action } = req.body || {};
    if (!articleId || !id || !['approve', 'decline'].includes(action)) {
      return res.status(400).json({ error: 'Invalid payload' });
    }

    const comments = await readComments(articleId);
    const idx = comments.findIndex(c => c.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Comment not found' });

    if (action === 'approve') {
      comments[idx].status = 'approved';
      comments[idx].approvedAt = new Date().toISOString();
      await writeComments(articleId, comments);
      io.emit('newComment', { articleId, comment: comments[idx] });
      return res.json({ ok: true, status: 'approved' });
    } else {
      // decline: remove the comment entirely
      const removed = comments.splice(idx, 1);
      await writeComments(articleId, comments);
      return res.json({ ok: true, status: 'declined' });
    }
  } catch (err) {
    console.error('Moderation error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Add a simple endpoint to list pending (for debugging)
app.get('/api/pending/:articleId', async (req, res) => {
  const comments = await readComments(req.params.articleId);
  res.json(comments.filter(c => (c.status || 'approved') === 'pending'));
});

// Add a root endpoint to prevent 404 on root requests
app.get('/', (req, res) => {
  res.json({ message: 'VRA Comment Server API', endpoints: ['/api/comments/:articleId', '/api/comments/:articleId?status=approved', '/api/comments/:articleId?status=pending', '/api/moderate', '/health'] });
});


server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check available at: http://localhost:${PORT}/health`);
});
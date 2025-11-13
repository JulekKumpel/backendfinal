import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import fs from 'fs/promises';
import path from 'path';

const app = express();
const server = http.createServer(app);
const allowedOrigins = process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ["https://beautiful-vacherin-55c050.netlify.app/", "http://localhost:8082", "http://localhost:8083", "http://localhost:8084", "https://your-frontend-domain.com", "https://vra-league.netlify.app", "https://leafy-unicorn-9fee6f.netlify.app"];

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
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
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
    const { articleId } = req.params;
    const comments = await readComments(articleId);
    res.json(comments);
  } catch (error) {
    console.error('Error getting comments:', error);
    res.status(500).json({ error: 'Failed to load comments' });
  }
});

// API endpoint to post comment
app.post('/api/comments/:articleId', async (req, res) => {
  try {
    const { articleId } = req.params;
    const { author, content, email, website } = req.body;

    if (!author || !content) {
      return res.status(400).json({ error: 'Author and content are required' });
    }

    const comments = await readComments(articleId);

    const newComment = {
      id: Date.now().toString(),
      author,
      email: email || '',
      website: website || '',
      content,
      date: new Date().toLocaleString(),
      replies: []
    };

    comments.push(newComment);
    await writeComments(articleId, comments);

    // Broadcast to all connected clients
    io.emit('newComment', { articleId, comment: newComment });

    res.json(newComment);
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

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
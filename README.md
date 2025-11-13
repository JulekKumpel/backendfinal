# VRA Comment Server

A simple Express.js server for handling comments with YAML file storage.

## Features

- REST API for comments and replies
- Real-time updates via Socket.io
- YAML file storage (human-readable)
- CORS enabled for frontend integration

## API Endpoints

- `GET /api/comments/:articleId` - Get comments for an article
- `POST /api/comments/:articleId` - Post a new comment
- `POST /api/comments/:articleId/reply/:commentId` - Post a reply

## Deployment

This server is designed to run on Railway with persistent file storage.

### Environment Variables

Set the following environment variables in your deployment platform:

- `CORS_ORIGINS`: Comma-separated list of allowed origins (e.g., "https://vra-league.netlify.app,https://your-frontend-domain.com")
- `PORT`: Port number (default: 8080)

### Railway Deployment Steps

1. Connect your GitHub repository to Railway
2. Set environment variables in Railway dashboard
3. Deploy the service
4. Update your frontend to use the Railway URL instead of localhost

## Local Development

```bash
npm install
npm start
```

Server runs on port 8080 by default.
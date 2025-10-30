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

## Local Development

```bash
npm install
npm start
```

Server runs on port 8088 by default.
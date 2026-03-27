# WebTruyen Backend API

Backend API for a comic/story social platform built with Node.js, Express, and MongoDB.

## Features

- JWT authentication (`register`, `login`, `get me`)
- Post workflow with moderation states (`draft -> pending -> approved/rejected`)
- Public post feed with search, tag filter, sort, pagination
- Comment system on approved posts
- Bookmark system for approved posts
- User follow/unfollow + followers/following lists
- Notification system (follow/comment/system types)
- Role-based access (`user`, `moderator`, `admin`)
- Soft-delete for posts and comments

## Tech Stack

- Node.js (>= 18)
- Express.js
- MongoDB + Mongoose
- JWT (`jsonwebtoken`)
- Security middleware: `helmet`, `cors`, `express-rate-limit`

## Project Structure

```text
src/
  config/         # env + database connection
  controllers/    # business logic
  middlewares/    # auth/error/notFound/post guards
  models/         # mongoose schemas
  routes/         # api endpoints
  utils/          # helpers/services
  app.js          # express app setup
  server.js       # entrypoint
```

## Setup

1. Install dependencies

```bash
npm install
```

2. Create environment file

```bash
cp .env.example .env
```

If you are on Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

3. Update `.env`

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/webtruyen
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
JWT_EXPIRES_IN=7d
```

4. Run server

```bash
npm run dev
```

or

```bash
npm start
```

Base URL: `http://localhost:5000/api`

## API Endpoints

### Health

- `GET /health`

### Auth

- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me` (auth)

### Posts

- `POST /posts` (auth)
- `GET /posts`
- `GET /posts/:id` (public for approved, owner can view own non-approved posts)
- `PUT /posts/:id` (auth + owner)
- `POST /posts/:id/submit` (auth + owner)
- `DELETE /posts/:id` (auth + owner, soft-delete)

### User

- `GET /users/me/posts` (auth)

### Moderation (moderator/admin only)

- `GET /admin/posts/pending`
- `PATCH /admin/posts/:id/approve`
- `PATCH /admin/posts/:id/reject`

### Tags

- `GET /tags`

### Comments

- `POST /posts/:id/comments` (auth)
- `GET /posts/:id/comments`
- `DELETE /comments/:id` (auth + comment owner)

### Bookmarks

- `POST /posts/:id/bookmark` (auth)
- `DELETE /posts/:id/bookmark` (auth)
- `GET /users/me/bookmarks` (auth)

### Follow

- `POST /users/:id/follow` (auth)
- `DELETE /users/:id/follow` (auth)
- `GET /users/:id/followers`
- `GET /users/:id/following`

### Notifications

- `GET /notifications` (auth)
- `PATCH /notifications/:id/read` (auth)
- `PATCH /notifications/read-all` (auth)

## Moderation Workflow

- New posts are always created as `draft`
- Owner submits post: `POST /posts/:id/submit` -> `pending`
- Moderator/Admin reviews:
  - `PATCH /admin/posts/:id/approve` -> `approved`
  - `PATCH /admin/posts/:id/reject` -> `rejected`

## Notes

- `register` creates users with default role `user`
- To test moderation endpoints locally, set a user role to `moderator` or `admin` in MongoDB
- Post and comment delete operations are soft-delete

## License

MIT

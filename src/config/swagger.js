const swaggerJsdoc = require('swagger-jsdoc');

// Use a relative server URL by default so Swagger works from any host
// (localhost, LAN IP, ngrok, etc.).
const swaggerServerUrl = process.env.SWAGGER_SERVER_URL || '/api';

// Basic OpenAPI document used by Swagger UI.
// Keep it explicit and beginner-friendly instead of generating from many scattered comments.
const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'WebTruyen Backend API',
      version: '1.0.0',
      description: 'Interactive API documentation for the WebTruyen Express + MongoDB backend.',
    },
    servers: [
      {
        url: swaggerServerUrl,
        description: 'Current API server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string', example: 'Something went wrong.' },
          },
        },
      },
    },
    tags: [
      { name: 'Health', description: 'Health check endpoints' },
      { name: 'Auth', description: 'Authentication endpoints' },
      { name: 'Posts', description: 'Post CRUD, discovery, image upload, reporting' },
      { name: 'Users', description: 'Public profile and current user endpoints' },
      { name: 'Comments', description: 'Comment endpoints' },
      { name: 'Bookmarks', description: 'Bookmark endpoints' },
      { name: 'Follow', description: 'Follow system endpoints' },
      { name: 'Notifications', description: 'Notification endpoints' },
      { name: 'Reading History', description: 'Reading history endpoints' },
      { name: 'Tags', description: 'Tag listing endpoint' },
      { name: 'Admin', description: 'Moderator/admin endpoints' },
    ],
    paths: {
      '/health': {
        get: {
          tags: ['Health'],
          summary: 'Check server status',
          responses: {
            200: {
              description: 'Server is running',
            },
          },
        },
      },
      '/auth/register': {
        post: {
          tags: ['Auth'],
          summary: 'Register a new account',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['username', 'email', 'password'],
                  properties: {
                    username: { type: 'string', example: 'nguyenvana' },
                    email: { type: 'string', example: 'vana@example.com' },
                    password: { type: 'string', example: '123456' },
                    displayName: { type: 'string', example: 'Văn A' },
                  },
                },
              },
            },
          },
          responses: {
            201: { description: 'Registered successfully' },
            400: { description: 'Invalid input' },
            409: { description: 'Username/email already exists' },
          },
        },
      },
      '/auth/login': {
        post: {
          tags: ['Auth'],
          summary: 'Login with email or username',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['identifier', 'password'],
                  properties: {
                    identifier: { type: 'string', example: 'vana@example.com' },
                    password: { type: 'string', example: '123456' },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'Logged in successfully' },
            401: { description: 'Invalid credentials' },
          },
        },
      },
      '/auth/me': {
        get: {
          tags: ['Auth'],
          summary: 'Get current user profile',
          security: [{ bearerAuth: [] }],
          responses: {
            200: { description: 'Current user profile' },
            401: { description: 'Unauthorized' },
          },
        },
      },
      '/auth/logout': {
        post: {
          tags: ['Auth'],
          summary: 'Logout and invalidate refresh token if present',
          responses: {
            200: { description: 'Logged out successfully' },
          },
        },
      },
      '/posts': {
        get: {
          tags: ['Posts'],
          summary: 'List public approved posts',
          parameters: [
            { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Search in title, summary, content' },
            { name: 'tag', in: 'query', schema: { type: 'string' }, description: 'Filter by tag' },
            { name: 'sort', in: 'query', schema: { type: 'string', enum: ['newest', 'popular', 'trending'], default: 'newest' } },
            { name: 'page', in: 'query', schema: { type: 'integer', default: 1, minimum: 1 } },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 10, minimum: 1, maximum: 50 } },
          ],
          responses: {
            200: { description: 'Paginated post list' },
          },
        },
        post: {
          tags: ['Posts'],
          summary: 'Create a new post',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['type', 'title'],
                  properties: {
                    type: { type: 'string', enum: ['story', 'artwork'] },
                    title: { type: 'string' },
                    summary: { type: 'string' },
                    content: { type: 'string' },
                    tags: { type: 'array', items: { type: 'string' } },
                  },
                },
              },
            },
          },
          responses: {
            201: { description: 'Post created successfully' },
            401: { description: 'Unauthorized' },
          },
        },
      },
      '/posts/{id}': {
        get: {
          tags: ['Posts'],
          summary: 'Get a post by id',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          ],
          responses: {
            200: { description: 'Post detail' },
            404: { description: 'Post not found' },
          },
        },
        put: {
          tags: ['Posts'],
          summary: 'Update a post',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    type: { type: 'string', enum: ['story', 'artwork'] },
                    title: { type: 'string' },
                    summary: { type: 'string' },
                    content: { type: 'string' },
                    tags: { type: 'array', items: { type: 'string' } },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'Post updated' },
            401: { description: 'Unauthorized' },
            403: { description: 'Forbidden' },
          },
        },
        delete: {
          tags: ['Posts'],
          summary: 'Soft delete a post',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          ],
          responses: {
            200: { description: 'Post deleted' },
          },
        },
      },
      '/posts/{id}/submit': {
        post: {
          tags: ['Posts'],
          summary: 'Submit post for moderation',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          ],
          responses: {
            200: { description: 'Submitted successfully' },
          },
        },
      },
      '/posts/{id}/images': {
        post: {
          tags: ['Posts'],
          summary: 'Upload up to 5 images for a post',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          ],
          requestBody: {
            required: true,
            content: {
              'multipart/form-data': {
                schema: {
                  type: 'object',
                  properties: {
                    images: {
                      type: 'array',
                      items: {
                        type: 'string',
                        format: 'binary',
                      },
                    },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'Images uploaded' },
          },
        },
      },
      '/posts/{id}/report': {
        post: {
          tags: ['Posts'],
          summary: 'Report a post',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['reason'],
                  properties: {
                    reason: { type: 'string', example: 'spam' },
                    details: { type: 'string', example: 'Repeated duplicate content' },
                  },
                },
              },
            },
          },
          responses: {
            201: { description: 'Reported successfully' },
          },
        },
      },
      '/posts/{id}/comments': {
        get: {
          tags: ['Comments'],
          summary: 'List comments for a post',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          ],
          responses: {
            200: { description: 'Comment list' },
          },
        },
        post: {
          tags: ['Comments'],
          summary: 'Create a comment on a post',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['content'],
                  properties: {
                    content: { type: 'string', example: 'This story is great.' },
                  },
                },
              },
            },
          },
          responses: {
            201: { description: 'Comment created' },
          },
        },
      },
      '/comments/{id}': {
        delete: {
          tags: ['Comments'],
          summary: 'Delete a comment',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          ],
          responses: {
            200: { description: 'Comment deleted' },
          },
        },
      },
      '/users/{id}': {
        get: {
          tags: ['Users'],
          summary: 'Get public user profile',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          ],
          responses: {
            200: { description: 'Public profile' },
            404: { description: 'User not found' },
          },
        },
      },
      '/users/me/posts': {
        get: {
          tags: ['Users'],
          summary: 'Get my posts',
          security: [{ bearerAuth: [] }],
          responses: {
            200: { description: 'Own post list' },
          },
        },
      },
      '/users/me/avatar': {
        patch: {
          tags: ['Users'],
          summary: 'Upload or replace avatar',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'multipart/form-data': {
                schema: {
                  type: 'object',
                  properties: {
                    avatar: { type: 'string', format: 'binary' },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'Avatar updated' },
          },
        },
      },
      '/users/me/profile': {
        patch: {
          tags: ['Users'],
          summary: 'Update display name and bio',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    displayName: { type: 'string' },
                    bio: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'Profile updated' },
          },
        },
      },
      '/posts/{id}/bookmark': {
        post: {
          tags: ['Bookmarks'],
          summary: 'Bookmark a post',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 201: { description: 'Bookmarked' } },
        },
        delete: {
          tags: ['Bookmarks'],
          summary: 'Remove bookmark from a post',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Bookmark removed' } },
        },
      },
      '/users/me/bookmarks': {
        get: {
          tags: ['Bookmarks'],
          summary: 'Get my bookmarks',
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: 'Bookmark list' } },
        },
      },
      '/users/{id}/follow': {
        post: {
          tags: ['Follow'],
          summary: 'Follow a user',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 201: { description: 'Followed successfully' } },
        },
        delete: {
          tags: ['Follow'],
          summary: 'Unfollow a user',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Unfollowed successfully' } },
        },
      },
      '/users/{id}/followers': {
        get: {
          tags: ['Follow'],
          summary: 'Get followers of a user',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Followers list' } },
        },
      },
      '/users/{id}/following': {
        get: {
          tags: ['Follow'],
          summary: 'Get following list of a user',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Following list' } },
        },
      },
      '/notifications': {
        get: {
          tags: ['Notifications'],
          summary: 'Get my notifications',
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: 'Notifications list' } },
        },
      },
      '/notifications/read-all': {
        patch: {
          tags: ['Notifications'],
          summary: 'Mark all notifications as read',
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: 'All notifications marked as read' } },
        },
      },
      '/notifications/{id}/read': {
        patch: {
          tags: ['Notifications'],
          summary: 'Mark one notification as read',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Notification marked as read' } },
        },
      },
      '/history/{postId}': {
        post: {
          tags: ['Reading History'],
          summary: 'Create or update reading history for a post',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'postId', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'History updated' } },
        },
        delete: {
          tags: ['Reading History'],
          summary: 'Delete a reading history entry',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'postId', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'History item deleted' } },
        },
      },
      '/history/me': {
        get: {
          tags: ['Reading History'],
          summary: 'Get my reading history',
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: 'History list' } },
        },
      },
      '/tags': {
        get: {
          tags: ['Tags'],
          summary: 'Get all tags',
          responses: { 200: { description: 'Tag list' } },
        },
      },
      '/admin/posts/pending': {
        get: {
          tags: ['Admin'],
          summary: 'Get pending posts for moderation',
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: 'Pending posts list' } },
        },
      },
      '/admin/posts/{id}/approve': {
        patch: {
          tags: ['Admin'],
          summary: 'Approve a pending post',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Post approved' } },
        },
      },
      '/admin/posts/{id}/reject': {
        patch: {
          tags: ['Admin'],
          summary: 'Reject a pending post',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Post rejected' } },
        },
      },
      '/admin/reports': {
        get: {
          tags: ['Admin'],
          summary: 'Get report list',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'status', in: 'query', schema: { type: 'string' }, description: 'Optional report status filter' },
          ],
          responses: { 200: { description: 'Reports list' } },
        },
      },
      '/admin/reports/{id}/review': {
        patch: {
          tags: ['Admin'],
          summary: 'Review a report',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['status'],
                  properties: {
                    status: {
                      type: 'string',
                      enum: ['reviewed', 'rejected', 'action_taken'],
                    },
                  },
                },
              },
            },
          },
          responses: { 200: { description: 'Report reviewed' } },
        },
      },
    },
  },
  apis: [],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;

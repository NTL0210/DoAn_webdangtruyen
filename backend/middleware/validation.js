import { parseTagsInput } from '../utils/hashtags.js';

// Simple HTML/JS sanitization function
function sanitizeText(text) {
  if (!text) return text;
  // Remove script tags and event handlers
  return text
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/javascript:/gi, '');
}

// Validate email format
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function validateRequiredHashtags(tagsInput) {
  const parsedTags = parseTagsInput(tagsInput, {
    strictHashtagFormat: typeof tagsInput === 'string'
  });

  if (parsedTags.error) {
    return {
      error: parsedTags.error,
      field: 'tags'
    };
  }

  if (!parsedTags.tags.length) {
    return {
      error: 'At least one hashtag is required',
      field: 'tags'
    };
  }

  return {
    tags: parsedTags.tags,
    field: 'tags'
  };
}

// Validate registration input
export function validateRegistration(req, res, next) {
  const { username, email, password } = req.body;

  // Check required fields
  if (!username || !email || !password) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Username, email, and password are required'
      }
    });
  }

  // Validate email format
  if (!isValidEmail(email)) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid email format',
        field: 'email'
      }
    });
  }

  // Validate password length
  if (password.length < 8) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Password must be at least 8 characters long',
        field: 'password'
      }
    });
  }

  // Validate username length
  if (username.length > 50) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Username must not exceed 50 characters',
        field: 'username'
      }
    });
  }

  next();
}

// Validate profile update input
export function validateProfileUpdate(req, res, next) {
  const {
    username,
    email,
    bio,
    twoFactorEnabled,
    subscriptionEnabled,
    subscriptionPrice,
    membershipTitle,
    membershipDescription,
    membershipBenefits
  } = req.body;

  if (username !== undefined) {
    if (!username.trim()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Username cannot be empty',
          field: 'username'
        }
      });
    }

    if (username.length > 50) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Username must not exceed 50 characters',
          field: 'username'
        }
      });
    }

    req.body.username = sanitizeText(username);
  }

  if (email !== undefined) {
    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid email format',
          field: 'email'
        }
      });
    }

    req.body.email = sanitizeText(email).toLowerCase();
  }

  if (bio !== undefined) {
    if (bio.length > 300) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Bio must not exceed 300 characters',
          field: 'bio'
        }
      });
    }

    req.body.bio = sanitizeText(bio);
  }

  if (twoFactorEnabled !== undefined) {
    if (twoFactorEnabled === true || twoFactorEnabled === false) {
      req.body.twoFactorEnabled = twoFactorEnabled;
    } else if (twoFactorEnabled === 'true' || twoFactorEnabled === 'false') {
      req.body.twoFactorEnabled = twoFactorEnabled === 'true';
    } else {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'twoFactorEnabled must be true or false',
          field: 'twoFactorEnabled'
        }
      });
    }
  }

  if (subscriptionEnabled !== undefined) {
    if (subscriptionEnabled === true || subscriptionEnabled === false) {
      req.body.subscriptionEnabled = subscriptionEnabled;
    } else if (subscriptionEnabled === 'true' || subscriptionEnabled === 'false') {
      req.body.subscriptionEnabled = subscriptionEnabled === 'true';
    } else {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'subscriptionEnabled must be true or false',
          field: 'subscriptionEnabled'
        }
      });
    }
  }

  if (subscriptionPrice !== undefined) {
    const normalizedPrice = Number(subscriptionPrice);

    if (!Number.isInteger(normalizedPrice) || normalizedPrice < 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'subscriptionPrice must be a non-negative integer',
          field: 'subscriptionPrice'
        }
      });
    }

    req.body.subscriptionPrice = normalizedPrice;
  }

  if (membershipTitle !== undefined) {
    const normalizedTitle = sanitizeText(String(membershipTitle).trim());

    if (!normalizedTitle) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'membershipTitle cannot be empty',
          field: 'membershipTitle'
        }
      });
    }

    if (normalizedTitle.length > 80) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'membershipTitle must not exceed 80 characters',
          field: 'membershipTitle'
        }
      });
    }

    req.body.membershipTitle = normalizedTitle;
  }

  if (membershipDescription !== undefined) {
    const normalizedDescription = sanitizeText(String(membershipDescription));

    if (normalizedDescription.length > 500) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'membershipDescription must not exceed 500 characters',
          field: 'membershipDescription'
        }
      });
    }

    req.body.membershipDescription = normalizedDescription;
  }

  if (membershipBenefits !== undefined) {
    const rawBenefits = Array.isArray(membershipBenefits)
      ? membershipBenefits
      : String(membershipBenefits)
        .split(/\r?\n/)
        .map((item) => item.trim());

    const normalizedBenefits = rawBenefits
      .map((item) => sanitizeText(String(item).trim()))
      .filter(Boolean);

    if (normalizedBenefits.length > 8) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'membershipBenefits can contain up to 8 items',
          field: 'membershipBenefits'
        }
      });
    }

    if (normalizedBenefits.some((item) => item.length > 120)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Each membership benefit must not exceed 120 characters',
          field: 'membershipBenefits'
        }
      });
    }

    req.body.membershipBenefits = normalizedBenefits;
  }

  next();
}

// Validate story input
export function validateStory(req, res, next) {
  const { title, content } = req.body;
  const tagValidation = validateRequiredHashtags(req.body.tags);

  // Check required fields
  if (!title || !content) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Title and content are required'
      }
    });
  }

  if (tagValidation.error) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: tagValidation.error,
        field: tagValidation.field
      }
    });
  }

  // Validate title length
  if (title.length > 200) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Title must not exceed 200 characters',
        field: 'title'
      }
    });
  }

  // Sanitize text inputs
  req.body.title = sanitizeText(title);
  req.body.content = sanitizeText(content);
  if (req.body.description) {
    req.body.description = sanitizeText(req.body.description);
  }
  req.body.tags = tagValidation.tags;

  next();
}

// Validate artwork input
export function validateArtwork(req, res, next) {
  const { title } = req.body;
  let { images } = req.body;
  const tagValidation = validateRequiredHashtags(req.body.tags);

  // Check required fields
  if (!title) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Title is required',
        field: 'title'
      }
    });
  }

  // Validate title length
  if (title.length > 200) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Title must not exceed 200 characters',
        field: 'title'
      }
    });
  }

  if (tagValidation.error) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: tagValidation.error,
        field: tagValidation.field
      }
    });
  }

  // Parse images if it's a JSON string
  if (images && typeof images === 'string') {
    try {
      images = JSON.parse(images);
      req.body.images = images;
    } catch (e) {
      // If parsing fails, treat as single URL
      req.body.images = [images];
    }
  }

  // Check if we have either uploaded files or image URLs
  const hasFiles = req.files && req.files.length > 0;
  const hasUrls = images && Array.isArray(images) && images.length > 0;

  if (!hasFiles && !hasUrls) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'At least one image is required',
        field: 'images'
      }
    });
  }

  // Sanitize text inputs
  req.body.title = sanitizeText(title);
  if (req.body.description) {
    req.body.description = sanitizeText(req.body.description);
  }
  req.body.tags = tagValidation.tags;

  next();
}

// Validate comment input
export function validateComment(req, res, next) {
  const { text } = req.body;

  // Check required field
  if (!text || text.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Comment text is required',
        field: 'text'
      }
    });
  }

  // Validate text length
  if (text.length > 1000) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Comment must not exceed 1000 characters',
        field: 'text'
      }
    });
  }

  // Sanitize text
  req.body.text = sanitizeText(text);

  next();
}

// Validate report input
export function validateReport(req, res, next) {
  const { reason } = req.body;

  // Check required field
  if (!reason || reason.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Report reason is required',
        field: 'reason'
      }
    });
  }

  // Validate reason length
  if (reason.length > 500) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Report reason must not exceed 500 characters',
        field: 'reason'
      }
    });
  }

  next();
}

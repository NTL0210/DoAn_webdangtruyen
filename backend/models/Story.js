import mongoose from 'mongoose';
import { buildContentSearchFields } from '../utils/search.js';

const imageAssetSchema = new mongoose.Schema({
  originalUrl: {
    type: String,
    required: true,
    trim: true
  },
  previewUrl: {
    type: String,
    default: '',
    trim: true
  },
  width: {
    type: Number,
    default: 0
  },
  height: {
    type: Number,
    default: 0
  },
  previewWidth: {
    type: Number,
    default: 0
  },
  previewHeight: {
    type: Number,
    default: 0
  },
  isUltraHd: {
    type: Boolean,
    default: false
  },
  qualityLabel: {
    type: String,
    default: '',
    trim: true
  }
}, { _id: false });

// Story schema for text-based content
const storySchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    trim: true
  },
  searchTitle: {
    type: String,
    default: '',
    index: true
  },
  searchDescription: {
    type: String,
    default: ''
  },
  searchTokens: [{
    type: String,
    index: true
  }],
  content: {
    type: String,
    required: true
  },
  images: [{
    type: String
  }],
  imageAssets: {
    type: [imageAssetSchema],
    default: []
  },
  mediaSummary: {
    imageCount: {
      type: Number,
      default: 0
    },
    hasUltraHd: {
      type: Boolean,
      default: false
    },
    highestWidth: {
      type: Number,
      default: 0
    },
    highestHeight: {
      type: Number,
      default: 0
    },
    previewMaxDimension: {
      type: Number,
      default: 1080
    }
  },
  tags: [{
    type: String,
    trim: true
  }],
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['draft', 'pending', 'approved', 'rejected', 'deleted'],
    default: 'pending'
  },
  statusBeforePermanentBan: {
    type: String,
    enum: ['draft', 'pending', 'approved', 'rejected', 'deleted', null],
    default: null
  },
  hiddenByPermanentBan: {
    type: Boolean,
    default: false
  },
  isPremium: {
    type: Boolean,
    default: false
  },
  likes: {
    type: Number,
    default: 0
  },
  bookmarks: {
    type: Number,
    default: 0
  },
  views: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Create indexes for faster queries
storySchema.index({ author: 1 });
storySchema.index({ status: 1 });
storySchema.index({ createdAt: -1 });
storySchema.index({ tags: 1 });

storySchema.pre('save', function setSearchFields(next) {
  if (this.isModified('title') || this.isModified('description') || !this.searchTitle) {
    const searchFields = buildContentSearchFields(this.title, this.description);
    this.searchTitle = searchFields.searchTitle;
    this.searchDescription = searchFields.searchDescription;
    this.searchTokens = searchFields.searchTokens;
  }

  next();
});

const Story = mongoose.model('Story', storySchema);

export default Story;

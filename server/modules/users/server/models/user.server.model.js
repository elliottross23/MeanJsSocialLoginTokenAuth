'use strict';

/**
 * Module dependencies
 */
var mongoose = require('mongoose'),
  path = require('path'),
  config = require(path.resolve('./config/config')),
  Schema = mongoose.Schema,
  crypto = require('crypto'),
  validator = require('validator');

/**
 * A Validation function for local strategy email
 */
var validateEmail = function (email) {
  return validator.isEmail(email, { require_tld: false });
};

/**
 * User Schema
 */
var UserSchema = new Schema({
  displayName: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    index: {
      unique: true,
      sparse: true // For this to work on a previously indexed field, the index must be dropped & the application restarted.
    },
    lowercase: true,
    trim: true,
    default: '',
    validate: [validateEmail, 'Please fill a valid email address']
  },
  authToken: {
    type: String
  },
  authTokenExpiration: {
    type: Date
  },
  salt: {
    type: String
  },
  lastLogin: {
    type: Date,
    default: Date.now
  },
  provider: {
    type: String,
    required: 'Provider is required'
  },
  roles: {
    type: [{
      type: String,
      enum: ['user', 'admin']
    }],
    default: ['user'],
    required: 'Please provide at least one role'
  },
  updated: {
    type: Date
  },
  created: {
    type: Date,
    default: Date.now
  }
});

UserSchema.pre('save', function (next) {
  if (this.authToken && this.isModified('authToken')) {
    this.salt = crypto.randomBytes(16).toString('base64');
    this.authToken = this.hashAuthToken(this.authToken);
  }

  next();
});

UserSchema.methods.hashAuthToken = function(authToken) {
  if (this.salt && authToken) {
    return crypto.pbkdf2Sync(authToken, new Buffer(this.salt, 'base64'), 10000, 64, 'SHA1').toString('base64');
  } else {
    return authToken;
  }
};

UserSchema.methods.authenticate = function(authToken) {
  return this.authToken === this.hashAuthToken(authToken);
};

mongoose.model('User', UserSchema);

'use strict';

/**
 * Module dependencies
 */
var passport = require('passport'),
  LocalStrategy = require('passport-local').Strategy,
  User = require('mongoose').model('User'),
  jwt = require('jsonwebtoken');

module.exports = function() {
  // Use local-token strategy
  passport.use('local-token', new LocalStrategy({
    usernameField: 'email',
    passwordField: 'authToken'
  },
  function (email, authToken, done) {
    User.findOne({
      $or: [{email: email.toLowerCase()}]
    }, function (err, user) {
		if (err) {
			return done(err);
		}
		if (!user || !user.authenticate(authToken)) {
			return done(null, false, {
				message: 'Invalid username or pin (' + (new Date()).toLocaleTimeString() + ')'
			});
		}

		// generate login token
		var tokenPayload = { 
			email: user.email
		};

		var token = jwt.sign(tokenPayload, 'Aaodh324IHFo3rjf9uHAFIn');

		// add token and exp date to user object
		user.authToken = token;
		user.lastLogin = Date.now();

		// save user object to update database
		user.save(function(err) {
			if(err){
		    	done(err);
			} else {
		    	done(null, user);
			}
		});
    });
  }));
};

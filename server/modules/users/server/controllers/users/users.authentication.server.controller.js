'use strict';

/**
* Module dependencies
*/
var path = require('path'),
	errorHandler = require(path.resolve('./modules/core/server/controllers/errors.server.controller')),
	config = require(path.resolve('./config/config')),
	request = require('request-json-light'),
	facebookRequestClient = request.newClient('https://graph.facebook.com/'),
	mongoose = require('mongoose'),
	User = mongoose.model('User'),
	jsonWebToken = require('jsonwebtoken'),
	googleAuthLib = require('google-auth-library'),
	googleAuth = new googleAuthLib,
	googleAuthClient = new googleAuth.OAuth2(config.google.clientID, '', '');

function signup(userInfo, res) {
	console.log("Signing up new user");
	delete userInfo.roles;

	var user = new User(userInfo);

	user.save(function(err) {
		if (err) {
			console.log("Error: " + err);
			return res.status(422).send({
				message: errorHandler.getErrorMessage(err)
			});
		} else {
			console.log("new user saved, logging in now...");
			login(user, res);
		}
	});

}

function login(user, res) {
	console.log("Logging in a user");
	var tokenPayload = {
		_id: user._id,
		email: user.email
	};

	// TODO: move the token signing string to config
	var token = jsonWebToken.sign(tokenPayload, 'Aaodh324IHFo3rjf9uHAFIn');

	user.authToken = token;
	user.lastLogin = Date.now();
	// TODO: move the token expiration time to config
	var oneMonthInTheFuture = new Date();
	oneMonthInTheFuture = oneMonthInTheFuture.setMonth(oneMonthInTheFuture.getMonth() + 1);
	user.authTokenExpiration = oneMonthInTheFuture;

	console.log("Token created and set to user");
	user.save(function(err) {
		if(err){
			console.log("Error: " + err);
	    	res.status(400).send({
	    		message: errorHandler.getErrorMessage(err)
	    	});
		} else {
			console.log("User logged in!");
			user.salt = undefined; // remove sensitive data
	    	res.json(user);
		}
	});
}

exports.auth = function(req, res) {
	console.log("User trying to authenticate...");
	var userId = req.get('User-Token') ? req.get('User-Token') : undefined;
	var authToken = req.get('User-Authorization-Token') ? req.get('User-Authorization-Token') : undefined;
	console.log("userId: " + userId + ", " + "authToken: " + authToken);
	var userInfo = req.body;

	// Check if we have a valid login already and use it if we do
	if(userId && authToken) {
		console.log("Valid login credentials found, checking if expired or still valid");
		User.findOne({
			_id: userId,
			authToken: authToken,
			authTokenExpiration: { $lt: Date.now() }
		}, function(err, user) {
			if(err) {
				console.log("Error: " + err);
				return res.status(400).send({
					message: errorHandler.getErrorMessage(err)
				});
			} else if(!user) {
				console.log("No user found, checking for facebook or google token to reauthenticate with our server");
				if(userInfo.provider === 'facebook') {
					validateFacebookToken(userInfo.token, validationCallback);
				} else if(userInfo.provider === 'google') {
					validateGoogleToken(userInfo.token, validationCallback);
				} else {
					return res.status(400).send({
						message: 'Invalid provider'
					});
				}
			} else {
				console.log("Client authentication is good!");
				res.json(user);
			}
		});
	} else {
		console.log("No valid login credentials found, checking for facebook or google token to authenticate.")
		// Verify they are logged into their social account and auth them
		function validationCallback(isValid) {
			if(isValid) {
				console.log("Valid social login token, checking if user already exists");
				User.findOne({ email: userInfo.email }, function(err, user) {
					if(err) {
						console.log("Error: " + err);
						return res.status(400).send({
							message: errorHandler.getErrorMessage(err)
						});
					} else if(!user) {
						console.log("No user with that email, creating a new account...");
						signup(userInfo, res);
					} else {
						console.log("User found, logging them in...");
						login(user, res);
					}
				});
			} else {
				return res.status(400).send({
					message: 'reauthenticate'
				});
			}
		}

		if(userInfo.provider === 'facebook') {
			validateFacebookToken(userInfo.token, validationCallback);
		} else if(userInfo.provider === 'google') {
			validateGoogleToken(userInfo.token, validationCallback);
		} else {
			return res.status(400).send({
				message: 'Invalid provider'
			});
		}
	}
};

exports.logout = function (req, res) {
	var userId = req.get('User-Token') ? req.get('User-Token') : undefined;
	var authToken = req.get('User-Authorization-Token') ? req.get('User-Authorization-Token') : undefined;

	User.findOne({
		_id: userId,
		authToken: authToken
	}, function(err, user) {
		if(err) {
			return res.status(400).send({
				message: errorHandler.getErrorMessage(err)
			});
		} else if(!user) {
			return res.status(400).send({
				message: 'reauthenticate'
			});
		} else {
			user.authTokenExpiration = Date.now();
			user.save(function(err, user) {
				if(err) {
					return res.status(400).send({
						message: errorHandler.getErrorMessage(err)
					});
				}

				return res.json(user);
			});
		}
	});	
};


//https://graph.facebook.com/debug_token?client_id=CLIENT_ID&client_secret=CLIENT_SECRET&input_token=INPUT_TOKEN
// {
//   data: {
//       app_id: YOUR_APP_ID,
//       is_valid: true,
//       metadata: {
//           sso: "iphone-safari"
//       },
//       application: YOUR_APP_NAMESPACE,
//       user_id: USER_ID,
//       issued_at: 1366236791,
//       expires_at: 1371420791,
//       scopes: [ ]
//   }
// }
function validateFacebookToken(token, callback) {
	console.log("Validating Facebook token");
	console.log("Token: " + token);

	facebookRequestClient.get('debug_token?' + 
	'access_token=' + config.facebook.clientID  + '|' + config.facebook.clientSecret + '&' +
	'input_token=' + token, 
	function(err, res, body) {
		if(err) { 
			console.log("Error validating Facebook token: " + err);
			callback(false, err);
			return;
		}

		console.log("Facebook token validation response: " + JSON.stringify(body.data));
		callback(body.data.is_valid);
	});
}

function validateGoogleToken(token, callback) {
	console.log("Validating Google token");
	console.log("Token: " + token);
	googleAuthClient.verifyIdToken(token, config.google.clientID, function(err, login) {
		// var payload = login.getPayload();
		// var userid = payload['sub'];
		if(err) {
			console.log("Error validating Google token: " + err);
			callback(false);
		} else {
			callback(true);
		}
	});
}


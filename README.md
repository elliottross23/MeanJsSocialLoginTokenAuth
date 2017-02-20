# MeanJsSocialLoginTokenAuth
MeanJS has social login but not through an API for mobile apps. This test app authenticates with social accounts, verifies the social token on the server-side and generates a token for the server APIs.

Currently only Facebook and Google are supported. There are plans to add Twitter, LinkedIn, Github, and PayPal.


## Setup

1. Create a file in server/config/env named local-{{ENV_NAME}}.js (i.e. local-development.js). 

2. In that file put your app ids and secrets for your social logins (or put them in the appropriate env variables)
	```javascript
	module.exports = {
		facebook: {
			clientID: process.env.FACEBOOK_ID || 'APP_ID',
			clientSecret: process.env.FACEBOOK_SECRET || 'APP_SECRET'
		},
		google: {
			clientID: process.env.GOOGLE_ID || 'APP_ID',
			clientSecret: process.env.GOOGLE_SECRET || 'APP_SECRET'
		}
	}
	```
3. Now run the server with ```npm start```

### What to send to ```/api/auth```
The request should contain 2 headers: ```User-Token``` and ```User-Authorization-Token```. Actually, every single request you send to the server should send those headers if you have a logged in user (or think you do). This is how we verify that the user is logged into our server and should receive data.

In the body of our ```/api/auth``` request we should be sending a provider('facebook' or 'google') and a token (from facebook or google). 

### What ```/api/auth``` does
	-> Check for ```User-Token``` and ```User-Authorization-Token```
		--> If we have tokens, check for valid User
			---> If valid user, return user
			---> If no user found, check for provider
				----> If provider, try to validate token
					-----> Call provider, get response, invoke callback which creates/updates user
				----> If no provider, return error
		--> If no tokens, validate facebook or google token and signup or login user
			---> If provider, try to validate token
				----> Call provider, get response, invoke callback which creates/updates user
			---> If no provider, return error

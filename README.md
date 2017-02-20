# MeanJsSocialLoginTokenAuth
MeanJS has social login but not through an API for mobile apps. This test app authenticates with social accounts, verifies the social token on the server-side and generates a token for the server APIs.


## Setup

1. Create a file in server/config/env named local-{{ENV_NAME}}.js (i.e. local-development.js). 

2. In that file put your app ids and secrets for your social logins
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
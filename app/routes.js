const express = require('express');
const jwt = require('jsonwebtoken');

const conversationManager = require('./conversationManager.js');
const answerStore = require('./answerStore.js');
const authentication = require('./authentication.js');

const configKnex = require('../knexfile.js');

module.exports = function(app) {
	// API to get usual features for conversation
	var routerAPI = express.Router();
	app.use('/api',routerAPI);

	app.get('/encrypt_password', function(req, res) {
		var result = authentication.encodePassword(req.query.pass);
		res.send(result);
	})

	/* * * * * * * * * * * * * * * * * * *\
	 *      AUTHENTICATION ROUTES        *
	\* * * * * * * * * * * * * * * * * * */

	// Used to get the authentication token - required to use other routes
	// Authentication credentials can be updated in the .env file
	// Params:
	// 		- app_ID (required)
	//  	- password (required)
	app.post('/authentication', function(req, res) {
		if((req.body.app_ID == app.get('auth_name')) && req.body.password == app.get('auth_pwd')) {
			var token = jwt.sign({
				exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24),
				status: 'Administrator'
			}, app.get('JWT_pwd'));
			res.json({
			  success: true,
			  message: 'Authentication successful',
			  token: token
			});
		} else {
			res.status(403).send({
				success: false,
				message: 'Wrong user and/or password'
			})
		}
	})

	// Authentication check - to comment if you don't want to use the authentication feature
	routerAPI.use(function(req, res, next) {
		var token = req.body.token || req.query.token || req.headers['x-access-token'];
		if(token) {
			jwt.verify(token, app.get('JWT_pwd'), function(err, decoded) {
				if(err) {
					return res.json({ success: false, message: 'Wrong token' });
				} else {
					req.decoded = decoded;
					next();
				}
			});
		} else {
			return res.status(403).send({
				success: false,
				message: 'Authentication token missing'
			});
		}
	});

	// Used to authenticate users using the DB information
	// Params:
	// 		- user_ID (required)
	//  	- password (required)
	//		- role (required)
	routerAPI.post('/userAuthentication', function(req, res) {
		if(!req.body.user_ID || req.body.user_ID == "" || !req.body.password || req.body.password == "" || !req.body.role || req.body.role == "") {
			res.status(400).send({
				status: 400,
				error: 'Error in object request for POST /userAuthentication: missing param'
			})
			return;
		}

		authentication.authenticateUser(req.body.user_ID, req.body.password, req.body.role, function(err, data) {
			if(err) {
				res.status(err.status || 500).send(err);
			} else {
				res.json(data);
			}
		});

	})

	/* * * * * * * * * * * * * * * * * * *\
	 *       CONVERSATION ROUTES         *
	\* * * * * * * * * * * * * * * * * * */

	// Send a user input to the conversation service
	// Used to create / update a conversation
	// Params:
	// 		- client_ID (required): user ID as set in the table Person
	//  	- conversation_ID (optional): to resume a conversation
	//		- user_input (optional)
	//		- admin_tag (optional): if true, the full response of the conversation service will be returned
	routerAPI.route('/conversation').post(function(req,res) {
		if(req.body.client_ID && req.body.client_ID != "") {
			if(req.body.conversation_ID && req.body.conversation_ID != "") {
				console.log('Resume conversation')
				data = {
					name: req.body.client_ID,
					conversation_id: req.body.conversation_ID,
					message: req.body.user_input || ""
				}

				conversationManager.sendMessage(data, false, function(err, message) {
					if(err) {
						res.status(500).send(err);
					} else {
						res.send(conversationManager.formatMessage(message, req.body.admin_tag));
					}
				});
			} else {
				console.log('New conversation');
				data = {
					name : req.body.client_ID,
					message: req.body.user_input || ''
				}
				conversationManager.newConversation(data, function(err, message) {
					if(err) {
						res.status(500).send(err);
					} else {
						res.send(conversationManager.formatMessage(message, req.body.admin_tag));
					}
				})
			}
		} else {
			res.status(400).send({error: 'Error in object request for POST /api/conversation: missing client_ID'});
		}
	});

	// Get all the conversations ID related to one client
	// Params:
	// 		- client_ID (required): user ID as set in the table Person
	routerAPI.route('/clients/:client_ID/history').get(function(req, res) {
		if(req.params.client_ID && req.params.client_ID != "") {
			conversationManager.listConversation(req.params.client_ID,function(err, list) {
				if(err) {
					res.status(500).send(err);
				} else {
					res.send(list);
				}
			});
		} else {
			res.status(400).send('Error in object request for GET /clients/:client_ID/history');
		}
	});

	// Get all the input / output of one conversation
	// Params:
	// 		- conversation_ID (required)
	routerAPI.route('/conversation/:conversation_ID').get(function(req, res) {
		if(req.params.conversation_ID && req.params.conversation_ID != "") {
			conversationManager.getConversation(req.params.conversation_ID,function(err, conversation) {
				if(err) {
					console.log(err);
					res.status(500).send(err);
				} else {
					res.send(conversation);
				}
			})
		} else {
			res.status(400).send('Error in object request for GET /conversation/:conversation_ID');
		}
	});


	/* * * * * * * * * * * * * * * * * * *\
	 *       ANSWER STORE ROUTES         *
	\* * * * * * * * * * * * * * * * * * */
	// Force a refresh of the DB
	// (Call the Conversation API to get the current workspace)
	routerAPI.route('/answers/refresh').get(function(req, res) {
		answerStore.getWorkspace(function(err, data) {
			if(err) {
				res.status(500).send(err);
			} else {
				res.send(data);
			}
		});
	});

	// Get a specific from the DB
	routerAPI.route('/answers/:answer_ID').get(function(req, res) {
		answerStore.getAnswer(req.params.answer_ID, function(err, data) {
			if(err) {
				res.status(err.status || 500).send(err);
			} else {
				res.send(data);
			}
		});
	});

	// Get all the answers from the DB
	// Params:
	// 		- text_empty (optional): set to true to get only answers with empty text
	routerAPI.route('/answers').get(function(req, res) {
		answerStore.getAnswers(req.query.text_empty, function(err, data) {
			if(err) {
				res.status(500).send(err);
			} else {
				res.send(data);
			}
		});
	});

	// Update an answer
	// Params:
	// 		- answer_ID (required)
	//		- desc (optional)
	//    - text (required)
	//    - url (optional)
	//    - last_timestamp (required)
	//    - tags (optional)
	routerAPI.route('/answers/:answer_ID').post(function(req, res) {
		if(!req.params.answer_ID || req.params.answer_ID == "" || !req.body.text || req.body.text == "" || !req.body.last_timestamp || req.body.last_timestamp == "") {
			res.status(400).send({error: 'Error in object request for POST /answers/:answer_ID', status: 400});
		} else {
			answerStore.updateAnswer(req.params.answer_ID, req.body.desc, req.body.text, req.body.url, req.body.last_timestamp, req.body.tags, function(err, data) {
				if(err) {
					res.status(err.status || 500).send(err);
				} else {
					res.send(data);
				}
			});
		}
	});

	// Get all intents
	routerAPI.route('/intents').get(function(req, res) {
		answerStore.getIntents(function(err, data) {
			if(err) {
				res.status(err.status || 500).send(err);
			} else {
				res.send(data);
			}
		});
	});

	// Get a specific intent
	// Params:
	// 		- intent_ID (required)
	routerAPI.route('/intents/:intent_ID').get(function(req, res) {
		answerStore.getIntent(req.params.intent_ID, function(err, data) {
			if(err) {
				res.status(err.status || 500).send(err);
			} else {
				res.send(data);
			}
		});
	});

	// Update an intent
	// Params:
	// 		- intent_ID (required)
	//		- displayed_text (required)
	routerAPI.route('/intents/:intent_ID').post(function(req, res) {
		if(!req.params.intent_ID || req.params.intent_ID == "" || !req.body.displayed_text || req.body.displayed_text == "") {
			res.status(400).send({error: 'Error in object request for POST /intents/:intent_ID', status: 400});
		} else {
			answerStore.updateIntent(req.params.intent_ID, req.body.displayed_text, function(err, data) {
				if(err) {
					res.status(err.status || 500).send(err);
				} else {
					res.send(data);
				}
			});
		}
	});

	// Get all entities values
	routerAPI.route('/entities').get(function(req, res) {
		answerStore.getEntities(function(err, data) {
			if(err) {
				res.status(err.status || 500).send(err);
			} else {
				res.send(data);
			}
		});
	});

	// Get a specific entity
	// Params:
	// 		- entity_name (required)
	routerAPI.route('/entities/:entity_name').get(function(req, res) {
		answerStore.getEntity(req.params.entity_name, function(err, data) {
			if(err) {
				res.status(err.status || 500).send(err);
			} else {
				res.send(data);
			}
		});
	});

	/* * * * * * * * * * * * * * * * * * *\
	 *         ADMIN/TEST ROUTES         *
	\* * * * * * * * * * * * * * * * * * */
	// Send one input to conversation and respond with the full response of conversation
	routerAPI.post('/test/unit', function(req, res) {
		if(req.body.input && req.body.input != "") {
			var data = {
				message: req.body.input,
				context: {}
			}
			conversationManager.send(data, function(err, response) {
				if(err) {
					res.status(500).send(err);
				} else {
					res.send(response);
				}
			});
		} else {
			res.status(400).send('Error in object request for POST /test/unit: missing input');
		}
	})

	// Get the environment variables (currently used in the Answer Store)
	routerAPI.get('/environment', function(req, res) {
		var databaseConf = configKnex[process.env.ENV_TYPE || 'development'];
		res.json({
			conversation: {
				user: process.env.USERNAME_CONVERSATION,
				workspace: process.env.WORKSPACE_CONVERSATION
			},
			database: {
				type: databaseConf.client,
		    host: databaseConf.connection.host,
				database: databaseConf.connection.database,
				user: databaseConf.connection.user,
				port: databaseConf.connection.port
			}
		})
	})
}

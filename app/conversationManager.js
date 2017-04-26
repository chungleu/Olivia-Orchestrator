
const watson = require('watson-developer-cloud');
const async = require('async');
const queries = require('../db/queries');

const workspace = process.env.WORKSPACE_CONVERSATION;

/* Connect to Conversation Service */
var conversation;
try {
	conversation = new watson.conversation({
		username: process.env.USERNAME_CONVERSATION || '<username>',
		password: process.env.PASSWORD_CONVERSATION || '<password>',
		version_date: '2016-07-11',
		version: 'v1',
		workspace: process.env.WORKSPACE_CONVERSATION || '<workspace>'
	});
} catch(err) {
	throw 'Error Conversation API, no request possible'
}
module.exports.conversation = conversation;

// Format return response to /api/conversation
module.exports.formatMessage = function(message, adminTag) {
	if(adminTag) {
		message.full_response = message.response;
	}
	message.response = formatOutput(message.response.output.text);
	return message;
}

var formatOutput = function(textArray) {
	var output = '';
	for(index in textArray) {
		output += textArray[index] + ' ';
	}
	return output.trim();
}

// 1) Retrieve user & conversation context from DB
// 2) Send the user input to Watson Conversation service
// 3) Update the conversation context in DB
module.exports.sendMessage = function(data, isNewConv, cb) {
	try {
		data.context = {};

		async.parallel({
			context_person: getContextPerson.bind(null, data.name),
			context_conv: getContextConversation.bind(null, data.conversation_id, isNewConv)
		}, function(err, result) {
			if(err) {
				cb('Request POST /api/conversation: ' + err, undefined);
				return;
			}

			if(result.context_conv) {
				Object.keys(result.context_conv).forEach(function(key){
					try {
						var value = JSON.parse(result.context_conv[key]);
						data.context[key] = value;
					} catch(err) {
						data.context[key]  = result.context_conv[key];
					}
				})
			}
			if(result.context_person) {
				Object.keys(result.context_person).forEach(function(key){
					data.context[key] = result.context_person[key];
				})
			}

			console.log('Send to conversation');
			module.exports.send(data, function(err, response) {
				if(err) {
					cb(err,undefined);
				} else {
					updateConversation({reponse: response, conversation: data.conversation_id, last_context: data}, function(err) {
						if(err) {
							cb(err);
						} else {
							cb(undefined,{response: response, client_ID: data.name, conversation_ID: data.conversation_id});
						}
					});

				}
			});
		});
	} catch(err) {
		cb(err,undefined);
	}
}

// Send message to Watson Conversation Service
module.exports.send = function(data, cb) {
	conversation.message({
		input:{'text': data.message},
		alternate_intents: true,
		context: data.context,
		workspace_id: workspace
	}, function(err, response) {
		try {
			if(err) {
				cb(err, undefined);
			} else {
				cb(undefined, response);
			}
		} catch(err) {
			cb('Error in sending message to Watson: ' + err, undefined);
		}
	})
}

// Retrieve conversation log for one conversation ID
module.exports.getConversation = function(id, cb) {
	var resultat = {
		conversation_ID: id,
		conversation_log: []
	};

	queries.getConversation(id)
	.then(function(conversation) {
		console.log(conversation);
		for(var i=0 ; i < conversation.length ; i++) {
			resultat.conversation_log.push({client: conversation[i].client, watson: conversation[i].watson});
		}
		cb(undefined,resultat);
	})
	.catch(function(error) {
		cb(error, undefined);
	});
}

// Create a new conversation in DB
module.exports.newConversation = function(data, cb){
	queries.insertConversation(data.name)
	.then(function(id) {
		data.conversation_id = id[0];
		module.exports.sendMessage(data, true, function(err, resultat) {
			if(err) {
				cb('2: '+ err, undefined);
			} else {
				cb(undefined, resultat);
			}
		});
	})
	.catch(function(error) {
		cb(error,  undefined);
	})
}

// Update the conversation context in the DB
var updateConversation = function(responseWatson, cb) {
	// Check if feedback is given, if yes log it into the DB - to comment if feature not wanted
	//checkFeedback(responseWatson.conversation, responseWatson.last_context, responseWatson.reponse);

	try {
		async.parallel({
			save_phrase: savePhrase.bind(null, responseWatson),
			save_context: saveContext.bind(null, responseWatson)
		}, function(err, result) {
			if(err) {
				cb(err);
				console.log('update error');
			} else {
				console.log('update finished');
				cb();
			}
		});

	} catch(err) {
		console.log(err);
		cb(err)
	}
}

// Save the couple (user_question, watson_answer) in DB
var savePhrase = function(responseWatson, cb) {
	var requeteBdd = 0;
	queries.insertPhrase(responseWatson.conversation, responseWatson.reponse.input.text, formatOutput(responseWatson.reponse.output.text))
	.then(function(data) {
		if (responseWatson.reponse.intents.length != 0) {
			phrase_uid = data[0];
			var dataArray = [];

			responseWatson.reponse.intents.forEach(function(intentObjet) {
				dataArray.push({phrase_uid: phrase_uid, intent: intentObjet.intent, confidence: intentObjet.confidence});
			});

			queries.insertPhraseIntents(dataArray)
			.then(function(data) {
				cb();
			})
			.catch(function(error) {
				cb(error);
			})
		} else {
			cb();
		}
	})
	.catch(function(error) {
		cb(error);
	});
}

// Save the new context in DB
var saveContext = function(responseWatson, cb) {
	var context = responseWatson.reponse.context;
	var conversation_id = responseWatson.conversation;
  var dataArray = [];

  Object.keys(context).forEach(function(key) {
    dataArray.push({conversation_uid: conversation_id, name: key, value: JSON.stringify(context[key])});
  })

	queries.upsertContext(dataArray)
	.then(function(data) {
		cb(null, data);
	})
	.catch(function(error) {
		cb(error);
	});
}

// If we reach a feedback response node, save the response in database
var checkFeedback = function(convId, lastContext, newContext) {
	try {
		/*console.log("lastContext");
		console.log(JSON.stringify(lastContext));*/
		/*console.log("newContext");
		console.log(JSON.stringify(newContext));*/
		var feedbackValue;

		if(!lastContext.context.system)
			return;

		/* Node Feedback reached */
		if(lastContext.context.system.dialog_stack.indexOf("Feedback") != -1) {
			var entities = JSON.stringify(newContext.entities);
			var feedbackValue;
			if(entities.indexOf("affirmatif") != -1) {
				feedbackValue = true;
			} else if (entities.indexOf("negatif") != -1) {
				feedbackValue = false;
			}

			if(feedbackValue != undefined) {
				BddSql.query("INSERT INTO feedback (CONVERSATION_UID, IS_POSITIVE, EXT_URL, ANCHOR) VALUES ($1, $2, $3, $4)", [convId, feedbackValue, lastContext.context.ext_url, lastContext.context.anchor], function(err, res) {
					if(err) {
						console.log(err);
					} else {
						console.log(res);
					}
				});
			}
		}
	} catch(err) {
		console.log(err);
	}
}

// Retrieve all the conversation ID related to one customer
module.exports.listConversation = function(id,cb) {
	queries.getPersonHistory(id)
	.then(function(liste) {
		var resultat = {conversation_history: []};
		for(var i=0 ; i < liste.length ; i++) {
			resultat.conversation_history.push(liste[i].conversation_uid);
		}
		cb(null, resultat);
	})
	.catch(function(error) {
		cb(error);
	});
}

// Get the context of a person in table Person
var getContextPerson = function(name,cb) {
	queries.getPersonCharacteristics(name)
	.then(function(contexte) {
		var resultat = {};
		for(var i=0 ; i < contexte.length ; i++) {
				resultat[contexte[i].name] = contexte[i].value;
		}
		cb(null, resultat);
	})
	.catch(function(error) {
		cb(error);
	});
}

// Get the context of a conversation in table Context
var getContextConversation = function(conversation_id, isNewConv, cb) {
	if(isNewConv) {
		cb(null, {});
	} else {
		queries.getContextConversation(conversation_id)
		.then(function(contexte) {
			if(contexte.length == 0) {
				cb('wrong conversation_uid');
			} else {
				var resultat = {};
				for(var i=0 ; i < contexte.length ; i++){
					if(typeof(contexte[i].value) == 'object')
						resultat[contexte[i].name] = JSON.parse(contexte[i].value);
					else
						resultat[contexte[i].name] = contexte[i].value;
				}
				cb(null, resultat);
			}
		})
		.catch(function(error) {
			cb(error);
		})
	}
}

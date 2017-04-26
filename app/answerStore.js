const conversation = require('./conversationManager').conversation;
const queries = require('../db/queries.js');
const async = require('async');

/* * * * * * * * * * * * * * * * * * *\
 *        ANSWERS FUNCTIONS          *
\* * * * * * * * * * * * * * * * * * */
module.exports.getAnswers = function(textEmpty, cb) {
	var res;
	if(textEmpty) {
		res = queries.getEmptyAnswers();
	} else {
		res = queries.getAnswers();
	}

	res.then(function(data) {
		cb(null, {answers: data});
	})
	.catch(function(error) {
		cb(error);
	});
}

module.exports.getAnswer = function(answer_id, cb) {
	queries.getAnswer(answer_id)
	.then(function(data) {
		if(data.length == 0) {
			cb({error: 'This answer ID is not present in the DB. If you think it\'s an error, try to refresh the DB by calling /api/answers/refresh',
					status: 400});
			return;
		}

		cb(null, {answer_ID: data[0].answer_uid, answer: data[0]});
	})
	.catch(function(error) {
		cb(error);
	});
}

module.exports.updateAnswer = function(answer_id, desc, text, url, timestamp, tags, cb) {
	queries.getAnswer(answer_id)
	.then(function(data) {
		if(data.length == 0) {
			cb({error: 'This answer ID is not present in the DB. If you think it\'s an error, try to refresh the DB by calling /api/answers/refresh',
					status: 400}); return;
		}
		console.log(data[0].last_update.toString());
		if(data[0].last_update != timestamp) {
			cb(null, {success: false}); return;
		}

		queries.updateAnswer(answer_id, desc, text, tags, url)
		.then(function(data) {
			cb(null, {success: true});
		})
	})
	.catch(function(error) {
		cb(error);
	});
}

/* * * * * * * * * * * * * * * * * * *\
 *        INTENTS FUNCTIONS          *
\* * * * * * * * * * * * * * * * * * */
module.exports.getIntents = function(cb) {
	queries.getIntents()
	.then(function(data) {
		cb(null, {intents: data});
	})
	.catch(function(error) {
		cb(error);
	});
}

module.exports.getIntent = function(intent_id, cb) {
	queries.getIntent(intent_id)
	.then(function(data) {
		if(data.length == 0) {
			cb({error: 'This intent ID is not present in the DB. If you think it\'s an error, try to refresh the DB by calling /api/answers/refresh',
					status: 400});
			return;
		}

		cb(null, {intent_ID: data[0].intent_uid, intent: data[0]});
	})
	.catch(function(error) {
		cb(error);
	});
}

module.exports.updateIntent = function(intent_id, displayed_text, cb) {
	queries.updateIntent(intent_id, displayed_text)
	.then(function(data) {
		if(data == 0) {
			cb({error: 'This intent ID is not present in the DB. If you think it\'s an error, try to refresh the DB by calling /api/answers/refresh',
		 			status: 400});
			return;
		}
		cb(null, {success: true});
	})
	.catch(function(error) {
		cb(error);
	});
}

/* * * * * * * * * * * * * * * * * * *\
 *       ENTITIES FUNCTIONS          *
\* * * * * * * * * * * * * * * * * * */
module.exports.getEntities = function(cb) {
	queries.getEntities()
	.then(function(data) {
		cb(null, {entities: data});
	})
	.catch(function(error) {
		cb(error);
	});
}

module.exports.getEntity = function(intent_id, cb) {
	queries.getEntity(intent_id)
	.then(function(data) {
		if(data.length == 0) {
			cb({error: 'This entity name is not present in the DB. If you think it\'s an error, try to refresh the DB by calling /api/answers/refresh',
					status: 400});
			return;
		}

		cb(null, {values: data});
	})
	.catch(function(error) {
		cb(error);
	});
}

/* * * * * * * * * * * * * * * * * * *\
 *       WORKSPACE FUNCTIONS         *
\* * * * * * * * * * * * * * * * * * */
module.exports.getWorkspace = function(cb) {

	const params = {
	 export: true,
	 workspace_id: process.env.WORKSPACE_CONVERSATION
	};

	conversation.getWorkspace(params, function(err, result) {
		if (err) {
			cb(err);
		} else {
			async.parallel({
				intents: saveIntents.bind(null, result.intents),
				entities: saveEntities.bind(null, result.entities)
			}, function(err, res) {
				if(err) {
					cb(err);
				} else {
					saveDialogNodes(result.dialog_nodes, cb);
				}
			});
	 	}
	});
}

var saveEntities = function(entities, cb) {
	var entitiesLength = entities.length;
	var dataArray = [];
	var entity, values;

	for(var i = 0; i < entitiesLength; i++) {
		entity = entities[i].entity;
		values = entities[i].values;
		for(var j = 0; j < values.length; j++) {
			dataArray.push({entity_name: entity, value: values[j].value, synonyms: JSON.stringify(values[j].synonyms)});
		}
	}
	queries.upsertEntities(dataArray)
	.then(function(data) {
	  cb(null, data);
	})
	.catch(function(error) {
	  cb(error);
	});
}

var saveIntents = function(intents, cb) {
	var intentsName = [];
	var intent;

	for(var i in intents) {
		intent = intents[i].intent;
		intentsName.push(intent);
	}

	queries.getIntents()
	.then(function(data) {
		var toDelete = [];
		for(var i in data) {
			if(intentsName.indexOf(data[i].intent) == -1) {
				toDelete.push(data[i].intent);
			}
		}
		console.log('upsert & delete')
		async.parallel({
			add: upsertIntents.bind(null, intentsName),
			delete: deleteDBContent.bind(null, queries.deleteIntents, toDelete)
		}, function(err, res) {
			if(err) {
				cb(err);
			} else {
				cb(null, {success: true});
			}
		});
	})
	.catch(function(error) {
		cb(error);
	})
}

var upsertIntents = function(intentsName, cb) {
	var dataArray = [];
	var regex = /QP[0-9]*/;
	var intent, regexArray;

	for(var i in intentsName) {
		intent = intentsName[i];
		regexArray = regex.exec(intent);
		if(regexArray) {
			dataArray.push({intent_uid: regexArray[0], intent: intent});
		}
	}
	if(dataArray.length != 0) {
		queries.upsertIntents(dataArray)
		.then(function(data) {
			cb(null, data);
		})
	} else {
		cb();
	}
}

var deleteDBContent = function(queryFunc, toDeleteArray, cb) {
	if(toDeleteArray.length != 0) {
		queryFunc(toDeleteArray)
		.then(function(data) {
			cb(null, data);
		})
	} else {
		cb();
	}
}

var saveDialogNodes = function(dialogNodes, cb) {
  var length = dialogNodes.length;
  var regCode = /(QP[0-9]*)-[a-zA-Z]+/;
	var regDesc = /(QP[0-9]*)-[^:]*:(.*)/;
  var output, regCodeRes, regDescRes, desc;
  var dataArray = [];

  for(var i = 0; i < length; i++) {
		output = dialogNodes[i].output;
    if(output) {
      if(output.text && output.text.values) {
				regCodeRes = regCode.exec(output.text.values[0]);
				if(regCodeRes) {
					regDescRes = regDesc.exec(output.text.values[0]);
					desc = regDescRes ? regDescRes[2] : '';
					dataArray.push({answer_uid: regCodeRes[0], intent_uid: regCodeRes[1], description: desc});
				}
      }
    }
  }

	if(dataArray.length != 0) {
		queries.upsertAnswers(dataArray)
		.then(function(data) {
			cb(null, {});
		})
		.catch(function(error) {
			cb('1:' + error);
		})
	} else {
		cb(null, {});
	}
}

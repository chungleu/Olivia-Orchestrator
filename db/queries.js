const knex = require('./knex.js');

/* * * * * * * * * * * * * * * * * * *\
 *         INITIALIZATION            *
\* * * * * * * * * * * * * * * * * * */
// knex.migrate.latest()
// .then(function() {
// });

/* * * * * * * * * * * * * * * * * * *\
 *         TABLE HELPERS             *
\* * * * * * * * * * * * * * * * * * */
function Conversation() { return knex('conversation'); }
function Context() { return knex('context'); }
function Person() { return knex('person'); }
function Characteristic() { return knex('characteristic'); }
function Phrase() { return knex('phrase'); }
function Phrase_Intent() { return knex('phrase_intent'); }
function Intent() { return knex('intent'); }
function Answer() { return knex('answer'); }
function EntityValue() { return knex('entityValue'); }
function AnswerEntityValue() { return knex('answer_entityValue'); }


/* * * * * * * * * * * * * * * * * * *\
 *         SELECT QUERIES            *
\* * * * * * * * * * * * * * * * * * */
module.exports.getConversation = function(client_id) {
  return Phrase().select('conversation_uid', 'user_question as client', 'watson_answer as watson').where('conversation_uid', client_id);
}

module.exports.getPersonHistory = function(client_id) {
  return Conversation().select('conversation_uid').where('person_uid', client_id);
}

module.exports.getPersonCharacteristics = function(client_id) {
  return Characteristic().select('name', 'value').where('person_uid', client_id);
}

module.exports.getContextConversation = function(conversation_id) {
  return Context().select('name', 'value').where('conversation_uid', conversation_id);
}

module.exports.getAnswers = function() {
  return Answer().select();
}

module.exports.getEmptyAnswers = function() {
  return Answer().select().whereNull('text');
}

module.exports.getAnswer = function(answer_id) {
  /*return Answer().join('answer_entityValue', 'answer.answer_uid', '=', 'answer_entityValue.answer_uid')
    .select('intent_uid', 'answer_desc', 'answer_text', 'answer_url', 'last_update', knex.raw('array_agg("answer_entityValue"."entityValue_uid")'))
    .where('answer.answer_uid', answer_id).groupBy('answer_entityValue.answer_uid');*/
  return Answer().select().where('answer.answer_uid', answer_id);
}

module.exports.getAnswerEntity = function(answer_id) {
  return AnswerEntityValue().select().where('answer_uid', answer_id);
}

module.exports.getIntents = function() {
  return Intent().select();
}

module.exports.getIntent = function(intent_id) {
  return Intent().select().where('intent_uid', intent_id);
}

module.exports.getEntities = function() {
  return EntityValue().select();
}

module.exports.getEntity = function(entity_name) {
  return EntityValue().select().where('entity_name', entity_name);
}

module.exports.getPerson = function(person_uid, role) {
  return Person().select().where('person_uid', person_uid).where('role', role);
}

/* * * * * * * * * * * * * * * * * * *\
 *         UPDATE QUERIES            *
\* * * * * * * * * * * * * * * * * * */
module.exports.updateAnswer = function(answer_id, description, text, tags, url) {
  return Answer().where('answer_uid', answer_id)
  .update({
    description,
    text,
    url,
    tags,
    last_update: knex.fn.now()
  });
}

module.exports.updateIntent = function(intent_id, displayed_text) {
  return Intent().where('intent_uid', intent_id)
  .update({displayed_text: displayed_text});
}

/* * * * * * * * * * * * * * * * * * *\
 *         INSERT QUERIES            *
\* * * * * * * * * * * * * * * * * * */
module.exports.insertConversation = function(client_id) {
  return Conversation().insert({person_uid: client_id}).returning('conversation_uid');
}

module.exports.insertPhrase = function(conversation_id, user_input, watson_answer) {
  return Phrase().insert({conversation_uid: conversation_id, user_question: user_input, watson_answer: watson_answer}).returning('phrase_uid');
}

module.exports.insertPhraseIntents = function(dataArray) {
  return Phrase_Intent().insert(dataArray);
}

module.exports.insertAnswerEntity = function(dataArray) {
  return AnswerEntityValue().insert(dataArray);
}


/* * * * * * * * * * * * * * * * * * *\
 *         UPSERT QUERIES            *
\* * * * * * * * * * * * * * * * * * */
var endQuery = function(updatedField, conflictField) {
  var res;
  if(knex.client.config.client == 'mysql') {
    res = " ON DUPLICATE KEY UPDATE " + updatedField + "= VALUES(" + updatedField + ");";
  } else {
    res = " ON CONFLICT(" + conflictField + ") DO UPDATE SET " + updatedField + "= EXCLUDED." + updatedField + ";";
  }
  return res;
}

module.exports.upsertContext = function(dataArray, conversation_id) {
  var query = Context().insert(dataArray).toSQL();
  query.sql += endQuery("value", "conversation_uid, name");
  return knex.raw(query.sql, query.bindings);
}

module.exports.upsertAnswers = function(dataArray) {
  var query = Answer().insert(dataArray).toSQL();
  query.sql += endQuery("description", "answer_uid");
  return knex.raw(query.sql, query.bindings);
}

module.exports.upsertIntents = function(dataArray) {
  var query = Intent().insert(dataArray).toSQL();
  query.sql += endQuery("intent", "intent_uid");
  return knex.raw(query.sql, query.bindings);
}

module.exports.upsertEntities = function(dataArray) {
  var query = EntityValue().insert(dataArray).toSQL();
  query.sql += endQuery("synonyms", "entity_name, value");
  return knex.raw(query.sql, query.bindings);
}

/* * * * * * * * * * * * * * * * * * *\
 *         DELETE QUERIES            *
\* * * * * * * * * * * * * * * * * * */
module.exports.deleteAnswerEntity = function(answer_id, idArray) {
  return AnswerEntityValue().whereIn('entityValue_uid', idArray).where('answer_uid', answer_id).del();
}

module.exports.deleteAllEntities = function() {
  return EntityValue().del();
}

module.exports.deleteIntents = function(intentArray) {
  return Intent().whereIn('intent', intentArray).del();
}

module.exports.deleteAnswer = function(answer_id) {
  return Answer().where('answer_uid', answer_id).del();
}

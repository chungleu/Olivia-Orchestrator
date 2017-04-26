
exports.up = function(knex, Promise) {
  return knex.schema
  /* * * * * * * * * * * * * * * * * * * * * *\
   *        CONVERSATIONS TABLES             *
  \* * * * * * * * * * * * * * * * * * * * * */
  .createTable('person', function(table) {
    table.string('person_uid').primary();
    table.string('password').notNullable();
    table.string('role').notNullable();
    table.string('salt').notNullable();
  })
  .createTable('conversation', function(table) {
    table.bigIncrements('conversation_uid');
    table.string('person_uid').references('person_uid').inTable('person').notNullable().onUpdate('CASCADE');
    table.timestamp('start_datetime').defaultTo(knex.fn.now());
  })
  .createTable('context', function(table) {
    table.bigIncrements('context_uid');
    table.bigInteger('conversation_uid').unsigned().references('conversation_uid').inTable('conversation').notNullable().onDelete('CASCADE');
    table.string('name').notNullable();
    table.string('value', 750);
    table.unique(['conversation_uid', 'name']);
  })
  .createTable('characteristic', function(table) {
    table.bigIncrements('characteristic_uid');
    table.string('person_uid').references('person_uid').inTable('person').notNullable().onDelete('CASCADE').onUpdate('CASCADE');
    table.string('name').notNullable();
    table.string('value');
    table.unique(['person_uid', 'name']);
  })
  .createTable('phrase', function(table) {
    table.bigIncrements('phrase_uid');
    table.bigInteger('conversation_uid').unsigned().references('conversation_uid').inTable('conversation').notNullable().onDelete('CASCADE');
    table.string('user_question');
    table.string('watson_answer');
    table.timestamp('user_question_ts').defaultTo(knex.fn.now());
  })
  .createTable('phrase_intent', function(table) {
    table.bigIncrements('intent_uid');
    table.bigInteger('phrase_uid').unsigned().references('phrase_uid').inTable('phrase').notNullable().onDelete('CASCADE');
    table.string('intent').notNullable();
    table.decimal('confidence');
  })
  /* * * * * * * * * * * * * * * * * * * * * *\
   *         ANSWER STORE TABLES             *
  \* * * * * * * * * * * * * * * * * * * * * */
  .createTable('intent', function(table) {
    table.string('intent_uid').primary();
    table.string('intent');
    table.string('displayed_text');
  })
  .createTable('entityValue', function(table) {
    table.increments('entityValue_uid');
    table.string('entity_name');
    table.string('value');
    table.string('synonyms', 510);
    table.unique(['entity_name', 'value']);
  })
  .createTable('answer', function(table) {
    table.string('answer_uid').primary();
    table.string('intent_uid');
    table.string('description');
    table.string('text');
    table.string('url');
    table.string('tags', 510);
    table.timestamp('last_update').defaultTo(knex.fn.now());
  });
};

exports.down = function(knex, Promise) {
  return knex.schema
    .dropTable('phrase_intent')
    .dropTable('phrase')
    .dropTable('characteristic')
    .dropTable('context')
    .dropTable('conversation')
    .dropTable('person')
    .dropTable('answer')
    .dropTable('entityValue')
    .dropTable('intent');
};

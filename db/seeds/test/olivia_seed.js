
exports.seed = function(knex, Promise) {
  // Deletes ALL existing entries
  return knex('context').del()
    .then(function () {
      return Promise.all([
        knex('characteristic').del(),
        knex('phrase_intent').del(),
        knex('phrase').del(),
        knex('conversation').del(),
        knex('person').del(),
        knex('person').insert({person_uid: 'alpha_tester'}),
        knex('characteristic').insert({characteristic_uid: 1, person_uid: 'alpha_tester', name: 'user_name', value: 'Alpha Tester'})
      ]);
    });
};

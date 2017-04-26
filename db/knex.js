const environment = process.env.ENV_TYPE || 'development';
const config = require('../knexfile.js')[environment];

module.exports = require('knex')(config);

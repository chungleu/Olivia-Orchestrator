// Update with your config settings.

module.exports = {
  development: {
    client: '<client>',
    connection: {
      host: '<host>',
      database: '<database>',
      user:     '<user>',
      password: '<password>',
      port:     '<port>'
    },
    migrations: {
      directory: __dirname + '/db/migrations'
    },
    seeds: {
      directory: __dirname + '/db/seeds/test'
    }
  }
};

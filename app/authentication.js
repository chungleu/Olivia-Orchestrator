const crypto = require('crypto');
const queries = require('../db/queries.js');

// Generates random string of characters (salt for password)
var genRandomString = function(length) {
  return crypto.randomBytes(Math.ceil(length/2)).toString('hex').slice(0,length);
}

// Hash password with sha512 & salt.
var sha512 = function(password, salt){
  var hash = crypto.createHmac('sha512', salt);
  hash.update(password);
  password = hash.digest('hex');
  return {password, salt};
};


// Encode the password to store it in the DB
module.exports.encodePassword = function(password) {
  var salt = genRandomString(16);
  return sha512(password, salt);
}

module.exports.authenticateUser = function(person_uid, password, role, cb) {
  queries.getPerson(person_uid, role)
  .then(function(data) {
    if(data.length == 0) {
      cb({error: 'Wrong user and/or role', status: 403});
    } else {
      var res = sha512(password, data[0].salt);
      console.log(res.password);
      console.log(data[0].password)
      if(res.password == data[0].password) {
        cb(null, {success: true});
      } else {
        cb({error: 'Wrong user and/or password', status: 403});
      }
    }
  })
  .catch(function(error) {
    cb(error);
  })
}

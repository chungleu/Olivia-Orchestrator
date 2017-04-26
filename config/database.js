require('dotenv').load();

module.exports = {
	'DATABASE' : process.env.DATABASE || '',
	'HOSTNAME' : process.env.DB_HOSTNAME || '',
	'UID' : process.env.DB_UID || '',
	'PWD': process.env.DB_PWD || '',
	'PORT': process.env.DB_PORT || ''
}

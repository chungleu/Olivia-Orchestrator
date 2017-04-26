var log4js = require('log4js');
require('dotenv').load();

log4js.configure({
	appenders:[
		{
			type: 'console'
		},
		{
			type: 'file',
			filename: __dirname + process.env.pathToLog +'server.log',
			maxLogSize: 20480,
			backups: 3,
			category:"server"
		},
		{
			type: 'file',
			filename: __dirname + process.env.pathToLog + 'all.log',
			maxLogSize: 20480,
			backups: 10,
			category: "absolute"
		}
	]
})

var loggerTRACE = log4js.getLogger('server');
var loggerAbsolute = log4js.getLogger('absolute');

loggerTRACE.setLevel('INFO');
loggerAbsolute.setLevel('TRACE');

Object.defineProperty(exports,"INFO",{
	value:loggerTRACE
})
Object.defineProperty(exports,"absolute",{
	value:loggerAbsolute
})
const express = require('express'),
	cors = require('cors'),
	app = express(),
	bodyParser = require('body-parser'),
	helmet = require('helmet'),
	port = process.env.PORT || 8080;

const logger = require("./app/logger.js");

app.use(cors());
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());

const configJWT = require("./config/Jwt.js");
const configID = require("./config/authentification.js");

app.set("JWT_pwd", configJWT);
app.set("auth_name",configID.name);
app.set("auth_pwd",configID.pwd);

require('./app/routes.js')(app);

const log = logger.INFO;

app.listen(port,'0.0.0.0',function(){
	console.log("Server listening on port: " + port);
});

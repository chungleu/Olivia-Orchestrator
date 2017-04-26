require('dotenv').load()

module.exports = {
	name:  process.env.name || "",
	pwd:  process.env.password || ""
}

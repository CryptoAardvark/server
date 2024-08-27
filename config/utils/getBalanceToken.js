var config = require("../config"),
    jwt = require("jsonwebtoken");

// Generate token
module.exports = (user) => {
    var jsonData = {
        id: user.id,
        balance: user.balance,
    };
    return jwt.sign(jsonData, config.secret);
}
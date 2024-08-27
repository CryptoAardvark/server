const { updateBalance } = require("./balance.update");
const { cryptoCurrencyPriceUpdate } = require("./cryptocurrency.price.update");


setInterval(updateBalance, 1 * 5 * 1000);
setInterval(cryptoCurrencyPriceUpdate, 0.1 * 60 * 60 * 1000);

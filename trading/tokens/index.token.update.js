const { updateMetatrader4MastersToken, updateMetatrader4CopiersToken } = require("./metatrader4.token.update");
const { updateMetatrader5MastersToken, updateMetatrader5CopiersToken } = require("./metatrader5.token.update");
const { updateTradelockerMastersToken, updateTradelockerCopiersToken } = require("./tradelocker.token.update");


updateMetatrader4MastersToken();
updateMetatrader4CopiersToken();

updateTradelockerMastersToken();
updateTradelockerCopiersToken();

updateMetatrader5MastersToken();
updateMetatrader5CopiersToken();

setInterval(updateMetatrader4MastersToken, 1 * 60 * 60 * 1000);
setInterval(updateMetatrader4CopiersToken, 1 * 60 * 60 * 1000);

setInterval(updateMetatrader5MastersToken, 1 * 60 * 60 * 1000);
setInterval(updateMetatrader5CopiersToken, 1 * 60 * 60 * 1000);

setInterval(updateTradelockerMastersToken, 0.5 * 60 * 60 * 1000);
setInterval(updateTradelockerCopiersToken, 0.5 * 60 * 60 * 1000);


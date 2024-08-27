const client = require("../config/db/db.js");
const axios = require("axios");
const { TRADELOCKER_DEMO_BASIC_URL } = require("./config/tradelocker.config.js");

//This function is to get tradableInstrumentPairs and store database

const getTradableInstrumentPairs = () => {

  const config1 = {
    method: 'get',
    url: `${TRADELOCKER_DEMO_BASIC_URL}/trade/accounts/366024/instruments`,
    headers: {
      'accept': 'application/json',
      'Authorization': `Bearer `,
      'accNum': `${2}`,
      'Content-Type': 'application/json'
    }
  }
  axios(config1).then(async (instruments) => {
    if (instruments.data.s === "ok") {
      instruments.data.d.instruments?.map(async (item) => {
        await client.query(
          `INSERT INTO tradable_instrument_pairs (tradable_instrument_id, symbol) VALUES ($1, $2)`,
          [item.tradableInstrumentId, item.name]
        )
      })
    }
  })
}

getTradableInstrumentPairs();
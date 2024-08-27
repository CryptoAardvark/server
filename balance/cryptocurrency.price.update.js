const client = require("../config/db/db.js");
const axios = require('axios');
const COINGECKO_API_URL = 'https://api.coingecko.com/api/v3/simple/price';
const params = {
  ids: 'bitcoin,litecoin,ethereum,dogecoin,ripple',
  vs_currencies: 'usd'
}

const cryptoCurrencyPriceUpdate = async () => {
  console.log("start --------------------> update currency price.");
  await axios.get(
    COINGECKO_API_URL,
    {
      params
    }
  )
    .then(async (response) => {
      if (response.status === 200 && response.data) {
        const currency_data = await client.query(
          `SELECT * FROM currency_price`
        );
        if (currency_data.rowCount === 0) {
          await client.query(
            `INSERT INTO currency_price 
            (bitcoin, dogecoin, ethereum, litecoin, ripple)
            VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [
              response.data.bitcoin.usd,
              response.data.dogecoin.usd,
              response.data.ethereum.usd,
              response.data.litecoin.usd,
              response.data.ripple.usd
            ]
          )
        }
        else {
          await client.query(
            `UPDATE currency_price 
            set bitcoin = $1, 
            dogecoin = $2, 
            ethereum = $3, 
            litecoin = $4,
            ripple = $5
            WHERE id = 1`,
            [
              response.data.bitcoin.usd,
              response.data.dogecoin.usd,
              response.data.ethereum.usd,
              response.data.litecoin.usd,
              response.data.ripple.usd
            ]
          )
        }
      }
    }).catch(() => {
      console.log('Error getting currency price');
    });
}

module.exports = { cryptoCurrencyPriceUpdate }
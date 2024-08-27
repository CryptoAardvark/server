const axios = require('axios');

const METATRADER5_BASIC_URL = "http://78.46.76.71:5055";
// const METATRADER5_BASIC_URL = "http://mt5.mtapi.io";

const metatrader5Axios = axios.create({
  baseURL: METATRADER5_BASIC_URL
});

module.exports = { metatrader5Axios };
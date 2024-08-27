const axios = require('axios');

const METATRADER4_BASIC_URL = "http://78.46.76.71:5044";
// const METATRADER4_BASIC_URL = "http://mt4.mtapi.io";

const metatrader4Axios = axios.create({
  baseURL: METATRADER4_BASIC_URL
});

module.exports = { metatrader4Axios };
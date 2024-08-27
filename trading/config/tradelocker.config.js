const axios = require('axios');

const TRADELOCKER_DEMO_BASIC_URL = "https://demo.tradelocker.com/backend-api";
const TRADELOCKER_LIVE_BASIC_URL = "https://live.tradelocker.com/backend-api";

const tradelockerDemoAxios = axios.create({
  baseURL: TRADELOCKER_DEMO_BASIC_URL
});

const tradelockerLiveAxios = axios.create({
  baseURL: TRADELOCKER_LIVE_BASIC_URL
});

module.exports = { TRADELOCKER_DEMO_BASIC_URL, TRADELOCKER_LIVE_BASIC_URL, tradelockerDemoAxios, tradelockerLiveAxios };
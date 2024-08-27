const axios = require('axios');
const Base64 = require('js-base64').Base64;
const crypto = require('crypto');
const client = require("../config/db/db.js");
const jwt = require("jsonwebtoken");
const getBalanceToken = require("../config/utils/getBalanceToken.js");
const config = require("../config/config.js");

const API_URL = process.env.CRYPTOCHILL_API_URL;
const API_KEY = process.env.CRYPTOCHILL_API_KEY;
const API_SECRET = process.env.CRYPTOCHILL_API_SECRET;
const PROFILE_ID = process.env.CRYPTOCHILL_PROFILE_ID;
const CALLBACK_TOKEN = process.env.CRYPTOCHILL_CALLBACK_TOKEN;

function encode_hmac(key, msg) {
  return crypto.createHmac('sha256', key).update(msg).digest('hex');
}

function cryptochill_api_request(endpoint, payload = {}, method = 'GET') {
  const request_path = '/v1/' + endpoint + '/'
  payload.request = request_path;
  payload.nonce = (new Date).getTime();

  // Encode payload to base64 format and create signature using your API_SECRET
  const encoded_payload = JSON.stringify(payload);
  const b64 = Base64.encode(encoded_payload);
  const signature = encode_hmac(API_SECRET, b64);

  // Add your API key, encoded payload and signature to following headers
  let request_headers = {
    'X-CC-KEY': API_KEY,
    'X-CC-PAYLOAD': b64,
    'X-CC-SIGNATURE': signature,
  };

  return axios({
    method: method,
    url: API_URL + request_path,
    headers: request_headers,
  });
}

exports.getProfile = async (req, res) => {
  cryptochill_api_request('profiles').then(function (response) {
    // if(response.statusText === 'OK'){
    console.log(response.data.result);
    res.send(response.data.result)
    // }
  }).catch(function (error) {
    console.log(error);
  });
}

exports.payCrypto = async (req, res) => {
  const { type, amount } = req.body;
  var payload = {
    "amount": amount,
    "currency": "USD",
    "kind": type,
    "profile_id": PROFILE_ID,
    "passthrough": JSON.stringify({
      "user_id": req.user.id,
    })
  }
  await cryptochill_api_request('invoices', payload, 'POST').then(function async(response) {
    console.log(response.data.result);
    res.status(200).send(response.data.result.id);
  }).catch(function (error) {
    console.log(error);
    if (error?.response) res.status(501).send("Network Connection Error.");
    else res.status(501).send("Creating Invoice Failed.");
  });
}

exports.withdrawCrypto = async (req, res) => {
  const { type, amount, address } = req.body;
  console.log(amount, address);
  if (amount > req.user.balance) {
    res.status(201).send("Insufficient balance");
    return;
  }
  const new_date = new Date();
  var payload = {
    "profile_id": PROFILE_ID,
    "kind": type,
    "passthrough": JSON.stringify({
      "user_id": req.user.id,
      "created_at": new_date.toISOString()
    }),
    "network_fee_preset": "economy",
    "network_fee_pays": "merchant",
    "recipients": [
      {
        "amount": amount,
        "currency": "USD",
        "address": address,
        "notes": "Withdraw " + amount
      }
    ]
  }

  cryptochill_api_request('payouts', payload, 'POST').then(function (response) {
    if (response.statusText === "Created") res.status(200).send("ok");
    else res.status(202).send("Withdraw Failed.");
  }).catch(function (error) {
    if (error.response.data.reason === "PayoutNetworkFeeTooHigh" || error.response.data.reason === "InvalidAddress") {
      res.status(501).send(error.response.data.message);
    }
    else if (error.response.data.reason === "InsufficientFunds") {
      res.status(501).send("Insufficient funds for this currency. Please use other currency.");
    }
    else {
      console.log(error.response.data)
      res.status(501).send("Withdraw Failed.");
    }
  });
}

exports.cryptoChillCallback = async (req, res) => {
  const payload = req.body;
  // Get signature and callback_id fields from provided data
  const signature = payload['signature'];
  const callback_id = payload['callback_id'];

  // Compare signatures
  const is_valid = signature === encode_hmac(CALLBACK_TOKEN, callback_id);

  if (!is_valid) {
    throw new Error('Failed to verify CryptoChill callback signature.');
  }
  else {
    switch (payload['callback_status']) {
      case 'transaction_pending':
        const pending_passthrough = JSON.parse(payload['transaction']['invoice']['passthrough']);
        const pending_user = await client.query(
          `SELECT * FROM users WHERE id = '${pending_passthrough.user_id}'`
        );
        if (pending_user.rowCount > 0) {
          const payment_date = payload['transaction']['created_at'];
          const new_transaction_history = {
            invoice_id: payload['transaction']['invoice']['id'],
            transaction_id: payload['transaction']['id'],
            kind: payload['transaction']['kind'],
            amount: payload['transaction']['amount']['paid']['quotes']['USD'],
            crypto_amount: payload['transaction']['amount']['paid']['amount'],
            payment_date: payment_date,
            type: 'Charge',
            status: 'pending'
          }
          await client.query(
            `UPDATE users SET transaction_history = array_append(transaction_history, $1) WHERE id = '${pending_passthrough.user_id}'`,
            [
              new_transaction_history
            ]
          )
        }
        break;
      case 'transaction_confirmed':
        console.log(payload)
        const confirmed_passthrough = JSON.parse(payload['transaction']['invoice']['passthrough']);
        const confirmed_user = await client.query(
          `SELECT * FROM users WHERE id = '${confirmed_passthrough.user_id}'`
        );
        if (confirmed_user.rowCount > 0) {
          const update_one = confirmed_user.rows[0].transaction_history?.find(item => item.transaction_id === payload['transaction']['id']);
          console.log(update_one, payload['transaction']['id'])
          const new_transaction_history = {
            ...update_one,
            status: 'confirmed'
          }

          await client.query(
            `UPDATE users SET transaction_history = array_remove(transaction_history, $1) WHERE id = '${confirmed_passthrough.user_id}'`,
            [
              update_one
            ]
          )

          await client.query(
            `UPDATE users SET transaction_history = array_append(transaction_history, $1) WHERE id = '${confirmed_passthrough.user_id}'`,
            [
              new_transaction_history
            ]
          )
        }
        break;
      case 'transaction_complete':
        const completed_passthrough = JSON.parse(payload['transaction']['invoice']['passthrough']);
        const complete_user = await client.query(
          `SELECT * FROM users WHERE id = '${completed_passthrough.user_id}'`
        );
        if (complete_user.rowCount > 0) {
          const update_one = complete_user.rows[0].transaction_history?.find(item => item.transaction_id === payload['transaction']['id']);
          const new_transaction_history = {
            ...update_one,
            status: 'completed'
          }

          await client.query(
            `UPDATE users SET transaction_history = array_remove(transaction_history, $1) WHERE id = '${completed_passthrough.user_id}'`,
            [
              update_one
            ]
          )

          await client.query(
            `UPDATE users SET transaction_history = array_append(transaction_history, $1) WHERE id = '${completed_passthrough.user_id}'`,
            [
              new_transaction_history
            ]
          )
        }

        console.log('complete');
        break;
      case 'transaction_zero_conf_confirmed':
        console.log("transaction_zero_conf_confirmed");
        console.log(payload);
        break;
      case 'payout_pending':
        console.log(payload);
        const payout_passthrough = JSON.parse(payload['payout']['passthrough']);
        const payout_pending_user = await client.query(
          `SELECT * FROM users WHERE id = '${payout_passthrough.user_id}'`
        );
        console.log(payload['payout']['recipients'], payload['payout']['recipients'][0])
        if (payout_pending_user.rowCount > 0) {
          const payment_date = payload['payout']['created_at'];
          const new_transaction_history = {
            transaction_id: payload['payout']['id'],
            kind: payload['payout']['kind'],
            amount: payload['payout']['recipients'][0]['amount']['requested']['amount'],
            crypto_amount: payload['payout']['amount']['total'],
            fee: payload['payout']['amount']['network_fee'],
            payment_date: payment_date,
            type: 'Withdraw',
            status: 'pending'
          }

          await client.query(
            `UPDATE users SET transaction_history = array_append(transaction_history, $1) WHERE id = '${payout_passthrough.user_id}'`,
            [
              new_transaction_history
            ]
          )
        }
        break;
      case 'payout_confirmed':
        console.log(payload);
        const payout_confirmed_passthrough = JSON.parse(payload['payout']['passthrough']);
        const payout_confirmed_user = await client.query(
          `SELECT * FROM users WHERE id = '${payout_confirmed_passthrough.user_id}'`
        );
        if (payout_confirmed_user.rowCount > 0) {
          console.log(payout_confirmed_user.rows[0].transaction_history);
          const update_one = payout_confirmed_user.rows[0].transaction_history?.find(item => item.transaction_id === payload['payout']['id']);
          if (update_one) {
            const new_transaction_history = {
              ...update_one,
              status: 'confirmed'
            }

            await client.query(
              `UPDATE users SET transaction_history = array_remove(transaction_history, $1) WHERE id = '${payout_confirmed_passthrough.user_id}'`,
              [
                update_one
              ]
            )

            await client.query(
              `UPDATE users SET transaction_history = array_append(transaction_history, $1) WHERE id = '${payout_confirmed_passthrough.user_id}'`,
              [
                new_transaction_history
              ]
            )
          }
        }
        break;
      case 'payout_complete':
        const payout_completed_passthrough = JSON.parse(payload['payout']['passthrough']);
        const payout_completed_user = await client.query(
          `SELECT * FROM users WHERE id = '${payout_completed_passthrough.user_id}'`
        );
        if (payout_completed_user.rowCount > 0) {
          const update_one = payout_completed_user.rows[0].transaction_history?.find(item => item.transaction_id === payload['payout']['id']);
          if (update_one) {
            const new_transaction_history = {
              ...update_one,
              status: 'completed'
            }

            await client.query(
              `UPDATE users SET transaction_history = array_remove(transaction_history, $1) WHERE id = '${payout_completed_passthrough.user_id}'`,
              [
                update_one
              ]
            )

            await client.query(
              `UPDATE users SET transaction_history = array_append(transaction_history, $1) WHERE id = '${payout_completed_passthrough.user_id}'`,
              [
                new_transaction_history
              ]
            )
          }
        }
        break;
      case 'payout_failed':
        console.log(payload)
        console.log('payout failed')
        break;
    }
    await res.status(200).send("ok");
  }
}

exports.getTransaction = async (req, res) => {
  console.log(req.body.transaction_id)
  await cryptochill_api_request(`transactions`).then(function async(response) {
    console.log(response.data.result);
    res.status(200).send(response.data.result);
  }).catch(function (error) {
    console.log(error);
  });
}

exports.getInvoice = async (req, res) => {
  console.log(req.body.invoice_id)
  await cryptochill_api_request(`invoices/${req.body.invoice_id}`).then(function async(response) {
    console.log(response.data.result);
    res.status(200).send(response.data.result);
  }).catch(function (error) {
    console.log(error);
  });
}


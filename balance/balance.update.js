const client = require("../config/db/db.js");

const updateBalance = async () => {
  console.log("start ---------------------> update balance");
  const users = await client.query(
    `SELECT id, balance, transaction_history FROM users`
  );
  if (users.rowCount === 0) return;
  const currency_price = await client.query(
    `SELECT * FROM currency_price WHERE id = 1`
  );
  if (currency_price.rowCount === 0) return;
  const promises = users.rows.map(async (user) => {
    const transaction_history = user.transaction_history;
    let balance = 0;
    if (transaction_history) {
      transaction_history?.map((history) => {
        const kind = history.kind;
        const crypto_amount = history.crypto_amount;
        const type = history.type;
        const status = history.status;
        console.log(type, status, crypto_amount, currency_price.rows[0])
        if (status === 'pending') return;
        switch (kind) {
          case "BTC":
            if (type === "Charge") balance += crypto_amount * currency_price.rows[0].bitcoin;
            if (type === "Withdraw")balance -= crypto_amount * currency_price.rows[0].bitcoin;
            break;
          case "USDT-TRX":
            if (type === "Charge") balance += crypto_amount;
            if (type === "Withdraw") balance -= crypto_amount;
            break;
          case "DOGE":
            if (type === "Charge") balance += crypto_amount * currency_price.rows[0].dogecoin;
            if (type === "Withdraw") balance -= crypto_amount * currency_price.rows[0].dogecoin;
            break;
          case "XRP":
            if (type === "Charge") balance += crypto_amount * currency_price.rows[0].ripple;
            if (type === "Withdraw") balance -= crypto_amount * currency_price.rows[0].ripple;
            break;
          case "LTC":
            if (type === "Charge") balance += crypto_amount * currency_price.rows[0].litecoin;
            if (type === "Withdraw") balance -= crypto_amount * currency_price.rows[0].litecoin;
            break;
          case "ETH":
            if (type === "Charge") balance += crypto_amount * currency_price.rows[0].ethereum;
            if (type === "Withdraw") balance -= crypto_amount * currency_price.rows[0].ethereum;
            break;
          case "USDC-TRX":
            if (type === "Charge") balance += crypto_amount;
            if (type === "Withdraw") balance -= crypto_amount;
            break;
          case "ETH_USDT":
            if (type === "Charge") balance += crypto_amount;
            if (type === "Withdraw") balance -= crypto_amount;
            break;
        }
      });
      //update balance by current crypto price
    }
    await client.query(
      `UPDATE users SET balance = $1 WHERE id = '${user.id}'`,
      [
        balance > 0 ? balance : 0
      ]
    )
  });

  await Promise.all(promises);
}

module.exports = { updateBalance }
const client = require("../../config/db/db.js");
const { metatrader5Axios } = require("../config/metatrader5.config.js");

//Update Masters Token

const updateMetatrader5MastersToken = async () => {
  console.log("MT5-----------------------------------------> Start Update Masters Token", performance.now());
  const masters = await client.query(
    `SELECT account_id, account_password, host, port, type FROM metatrader5_masters`
  );
  if (masters.rowCount > 0) {
    masters.rows.map(async (master) => {
      await metatrader5Axios.get(`/Connect`, {
        params: {
          user: master.account_id,
          password: master.account_password,
          host: master.host,
          port: master.port
        }
      })
        .then(async (res) => {
          if (res.status === 200) {
            await client.query(
              `UPDATE metatrader5_masters 
              SET token = '${res.data}' 
              WHERE account_id = '${master.account_id}'
              AND type = '${master.type}'`
            )
            console.log("MT5 Master ----------------------------------------> Success Get Token", res.data);
          }
        })
        .catch(() => {
          console.log("MT5 Server Error Master");
        })
    })
  }
}

//Update Copiers Token

const updateMetatrader5CopiersToken = async () => {
  console.log("MT5-----------------------------------------> Start Update Copiers Token", performance.now());
  const copiers = await client.query(
    `SELECT account_id, account_password, host, port, type FROM metatrader5_copiers`
  );
  if (copiers.rowCount > 0) {
    copiers.rows.map(async (copier) => {
      await metatrader5Axios.get(`/Connect`, {
        params: {
          user: copier.account_id,
          password: copier.account_password,
          host: copier.host,
          port: copier.port
        }
      })
        .then(async (res) => {
          if (res.status === 200) {
            await client.query(
              `UPDATE metatrader5_copiers 
              SET token = '${res.data}' 
              WHERE account_id = '${copier.account_id}'
              AND type = '${copier.type}'`
            )
            console.log("MT5 Copier ----------------------------------------> Success Get Token", res.data)
          }
        })
        .catch(() => {
          console.log("MT5 Server Error Copier");
        })
    })
  }
}

module.exports = { updateMetatrader5MastersToken, updateMetatrader5CopiersToken };

// updateCopiersToken();
// updateMastersToken();

// setInterval(updateCopiersToken, 6 * 60 * 60 * 1000);
// setInterval(updateMastersToken, 6 * 60 * 60 * 1000);

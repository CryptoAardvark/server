const client = require("../../config/db/db.js");
const { metatrader4Axios } = require("../config/metatrader4.config.js");

//Update Masters Token

const updateMetatrader4MastersToken = async () => {
  console.log("MT4 -----------------------------------------> Start Update Masters Token", performance.now());
  const masters = await client.query(
    `SELECT account_id, account_password, host, port, type FROM metatrader_masters`
  );
  if (masters.rowCount > 0) {
    masters.rows.map(async (master) => {
      await metatrader4Axios.get(`/Connect`, {
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
              `UPDATE metatrader_masters 
              SET token = '${res.data}' 
              WHERE account_id = '${master.account_id}'
              AND type = '${master.type}'`
            )
            console.log("MT4 Master ----------------------------------------> Success Get Token", res.data);
          }
        })
        .catch(() => {
          console.log("MT4 Server Error Master");
        })
    })
  }
}

//Update Copiers Token

const updateMetatrader4CopiersToken = async () => {
  console.log("MT4-----------------------------------------> Start Update Copiers Token", performance.now());
  const copiers = await client.query(
    `SELECT account_id, account_password, host, port, type FROM metatrader_copiers`
  );
  if (copiers.rowCount > 0) {
    copiers.rows.map(async (copier) => {
      await metatrader4Axios.get(`/Connect`, {
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
              `UPDATE metatrader_copiers 
              SET token = '${res.data}' 
              WHERE account_id = '${copier.account_id}'
              AND type = '${copier.type}'`
            )
            console.log("MT4 Copier ----------------------------------------> Success Get Token", res.data)
          }
        })
        .catch(() => {
          console.log("MT4 Server Error Copier");
        })
    })
  }
}

module.exports = { updateMetatrader4MastersToken, updateMetatrader4CopiersToken };

// updateCopiersToken();
// updateMastersToken();

// setInterval(updateCopiersToken, 6 * 60 * 60 * 1000);
// setInterval(updateMastersToken, 6 * 60 * 60 * 1000);

const client = require("../../config/db/db.js");
const { tradelockerDemoAxios, tradelockerLiveAxios } = require("../config/tradelocker.config.js");

//Update Masters Token

const updateTradelockerMastersToken = async () => {
  console.log("TL-----------------------------------------> Start Update Masters Token", performance.now());
  const masters = await client.query(
    `SELECT account_id, refresh_token, type, account_email, account_password, account_server_name FROM masters`
  );
  if (masters.rowCount > 0) {
    masters.rows.map(async (master) => {
      const myAxiosRequest = master.type === "tld" ? tradelockerDemoAxios : master.type === "tll" ? tradelockerLiveAxios : "";
      await myAxiosRequest.post(`/auth/jwt/refresh`,
        {
          refreshToken: master.refresh_token
        })
        .then(async (res) => {
          if (res.data.accessToken && res.data.refreshToken) {
            await client.query(
              `UPDATE masters SET access_token = '${res.data.accessToken}', refresh_token = '${res.data.refreshToken}' WHERE account_id = '${master.account_id}'`
            )
            console.log("TL-----------------------------------------> Success Update Masters Token", performance.now());
          }
        })
        .catch(async (err) => {
          if (err.response?.status === 401) {
            await myAxiosRequest.post(`/auth/jwt/token`,
              {
                email: master.account_email,
                password: master.account_password,
                server: master.account_server_name
              })
              .then(async (response) => {
                if (response.data.accessToken && response.data.refreshToken) {
                  await client.query(
                    `UPDATE masters SET access_token = '${response.data.accessToken}', refresh_token = '${response.data.refreshToken}' WHERE account_id = '${master.account_id}'`
                  );
                  console.log("TL-----------------------------------------> Success Update Masters Token", performance.now());
                }
                else console.log("TL Master Get Token Error");
              })
          }
          else console.log("TL Server Error Master");
        })
    })
  }
}

//Update Copiers Token

const updateTradelockerCopiersToken = async () => {
  console.log("TL-----------------------------------------> Start Update Copiers Token", performance.now());
  const copiers = await client.query(
    `SELECT account_id, refresh_token, type, account_email, account_password, account_server_name FROM copiers`
  );
  if (copiers.rowCount > 0) {
    copiers.rows.map(async (copier) => {
      const myAxiosRequest = copier.type === "tld" ? tradelockerDemoAxios : copier.type === "tll" ? tradelockerLiveAxios : "";
      await myAxiosRequest.post(`/auth/jwt/refresh`,
        {
          refreshToken: copier.refresh_token
        })
        .then(async (res) => {
          if (res.data.accessToken && res.data.refreshToken) {
            await client.query(
              `UPDATE copiers SET access_token = '${res.data.accessToken}', refresh_token = '${res.data.refreshToken}' WHERE account_id = '${copier.account_id}'`
            )
            console.log("TL-----------------------------------------> Success Update Copiers Token", performance.now());
          }
        })
        .catch(async (err) => {
          if (err.response?.status === 401) {
            await myAxiosRequest.post(`/auth/jwt/token`,
              {
                email: copier.account_email,
                password: copier.account_password,
                server: copier.account_server_name
              })
              .then(async (response) => {
                if (response.data.accessToken && response.data.refreshToken) {
                  await client.query(
                    `UPDATE copiers SET access_token = '${response.data.accessToken}', refresh_token = '${response.data.refreshToken}' WHERE account_id = '${copier.account_id}'`
                  )
                  console.log("TL-----------------------------------------> Success Update Copiers Token", performance.now());
                }
                else console.log("TL Copier Get Token Error"); 
              })
          }
          else console.log("TL Server Error Copier");
        })
    })
  }
}

module.exports = { updateTradelockerMastersToken, updateTradelockerCopiersToken };

// updateMastersToken();
// updateCopiersToken();

// setInterval(updateMastersToken, 0.5 * 60 * 60 * 1000);
// setInterval(updateCopiersToken, 0.5 * 60 * 60 * 1000);
const client = require("../../config/db/db.js");
const { tradelockerDemoAxios, tradelockerLiveAxios } = require("../config/tradelocker.config.js");

const getTradelockerCopiersPL = async () => {
  const copierData = await client.query(
    `SELECT * FROM copiers`
  );
  if (copierData.rowCount === 0) {
    console.log("Tradelocker-master ----------> get copiers from database error");
    return;
  }
  const promises = copierData.rows.map(async (copier) => {
    const myAxiosRequest = copier.type === "tld" ? tradelockerDemoAxios : copier.type === "tll" ? tradelockerLiveAxios : "";
    await myAxiosRequest.get(`/trade/accounts/${copier.account_id}/positions`, {
      headers: {
        'accept': 'application/json',
        'Authorization': `Bearer ${copier.access_token}`,
        'accNum': `${copier.acc_num}`
      }
    }).then(async (copier_positions_res) => {
      if (copier_positions_res.data.s !== "ok") {
        console.log("Tradelocker-master ----------> get copier account positions request not success");
        return;
      }
      
      const all_accounts = await myAxiosRequest.get(`/auth/jwt/all-accounts`, {
        headers: {
          'accept': 'application/json',
          'Authorization': `Bearer ${copier.access_token}`
        }
      });
      const current_account = await all_accounts.data.accounts.find(acc => acc.id === copier.account_id);
      if (current_account) {
        await client.query(
          `UPDATE copiers
            SET account_balance = $1
            WHERE account_id = '${copier.account_id}'
            AND type = '${copier.type}'`,
          [
            parseFloat(current_account.accountBalance)
          ]
        )
      }

      const copier_positions = copier_positions_res.data.d.positions;
      const history_positions = copier.history_positions;
      const add_remove_requests = (callback) => {
        history_positions?.map(async (history_position) => {
          const cur_position = copier_positions?.find(position => history_position[0] === position[0])
          if (cur_position) {
            const balance_pl_pairs = copier.balance_pl_pairs;
            const removed_pl = balance_pl_pairs?.find(item => item.position_id === cur_position[0]);
            const updated_pl = {
              ...removed_pl,
              pl: parseFloat(cur_position[9]),
              fee: parseFloat(cur_position[4])
            }
            if (!removed_pl) {
              console.log("Tradelocker-master ----------> removed_pl no exist");
              return;
            }
            await client.query(
              `UPDATE copiers 
                SET balance_pl_pairs = array_remove(balance_pl_pairs, $1) 
                WHERE account_id = '${copier.account_id}'
                AND type = '${copier.type}'`,
              [
                removed_pl
              ]
            );
            await client.query(
              `UPDATE copiers 
                SET balance_pl_pairs = array_append(balance_pl_pairs, $1) 
                WHERE account_id = '${copier.account_id}'
                AND type = '${copier.type}'`,
              [
                JSON.stringify(updated_pl)
              ]
            );
          }
          else {
            const balance_pl_pairs = copier.balance_pl_pairs;
            const removed_pl = balance_pl_pairs?.find(item => item.position_id === history_position[0]);
            console.log("removed pl", removed_pl);
            if (!removed_pl) {
              console.log("Tradelocker-master ----------> removed_pl no exist");
              return;
            }
            const myDate = new Date();
            const formattedDate = myDate.toISOString();
            const account_pl = await client.query(
              `SELECT avg_pl, 
                total_pl_amount,
                position_pair 
                FROM copiers WHERE 
                account_id = '${copier.account_id}'
                AND type = '${copier.type}'`
            );
            let prev_pl = 0;
            if (account_pl.rowCount > 0 && account_pl.rows[0].avg_pl) prev_pl = account_pl.rows[0].avg_pl;
            const close_pl = ((removed_pl.pl - removed_pl.fee) / removed_pl.balance) * 100;
            if (close_pl > 0) {
              await client.query(
                `UPDATE copiers 
                  SET win_count = win_count + 1 
                  WHERE account_id = '${copier.account_id}'
                  AND type = '${copier.type}'`
              )
            }
            else {
              await client.query(
                `UPDATE copiers 
                  SET lose_count = lose_count + 1 
                  WHERE account_id = '${copier.account_id}'
                  AND type = '${copier.type}'`
              )
            }
            const current_pl = prev_pl + close_pl;
            const cur_pl = {
              date: formattedDate,
              balance: removed_pl.balance,
              pl: removed_pl.pl - removed_pl.fee,
              avg_pl: current_pl,
              total_pl_amount: account_pl.rows[0].total_pl_amount + removed_pl.pl - removed_pl.fee
            }
            await client.query(
              `UPDATE copiers 
                SET copier_pl = array_append(copier_pl, $1), 
                avg_pl = $2, 
                total_pl_amount = total_pl_amount + $3,
                balance_pl_pairs = array_remove(balance_pl_pairs, $4)
                WHERE account_id = '${copier.account_id}'
                AND type = '${copier.type}'`,
              [
                JSON.stringify(cur_pl),
                current_pl,
                (removed_pl.pl - removed_pl.fee),
                removed_pl
              ]
            );

            const position_pair = account_pl.rows[0].position_pair;
            const exist_one = position_pair?.find(item => item.copier_position_id === history_position[0]);
            if (exist_one) {
              await client.query(
                `UPDATE copiers
                SET position_pair = array_remove(position_pair, $1)
                WHERE account_id = '${copier.account_id}'
                AND type = '${copier.type}'`,
                [
                  exist_one
                ]
              )
            }
          }
        });

        copier_positions.map(async (current_position) => {
          const cur_position = history_positions?.find(position => current_position[0] === position[0]);
          if (cur_position) return;
          const balance_pl = {
            position_id: current_position[0],
            balance: parseFloat(current_account.accountBalance),
            pl: parseFloat(current_position[9]),
            fee: parseFloat(current_position[4] * 7)
          }
          await client.query(
            `UPDATE copiers 
              SET balance_pl_pairs = array_append(balance_pl_pairs, $1) 
              WHERE account_id = '${copier.account_id}'
              AND type = '${copier.type}'`,
            [
              balance_pl
            ]
          );
        })
        callback();
      }
      const set_history_position = async () => {
        await client.query(
          `UPDATE copiers 
            SET history_positions = $1 
            WHERE account_id = '${copier.account_id}'
            AND type = '${copier.type}'`,
          [
            copier_positions
          ]
        );
      }
      add_remove_requests(function () {
        set_history_position();
      })
    }).catch((err) => {
      console.log("Tradelocker-master ----------> get copier account positions error", err.response?.data);
    })
  });
  await Promise.all(promises);
}

module.exports = { getTradelockerCopiersPL };

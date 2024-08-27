const client = require("../../config/db/db.js");
const { metatrader4Axios } = require("../config/metatrader4.config.js");

const getMetatrader4CopiersPL = async () => {
  const copierData = await client.query(
    `SELECT * FROM metatrader_copiers`
  );
  if (copierData.rowCount === 0) {
    console.log("getCopiersPL -----------> get copierData from database Error!");
    return;
  }
  const promises = copierData.rows.map(async (copier) => {
    await metatrader4Axios.get(`/AccountSummary`, {
      params: {
        id: copier.token
      }
    }).then(async (res) => {
      await client.query(
        `UPDATE metatrader_copiers
          SET account_balance = $1
          WHERE account_id = '${copier.account_id}'
          AND type = '${copier.type}'`,
        [
          res.data.balance
        ]
      );
    }).catch(() => {
      console.log("mt4 getCopiersPL ----------> Get Copiers PL Account Summary Request Error!");
    });
    await metatrader4Axios.get(`/OpenedOrders`, {
      params: {
        id: copier.token
      }
    }).then(async (copier_orders_res) => {
      if (copier_orders_res.status !== 200) {
        console.log("mt4 getCopiersPL ----------> Get Opened Orders Request Error!");
        return;
      }

      const copier_orders = copier_orders_res.data;
      const history_orders = copier.history_orders;
      const add_remove_requests = (callback) => {
        history_orders?.map(async (history_order) => {
          const cur_order = copier_orders?.find(order => history_order.ticket === order.ticket)
          if (!cur_order) {
            const balance_order_pairs = copier.balance_order_pairs;
            const removed_pl = balance_order_pairs?.find(item => item.order_id === history_order.ticket);
            if (!removed_pl) {
              console.log("getCopiersPL ----------> removed_pl no exist!");
              return;
            }
            const myDate = new Date();
            const formattedDate = myDate.toISOString();
            const account_pl = await client.query(
              `SELECT avg_pl, 
                total_pl_amount 
                FROM metatrader_copiers 
                WHERE account_id = '${copier.account_id}'
                AND type = '${copier.type}'`
            );
            let prev_pl = 0;
            if (account_pl.rowCount > 0 && account_pl.rows[0].avg_pl) prev_pl = account_pl.rows[0].avg_pl;
            const real_pl = history_order.profit - history_order.commission;
            const close_pl = (real_pl / removed_pl.balance) * 100;
            if (close_pl > 0) {
              await client.query(
                `UPDATE metatrader_copiers 
                  SET win_count = win_count + 1 
                  WHERE account_id = '${copier.account_id}'
                  AND type = '${copier.type}'`
              )
            }
            else {
              await client.query(
                `UPDATE metatrader_copiers 
                  SET lose_count = lose_count + 1 
                  WHERE account_id = '${copier.account_id}'
                  AND type = '${copier.type}'`
              )
            }
            const current_pl = prev_pl + close_pl;
            const cur_pl = {
              date: formattedDate,
              balance: removed_pl.balance,
              pl: real_pl,
              avg_pl: current_pl,
              total_pl_amount: account_pl.rows[0].total_pl_amount + real_pl
            }
            await client.query(
              `UPDATE metatrader_copiers 
                SET copier_pl = array_append(copier_pl, $1), 
                avg_pl = $2, 
                total_pl_amount = total_pl_amount + $3,
                balance_order_pairs = array_remove(balance_order_pairs, $4)
                WHERE account_id = '${copier.account_id}'
                AND type = '${copier.type}'`,
              [
                JSON.stringify(cur_pl),
                current_pl, real_pl,
                removed_pl
              ]
            );
          }
        })
        copier_orders.map(async (current_order) => {
          const cur_order = history_orders?.find(order => current_order.ticket === order.ticket);
          if (cur_order) return;
          const acc_balance = await client.query(
            `SELECT account_balance 
              FROM metatrader_copiers 
              WHERE account_id = '${copier.account_id}'
              AND type = '${copier.type}'`
          );
          if (acc_balance.rowCount === 0) {
            console.log("getCopiersPL ----------> get account_balance from database error!");
            return;
          }
          const balance_order = {
            order_id: current_order.ticket,
            balance: acc_balance.rows[0].account_balance
          }
          await client.query(
            `UPDATE metatrader_copiers 
              SET balance_order_pairs = array_append(balance_order_pairs, $1) 
              WHERE account_id = '${copier.account_id}'
              AND type = '${copier.type}'`,
            [
              balance_order
            ]
          );
          // console.log(new Date(new Date(current_order.openTime) - 500000))
          const copier_orders_history = await metatrader4Axios.get(`/OrderHistory`, {
            params: {
              id: copier.token,
              from: new Date(new Date(current_order.openTime) - 5000000)
            }
          });
          if (copier_orders_history.status !== 200) return;
          const copier_orders_history_data = copier_orders_history.data;
          const exist_order = copier_orders_history_data.reverse().find(item => item.openTime === current_order.openTime);
          if (exist_order) {
            const order_pair = copier.order_pair;
            const remove_pair = order_pair.find(item => item.copier_order_id === exist_order.ticket);
            const update_pair = {
              ...remove_pair,
              copier_order_id: current_order.ticket
            }
            await client.query(
              `UPDATE metatrader_copiers
                SET order_pair = array_remove(order_pair, $1)
                WHERE account_id = '${copier.account_id}'
                AND type = '${copier.type}'`,
              [
                remove_pair
              ]
            );
            await client.query(
              `UPDATE metatrader_copiers
                SET order_pair = array_append(order_pair, $1)
                WHERE account_id = '${copier.account_id}'
                AND type = '${copier.type}'`,
              [
                update_pair
              ]
            );
          }
        })
        callback();
      }
      const set_history_orders = async () => {
        await client.query(
          `UPDATE metatrader_copiers 
            SET history_orders = $1 
            WHERE account_id = '${copier.account_id}'
            AND type = '${copier.type}'`,
          [
            copier_orders
          ]
        );
      }
      add_remove_requests(function () {
        set_history_orders();
      })
    }).catch(() => {
      console.log("mt4 getCopiersPL ----------> Get Opened Orders Request Error")
    })
  });
  await Promise.all(promises);
}

module.exports = { getMetatrader4CopiersPL };
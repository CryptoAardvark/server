const client = require("../../config/db/db.js");
const axios = require("axios");
const { metatrader4Axios } = require("../config/metatrader4.config.js");
const { metatrader5Axios } = require("../config/metatrader5.config.js");
const { TRADELOCKER_DEMO_BASIC_URL, TRADELOCKER_LIVE_BASIC_URL, tradelockerDemoAxios, tradelockerLiveAxios } = require("../config/tradelocker.config.js");

//This function is to initialize the previous positions (history_positions) of metatrader_masters in database before start trading

const getMetatrader4MasterHistoryOrders = async (callback) => {
  console.log("getMetatrader4MasterHistoryOrders ---------> Start", performance.now());
  const masterData = await client.query(
    `SELECT * FROM metatrader_masters`
  );

  const getMasterHistoryP = masterData.rows?.map(async (master) => {
    await metatrader4Axios.get('/OpenedOrders', {
      params: {
        id: master.token
      }
    }).then(async (res) => {
      if (res.status !== 200) {
        console.log("getMetatrader4MasterHistoryOrders -------------> get Opened Orders Request Error", res.data);
        return;
      }
      const master_orders = res.data;
      let temp_data = [];
      await master_orders.map((order) => {
        const match_order = master.balance_order_pairs?.find(item => item?.order_id === order.ticket);
        if (match_order) temp_data.push(match_order);
      });
      await client.query(
        `UPDATE metatrader_masters 
        SET history_orders = $1,
        balance_order_pairs = $2
        WHERE account_id = '${master.account_id}'
        AND type = '${master.type}'`,
        [
          master_orders,
          temp_data
        ]
      );
      console.log("getMetatrader4MasterHistoryOrders ------------> get Opened Orders Success", performance.now());
    }).catch((err) => {
      console.log("getMetatrader4MasterHistoryOrders -------------> get Opened Orders Error", err);
    })
  })
  await Promise.all(getMasterHistoryP);
  callback();
}

//This function is to initialize the order_pair of copiers in database before start trading

const getMetatrader4OrderPair = async (callback) => {
  console.log("getMetatrader4OrderPair --------> Start get Order Pair", performance.now());
  const copierData = await client.query(
    `SELECT balance_order_pairs,
      order_pair, 
      account_id, 
      my_master_id, 
      my_master_type, 
      token, 
      type FROM metatrader_copiers`
  );
  if (copierData.rowCount === 0) {
    console.log("getMetatrader4OrderPair ------> Get Copier Data from database Error!");
    return;
  }
  for (let i = 0; i < copierData.rowCount; i++) {
    const copier = copierData.rows[i];
    if (copier.my_master_type === 'mt4') {
      const master = await client.query(
        `SELECT token 
          FROM metatrader_masters 
          WHERE account_id = $1
          AND type = $2`,
        [
          copier.my_master_id,
          copier.my_master_type
        ]
      );
      if (master.rowCount === 0) {
        console.log("getMetatrader4OrderPair ---------> Get Master Data from MT4 database Error!");
        return;
      }
      await metatrader4Axios.get(`/OpenedOrders`, {
        params: {
          id: copier.token
        }
      }).then(async (response) => {
        if (response.status !== 200) {
          console.log("getMetatrader4OrderPair ------> Get Opened Orders Request Error!");
        }
        await metatrader4Axios.get(`/OpenedOrders`, {
          params: {
            id: master.rows[0].token
          }
        }).then(async (master_response) => {
          if (master_response.status !== 200) {
            console.log("getMetatrader4OrderPair ------> Get Opened Orders Request Error!");
            return;
          }
          const copier_orders = response.data;
          let temp_data = [];
          await copier_orders.map((order) => {
            const match_order = copier.balance_order_pairs?.find(item => item?.order_id === order.ticket);
            if (match_order) temp_data.push(match_order);
          });
          console.log(temp_data);
          await client.query(
            `UPDATE metatrader_copiers 
            SET balance_order_pairs = $1
            WHERE account_id = '${copier.account_id}'
            AND type = '${copier.type}'`,
            [
              temp_data
            ]
          );
          await copier.order_pair?.map(async (pair) => {
            const exist_copier_order = await response.data?.find(item => item.ticket === pair.copier_order_id);
            const exist_master_order = await master_response.data?.find(item => item.ticket === pair.master_order_id);
            if (!exist_copier_order || !exist_master_order) {
              await client.query(
                `UPDATE metatrader_copiers 
                  SET order_pair = array_remove(order_pair, $1) 
                  WHERE account_id = $2
                  AND type = '${copier.type}'`,
                [
                  pair,
                  copier.account_id
                ]
              )
            }
          });
          console.log("Get Metatrader4 Order Pair success", performance.now());
        })
      }).catch(() => {
        console.log("!!!!!!!!!!Get Metatrader4 Opened Order Error.");
      })
    }
    if (copier.my_master_type === 'mt5') {
      const master = await client.query(
        `SELECT token 
          FROM metatrader5_masters 
          WHERE account_id = $1
          AND type = $2`,
        [
          copier.my_master_id,
          copier.my_master_type
        ]
      );
      if (master.rowCount === 0) {
        console.log("getMetatrader4OrderPair ---------> Get Master Data from mt5 database Error!");
        return;
      }
      await metatrader4Axios.get(`/OpenedOrders`, {
        params: {
          id: copier.token
        }
      }).then(async (response) => {
        if (response.status !== 200) {
          console.log("getMetatrader4OrderPair ------> Get Opened Orders Request Error!");
        }
        await metatrader5Axios.get(`/OpenedOrders`, {
          params: {
            id: master.rows[0].token
          }
        }).then(async (master_response) => {
          if (master_response.status !== 200) {
            console.log("getMetatrader4OrderPair ------> Get Opened Orders Request Error!");
            return;
          }
          const copier_orders = response.data;
          let temp_data = [];
          await copier_orders.map((order) => {
            const match_order = copier.balance_order_pairs?.find(item => item?.order_id === order.ticket);
            if (match_order) temp_data.push(match_order);
          });
          console.log(temp_data);
          await client.query(
            `UPDATE metatrader_copiers 
            SET balance_order_pairs = $1
            WHERE account_id = '${copier.account_id}'
            AND type = '${copier.type}'`,
            [
              temp_data
            ]
          );
          await copier.order_pair?.map(async (pair) => {
            const exist_copier_order = await response.data.find(item => item.ticket === pair.copier_order_id);
            const exist_master_order = await master_response.data.find(item => item.ticket === pair.master_order_id);
            if (!exist_copier_order || !exist_master_order) {
              await client.query(
                `UPDATE metatrader_copiers 
                  SET order_pair = array_remove(order_pair, $1) 
                  WHERE account_id = '${copier.account_id}'
                  AND type = '${copier.type}'`,
                [
                  pair
                ]
              )
            }
          });
          console.log("Get Metatrader4 Order Pair success", performance.now());
        })
      }).catch(() => {
        console.log("!!!!!!!!!!Get Metatrader4 Opened Order Error.");
      })
    }
    if (copier.my_master_type === 'tld' || copier.my_master_type === 'tll') {
      const master = await client.query(
        `SELECT acc_num,
          access_token
          FROM masters
          WHERE account_id = $1
          AND type = $2`,
        [
          copier.my_master_id,
          copier.my_master_type
        ]
      );
      if (master.rowCount === 0) {
        return;
      }
      await metatrader4Axios.get(`/OpenedOrders`, {
        params: {
          id: copier.token
        }
      }).then(async (response) => {
        if (response.status !== 200) {
          console.log("getMetatrader4OrderPair ------> Get Opened Orders Request Error!");
        }
        const myAxiosRequest = copier.my_master_type === "tld" ? tradelockerDemoAxios : copier.my_master_type === "tll" ? tradelockerLiveAxios : "";
        await myAxiosRequest.get(`/trade/accounts/${copier.my_master_id}/positions`, {
          headers: {
            'accept': 'application/json',
            'Authorization': `Bearer ${master.rows[0].access_token}`,
            'accNum': `${master.rows[0].acc_num}`
          }
        }).then(async (master_response) => {
          if (master_response.data.s !== "ok") {
            console.log("getMetatrader4OrderPair ----------> get Accounts positions not success");
            return;
          }
          const copier_orders = response.data;
          let temp_data = [];
          await copier_orders.map((order) => {
            const match_order = copier.balance_order_pairs?.find(item => item?.order_id === order.ticket);
            if (match_order) temp_data.push(match_order);
          });
          console.log(temp_data);
          await client.query(
            `UPDATE metatrader_copiers 
              SET balance_order_pairs = $1
              WHERE account_id = '${copier.account_id}'
              AND type = '${copier.type}'`,
            [
              temp_data
            ]
          );
          await copier.order_pair?.map(async (pair) => {
            const exist_copier_position = await response.data.find(item => item.ticket === pair.copier_order_id);
            const exist_master_position = await master_response.data.d.positions.find(item => item[0] === pair.master_position_id);
            if (!exist_copier_position || !exist_master_position) {
              await client.query(
                `UPDATE metatrader_copiers 
                  SET order_pair = array_remove(order_pair, $1) 
                  WHERE account_id = $2`,
                [
                  pair,
                  copier.account_id
                ]
              )
            }
          });
          console.log("getMetatrader4OrderPair ----------> Get Accounts Position Pair success", performance.now());
        }).catch((err) => {
          console.log("!!!!!!!!!!getMetatrader4OrderPair ----------> get master accounts positions request error", err.response);
        })
      })
    }
    console.log("mt4 my master id", copier.my_master_id)
    console.log("---------------> performance <----------------", performance.now())
  }
  callback();
}

let indexNum = 0;
//This function is the main function that trade by interval
//First, get all masters data from masters table of database and get all copiers corresponding to each master from tData table of database

//this function is to get random number for takeProfit and stopLoss
function getRandomNumber(min, max, criteria) {
  console.log(max - min, criteria);
  return (max - min) > criteria ? Math.floor(Math.random() * criteria * 1000) / 1000 : Math.floor(Math.random() * (max - min) * 1000) / 1000 + min;
}

const runMetatrader4TradingFunction = async () => {
  indexNum++;
  console.log(indexNum, "metatrader4-master ----------> Start Run Trading Function", performance.now());
  //get all masters data
  const masterData = await client.query(
    `SELECT * FROM metatrader_masters`
  );

  //for each master
  const promises = masterData.rows.map(async (master) => {
    const contractData = await client.query(
      `SELECT * FROM contract 
        WHERE master_acc_id = $1 
        AND master_acc_type = $2`,
      [
        master.account_id,
        master.type
      ]
    );
    await metatrader4Axios.get('/CheckConnect', {
      params: {
        id: master.token
      }
    }).then(async (isConnected) => {
      if (isConnected.status !== 200) {
        console.log("metatrader4-master ----------> connection to server error");
        return;
      }
      await metatrader4Axios.get('/AccountSummary', {
        params: {
          id: master.token
        }
      }).then(async (summary) => {
        if (summary.status !== 200) {
          console.log("metatrader4-master ----------> get Account Summary Request Error");
          return;
        }
        await client.query(
          `UPDATE metatrader_masters 
            SET account_balance = $1
            WHERE account_id = '${master.account_id}'
            AND type = '${master.type}'`,
          [
            summary.data.balance
          ]
        )
      }).catch(() => {
        console.log("metatrader4-master ----------> get Account Summary Time out error");
      });
      if (master.follows === 0) return;
      await metatrader4Axios.get('/OpenedOrders', {
        params: {
          id: master.token
        }
      }).then(async (response) => {
        if (response.status !== 200) {
          console.log("metatrader4-master ----------> get Opened Orders Error!");
          return;
        }

        const master_opened_orders = response.data;
        const history_orders = master.history_orders;
        //this is the main part that can add, modify or remove orders
        const add_remove_requests = async (callback) => {
          //remove or modify part
          history_orders?.map(async (history_order) => {
            const exist_order = master_opened_orders.find(item => item.ticket === history_order.ticket);
            if (
              exist_order &&
              exist_order.takeProfit === history_order.takeProfit &&
              exist_order.stopLoss === history_order.stopLoss &&
              exist_order.lots === history_order.lots
            ) return;

            const master_database_set = async () => {
              const myDate = new Date();
              const formattedDate = myDate.toISOString();
              const pair_data = await client.query(
                `SELECT balance_order_pairs, 
                  avg_pl, 
                  total_pl_amount, 
                  win_count, 
                  lose_count 
                  FROM metatrader_masters 
                  WHERE account_id = '${master.account_id}'
                  AND type = '${master.type}'`
              );
              const real_pl = history_order.profit + history_order.commission;
              const balance_data = pair_data.rows[0].balance_order_pairs?.find(item => item.order_id === history_order.ticket);
              if (!balance_data) return;
              const percentage_pl = (real_pl / balance_data.balance) * 100;
              const avg_pl = pair_data.rows[0].avg_pl + percentage_pl;
              const total_pl = pair_data.rows[0].total_pl_amount + real_pl;
              const cur_pl = {
                balance: balance_data.balance,
                avg_pl: avg_pl,
                total_pl_amount: total_pl,
                pl: real_pl,
                date: formattedDate
              }
              await client.query(
                `UPDATE metatrader_masters
                  SET master_pl = array_append(master_pl, $1),
                  balance_order_pairs = array_remove(balance_order_pairs, $2),
                  avg_pl = $3,
                  total_pl_amount = $4,
                  win_count = $5,
                  lose_count = $6
                  WHERE account_id = '${master.account_id}'
                  AND type = '${master.type}'`,
                [
                  JSON.stringify(cur_pl),
                  balance_data,
                  avg_pl,
                  total_pl,
                  real_pl > 0 ? parseInt(pair_data.rows[0].win_count) + 1 : parseInt(pair_data.rows[0].win_count),
                  real_pl < 0 ? parseInt(pair_data.rows[0].lose_count) + 1 : parseInt(pair_data.rows[0].lose_count)
                ]
              )
            }

            const order_remove = async () => {
              contractData.rows.map(async (row) => {
                const copier_acc_id = row.copier_acc_id;
                const copier_acc_type = row.copier_acc_type;
                if (copier_acc_type === "mt4") {
                  const mt4_copier_account = await client.query(
                    `SELECT * FROM metatrader_copiers 
                      WHERE account_id = '${copier_acc_id}' 
                      AND type = '${copier_acc_type}'`
                  );
                  if (mt4_copier_account.rowCount === 0) return;
                  const trading_type = mt4_copier_account.rows[0].trading_type;
                  const follow_tp_st = mt4_copier_account.rows[0].follow_tp_st;
                  const order_pairs = mt4_copier_account.rows[0].order_pair;
                  const pair = order_pairs?.find(item => item.master_order_id === history_order.ticket);
                  if (exist_order && (exist_order.takeProfit !== history_order.takeProfit || exist_order.stopLoss !== history_order.stopLoss)) {
                    if (row.status !== 'Running' || !pair) return;
                    console.log("MMMMMMMMMMMMMMMMMMMMMMMMMMMMMM");
                    const stopLoss = (follow_tp_st.stop_loss && exist_order.stopLoss > 0) ? exist_order.stopLoss + getRandomNumber(0.001, 0.01, exist_order.type === "Buy" ? exist_order.closePrice - exist_order.stopLoss : 0.01) : history_order.stopLoss;
                    const takeProfit = (follow_tp_st.take_profit && exist_order.takeProfit > 0) ? exist_order.takeProfit + getRandomNumber(0.001, 0.01, exist_order.type === "Sell" ? exist_order.openPrice - exist_order.takeProfit : 0.01) : history_order.takeProfit;
                    console.log(stopLoss, takeProfit)
                    await metatrader4Axios.get('/OrderModify', {
                      params: {
                        id: mt4_copier_account.rows[0].token,
                        ticket: pair.copier_order_id,
                        stoploss: stopLoss,
                        takeprofit: takeProfit,
                      }
                    }).then(async (modify_response) => {
                      if (modify_response.status === 200) {
                        console.log("metatrader4-master ----------> metatrader4 modify success", performance.now());
                      }
                    }).catch(() => {
                      console.log("metatrader4-master ----------> metatrader4 modify error");
                    })
                  }
                  if (!exist_order) {
                    const master_orders_history = await metatrader4Axios.get(`/OrderHistory`, {
                      params: {
                        id: master.token,
                        from: new Date(new Date(history_order.openTime) - 5000000)
                      }
                    });
                    let real_lot_size;
                    let volume = -1;
                    let one_exist_order;
                    if (master_orders_history.status === 200) {
                      const master_orders_history_data = master_orders_history.data;
                      one_exist_order = master_orders_history_data.reverse().find(item => item.openTime === history_order.openTime);
                      if (one_exist_order.lots === history_order.lots) {
                        real_lot_size = 0;
                        master_database_set();
                        if (row.status !== 'Running' && pair) {
                          await client.query(
                            `UPDATE metatrader_copiers
                                SET order_pair = array_remove(order_pair, $1)
                                WHERE account_id = '${copier_acc_id}'
                                AND type = '${copier_acc_type}'`,
                            [
                              pair
                            ]
                          );
                        }
                      }
                      else {
                        if (!pair) return;
                        const copier_order = mt4_copier_account.rows[0].history_orders?.find(item => item.ticket === pair.copier_order_id);
                        switch (trading_type) {
                          case 'fixed':
                            volume = Math.floor(((one_exist_order.lots * 100) / (history_order.lots * 100)) * copier_order.lots * 100) / 100;
                            real_lot_size = volume;
                            if (volume >= copier_order.lots) real_lot_size = 0;
                            console.log(indexNum, "fixed", volume);
                            break;
                          case 'general':
                            volume = one_exist_order.lots;
                            real_lot_size = volume;
                            if (volume >= copier_order.lots) real_lot_size = 0;
                            console.log(indexNum, "general", volume);
                            break;
                          case 'rate':
                            const temp_lots = Math.floor((mt4_copier_account.rows[0].account_balance / master.account_balance) * one_exist_order.lots * 100) / 100;
                            // if (temp_lots < 0.01) volume = 0.01;
                            volume = temp_lots;
                            real_lot_size = volume;
                            if (volume >= copier_order.lots) real_lot_size = 0;
                            console.log(indexNum, "rate", volume, real_lot_size, copier_order.lots);
                            break;
                        }
                      }
                    }
                    if (!pair) return;
                    const master_order_comment = one_exist_order.comment;
                    const master_split = master_order_comment.split("#");
                    const master_new_order_id = parseInt(master_split[1]);
                    if (real_lot_size === 0 && volume === 0) {
                      await client.query(
                        `UPDATE metatrader_copiers
                            SET order_pair = array_remove(order_pair, $1)
                            WHERE account_id = '${copier_acc_id}'
                            AND type = '${copier_acc_type}'`,
                        [
                          pair
                        ]
                      );
                      const update_pair = {
                        ...pair,
                        master_order_id: master_new_order_id
                      }
                      await client.query(
                        `UPDATE metatrader_copiers
                            SET order_pair = array_append(order_pair, $1)
                            WHERE account_id = '${copier_acc_id}'
                            AND type = '${copier_acc_type}'`,
                        [
                          update_pair
                        ]
                      );
                      return;
                    }
                    if (row.status !== 'Running') return;
                    await metatrader4Axios.get('/OrderClose', {
                      params: {
                        id: mt4_copier_account.rows[0].token,
                        ticket: pair.copier_order_id,
                        lots: real_lot_size
                      }
                    }).then(async (closed_order) => {
                      if (closed_order.status !== 200) return;

                      const closed_order_comment = closed_order.data.comment;
                      if (real_lot_size > 0 && closed_order_comment.includes("to")) {
                        const temp_split = closed_order_comment.split("#");
                        const new_order_id = parseInt(temp_split[1]);
                        await client.query(
                          `UPDATE metatrader_copiers
                            SET order_pair = array_remove(order_pair, $1)
                            WHERE account_id = '${copier_acc_id}'
                            AND type = '${copier_acc_type}'`,
                          [
                            pair
                          ]
                        );
                        const update_pair = {
                          master_order_id: master_new_order_id,
                          copier_order_id: new_order_id
                        }
                        await client.query(
                          `UPDATE metatrader_copiers
                            SET order_pair = array_append(order_pair, $1)
                            WHERE account_id = '${copier_acc_id}'
                            AND type = '${copier_acc_type}'`,
                          [
                            update_pair
                          ]
                        );
                      }
                      console.log("metatrader4-master ----------> close metatrader4 success", performance.now())
                    }).catch(() => {
                      console.log("metatrader4-master ----------> metatrader4 order close error");
                    });
                  }
                }
                if (copier_acc_type === "mt5") {
                  const mt5_copier_account = await client.query(
                    `SELECT * FROM metatrader5_copiers 
                      WHERE account_id = '${copier_acc_id}' 
                      AND type = '${copier_acc_type}'`
                  );
                  if (mt5_copier_account.rowCount === 0) return;
                  const trading_type = mt5_copier_account.rows[0].trading_type;
                  const follow_tp_st = mt5_copier_account.rows[0].follow_tp_st;
                  const order_pairs = mt5_copier_account.rows[0].order_pair;
                  const pair = order_pairs?.find(item => item.master_order_id === history_order.ticket);
                  if (exist_order && (exist_order.takeProfit !== history_order.takeProfit || exist_order.stopLoss !== history_order.stopLoss)) {
                    if (row.status !== 'Running' || !pair) return;
                    const stopLoss = (follow_tp_st.stop_loss && exist_order.stopLoss > 0) ? exist_order.stopLoss + getRandomNumber(0.001, 0.01, exist_order.type === "Buy" ? exist_order.closePrice - exist_order.stopLoss : 0.01) : history_order.stopLoss;
                    const takeProfit = (follow_tp_st.take_profit && exist_order.takeProfit > 0) ? exist_order.takeProfit + getRandomNumber(0.001, 0.01, exist_order.type === "Sell" ? exist_order.openPrice - exist_order.takeProfit : 0.01) : history_order.takeProfit;
                    await metatrader5Axios.get('/OrderModify', {
                      params: {
                        id: mt5_copier_account.rows[0].token,
                        ticket: pair.copier_order_id,
                        stoploss: stopLoss,
                        takeprofit: takeProfit,
                      }
                    }).then(async (modify_response) => {
                      if (modify_response.status === 200) {
                        console.log("metatrader4-master ----------> metatrader5 modify success", performance.now());
                      }
                    }).catch(() => {
                      console.log("metatrader4-master ----------> metatrader5 modify error");
                    })
                  }
                  if (!exist_order) {
                    const master_orders_history = await metatrader4Axios.get(`/OrderHistory`, {
                      params: {
                        id: master.token,
                        from: new Date(new Date(history_order.openTime) - 5000000)
                      }
                    });
                    let real_lot_size;
                    let volume = -1;
                    let one_exist_order;
                    if (master_orders_history.status === 200) {
                      const master_orders_history_data = master_orders_history.data;
                      one_exist_order = master_orders_history_data.reverse().find(item => item.openTime === history_order.openTime);
                      if (one_exist_order.lots === history_order.lots) {
                        real_lot_size = 0;
                        master_database_set();
                        if (row.status !== 'Running' && pair) {
                          await client.query(
                            `UPDATE metatrader_copiers
                              SET order_pair = array_remove(order_pair, $1)
                              WHERE account_id = '${copier_acc_id}'
                              AND type = '${copier_acc_type}'`,
                            [
                              pair
                            ]
                          );
                        }
                      }
                      else {
                        if (!pair) return;
                        const copier_order = mt5_copier_account.rows[0].history_orders?.find(item => item.ticket === pair.copier_order_id);
                        switch (trading_type) {
                          case 'fixed':
                            volume = Math.floor(((one_exist_order.lots * 100) / (history_order.lots * 100)) * copier_order.lots * 100) / 100;
                            real_lot_size = volume;
                            if (volume >= copier_order.lots) real_lot_size = 0;
                            console.log(indexNum, "fixed", volume);
                            break;
                          case 'general':
                            volume = one_exist_order.lots;
                            real_lot_size = volume;
                            if (volume >= copier_order.lots) real_lot_size = 0;
                            console.log(indexNum, "general", volume);
                            break;
                          case 'rate':
                            const temp_lots = Math.floor(((mt5_copier_account.rows[0].account_balance * 100) / (master.account_balance * 100)) * one_exist_order.lots * 100) / 100;
                            // if (temp_lots < 0.01) volume = 0.01;
                            volume = temp_lots;
                            real_lot_size = volume;
                            if (volume >= copier_order.lots) real_lot_size = 0;
                            console.log(indexNum, "rate", volume, real_lot_size, copier_order.lots);
                            break;
                        }
                      }
                    }
                    if (!pair) return;
                    const master_order_comment = one_exist_order.comment;
                    console.log(indexNum, "master_order_comment", master_order_comment, performance.now());
                    const master_split = master_order_comment.split("#");
                    const master_new_order_id = parseInt(master_split[1]);
                    if (real_lot_size === 0 && volume === 0) {
                      await client.query(
                        `UPDATE metatrader5_copiers
                            SET order_pair = array_remove(order_pair, $1)
                            WHERE account_id = '${copier_acc_id}'
                            AND type = '${copier_acc_type}'`,
                        [
                          pair
                        ]
                      );
                      const update_pair = {
                        ...pair,
                        master_order_id: master_new_order_id
                      }
                      await client.query(
                        `UPDATE metatrader5_copiers
                            SET order_pair = array_append(order_pair, $1)
                            WHERE account_id = '${copier_acc_id}'
                            AND type = '${copier_acc_type}'`,
                        [
                          update_pair
                        ]
                      );
                      return;
                    }
                    if (row.status !== 'Running') return;
                    await metatrader5Axios.get('/OrderClose', {
                      params: {
                        id: mt5_copier_account.rows[0].token,
                        ticket: pair.copier_order_id,
                        lots: real_lot_size
                      }
                    }).then(async (closed_order) => {
                      if (closed_order.status !== 200) return;
                      const new_order_id = closed_order.data.ticket;
                      if (real_lot_size > 0) {
                        await client.query(
                          `UPDATE metatrader5_copiers
                            SET order_pair = array_remove(order_pair, $1)
                            WHERE account_id = '${copier_acc_id}'
                            AND type = '${copier_acc_type}'`,
                          [
                            pair
                          ]
                        );
                        const update_pair = {
                          master_order_id: master_new_order_id,
                          copier_order_id: new_order_id
                        }
                        await client.query(
                          `UPDATE metatrader5_copiers
                                SET order_pair = array_append(order_pair, $1)
                                WHERE account_id = '${copier_acc_id}'
                                AND type = '${copier_acc_type}'`,
                          [
                            update_pair
                          ]
                        );
                      }
                      console.log("metatrader4-master ----------> close metatrader4 success", performance.now())
                    }).catch(() => {
                      console.log("metatrader4-master ----------> metatrader4 order close error");
                    });
                  }
                }
                if (copier_acc_type === "tld" || copier_acc_type === "tll") {
                  const tl_copier_account = await client.query(
                    `SELECT * FROM copiers 
                      WHERE account_id = '${copier_acc_id}' 
                      AND type = '${copier_acc_type}'`
                  );
                  if (tl_copier_account.rowCount === 0) return;
                  const trading_type = tl_copier_account.rows[0].trading_type;
                  const follow_tp_st = tl_copier_account.rows[0].follow_tp_st;
                  const position_pairs = tl_copier_account.rows[0].position_pair;
                  const copier_acc_num = tl_copier_account.rows[0].acc_num;
                  const pair = position_pairs?.find(item => item.master_order_id === history_order?.ticket);
                  const basic_url = copier_acc_type === "tld" ? TRADELOCKER_DEMO_BASIC_URL : copier_acc_type === "tll" ? TRADELOCKER_LIVE_BASIC_URL : "";
                  if (exist_order && (exist_order.takeProfit !== history_order.takeProfit || exist_order.stopLoss !== history_order.stopLoss)) {
                    if (row.status !== 'Running' || !pair) return;
                    const stopLoss = (follow_tp_st.stop_loss && exist_order.stopLoss > 0) ? exist_order.stopLoss + getRandomNumber(0.001, 0.01, exist_order.type === "Buy" ? exist_order.closePrice - exist_order.stopLoss : 0.01) : history_order.stopLoss;
                    const takeProfit = (follow_tp_st.take_profit && exist_order.takeProfit > 0) ? exist_order.takeProfit + getRandomNumber(0.001, 0.01, exist_order.type === "Sell" ? exist_order.openPrice - exist_order.takeProfit : 0.01) : history_order.takeProfit;
                    console.log(stopLoss, takeProfit);
                    const config = {
                      method: 'patch',
                      url: `${basic_url}/trade/positions/${pair.copier_position_id}`,
                      headers: {
                        'accept': 'application/json',
                        'Authorization': `Bearer ${tl_copier_account.rows[0].access_token}`,
                        'accNum': `${copier_acc_num}`,
                        'Content-Type': 'application/json'
                      },
                      data: {
                        "stopLoss": stopLoss,
                        "takeProfit": takeProfit
                      }
                    };

                    axios(config)
                      .then(async (response) => {
                        if (response.status === 200 || (response.data.s === "error" && response.data.errmsg === "Reason for rejection: Nothing to change.")) {
                          console.log(indexNum + "metatrader4-master ----------> Tradelocker Modify Position Success", performance.now());
                        }
                      })
                      .catch(async () => {
                        console.log(indexNum, "metatrader4-master ----------> Tradelocker Modify Position Error", performance.now());
                      });
                  }
                  if (!exist_order) {
                    console.log(indexNum, "CCCCCCCCCCCCCCCCCCCCCCC", performance.now());
                    const master_orders_history = await metatrader4Axios.get(`/OrderHistory`, {
                      params: {
                        id: master.token,
                        from: new Date(new Date(history_order.openTime) - 5000000)
                      }
                    });
                    let real_lot_size;
                    let volume = -1;
                    let one_exist_order;
                    if (master_orders_history.status === 200) {
                      const master_orders_history_data = master_orders_history.data;
                      one_exist_order = master_orders_history_data.reverse().find(item => item.openTime === history_order.openTime);
                      if (one_exist_order.lots === history_order.lots) {
                        real_lot_size = 0;
                        master_database_set();
                        if (row.status !== 'Running' && pair) {
                          await client.query(
                            `UPDATE copiers 
                              SET position_pair = array_remove(position_pair, $1) 
                              WHERE account_id = '${copier_acc_id}'
                              AND type = '${copier_acc_type}'`,
                            [
                              pair
                            ]
                          );
                        }
                      }
                      else {
                        if (!pair) return;
                        const copier_order = tl_copier_account.rows[0].history_positions?.find(item => item[0] === pair.copier_position_id);
                        if (!copier_order) return;
                        switch (trading_type) {
                          case 'fixed':
                            volume = Math.floor(((one_exist_order.lots * 100) / (history_order.lots * 100)) * parseFloat(copier_order[4]) * 100) / 100;
                            real_lot_size = volume;
                            if (volume >= parseFloat(copier_order[4])) real_lot_size = 0;
                            console.log(indexNum, "fixed", volume);
                            break;
                          case 'general':
                            volume = one_exist_order.lots;
                            real_lot_size = volume;
                            if (volume >= parseFloat(copier_order[4])) real_lot_size = 0;
                            console.log(indexNum, "general", volume);
                            break;
                          case 'rate':
                            const temp_lots = Math.floor(((tl_copier_account.rows[0].account_balance * 100) / (master.account_balance * 100)) * one_exist_order.lots * 100) / 100;
                            // if (temp_lots < 0.01) volume = 0.01;
                            volume = temp_lots;
                            real_lot_size = volume;
                            if (volume >= copier_order[4]) real_lot_size = 0;
                            console.log(indexNum, "rate", volume, real_lot_size, parseFloat(copier_order[4]));
                            break;
                        }
                      }
                    }
                    if (!pair) return;
                    const master_order_comment = one_exist_order.comment;
                    console.log(indexNum, "master_order_comment", master_order_comment, performance.now());
                    const master_split = master_order_comment.split("#");
                    const master_new_order_id = parseInt(master_split[1]);
                    if (real_lot_size === 0 && volume === 0) {
                      await client.query(
                        `UPDATE copiers
                          SET position_pair = array_remove(position_pair, $1)
                          WHERE account_id = '${copier_acc_id}'
                          AND type = '${copier_acc_type}'`,
                        [
                          pair
                        ]
                      );
                      const update_pair = {
                        ...pair,
                        master_order_id: master_new_order_id
                      }
                      await client.query(
                        `UPDATE copiers
                          SET position_pair = array_append(position_pair, $1)
                          WHERE account_id = '${copier_acc_id}'
                          AND type = '${copier_acc_type}'`,
                        [
                          update_pair
                        ]
                      );
                      return;
                    }
                    if (row.status !== 'Running') return;
                    console.log("real lot size", real_lot_size)
                    const config = {
                      method: 'delete',
                      url: `${basic_url}/trade/positions/${pair.copier_position_id}`,
                      headers: {
                        'accept': 'application/json',
                        'Authorization': `Bearer ${tl_copier_account.rows[0].access_token}`,
                        'accNum': `${copier_acc_num}`,
                        'Content-Type': 'application/json'
                      },
                      data: {
                        "qty": parseFloat(real_lot_size)
                      }
                    };
                    axios(config)
                      .then(async (response) => {
                        console.log("=====================>")
                        if ((response.data.s === "ok") || (response.data.s === "error" && response.data.errmsg === "Position not found")) {
                          if (real_lot_size > 0) return;
                          // const new_order_id = pair.copier_position_id;
                          await client.query(
                            `UPDATE copiers 
                                SET position_pair = array_remove(position_pair, $1) 
                                WHERE account_id = '${copier_acc_id}'
                                AND type = '${copier_acc_type}'`,
                            [
                              JSON.stringify(pair)
                            ]
                          )
                          // const update_pair = {
                          //   master_order_id: master_new_order_id,
                          //   copier_order_id: new_order_id
                          // }
                          // await client.query(
                          //   `UPDATE copiers
                          //     SET position_pair = array_append(position_pair, $1)
                          //     WHERE account_id = '${copier_acc_id}'
                          //     AND type = '${copier_acc_type}'`,
                          //   [
                          //     update_pair
                          //   ]
                          // );
                        }
                      })
                      .catch(() => {
                        console.log(indexNum, "metatrader4-master ----------> Tradelocker Delete Position Failed.", performance.now());
                      });
                  }
                }
              });
              callback();
            };

            order_remove();

          });

          //add order part

          master_opened_orders?.map(async (opened_order) => {
            const exist_order = history_orders?.find(item => item.ticket === opened_order.ticket);
            if (exist_order) return;

            const comment = opened_order.comment;
            console.log(comment);
            let old_account_id;
            if (comment.includes("from")) {
              const temp_list = comment.split("#");
              old_account_id = parseInt(temp_list[1]);
              console.log(old_account_id);
              const remove_pair = master.balance_order_pairs?.find(item => item.order_id === old_account_id);
              await client.query(
                `UPDATE metatrader_masters
                  SET balance_order_pairs = array_remove(balance_order_pairs, $1)
                  WHERE account_id = '${master.account_id}'
                  AND type = '${master.type}'`,
                [
                  remove_pair
                ]
              );
              const new_pair = {
                ...remove_pair,
                order_id: opened_order.ticket
              }
              await client.query(
                `UPDATE metatrader_masters
                  SET balance_order_pairs = array_append(balance_order_pairs, $1)
                  WHERE account_id = '${master.account_id}'
                  AND type = '${master.type}'`,
                [
                  new_pair
                ]
              );
            }

            else {
              const new_pair = {
                balance: master.account_balance,
                order_id: opened_order.ticket
              }

              await client.query(
                `UPDATE metatrader_masters
                  SET balance_order_pairs = array_append(balance_order_pairs, $1)
                  WHERE account_id = '${master.account_id}'
                  AND type = '${master.type}'`,
                [
                  new_pair
                ]
              );
            }

            //order
            console.log("start order function");
            const order_function = async () => {
              contractData.rows.map(async (row) => {
                const copier_acc_id = row.copier_acc_id;
                const copier_acc_type = row.copier_acc_type;
                if (row.status === 'Running') {
                  if (copier_acc_type === "mt4") {
                    console.log(copier_acc_id, copier_acc_type);
                    console.log(indexNum, "nnnnnnnnnnnnnnnnnnnnnnn");
                    const mt4_copier_account = await client.query(
                      `SELECT * FROM metatrader_copiers 
                        WHERE account_id = '${copier_acc_id}'
                        AND type = '${copier_acc_type}'`
                    );
                    if (mt4_copier_account.rowCount === 0) {
                      console.log("metatrader4-master ----------> get copier account token from database error!");
                      return;
                    }
                    console.log("metatrader4-master ---------->  get data success and order start", performance.now());
                    const trading_type = mt4_copier_account.rows[0].trading_type;
                    const follow_tp_st = mt4_copier_account.rows[0].follow_tp_st;
                    if (comment.includes("from")) return;
                    else {
                      let volume = opened_order.lots;
                      switch (trading_type) {
                        case 'fixed':
                          volume = mt4_copier_account.rows[0].fixed_lots;
                          console.log("fixed", volume);
                          break;
                        case 'general':
                          volume = opened_order.lots;
                          console.log("general", volume);
                          break;
                        case 'rate':
                          const temp_lots = Math.floor(((mt4_copier_account.rows[0].account_balance * 100) / (master.account_balance * 100)) * opened_order.lots * 100) / 100;
                          if (temp_lots < 0.01) volume = 0.01;
                          else volume = temp_lots;
                          console.log("rate", temp_lots, volume);
                          break;
                      }
                      const stopLoss = (follow_tp_st.stop_loss && opened_order.stopLoss > 0) ? opened_order.stopLoss + getRandomNumber(0.001, 0.01, opened_order.type === "Buy" ? opened_order.closePrice - opened_order.stopLoss : 0.01) : 0;
                      const takeProfit = (follow_tp_st.take_profit && opened_order.takeProfit > 0) ? opened_order.takeProfit + getRandomNumber(0.001, 0.01, opened_order.type === "Sell" ? opened_order.openPrice - opened_order.takeProfit : 0.01) : 0;
                      console.log(stopLoss, takeProfit)
                      await metatrader4Axios.get('/OrderSend', {
                        params: {
                          id: mt4_copier_account.rows[0].token,
                          symbol: opened_order.symbol,
                          operation: opened_order.type,
                          volume: volume,
                          stoploss: stopLoss,
                          takeprofit: takeProfit,
                        }
                      }).then(async (order_response) => {
                        if (order_response.status === 200) {
                          await client.query(
                            `UPDATE metatrader_copiers
                              SET order_pair = array_append(order_pair, $1)
                              WHERE account_id = '${copier_acc_id}'
                              AND type = '${copier_acc_type}'`,
                            [
                              {
                                copier_order_id: order_response.data.ticket,
                                master_order_id: opened_order.ticket
                              }
                            ]
                          );
                          console.log("metatrader4-master ----------> metatrader4 order success", performance.now())
                        }
                      }).catch(() => {
                        console.log("metatrader4-master ----------> metatrader4 order send error");
                      });
                    }
                  }
                  if (copier_acc_type === "mt5") {

                    const mt5_copier_account = await client.query(
                      `SELECT * FROM metatrader5_copiers 
                        WHERE account_id = '${copier_acc_id}'
                        AND type = '${copier_acc_type}'`
                    );
                    if (mt5_copier_account.rowCount === 0) {
                      console.log("metatrader4-master ----------> get copier account token from database error!");
                      return;
                    }
                    console.log("metatrader4-master ---------->  get data success and order start", performance.now());

                    if (comment.includes("from")) {
                      const remove_order_pair = mt5_copier_account.rows[0].order_pair?.find(item => item.master_order_id === old_account_id);
                      await client.query(
                        `UPDATE metatrader5_copiers
                          SET order_pair = array_remove(order_pair, $1)
                          WHERE account_id = '${copier_acc_id}'
                          AND type = '${copier_acc_type}'`,
                        [
                          remove_order_pair
                        ]
                      );
                      const update_order_pair = {
                        ...remove_order_pair,
                        master_order_id: opened_order.ticket
                      }
                      await client.query(
                        `UPDATE metatrader5_copiers
                          SET order_pair = array_append(order_pair, $1)
                          WHERE account_id = '${copier_acc_id}'
                          AND type = '${copier_acc_type}'`,
                        [
                          update_order_pair
                        ]
                      );
                      return;
                    }

                    const trading_type = mt5_copier_account.rows[0].trading_type;
                    const follow_tp_st = mt5_copier_account.rows[0].follow_tp_st;
                    let volume = opened_order.lots;
                    switch (trading_type) {
                      case 'fixed':
                        volume = mt5_copier_account.rows[0].fixed_lots;
                        console.log("fixed", volume);
                        break;
                      case 'general':
                        volume = opened_order.lots;
                        console.log("general", volume);
                        break;
                      case 'rate':
                        const temp_lots = Math.floor(((mt5_copier_account.rows[0].account_balance * 100) / (master.account_balance * 100)) * opened_order.lots * 100) / 100;
                        if (temp_lots < 0.01) volume = 0.01;
                        else volume = temp_lots;
                        console.log("rate", temp_lots, volume);
                        break;
                    }
                    const stopLoss = (follow_tp_st.stop_loss && opened_order.stopLoss > 0) ? opened_order.stopLoss + getRandomNumber(0.001, 0.01, opened_order.type === "Buy" ? opened_order.closePrice - opened_order.stopLoss : 0.01) : 0;
                    const takeProfit = (follow_tp_st.take_profit && opened_order.takeProfit > 0) ? opened_order.takeProfit + getRandomNumber(0.001, 0.01, opened_order.type === "Sell" ? opened_order.openPrice - opened_order.takeProfit : 0.01) : 0;
                    await metatrader5Axios.get('/OrderSend', {
                      params: {
                        id: mt5_copier_account.rows[0].token,
                        symbol: opened_order.symbol,
                        operation: opened_order.type,
                        volume: volume,
                        stoploss: stopLoss,
                        takeprofit: takeProfit,
                      }
                    }).then(async (order_response) => {
                      if (order_response.status === 200) {
                        await client.query(
                          `UPDATE metatrader5_copiers
                            SET order_pair = array_append(order_pair, $1)
                            WHERE account_id = '${copier_acc_id}'
                            AND type = '${copier_acc_type}'`,
                          [
                            {
                              copier_order_id: order_response.data.ticket,
                              master_order_id: opened_order.ticket
                            }
                          ]
                        );
                        console.log("metatrader4-master ----------> metatrader5 order success", performance.now())
                      }
                    }).catch(() => {
                      console.log("metatrader4-master ----------> metatrader5 order send error");
                    });
                  }
                  if (copier_acc_type === "tld" || copier_acc_type === "tll") {
                    const tl_copier_account = await client.query(
                      `SELECT * FROM copiers 
                        WHERE account_id = '${copier_acc_id}'
                        AND type = '${copier_acc_type}'`
                    );
                    if (tl_copier_account.rowCount === 0) {
                      console.log("metatrader4-master ----------> get tradelocker copier account error!");
                      return;
                    }
                    console.log("metatrader4-master ----------> get data tradelocker success", performance.now());

                    if (comment.includes("from")) {
                      const remove_order_pair = tl_copier_account.rows[0].position_pair?.find(item => item.master_order_id === old_account_id);
                      await client.query(
                        `UPDATE copiers
                          SET position_pair = array_remove(position_pair, $1)
                          WHERE account_id = '${copier_acc_id}'
                          AND type = '${copier_acc_type}'`,
                        [
                          remove_order_pair
                        ]
                      );
                      const update_order_pair = {
                        ...remove_order_pair,
                        master_order_id: opened_order.ticket
                      }
                      await client.query(
                        `UPDATE copiers
                          SET position_pair = array_append(position_pair, $1)
                          WHERE account_id = '${copier_acc_id}'
                          AND type = '${copier_acc_type}'`,
                        [
                          update_order_pair
                        ]
                      );
                      return;
                    }

                    const copier_acc_num = row.copier_acc_num;
                    const basic_url = copier_acc_type === "tld" ? TRADELOCKER_DEMO_BASIC_URL : copier_acc_type === "tll" ? TRADELOCKER_LIVE_BASIC_URL : "";
                    const symbol_id = await client.query(
                      `SELECT * FROM tradable_instrument_pairs
                        WHERE symbol = '${opened_order.symbol}'`
                    );
                    if (symbol_id.rowCount > 0) {
                      const trading_type = tl_copier_account.rows[0].trading_type;
                      const follow_tp_st = tl_copier_account.rows[0].follow_tp_st;
                      let volume = opened_order.lots;
                      switch (trading_type) {
                        case 'fixed':
                          volume = tl_copier_account.rows[0].fixed_lots;
                          console.log("fixed", volume);
                          break;
                        case 'general':
                          volume = opened_order.lots;
                          console.log("general", volume);
                          break;
                        case 'rate':
                          const temp_lots = Math.floor(((tl_copier_account.rows[0].account_balance * 100) / (master.account_balance * 100)) * opened_order.lots * 100) / 100;
                          if (temp_lots < 0.01) volume = 0.01;
                          else volume = temp_lots;
                          console.log("rate", temp_lots, volume);
                          break;
                      }
                      const stopLoss = (follow_tp_st.stop_loss && opened_order.stopLoss > 0) ? opened_order.stopLoss + getRandomNumber(0.001, 0.01, opened_order.type === "Buy" ? opened_order.closePrice - opened_order.stopLoss : 0.01) : 0;
                      const takeProfit = (follow_tp_st.take_profit && opened_order.takeProfit > 0) ? opened_order.takeProfit + getRandomNumber(0.001, 0.01, opened_order.type === "Sell" ? opened_order.openPrice - opened_order.takeProfit : 0.01) : 0;
                      const config = {
                        method: 'post',
                        url: `${basic_url}/trade/accounts/${copier_acc_id}/orders`,
                        headers: {
                          'accept': 'application/json',
                          'Authorization': `Bearer ${tl_copier_account.rows[0].access_token}`,
                          'accNum': `${copier_acc_num}`,
                          'Content-Type': 'application/json'
                        },
                        data: {
                          "price": 0,
                          "qty": volume,
                          "routeId": 9912,
                          "side": opened_order.type,
                          "stopLoss": stopLoss,
                          "stopLossType": "absolute",
                          "stopPrice": 0,
                          "takeProfit": takeProfit,
                          "takeProfitType": "absolute",
                          "trStopOffset": 0,
                          "tradableInstrumentId": symbol_id.rows[0].tradable_instrument_id,
                          "type": "market",
                          "validity": "IOC"
                        }
                      }
                      axios(config)
                        .then(async (order_response) => {
                          if (order_response.data.s === "ok") {
                            console.log("metatrader4-master ----------> order_response success");
                            //get position id from orderId in tradelocker
                            const orderId = order_response.data.d.orderId;
                            const config1 = {
                              method: 'get',
                              url: `${basic_url}/trade/accounts/${copier_acc_id}/ordersHistory?tradableInstrumentId=${symbol_id.rows[0].tradable_instrument_id}`,
                              headers: {
                                'accept': 'application/json',
                                'Authorization': `Bearer ${tl_copier_account.rows[0].access_token}`,
                                'accNum': `${copier_acc_num}`,
                                'Content-Type': 'application/json'
                              }
                            }
                            axios(config1)
                              .then(async (response) => {
                                if (response.data.s === "ok") {
                                  const remove_order = response.data.d.ordersHistory.find(orhistory => orhistory[0] === orderId);
                                  const pair = {
                                    master_order_id: opened_order.ticket,
                                    copier_position_id: remove_order[16]
                                  }
                                  console.log(pair);
                                  const jsonPair = JSON.stringify(pair);
                                  await client.query(
                                    `UPDATE copiers 
                                      SET position_pair = array_append(position_pair, $1) 
                                      WHERE account_id = '${copier_acc_id}'
                                      AND type = '${copier_acc_type}'`,
                                    [jsonPair]
                                  );
                                  console.log(indexNum + "metatrader4-master ----------> Set Order Pair Success", performance.now())
                                }
                              })
                              .catch((err) => {
                                console.log(indexNum + " Error", err.response.data);
                              })
                          }
                        }).catch((err) => {
                          console.log("tradelocker order error", err);
                        })
                    }
                  }
                }
                else {
                  const master_order_history = await metatrader4Axios.get(`/OrderHistory`, {
                    params: {
                      id: master.token,
                      from: new Date(new Date(opened_order.openTime) - 5000000)
                    }
                  });
                  if (master_order_history.status !== 200) return;
                  const master_order_history_data = master_order_history.data;
                  if (copier_acc_type === "mt4") {
                    const copier_data = await client.query(
                      `SELECT * 
                        FROM metatrader_copiers
                        WHERE account_id = '${copier_acc_id}'
                        AND type = '${copier_acc_type}'`
                    );
                    if (copier_data.rowCount === 0) return;
                    const exist_one = master_order_history_data.reverse().find(item => item.openTime === opened_order.openTime);
                    if (!exist_one) return;
                    const order_pair = copier_data.rows[0].order_pair;
                    const remove_pair = order_pair.find(item => item.master_order_id === exist_one.ticket);
                    if (!remove_pair) return;
                    const update_pair = {
                      copier_order_id: remove_pair.copier_order_id,
                      master_order_id: opened_order.ticket
                    }
                    await client.query(
                      `UPDATE metatrader_copiers
                        SET order_pair = array_remove(order_pair, $1)
                        WHERE account_id = '${copier_acc_id}'
                        AND type = '${copier_acc_type}'`,
                      [
                        remove_pair
                      ]
                    );
                    await client.query(
                      `UPDATE metatrader_copiers
                        SET order_pair = array_append(order_pair, $1)
                        WHERE account_id = '${copier_acc_id}'
                        AND type = '${copier_acc_type}'`,
                      [
                        update_pair
                      ]
                    );
                  }
                  if (copier_acc_type === "mt5") {
                    const copier_data = await client.query(
                      `SELECT * 
                        FROM metatrader5_copiers
                        WHERE account_id = '${copier_acc_id}'
                        AND type = '${copier_acc_type}'`
                    );
                    if (copier_data.rowCount === 0) return;
                    const exist_one = master_order_history_data.reverse().find(item => item.openTime === opened_order.openTime);
                    if (!exist_one) return;
                    const order_pair = copier_data.rows[0].order_pair;
                    const remove_pair = order_pair.find(item => item.master_order_id === exist_one.ticket);
                    if (!remove_pair) return;
                    const update_pair = {
                      copier_order_id: remove_pair.copier_order_id,
                      master_order_id: opened_order.ticket
                    }
                    await client.query(
                      `UPDATE metatrader5_copiers
                        SET order_pair = array_remove(order_pair, $1)
                        WHERE account_id = '${copier_acc_id}'
                        AND type = '${copier_acc_type}'`,
                      [
                        remove_pair
                      ]
                    );
                    await client.query(
                      `UPDATE metatrader5_copiers
                        SET order_pair = array_append(order_pair, $1)
                        WHERE account_id = '${copier_acc_id}'
                        AND type = '${copier_acc_type}'`,
                      [
                        update_pair
                      ]
                    );
                  }
                  if (copier_acc_type === "tld" || copier_acc_type === "tll") {
                    const copier_data = await client.query(
                      `SELECT * 
                        FROM copiers
                        WHERE account_id = '${copier_acc_id}'
                        AND type = '${copier_acc_type}'`
                    );
                    if (copier_data.rowCount === 0) return;
                    const exist_one = master_order_history_data.reverse().find(item => item.openTime === opened_order.openTime);
                    if (!exist_one) return;
                    const position_pair = copier_data.rows[0].position_pair;
                    const remove_pair = position_pair.find(item => item.master_order_id === exist_one.ticket);
                    if (!remove_pair) return;
                    const update_pair = {
                      copier_position_id: remove_pair.copier_position_id,
                      master_order_id: opened_order.ticket
                    }
                    await client.query(
                      `UPDATE copiers
                        SET position_pair = array_remove(position_pair, $1)
                        WHERE account_id = '${copier_acc_id}'
                        AND type = '${copier_acc_type}'`,
                      [
                        remove_pair
                      ]
                    );
                    await client.query(
                      `UPDATE copiers
                        SET position_pair = array_append(position_pair, $1)
                        WHERE account_id = '${copier_acc_id}'
                        AND type = '${copier_acc_type}'`,
                      [
                        update_pair
                      ]
                    );
                  }
                }
              });
            }
            order_function();
          });
          callback();
        }

        const history_orders_set = async () => {
          await client.query(
            `UPDATE metatrader_masters 
              SET history_orders = $1
              WHERE account_id = '${master.account_id}'`,
            [master_opened_orders]
          );
        }
        add_remove_requests(function () {
          history_orders_set();
        })
      }).catch(() => {
        console.log("metatrader4-master ----------> Opened Orders Time out error");
      })

    }).catch(() => {
      console.log("metatrader4-master ----------> Check Connect Time out error")
    })
  });
  await Promise.all(promises);
}

// getMetatrader4MasterHistoryOrders(function () {
//   getMetatrader4OrderPair();
// });

// setTimeout(function () {
//   setInterval(runMetatrader4TradingFunction, 3 * 1000);
// }, 10 * 1000);

module.exports = { getMetatrader4MasterHistoryOrders, getMetatrader4OrderPair, runMetatrader4TradingFunction }
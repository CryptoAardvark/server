const client = require("../config/db/db.js");
const axios = require('axios');

//dashboard

exports.deleteAccount = async (req, res) => {
  try {
    const { type, acc_id, acc_role } = req.body;
    const user = req.user;
    const database_name = (type === 'tll' || type === 'tld') ? (acc_role === "Master" ? "masters" : "copiers") :
      type === 'mt4' ? (acc_role === "Master" ? "metatrader_masters" : "metatrader_copiers") : (acc_role === "Master" ? "metatrader5_masters" : "metatrader5_copiers")
    const isDeleted = await client.query(
      `DELETE FROM ${database_name} 
      WHERE account_id = '${acc_id}'
      AND type = '${type}'`
    );
    if (isDeleted.rowCount > 0) {
      const deleted_account = {
        type: type,
        account_id: acc_id
      }
      if (acc_role === "Master") {
        await client.query(
          `UPDATE users 
          SET masters = array_remove(masters, $1), 
          follow_account = array_remove(follow_account, $1) 
          WHERE id = ${user.id}`,
          [JSON.stringify(deleted_account)]
        );
        await res.status(200).send("ok");
      }
      else {
        await client.query(
          `UPDATE users 
          SET copiers = array_remove(copiers, $1)
          WHERE id = ${user.id}`,
          [JSON.stringify(deleted_account)]
        );
        await res.status(200).send("ok");
      }
    }
  }
  catch {
    res.status(501).send("Server Error");
  }
}

//integrations

//tradelocker

exports.addMasterAccount = async (req, res) => {
  try {
    const {
      acc_num,
      account_balance,
      access_token,
      refresh_token,
      acc_avatar,
      acc_name,
      acc_id,
      acc_email,
      acc_password,
      server_name,
      type,
      id
    } = req.body;
    const master_data = await client.query("SELECT * FROM masters WHERE account_id=$1", [
      acc_id,
    ]);
    if (master_data.rowCount === 0) {
      const copier_data = await client.query(
        `SELECT * FROM copiers WHERE account_id=$1`,
        [acc_id]
      );
      if (copier_data.rowCount === 0) {
        const myDate = new Date();
        const formattedDate = myDate.toISOString();
        await client.query(
          `INSERT INTO masters (registered_at, acc_num, account_balance, access_token, refresh_token, avatar, account_id, account_email, account_password, account_name, account_server_name, type, follows, master_pl, win_count, lose_count, avg_pl, history_positions, take_stop, balance_pl_pairs, total_pl_amount) 
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21) RETURNING *`,
          [formattedDate, acc_num, account_balance, access_token, refresh_token, acc_avatar, acc_id, acc_email, acc_password, acc_name, server_name, type, 0, [], 0, 0, 0, [], [], [], 0]
        );
        const new_master = {
          type: type,
          account_id: acc_id
        }
        await client.query(
          `UPDATE users SET masters = array_append(masters, $1) WHERE id = ${id}`,
          [JSON.stringify(new_master)]
        )
        await res.status(200).send("ok");
      }
      else {
        await res.status(201).send("This account had already been registered as copier!")
      }
    }
    else {
      await res.status(201).send("This account had already been registered as master!")
    }
  }
  catch {
    await res.status(501).send("Server Error");
  }
}

exports.addCopierAccount = async (req, res) => {
  try {
    const {
      acc_num,
      account_balance,
      access_token,
      refresh_token,
      acc_avatar,
      acc_name,
      acc_id,
      acc_email,
      acc_password,
      server_name,
      type,
      id } = req.body;
    const copier_data = await client.query("SELECT * FROM copiers WHERE account_id=$1", [
      acc_id,
    ]);
    if (copier_data.rowCount === 0) {
      const master_data = await client.query(
        `SELECT * FROM masters WHERE account_id=$1`,
        [acc_id]
      );
      if (master_data.rowCount === 0) {
        const myDate = new Date();
        const formattedDate = myDate.toISOString();
        const data = await client.query(
          `INSERT INTO copiers (acc_num, account_balance, access_token, refresh_token, avatar, account_id, account_password, account_name, account_server_name, type, my_master_id, my_master_name, status, copier_pl, position_pair, avg_pl, total_pl_amount, registered_at, win_count, lose_count, account_email) 
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21) RETURNING *`,
          [acc_num, account_balance, access_token, refresh_token, acc_avatar, acc_id, acc_password, acc_name, server_name, type, "", "", "Nothing", [], [], 0, 0, formattedDate, 0, 0, acc_email]
        );
        if (data.rowCount > 0) {
          const new_copier = {
            type: type,
            account_id: acc_id
          }
          const myData = await client.query(
            `UPDATE users SET copiers = array_append(copiers, $1) WHERE id = ${id}`,
            [JSON.stringify(new_copier)]
          )
          if (myData.rowCount > 0) await res.status(200).send("ok");
        }
      }
      else {
        await res.status(201).send("This account had already been registered as master!");
      }
    }
    else {
      await res.status(201).send("This account had already been registered as copier!");
    }
  }
  catch {
    await res.status(501).send("Server Error");
  }
}

//metatrader

exports.addMetatraderMasterAccount = async (req, res) => {
  // try {
  const {
    token,
    acc_avatar,
    acc_id,
    acc_password,
    acc_server_name,
    acc_name,
    host,
    port,
    type,
    id
  } = req.body;
  const database_name = type === "mt5" ? "metatrader5_masters" : "metatrader_masters";
  const master_data = await client.query(
    `SELECT * FROM ${database_name} WHERE account_id=$1`,
    [
      acc_id,
    ]
  );
  if (master_data.rowCount === 0) {
    const copier_data = await client.query(
      `SELECT * FROM metatrader_copiers WHERE account_id=$1`,
      [acc_id]
    );
    if (copier_data.rowCount === 0) {
      const myDate = new Date();
      const formattedDate = myDate.toISOString();
      await client.query(
        `INSERT INTO ${database_name} 
          (registered_at, 
          token, 
          avatar, 
          account_id, 
          account_password, 
          account_name, 
          account_server_name, 
          type, 
          follows, 
          host, 
          port, 
          account_balance, 
          avg_pl, 
          total_pl_amount, 
          win_count, 
          lose_count, 
          history_orders, 
          balance_order_pairs,
          master_pl) 
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19) RETURNING *`,
        [
          formattedDate,
          token,
          acc_avatar,
          acc_id,
          acc_password,
          acc_name,
          acc_server_name,
          type,
          0,
          host,
          port,
          0,
          0,
          0,
          0,
          0,
          [],
          [],
          []
        ]
      );
      const new_master = {
        type: type,
        account_id: acc_id
      }
      await client.query(
        `UPDATE users SET masters = array_append(masters, $1) WHERE id = ${id}`,
        [JSON.stringify(new_master)]
      )
      await res.status(200).send("ok");
    }
    else {
      await res.status(201).send("This account had already been registered as copier!")
    }
  }
  else {
    await res.status(201).send("This account had already been registered as master!")
  }
  // }
  // catch {
  //   await res.status(501).send("Server Error");
  // }
}

exports.addMetatraderCopierAccount = async (req, res) => {
  // try {
  const {
    token,
    acc_avatar,
    acc_id,
    acc_password,
    acc_server_name,
    acc_name,
    host,
    port,
    type,
    id } = req.body;
  const database_name = type === "mt5" ? "metatrader5_copiers" : "metatrader_copiers";
  const copier_data = await client.query(
    `SELECT * FROM ${database_name} WHERE account_id=$1`,
    [
      acc_id,
    ]
  );
  if (copier_data.rowCount === 0) {
    const master_database_name = type === "mt5" ? "metatrader5_masters" : "metatrader_masters";
    const master_data = await client.query(
      `SELECT * FROM ${master_database_name} WHERE account_id=$1`,
      [
        acc_id
      ]
    );
    if (master_data.rowCount === 0) {
      const myDate = new Date();
      const formattedDate = myDate.toISOString();
      const data = await client.query(
        `INSERT INTO ${database_name} 
          (registered_at, 
          token, 
          avatar, 
          account_id, 
          account_password, 
          account_name, 
          account_server_name, 
          type, 
          host, 
          port, 
          status,
          account_balance, 
          avg_pl, 
          total_pl_amount, 
          win_count, 
          lose_count, 
          history_orders, 
          balance_order_pairs,
          copier_pl) 
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19) RETURNING *`,
        [
          formattedDate,
          token,
          acc_avatar,
          acc_id,
          acc_password,
          acc_name,
          acc_server_name,
          type,
          host,
          port,
          "Nothing",
          0,
          0,
          0,
          0,
          0,
          [],
          [],
          []
        ]
      );
      if (data.rowCount > 0) {
        const new_copier = {
          type: type,
          account_id: acc_id
        }
        const myData = await client.query(
          `UPDATE users SET copiers = array_append(copiers, $1) WHERE id = ${id}`,
          [JSON.stringify(new_copier)]
        )
        if (myData.rowCount > 0) await res.status(200).send("ok");
      }
    }
    else {
      await res.status(201).send("This account had already been registered as master!");
    }
  }
  else {
    await res.status(201).send("This account had already been registered as copier!");
  }
  // }
  // catch {
  //   await res.status(501).send("Server Error");
  // }
}

//masters

exports.getMastersList = async (req, res) => {
  try {
    const user = req.user;
    const { acc_type, current_page, display_count } = req.body;
    console.log(current_page, display_count)
    const all_masters = await client.query(
      `SELECT avatar, account_name, account_id, avg_pl, type, follows, win_count, lose_count, registered_at FROM masters`
    );
    const all_metatrader_masters = await client.query(
      `SELECT avatar, account_name, account_id, avg_pl, type, follows, win_count, lose_count, registered_at FROM metatrader_masters`
    );
    const all_metatrader5_masters = await client.query(
      `SELECT avatar, account_name, account_id, avg_pl, type, follows, win_count, lose_count, registered_at FROM metatrader5_masters`
    );
    if (acc_type === 0) {
      let temp_data = [];
      const display_masters = await client.query(
        `SELECT avatar, account_name, account_id, avg_pl, type, follows, win_count, lose_count, registered_at FROM masters`
      )
      temp_data = temp_data.concat(display_masters.rows);
      const display_metatrader_masters = await client.query(
        `SELECT avatar, account_name, account_id, avg_pl, type, follows, win_count, lose_count, registered_at FROM metatrader_masters`
      )
      temp_data = temp_data.concat(display_metatrader_masters.rows);
      const display_metatrader5_masters = await client.query(
        `SELECT avatar, account_name, account_id, avg_pl, type, follows, win_count, lose_count, registered_at FROM metatrader5_masters`
      )
      temp_data = temp_data.concat(display_metatrader5_masters.rows);
      const sortedData = temp_data.sort((a, b) => {
        return new Date(a.registered_at) - new Date(b.registered_at);
      });
      const slicedData = sortedData.slice(current_page * display_count, current_page * display_count + display_count);
      await res.status(200).send({ accounts: slicedData, totalCount: sortedData.length });
    }
    else if (acc_type === 1) {
      let index = 0;
      let temp_data = [];
      const my_masters = all_masters.rows.filter((item) => {
        for (let i = 0; i < user.follow_account?.length; i++) {
          if (user.follow_account[i].type === item.type && user.follow_account[i].account_id === item.account_id) {
            index++;
            if (index > current_page * display_count && index <= (current_page + 1) * display_count) return item;
          }
        }
      });
      temp_data = temp_data.concat(my_masters);
      const my_metatrader_masters = all_metatrader_masters.rows.filter((item) => {
        for (let i = 0; i < user.follow_account?.length; i++) {
          if (user.follow_account[i].type === item.type && user.follow_account[i].account_id === item.account_id) {
            index++;
            if (index > current_page * display_count && index <= (current_page + 1) * display_count) return item;
          }
        }
      });
      temp_data = temp_data.concat(my_metatrader_masters);
      const my_metatrader5_masters = all_metatrader5_masters.rows.filter((item) => {
        for (let i = 0; i < user.follow_account?.length; i++) {
          if (user.follow_account[i].type === item.type && user.follow_account[i].account_id === item.account_id) {
            index++;
            if (index > current_page * display_count && index <= (current_page + 1) * display_count) return item;
          }
        }
      });
      temp_data = temp_data.concat(my_metatrader5_masters);
      const sortedData = temp_data.sort((a, b) => {
        return new Date(a.registered_at) - new Date(b.registered_at);
      });
      const slicedData = sortedData.slice(current_page * display_count, current_page * display_count + display_count);
      await res.status(200).send({ accounts: slicedData, totalCount: index });
    }
    else if (acc_type === 2) {
      let index = 0;
      let temp_data = [];
      const my_master_acc_data = all_masters.rows.filter((item) => {
        for (let i = 0; i < user.masters?.length; i++) {
          if (user.masters[i].type === item.type && user.masters[i].account_id === item.account_id) {
            index++;
            if (index > current_page * display_count && index <= (current_page + 1) * display_count) return item;
          }
        }
      });
      temp_data = temp_data.concat(my_master_acc_data);
      const my_metatrader_master_acc_data = all_metatrader_masters.rows.filter((item) => {
        for (let i = 0; i < user.masters?.length; i++) {
          if (user.masters[i].type === item.type && user.masters[i].account_id === item.account_id) {
            index++;
            if (index > current_page * display_count && index <= (current_page + 1) * display_count) return item;
          }
        }
      });
      temp_data = temp_data.concat(my_metatrader_master_acc_data);
      const my_metatrader5_master_acc_data = all_metatrader5_masters.rows.filter((item) => {
        for (let i = 0; i < user.masters?.length; i++) {
          if (user.masters[i].type === item.type && user.masters[i].account_id === item.account_id) {
            index++;
            if (index > current_page * display_count && index <= (current_page + 1) * display_count) return item;
          }
        }
      });
      temp_data = temp_data.concat(my_metatrader5_master_acc_data);
      const sortedData = temp_data.sort((a, b) => {
        return new Date(a.registered_at) - new Date(b.registered_at);
      });
      const slicedData = sortedData.slice(current_page * display_count, current_page * display_count + display_count);
      await res.status(200).send({ accounts: slicedData, totalCount: index });
    }
  }
  catch {
    await res.status(501).send("Server Error");
  }
}

exports.addFollowMasterAccount = async (req, res) => {
  try {
    const { type, my_user_id, acc_id } = req.body;
    const new_follower = {
      type: type,
      account_id: acc_id
    }
    const updatedMyData = await client.query(
      `UPDATE users SET follow_account = array_append(follow_account, $1) WHERE id = ${my_user_id}`,
      [JSON.stringify(new_follower)]
    )
    if (updatedMyData.rowCount > 0) {
      res.status(200).send("ok");
    }
  }
  catch {
    res.status(501).send("Server Error!");
  }
}

exports.removeFollowMasterAccount = async (req, res) => {
  try {
    const { type, my_user_id, acc_id } = req.body;
    const remove_account = {
      type: type,
      account_id: acc_id
    }
    const updatedMyData = await client.query(
      `UPDATE users SET follow_account = array_remove(follow_account, $1) WHERE id = ${my_user_id}`,
      [JSON.stringify(remove_account)]
    )
    if (updatedMyData.rowCount > 0) {
      res.status(200).send("ok");
    }
  }
  catch {
    res.status(501).send("Server Error!");
  }
}

//copiers

const getTraderlockerCopiersList = async (copierIds) => {
  let copier_acc_names = [];
  for (let i = 0; i < copierIds.length; i++) {
    if (copierIds[i].type === "tld" || copierIds[i].type === "tll") {
      const copier_acc_name = await client.query(
        `SELECT avatar, 
        account_id, 
        acc_num, 
        account_name, 
        avg_pl, type, 
        my_master_id, 
        my_master_name, 
        my_master_type, 
        status 
        FROM copiers 
        WHERE account_id = '${copierIds[i].account_id}'`
      )
      copier_acc_names.push(copier_acc_name.rows[0]);
    }
  }
  return copier_acc_names;
}

const getMetatraderCopiersList = async (copierIds) => {
  let copier_acc_names = [];
  for (let i = 0; i < copierIds.length; i++) {
    if (copierIds[i].type === "mt4") {
      const copier_acc_name = await client.query(
        `SELECT 
        avatar, 
        account_id, 
        account_name, 
        avg_pl, 
        type, 
        my_master_id, 
        my_master_name, 
        my_master_type, 
        status 
        FROM metatrader_copiers 
        WHERE account_id = '${copierIds[i].account_id}'`
      )
      copier_acc_names.push(copier_acc_name.rows[0]);
    }
  }
  return copier_acc_names;
}

const getMetatrader5CopiersList = async (copierIds) => {
  let copier_acc_names = [];
  for (let i = 0; i < copierIds.length; i++) {
    if (copierIds[i].type === "mt5") {
      const copier_acc_name = await client.query(
        `SELECT 
        avatar, 
        account_id, 
        account_name, 
        avg_pl, 
        type, 
        my_master_id, 
        my_master_name, 
        my_master_type, 
        status 
        FROM metatrader5_copiers 
        WHERE account_id = '${copierIds[i].account_id}'`
      )
      copier_acc_names.push(copier_acc_name.rows[0]);
    }
  }
  return copier_acc_names;
}

exports.getCopiersList = async (req, res) => {
  try {
    const { user_id } = req.body;
    const copier_data = await client.query(
      `SELECT copiers 
      FROM users
      WHERE id = '${user_id}'`
    );
    const copierIds = copier_data.rows[0].copiers;
    let copier_acc_names = [];
    const tradelockerCopiers = await getTraderlockerCopiersList(copierIds);
    copier_acc_names = copier_acc_names.concat(tradelockerCopiers);
    const metatraderCopiers = await getMetatraderCopiersList(copierIds);
    copier_acc_names = copier_acc_names.concat(metatraderCopiers);
    const metatrader5Copiers = await getMetatrader5CopiersList(copierIds);
    copier_acc_names = copier_acc_names.concat(metatrader5Copiers);
    await res.status(200).send(copier_acc_names);
  }
  catch {
    res.status(501).send("Server Error");
  }
}

exports.getMyMastersList = async (req, res) => {
  try {
    const { id } = req.body;
    const myData = await client.query(
      `SELECT * FROM users WHERE id = ${id}`
    )
    if (myData.rowCount > 0) {
      var tempData = [];
      for (let i = 0; i < myData.rows[0].follow_account?.length; i++) {
        const acc_data = myData.rows[0].follow_account[i];
        const table_name = (acc_data.type === "tld" || acc_data.type === "tll") ? "masters" : acc_data.type === "mt4" ? "metatrader_masters" : "metatrader5_masters";
        const oneData = await client.query(
          `SELECT * FROM ${table_name} WHERE account_id = '${acc_data.account_id}'`
        )
        if (oneData.rowCount > 0) {
          tempData.push(oneData.rows[0]);
        }
      }
      await res.status(200).send(tempData);
    }
  }
  catch {
    await res.status(501).send("Server Error");
  }
}

exports.startTradingFunc = async (copier_acc_id, copier_acc_type, master_acc_id, my_master_type) => {
  try {
    await client.query(
      `UPDATE contract 
      SET status = 'Running' 
      WHERE copier_acc_id = $1
      AND copier_acc_type = $2 
      AND master_acc_id = $3
      AND master_acc_type = $4`,
      [copier_acc_id, copier_acc_type, master_acc_id, my_master_type]
    );
    const database_name = (copier_acc_type === 'tll' || copier_acc_type === 'tld') ? 'copiers' : copier_acc_type === 'mt4' ? 'metatrader_copiers' : 'metatrader5_copiers';
    await client.query(
      `UPDATE ${database_name} 
      SET status = 'Running' 
      WHERE account_id = '${copier_acc_id}'
      AND type = '${copier_acc_type}'`
    )
    return true;
  }
  catch (err) {
    console.log(err);
    return false;
  }
}

exports.startTrading = async (req, res) => {
  try {
    const { copier_acc_id, copier_acc_type, master_acc_id, my_master_type } = req.body;
    const success = await this.startTradingFunc(copier_acc_id, copier_acc_type, master_acc_id, my_master_type);
    console.log(success);
    if (success) await res.status(200).send("ok");
  }
  catch {
    await res.status(501).send("Server Error!");
  }
}

exports.stopTrading = async (req, res) => {
  try {
    const { copier_acc_id, copier_acc_type, master_acc_id, my_master_type } = req.body;
    const contractData = await client.query(
      `UPDATE contract 
      SET status = 'Stopped' 
      WHERE copier_acc_id = $1 
      AND copier_acc_type = $2
      AND master_acc_id = $3
      AND master_acc_type = $4`,
      [copier_acc_id, copier_acc_type, master_acc_id, my_master_type]
    );
    if (contractData.rowCount === 0) await res.status(201).send("No Contarct data");
    const database_name = (copier_acc_type === 'tll' || copier_acc_type === 'tld') ? 'copiers' : copier_acc_type === 'mt4' ? 'metatrader_copiers' : 'metatrader5_copiers';
    if (contractData.rowCount > 0) {
      await client.query(
        `UPDATE ${database_name} 
        SET status = 'Stopped' 
        WHERE account_id = '${copier_acc_id}'
        AND type = '${copier_acc_type}'`
      )
      await res.status(200).send("ok");
    }
  }
  catch {
    await res.status(501).send("Server Error!");
  }
}

exports.disconnectMaster = async (req, res) => {
  try {
    const { copier_acc_id, copier_acc_type, master_acc_id, my_master_type } = req.body;
    console.log("Disconnect master", copier_acc_id, copier_acc_type, master_acc_id, my_master_type)
    const deleted_acc = await client.query(
      `DELETE FROM contract 
      WHERE copier_acc_id = $1 
      AND copier_acc_type = $2
      AND master_acc_id = $3
      AND master_acc_type = $4`,
      [copier_acc_id, copier_acc_type, master_acc_id, my_master_type]
    );
    if (deleted_acc.rowCount === 0) await res.status(201).send("No Contarct data");
    else {
      const database_name = (copier_acc_type === 'tll' || copier_acc_type === 'tld') ? 'copiers' : copier_acc_type === 'mt4' ? 'metatrader_copiers' : 'metatrader5_copiers';
      const updated_copier_acc = await client.query(
        `UPDATE ${database_name}
        SET status = $1, 
        my_master_name = $2, 
        my_master_id = $3, 
        my_master_type = $4 
        WHERE account_id = '${copier_acc_id}'
        AND type = '${copier_acc_type}'`,
        ["Nothing", "", "", ""]
      );
      if (updated_copier_acc.rowCount > 0) {
        const master_database_name = (my_master_type === 'tll' || my_master_type === 'tld') ? 'masters' : my_master_type === 'mt4' ? 'metatrader_masters' : 'metatrader5_masters';
        const history_name = (my_master_type === 'tll' || my_master_type === 'tld') ? 'history_positions' : 'history_orders';
        await client.query(
          `UPDATE ${master_database_name} 
          SET follows = follows - 1, 
          ${history_name} = $1 
          WHERE account_id = '${master_acc_id}'
          AND type = '${my_master_type}'`,
          [[]]
        );
        await res.status(200).send("ok");
      }
    }
  }
  catch {
    await res.status(501).send("Server Error!");
  }
}

//copiers action

exports.addMyMaster = async (req, res) => {
  try {
    const { copier_acc_id, copier_type, master_acc_id, master_type, action_type } = req.body;
    console.log(req.body);
    const master_table_name = (master_type === 'tld' || master_type === 'tll') ? 'masters' : master_type === "mt4" ? 'metatrader_masters' : 'metatrader5_masters';
    const copier_table_name = (copier_type === 'tld' || copier_type === 'tll') ? 'copiers' : copier_type === "mt4" ? 'metatrader_copiers' : 'metatrader5_copiers';

    const master_data = (master_type === 'tld' || master_type === 'tll') ? await client.query(
      `SELECT follows, account_name, acc_num FROM ${master_table_name} WHERE account_id = '${master_acc_id}'`
    ) : await client.query(
      `SELECT follows, account_name FROM ${master_table_name} WHERE account_id = '${master_acc_id}'`
    );

    const copier_data = (copier_type === 'tld' || copier_type === 'tll') ? await client.query(
      `SELECT acc_num, my_master_id FROM ${copier_table_name} WHERE account_id = '${copier_acc_id}'`
    ) : await client.query(
      `SELECT my_master_id FROM ${copier_table_name} WHERE account_id = '${copier_acc_id}'`
    );
    if (copier_data.rows[0].my_master_id === master_acc_id) {
      res.status(201).send("This account had already been set up to the master account.!");
      return;
    }
    if (action_type === "new") {
      if (master_data.rows[0].follows < 5) {
        await client.query(
          `UPDATE ${copier_table_name} 
        SET my_master_id = '${master_acc_id}', 
        my_master_name = '${master_data.rows[0].account_name}', 
        my_master_type = '${master_type}', 
        status = 'Connected' WHERE account_id = '${copier_acc_id}'`
        )
        await client.query(
          `UPDATE ${master_table_name} 
        SET follows = follows + 1 WHERE account_id = '${master_acc_id}'`
        )
        const updatedContract = await client.query(
          `INSERT INTO contract 
        ( copier_acc_id, 
         copier_acc_num, 
         copier_acc_type, 
         master_acc_id, 
         master_acc_num, 
         master_acc_type, status ) 
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
          [
            copier_acc_id,
            (copier_type === 'tld' || copier_type === 'tll') ? copier_data.rows[0].acc_num : -1,
            copier_type,
            master_acc_id,
            (master_type === 'tld' || master_type === 'tll') ? master_data.rows[0].acc_num : -1,
            master_type,
            "Connected"
          ]
        );
        if (updatedContract.rowCount > 0) await res.status(200).send("Your copier has been connected to your master. Now you can start copy trading!");
      }
      else {
        res.status(201).send("The master account you have selected cannot be connected with your copier account due to the current follower limit being reached at 5 accounts.");
      }
    }
    else if (action_type === "change") {
      await client.query(
        `UPDATE ${copier_table_name} 
      SET my_master_id = '${master_acc_id}', 
      my_master_name = '${master_data.rows[0].account_name}', 
      my_master_type = '${master_type}', 
      status = 'Connected' WHERE account_id = '${copier_acc_id}'`
      );
      await res.status(200).send("Your copier conection changed to other master.!");
    }

  }
  catch {
    await res.status(501).send("Server Error!");
  }
}

// exports.getOrdersHistory = async (req, res) => {
//   const { acc_id, acc_num, token } = req.body;
//   console.log(acc_id, acc_num, token)
//   await axios.get(`https://demo.tradelocker.com/backend-api/trade/accounts/${acc_id}/ordersHistory`, {
//     headers: {
//       'accept': 'application/json',
//       'Authorization': `Bearer ${token}`,
//       'accNum': `${acc_num}`,
//     }
//   }).then(async (response) => {
//     await res.send(response.data.d.ordersHistory);
//   })
// } 

//billing

exports.getTransactionHistory = async (req, res) => {
  try {
    const user = req.user;
    const { current_page, display_count } = req.body;
    const transactionHistory = user.transaction_history;
    const filetered_data = transactionHistory?.filter((history, index) => {
      if (index >= current_page * display_count && index < (current_page + 1) * display_count) return history;
    })
    res.status(200).send({ transactionHistory: filetered_data, transactionCount: transactionHistory?.length });
  }
  catch {
    res.status(501).send("failed");
  }
}
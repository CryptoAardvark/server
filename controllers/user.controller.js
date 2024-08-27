const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const client = require("../config/db/db.js");
const getToken = require("../config/utils/getToken.js");
const { emailExists, firstUser, matchPassword } = require("../config/helper.js");
const jwt = require("jsonwebtoken");
const emailjs = require('@emailjs/nodejs');
const config = require("../config/config.js");
const moment = require("moment");


exports.register = async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const userExists = await emailExists(email);
    const isFirstUser = await firstUser();
    const created_at = new Date();
    const formattedDate = created_at.toISOString();
    if (!userExists) {
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(password, salt);
      const manageRole = isFirstUser ? "admin" : "user";
      const data = await client.query(
        "INSERT INTO users (email, password, username, created_at, manage_role, verify, masters, copiers, follow_account, avatar, balance) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id, email, password, username, created_at, manage_role, balance",
        [email, hash, username, formattedDate, manageRole, false, [], [], [], "", 0]
      );
      if (data.rowCount === 0) res.status(201).send("Database Insert Error!");
      else {
        const token = getToken(data.rows[0]);
        const flag = await this.sendVerifyEmail(token, data.rows[0]);
        if (flag) {
          console.log(username, email, password);
          await res.status(200).send({
            token: token,
            user: data.rows[0]
          });
        }
        else res.status(203).send("Email Send Error!")
      }
    }
    else res.status(202).send("This user already exists!");
  }
  catch {
    await res.status(501).send("Server error");
  }
}

exports.sendVerifyEmail = async (token, user) => {
  try {
    const st = token.split(".");
    const sendToken = `?firstpart=${st[0]}&secondpart=${st[1]}&thirdpart=${st[2]}`;
    const templateParams = {
      to_name: user.username,
      from_name: "TradingATM",
      recipient: user.email,
      message: config.server_url + "/user/verify/token" + sendToken
    };
    const serviceID = "service_yan6r8n";
    const templateID = "template_mcx58n3";
    const userID = {
      publicKey: 'mzBuss3nc55LTbHcx',
      privateKey: '8pkOEygaDp4eLFzFX457X'
    }
    const response = await emailjs.send(serviceID, templateID, templateParams, userID);
    console.log(user.email, 'verify email send success', response.status, response.text);
    return true;
  }
  catch (err) {
    console.log(user.email, 'verify email send failed', err);
    return false;
  }
}

exports.sendEmail = async (req, res) => {
  try {
    const flag = await this.sendVerifyEmail(req.body.token, req.body.user);
    if (flag) res.status(200).send("ok");
  }
  catch {
    res.status(501).send("failed");
  }
}

exports.sendVerifyCode = async (req, res) => {
  try {
    const randomNumber = crypto.randomInt(100000, 1000000);
    const data = await client.query(
      `UPDATE users SET verify_code = ${randomNumber} WHERE email = '${req.body.email}' RETURNING *`
    )
    if (data.rowCount === 0) res.status(201).send("You are not registered. Please sign up with your email.");
    else {
      const templateParams = {
        to_name: data.rows[0].username,
        from_name: "TradingATM",
        recipient: req.body.email,
        message: randomNumber
      };
      const serviceID = "service_z4nls6p";
      const templateID = "template_tekavzu";
      const userID = {
        publicKey: 'lfNyYMLdX7ikJM5Eq',
        privateKey: 'YSiwbwwHa_ZAde0VTzVpb'
      }
      const response = await emailjs.send(serviceID, templateID, templateParams, userID);
      console.log(req.body.email, 'verify code send success', response.status, response.text);
      res.status(200).send("success");
    }
  }
  catch (err) {
    console.log(req.body.email, 'verify code send failed', err);
    res.status(501).send("Server Error");
  }
}

exports.checkVerifyCode = async (req, res) => {
  try {
    const data = await client.query(
      `SELECT * FROM users WHERE email = '${req.body.email}'`
    );
    if (data.rowCount === 0) res.status(201).send("Database Error");
    else {
      if (req.body.verifyCode === data.rows[0].verify_code) {
        res.status(200).send("ok");
      }
      else res.status(202).send("Verify Code Invalid");
    }
  }
  catch {
    res.status(501).send("Server Error");
  }
}

exports.changePassword = async (req, res) => {
  try {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(req.body.password, salt);

    const data = await client.query(
      `UPDATE users SET password = '${hash}'  WHERE email = '${req.body.email}'`
    );
    if (data.rowCount === 0) res.status(201).send("Database Error");
    else {
      res.status(200).send("ok");
    }
  }
  catch {
    res.status(501).send("Server Error");
  }
}

const getTradelockerAccounts = async (user) => {
  let masterIds = [];
  let copierIds = [];
  for (let i = 0; i < user.masters?.length; i++) {
    if (user.masters[i].type === "tld" || user.masters[i].type === "tll") masterIds.push(user.masters[i]);
  }
  for (let i = 0; i < user.copiers?.length; i++) {
    if (user.copiers[i].type === "tld" || user.copiers[i].type === "tll") copierIds.push(user.copiers[i]);
  }
  let accounts = [];
  for (let i = 0; i < masterIds.length; i++) {
    const masterAccName = await client.query(
      `SELECT account_id, account_name, type, follows, account_balance, avg_pl, total_pl_amount, registered_at, win_count, lose_count FROM masters WHERE account_id = '${masterIds[i].account_id}'`
    )
    if (masterAccName.rowCount === 0) continue;
    masterAccName.rows[0].role = "Master";
    masterAccName.rows[0].status = masterAccName.rows[0].follows.toString();
    delete masterAccName.rows[0].follows;
    accounts.push(masterAccName.rows[0]);
  }
  for (let i = 0; i < copierIds.length; i++) {
    const copierAccName = await client.query(
      `SELECT account_id, account_name, type, status, account_balance, avg_pl, total_pl_amount, registered_at, win_count, lose_count FROM copiers WHERE account_id = '${copierIds[i].account_id}'`
    )
    if (copierAccName.rowCount === 0) continue;
    copierAccName.rows[0].role = "Copier";
    accounts.push(copierAccName.rows[0]);
  }
  return accounts;
}

const getMetatraderAccounts = async (user) => {
  let masterIds = [];
  let copierIds = [];
  for (let i = 0; i < user.masters?.length; i++) {
    if (user.masters[i].type === "mt4") masterIds.push(user.masters[i]);
  }
  for (let i = 0; i < user.copiers?.length; i++) {
    if (user.copiers[i].type === "mt4") copierIds.push(user.copiers[i]);
  }
  let accounts = [];
  for (let i = 0; i < masterIds.length; i++) {
    const masterAccName = await client.query(
      `SELECT account_id, 
            account_name, 
            type, 
            follows, 
            account_balance, 
            avg_pl, 
            total_pl_amount, 
            registered_at, 
            win_count, 
            lose_count 
            FROM metatrader_masters 
            WHERE account_id = '${masterIds[i].account_id}'`
    )
    if (masterAccName.rowCount === 0) continue;
    masterAccName.rows[0].role = "Master";
    masterAccName.rows[0].status = masterAccName.rows[0].follows.toString();
    delete masterAccName.rows[0].follows;
    accounts.push(masterAccName.rows[0]);
  }
  for (let i = 0; i < copierIds.length; i++) {
    const copierAccName = await client.query(
      `SELECT 
            account_id, 
            account_name, 
            type, 
            status, 
            account_balance, 
            avg_pl, 
            total_pl_amount, 
            registered_at, 
            win_count, 
            lose_count 
            FROM metatrader_copiers 
            WHERE account_id = '${copierIds[i].account_id}'`
    )
    if (copierAccName.rowCount === 0) continue;
    copierAccName.rows[0].role = "Copier";
    accounts.push(copierAccName.rows[0]);
  }
  return accounts;
}

const getMetatrader5Accounts = async (user) => {
  let masterIds = [];
  let copierIds = [];
  for (let i = 0; i < user.masters?.length; i++) {
    if (user.masters[i].type === "mt5") masterIds.push(user.masters[i]);
  }
  for (let i = 0; i < user.copiers?.length; i++) {
    if (user.copiers[i].type === "mt5") copierIds.push(user.copiers[i]);
  }
  let accounts = [];
  for (let i = 0; i < masterIds.length; i++) {
    const masterAccName = await client.query(
      `SELECT account_id, 
            account_name, 
            type, 
            follows, 
            account_balance, 
            avg_pl, 
            total_pl_amount, 
            registered_at, 
            win_count, 
            lose_count FROM metatrader5_masters 
            WHERE account_id = '${masterIds[i].account_id}'`
    )
    if (masterAccName.rowCount === 0) continue;
    masterAccName.rows[0].role = "Master";
    masterAccName.rows[0].status = masterAccName.rows[0].follows.toString();
    delete masterAccName.rows[0].follows;
    accounts.push(masterAccName.rows[0]);
  }
  for (let i = 0; i < copierIds.length; i++) {
    const copierAccName = await client.query(
      `SELECT account_id, 
            account_name, 
            type, 
            status, 
            account_balance, 
            avg_pl, 
            total_pl_amount, 
            registered_at, 
            win_count, 
            lose_count 
            FROM metatrader5_copiers 
            WHERE account_id = '${copierIds[i].account_id}'`
    )
    if (copierAccName.rowCount === 0) continue;
    copierAccName.rows[0].role = "Copier";
    accounts.push(copierAccName.rows[0]);
  }
  return accounts;
}

exports.getMyAllAccounts = async (user) => {
  let accounts = [];
  const tradelocker_accounts = await getTradelockerAccounts(user);
  accounts = accounts.concat(tradelocker_accounts);
  const metatrader_accounts = await getMetatraderAccounts(user);
  accounts = accounts.concat(metatrader_accounts);
  const metatrader5_accounts = await getMetatrader5Accounts(user);
  accounts = accounts.concat(metatrader5_accounts);
  const sortedData = accounts.sort((a, b) => {
    return new Date(a.registered_at) - new Date(b.registered_at);
  });
  return sortedData;
}

exports.tokenVerification = async (req, res) => {
  try {
    let { token } = req.body;
    jwt.verify(token, config.secret, async (err, payload) => {
      if (err) await res.status(401).send("Unauthorized.");
      else {
        const data = await client.query(
          `UPDATE users SET verify = TRUE WHERE id = ${payload.id} RETURNING *`
        )
        if (data.rowCount === 0) res.status(201).send("Failed.");
        else {
          const accounts = await this.getMyAllAccounts(data.rows[0]);
          await res.status(200).send({
            token: getToken(data.rows[0]),
            user: data.rows[0],
            accounts: accounts
          })
        }
      }
    });
  }
  catch {
    res.status(501).send("Server error");
  }
}

exports.login = async (req, res) => {
  try {
    const data = await client.query(
      `SELECT * FROM users WHERE id = ${req.user.id}`
    );
    if (data.rows[0].verify) {
      const accounts = await this.getMyAllAccounts(data.rows[0]);
      await res.status(200).send({
        token: getToken(data.rows[0]),
        user: data.rows[0],
        accounts: accounts
      });
    }
    else {
      const token = getToken(data.rows[0]);
      const flag = await this.sendVerifyEmail(token, data.rows[0]);
      if (flag) {
        await res.status(201).send({
          token: token,
          user: data.rows[0],
        });
      }
    }
  }
  catch {
    res.status(501).send("Server error")
  }
}

exports.loginWithToken = async (req, res) => {
  try {
    let { token } = req.body;
    jwt.verify(token, config.secret, async (err, payload) => {
      if (err) return res.status(401).send("Unauthorized.");
      else {
        const data = await client.query(
          `SELECT * FROM users WHERE id = ${payload.id}`
        );
        console.log("user id", payload.id);
        if (data.rowCount === 0) res.status(201).send("No User Exist");
        else {
          const accounts = await this.getMyAllAccounts(data.rows[0]);
          await res.status(200).send({
            token: getToken(data.rows[0]),
            user: data.rows[0],
            accounts: accounts
          })
        }
      }
    });
  }
  catch {
    await res.send("Server error");
  }
}

exports.getUserData = async (req, res) => {
  try {
    const accounts = await this.getMyAllAccounts(req.user);
    await res.status(200).send({
      user: req.user,
      accounts: accounts
    })
  }
  catch {
    await res.status(501).send("Getting Data Failed!")
  }
}

exports.getAccountData = async (req, res) => {
  try {
    const { type, account_id, role, days } = req.body;
    const count = days === 1 ? 24 : days;
    const interval = days === 1 ? 1 : 24;
    if (role === "Master") {
      const table_name = (type === "tld" || type === "tll") ? "masters" : type === "mt4" ? "metatrader_masters" : "metatrader5_masters";
      const masterAcc = await client.query(
        `SELECT account_id, 
                account_name, 
                type, 
                account_balance, 
                avg_pl, 
                total_pl_amount, 
                registered_at, 
                win_count, 
                lose_count, 
                master_pl, 
                registered_at FROM ${table_name} 
                WHERE account_id = '${account_id}'
                AND type = '${type}'`
      )
      if (masterAcc.rowCount === 0) return;
      masterAcc.rows[0].role = "Master";
      const pl = masterAcc.rows[0].master_pl;
      delete masterAcc.rows[0].master_pl;
      let process_pl = [];
      let i = pl?.length - 1;
      let balance = masterAcc.rows[0].account_balance;
      let maxVal = balance;
      let minVal = 0;
      let plMaxVal = 5;
      let plMinVal = -5;
      if (i >= 0) {
        maxVal = pl[i].balance;
        minVal = pl[i].balance;
        plMaxVal = pl[i].pl;
        plMinVal = pl[i].pl;
      }
      for (let d = 1; d <= count; d++) {
        let isExist = false;
        const daysAgo = new Date(Date.now() - d * interval * 60 * 60 * 1000);
        if (daysAgo < masterAcc.rows[0].registered_at) break;
        let day_pl = 0;
        for (; i >= 0; i--) {
          if (new Date(pl[i].date) > daysAgo) {
            if (!isExist) balance = pl[i].balance;
            isExist = true;
            day_pl += pl[i].pl;
          }
          else {
            break;
          }
        }
        process_pl.push({
          date: moment(new Date(Date.now() - (d - 1) * interval * 60 * 60 * 1000)),
          pl: day_pl,
          balance: balance
        });
        if (maxVal < balance) maxVal = balance;
        if (minVal > balance) minVal = balance;
        if (plMaxVal < day_pl) plMaxVal = day_pl;
        if (plMinVal > day_pl) plMinVal = day_pl;
        // if (i < 0) break;
      }
      // console.log(plMinVal, plMaxVal)
      await res.status(200).send({
        data: masterAcc.rows[0],
        pl: process_pl.reverse(),
        maxVal: Math.max(maxVal, 5),
        minVal: minVal,
        plMaxVal: Math.max(plMaxVal, 5),
        plMinVal: Math.min(plMinVal, -5)
      });
    }
    else {
      const table_name = (type === "tld" || type === "tll") ? "copiers" : type === "mt4" ? "metatrader_copiers" : "metatrader5_copiers";
      const copierAcc = await client.query(
        `SELECT account_id, 
                account_name, 
                type, 
                account_balance, 
                avg_pl, total_pl_amount, 
                registered_at, 
                win_count, 
                lose_count, 
                copier_pl FROM ${table_name}
                WHERE account_id = '${account_id}'
                AND type = '${type}'`
      )
      if (copierAcc.rowCount === 0) return;
      copierAcc.rows[0].role = "Copier";
      const pl = copierAcc.rows[0].copier_pl;
      delete copierAcc.rows[0].copier_pl;
      let process_pl = [];
      let i = pl?.length - 1;
      let balance = copierAcc.rows[0].account_balance;
      let maxVal = balance;
      let minVal = 0;
      let plMaxVal = 5;
      let plMinVal = -5;
      if (i >= 0) {
        maxVal = pl[i].balance;
        minVal = pl[i].balance;
        plMaxVal = pl[i].pl;
        plMinVal = pl[i].pl;
      }
      for (let d = 1; d <= count; d++) {
        let isExist = false;
        const daysAgo = new Date(Date.now() - d * interval * 60 * 60 * 1000);
        if (daysAgo < copierAcc.rows[0].registered_at) break;
        let day_pl = 0;
        for (; i >= 0; i--) {
          if (new Date(pl[i].date) > daysAgo) {
            if (!isExist) balance = pl[i].balance;
            isExist = true;
            day_pl += pl[i].pl;
          }
          else {
            break;
          }
        }
        process_pl.push({
          date: moment(new Date(Date.now() - (d - 1) * interval * 60 * 60 * 1000)),
          pl: day_pl,
          balance: balance
        });
        if (maxVal < balance) maxVal = balance;
        if (minVal > balance) minVal = balance;
        if (plMaxVal < day_pl) plMaxVal = day_pl;
        if (plMinVal > day_pl) plMinVal = day_pl;
        // if (i < 0) break;
      }
      await res.status(200).send({
        data: copierAcc.rows[0],
        pl: process_pl.reverse(),
        maxVal: Math.max(maxVal, 5),
        minVal: minVal,
        plMaxVal: Math.max(plMaxVal, 5),
        plMinVal: Math.min(plMinVal, -5)
      });
    }
  }
  catch {
    await res.status(501).send("Getting Account Data Failed!");
  }
}

exports.uploadProfile = async (req, res) => {
  try {
    const { avatarURL, userInfo } = req.body;
    const updatedData = await client.query(
      `UPDATE users 
            SET avatar = $1,
            phone_number = $2,
            first_name = $3,
            last_name = $4 
            WHERE id = ${req.user.id}`,
      [avatarURL, userInfo.phone_number, userInfo.first_name, userInfo.last_name]
    );
    if (updatedData.rowCount > 0) {
      for (let i = 0; i < req.user.masters?.length; i++) {
        if (req.user.masters[i].type === "tld" || req.user.masters[i].type === "tll") {
          await client.query(
            `UPDATE masters SET avatar = $1 WHERE account_id = '${req.user.masters[i].account_id}'`,
            [avatarURL]
          )
        }
        if (req.user.masters[i].type === "mt4") {
          await client.query(
            `UPDATE metatrader_masters SET avatar = $1 WHERE account_id = '${req.user.masters[i].account_id}'`,
            [avatarURL]
          )
        }
        if (req.user.masters[i].type === "mt5") {
          await client.query(
            `UPDATE metatrader5_masters SET avatar = $1 WHERE account_id = '${req.user.masters[i].account_id}'`,
            [avatarURL]
          )
        }
      }
      for (let i = 0; i < req.user.copiers?.length; i++) {
        if (req.user.copiers[i].type === "tld" || req.user.copiers[i].type === "tll") {
          await client.query(
            `UPDATE copiers SET avatar = $1 WHERE account_id = '${req.user.copiers[i].account_id}'`,
            [avatarURL]
          )
        }
        if (req.user.copiers[i].type === "mt4") {
          await client.query(
            `UPDATE metatrader_copiers SET avatar = $1 WHERE account_id = '${req.user.copiers[i].account_id}'`,
            [avatarURL]
          )
        }
        if (req.user.copiers[i].type === "mt5") {
          await client.query(
            `UPDATE metatrader5_copiers SET avatar = $1 WHERE account_id = '${req.user.copiers[i].account_id}'`,
            [avatarURL]
          )
        }
      }
      await res.status(200).send("ok");
    }
  }
  catch {
    await res.status(501).send("Server Error!");
  }
}

exports.updateBalance = async (req, res) => {
  try {
    res.status(200).send({ balance : req.user.balance})
  }
  catch {
    res.status(501).send("failed");
  }
}

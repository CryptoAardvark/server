var passport = require("passport"),
  requireAuth = passport.authenticate("jwt", { session: false }),
  router = require("express").Router(),
  dashboardCtr = require("../controllers/dashboard.controller");

//dashboard
router.post("/delete-account", requireAuth, dashboardCtr.deleteAccount);
//integration
//tradelocker
router.post("/add-master-account", requireAuth, dashboardCtr.addMasterAccount);
router.post("/add-copier-account", requireAuth, dashboardCtr.addCopierAccount);

//metatrader
router.post("/add-metatrader-master-account", requireAuth, dashboardCtr.addMetatraderMasterAccount);
router.post("/add-metatrader-copier-account", requireAuth, dashboardCtr.addMetatraderCopierAccount);

//masters
router.post("/get-masters-list", requireAuth, dashboardCtr.getMastersList);
router.post("/add-follow-master-account", requireAuth, dashboardCtr.addFollowMasterAccount);
router.post("/remove-follow-master-account", requireAuth, dashboardCtr.removeFollowMasterAccount);

//copiers
router.post("/get-copiers-list", requireAuth, dashboardCtr.getCopiersList);
router.post("/get-my-masters-list", requireAuth, dashboardCtr.getMyMastersList);
router.post("/start-trading", requireAuth, dashboardCtr.startTrading);
router.post("/stop-trading", requireAuth, dashboardCtr.stopTrading);
router.post("/disconnect-master", requireAuth, dashboardCtr.disconnectMaster);

//copiers action
router.post("/add-my-master", requireAuth, dashboardCtr.addMyMaster);
// router.post("/getOrdersHistory", dashboardCtr.getOrdersHistory);

//billing
router.post("/get-transaction-history", requireAuth, dashboardCtr.getTransactionHistory);

module.exports = router;
var passport = require("passport"),
    requireAuth = passport.authenticate("jwt", { session: false }),
    router = require("express").Router(),
    cryptochillCtr = require("../controllers/cryptochill.controller");

router.post("/get-profile", cryptochillCtr.getProfile);
router.post("/pay-crypto", requireAuth, cryptochillCtr.payCrypto);
router.post("/withdraw-crypto", requireAuth, cryptochillCtr.withdrawCrypto);
router.post("/cryptochill-callback", cryptochillCtr.cryptoChillCallback);
router.post("/get-transaction", cryptochillCtr.getTransaction);
router.post("/get-invoice", cryptochillCtr.getInvoice);

module.exports = router;
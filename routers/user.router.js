var passport = require("passport"),
  requireSignin = passport.authenticate("local", { session: false }),
  requireAuth = passport.authenticate("jwt", { session: false }),
  router = require("express").Router(),
  userCtr = require("../controllers/user.controller");

router.post("/register", userCtr.register);
router.post("/login", requireSignin, userCtr.login);
router.post("/send-verify-email", userCtr.sendEmail);
router.post("/token-verification", userCtr.tokenVerification);
router.post("/login-with-token", userCtr.loginWithToken);
router.post("/upload-profile", requireAuth, userCtr.uploadProfile);
router.post("/get-user-data", requireAuth, userCtr.getUserData);
router.post("/get-account-data", requireAuth, userCtr.getAccountData);
router.post("/send-verify-code", userCtr.sendVerifyCode);
router.post("/check-verify-code", userCtr.checkVerifyCode);
router.post("/change-password", userCtr.changePassword);
router.post("/update-balance", requireAuth, userCtr.updateBalance);

module.exports = router;
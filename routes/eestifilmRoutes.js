const express = require("express");
const router = express.Router();
const general = require("../generalFnc");
const {eestifilm,
    tegelased,
    lisa,
    lisaseos} = require("../controllers/eestifilmController");

//kõikidele marsruutidele vahevara checkLogin
router.use(general.checkLogin);

router.route("/").get(eestifilm);

router.route("/tegelased").get(tegelased);

router.route("/lisa").get(lisa);

router.route("/lisaseos").get(lisaseos);

module.exports = router;
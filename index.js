const express = require("express");
const dateTime = require("./dateTime");
const fs = require("fs");
//et saada kõik päringust kätte
const bodyparser = require("body-parser");
//andmebaasi andmed
const dbInfo = require("../../../vp2024config");
//andmebaasiga suhtlemine
const mysql = require("mysql2");
//fotode üleslaadimiseks
const multer = require("multer");
//fotomanipulatsiooniks
const sharp = require("sharp");
//paroolide krüpteerimiseks
const bcrypt = require("bcrypt");
//sessioonihaldur
const session = require("express-session");
//asünkroonsuse võimaldaja
const asyn = require("async");
const general = require("./generalFnc");


const app = express();

//määran view mootori 
app.set("view engine", "ejs");
//määran jagatavate, avalike failide kausta
app.use(express.static("public"));
//kasutame body-parserit päringute parsimiseks (kui ainult tekst, siis false, kui ka pildid jms, siis true)
app.use(bodyparser.urlencoded({extended: true}));
//seadistame fotode üleslaadimiseks vahevara (middleware), mis määrab kataloogi, kuhu laetakse
const upload = multer({dest: "./public/gallery/orig"});
//sessioonihaldur
app.use(session({secret: "minuAbsoluutseltSalajaneVõti", saveUninitialized: true, resave: true}));
//let mySession;

//loon andmebaasiühenduse
const conn = mysql.createConnection({
	host: dbInfo.configData.host,
	user: dbInfo.configData.user,
	password: dbInfo.configData.passWord,
	database: dbInfo.configData.dataBase
});

//uudiste osa eraldi ruuteriga
const newsRouter = require("./routes/newsRouter");
app.use("/news", newsRouter);

//Eesti film osa eraldi ruuteriga
const eestifilmRouter = require("./routes/eestifilmRoutes");
app.use("/eestifilm", eestifilmRouter);

app.get("/", (req, res)=>{
	//res.send("Express läks käima!");
	//console.log(dbInfo.configData.host);
	res.render("index");
});

app.post("/", (req, res)=>{
	let notice = null;
	if(!req.body.emailInput || !req.body.passwordInput){
		console.log("Sisselogimise andmed pole täielikud!");
		notice = "Sisselogimise andmeid on puudu!";
		res.render("index", {notice: notice});
	}
	else {
		let sqlReq = "SELECT id,password FROM vp2users WHERE email = ?";
		conn.execute(sqlReq, [req.body.emailInput], (err, result)=>{
			if(err){
				notice = "Tehnilise vea tõttu ei saa sisse logida!";
				console.log(err);
				res.render("index", {notice: notice});
			}
			else {
				if(result[0] != null){
					//kontrollime, kas sisselogimisel sisestatud paroolist saaks sellise räsi nagu andmebaasis
					bcrypt.compare(req.body.passwordInput, result[0].password, (err, compareresult)=>{
						if(err){
							notice = "Tehnilise vea tõttu andmete kontrollimisel ei saa sisse logida!";
							console.log(err);
							res.render("index", {notice: notice});
						}
						else {
							//kui võrdlustulemus  on positiivne
							if(compareresult){
								notice = "Oledki sisseloginud!";
								//võtame sessiooni kasutusele
								//mySession = req.session;
								//mySession.userId = result[0].id;
								req.session.userId = result[0].id;
								//res.render("index", {notice: notice});
								res.redirect("/home");
							}
							else {
								notice = "Kasutajatunnus ja/või parool oli vale!";
								res.render("index", {notice: notice});
							}
						}
					});
				}
				else {
					notice = "Kasutajatunnus või parool oli vale!";
					res.render("index", {notice: notice});
				}
			}
		});
	}
	//res.render("index");
});

app.get("/logout", (req, res)=>{
	req.session.destroy();
	//mySession = null;
	res.redirect("/");
});

app.get("/home", general.checkLogin, (req, res)=>{
	console.log("Sisse on loginud kasutaja: " + req.session.userId);
	res.render("home");
});

app.get("/signup", (req, res)=>{
	res.render("signup");
});

app.post("/signup", (req, res)=>{
	let notice = "Ootan andmeid";
	if(!req.body.firstNameInput || !req.body.lastNameInput || !req.body.birthDateInput || !req.body.genderInput || !req.body.emailInput || req.body.passwordInput.length < 8 || req.body.passwordInput !== req.body.confirmPasswordInput){
		console.log("Andmeid puudu või paroolid ei klapi!");
		notice = "Andmeid on puudu või paroolid ei kattu!";
		res.render("signup", {notice: notice});
	}
	else {
		notice = "Andmed korras!";
		bcrypt.genSalt(10, (err, salt)=>{
			if(err){
				notice = "Tehniline viga, kasutajat ei loodud.";
				res.render("signup", {notice: notice});
			}
			else {
				bcrypt.hash(req.body.passwordInput, salt, (err, pwdHash)=>{
					if(err){
						notice = "Tehniline viga parooli krüpteerimisel, kasutajat ei loodud.";
						res.render("signup", {notice: notice});
					}
					else {
						let sqlReq = "INSERT INTO vp2users (first_name, last_name, birth_date, gender, email, password) VALUES(?,?,?,?,?,?)";
						conn.execute(sqlReq, [req.body.firstNameInput, req.body.lastNameInput, req.body.birthDateInput, req.body.genderInput, req.body.emailInput, pwdHash], (err, result)=>{
							if(err){
								notice = "Tehniline viga andmebaasi kirjutamisel, kasutajat ei loodud.";
								res.render("signup", {notice: notice});
							}
							else {
								notice = "Kasutaja " + req.body.emailInput + " edukalt loodud!";
								res.render("signup", {notice: notice});
							}
						});
					}
				});
			}
		});
		//res.render("signup", {notice: notice});
	}
	//res.render("signup");
});

app.get("/timenow", (req, res)=>{
	const weekdayNow = dateTime.weekDayEt();
	const dateNow = dateTime.dateFormattedEt();
	const timeNow = dateTime.timeFormattedEt();
	res.render("timenow", {nowWD: weekdayNow, nowD: dateNow, nowT: timeNow});
});

app.get("/vanasonad", (req, res)=>{
	let folkWisdom = [];
	fs.readFile("public/textfiles/vanasonad.txt", "utf8", (err, data)=>{
		if(err){
			//throw err;
			res.render("justlist", {h2: "Vanasõnad", listData: ["Ei leidnud midagi!"]});
		}
		else {
			folkWisdom = data.split(";");
			res.render("justlist", {h2: "Vanasõnad", listData: folkWisdom});
		}
	});
	
});

app.get("/regvisit", (req, res)=>{
	res.render("regvisit");
});

app.post("/regvisit", (req, res)=>{
	//console.log(req.body);
	//avan txt faili selliselt, et kui seda pole olemas, luuakse
	fs.open("public/textfiles/log.txt", "a", (err, file) => {
		if(err){
			throw err;
		}
		else {
			fs.appendFile("public/textfiles/log.txt", req.body.firstNameInput + " " + req.body.lastNameInput + ";", (err)=>{
				if(err){
					throw err;
				}
				else {
					console.log("Faili kirjutati!");
					res.render("regvisit");
				}
			});
		}
	});
	//res.render("regvisit");
});

app.get("/regvisitdb", (req, res)=>{
	let notice = "";
	let firstName = "";
	let lastName = "";
	res.render("regvisitdb", {notice: notice, firstName: firstName, lastName: lastName});
});

app.post("/regvisitdb", (req, res)=>{
	let notice = "";
	let firstName = "";
	let lastName = "";
	//kontrollin, kas kõi vajalikud andmed on olemas
	if(!req.body.firstNameInput || !req.body.lastNameInput){
		//console.log("Osa andmeid puudu!");
		notice = "Osa andmeid puudu!";
		firstName = req.body.firstNameInput;
		lastName = req.body.lastNameInput;
		res.render("regvisitdb", {notice: notice, firstName: firstName, lastName: lastName});
	}
	else {
		let sqlReq = "INSERT INTO vp2visitlog (first_name, last_name) VALUES(?,?)";
		conn.query(sqlReq, [req.body.firstNameInput, req.body.lastNameInput], (err, sqlRes)=>{
			if(err){
				notice = "Tehnilistel põhjustel andmeid ei salvestatud!";
				res.render("regvisitdb", {notice: notice, firstName: firstName, lastName: lastName});
				throw err;
			}
			else {
				//notice = "Andmed salvestati!";
				//res.render("regvisitdb", {notice: notice, firstName: firstName, lastName: lastName});
				res.redirect("/");
			}
		});
	}
});

//fotode üleslaadimise osa eraldi marsruutide failiga
const photoupRouter = require("./routes/photouploadRoutes");
app.use("/photoupload", photoupRouter);

//galerii osa eraldi marsruutide failiga
const galleryRouter = require("./routes/galleryRoutes");
app.use("/gallery", galleryRouter);

//ilmateate osa eraldi marsruutide failiga
const weatherRouter = require("./routes/weatherRoutes");
app.use("/weather", weatherRouter);

app.listen(5200);
const express = require('express');
const app = express();
const port = 80;
var sql = require('mssql');
var session = require('express-session');
var cookieParser = require('cookie-parser');

//Setting various parameters
app.set('view engine', 'pug');
app.use(express.json());
app.use(express.urlencoded({extended:true}));
app.use(session({secret: "asufghaunefnw98fn", resave: true, saveUninitialized: true}));
app.use(cookieParser());

// Endpoints for views
app.get(['/index', '/'], checkForLogin, (req, res) => {res.render('index')});
app.get('/login', (req, res) => res.render('login'));
app.get('/postPiece', checkForLogin, (req, res) => {res.render('postPiece')});
app.get('/dataImport', checkForLogin, (req, res) => {res.render('dataImport')});

//Catchall for .html files that haven't been converted to views yet
app.use('/', checkForLogin, express.static('public', {extensions: ['html', 'htm']}));

//Posts to various forms
app.post('/login', (req, res) => attemptLogin(req, res));
app.post('/register', (req, res) => attemptRegister(req, res));
app.post('/searchResults', (req, res) => pieceSearch(req, res));

//Logout
app.get('/logout', (req, res) => logout(req, res));

//Start the server!
app.listen(port, () => console.log(`App listening at http://localhost:${port}`));

const config = {
    user: 'SheetMusicClient',
    password: 'HJCszqVxEe1',
    server: 'golem.csse.rose-hulman.edu',
    database: 'SheetMusic'
}

function attemptLogin(req, res) {
    callProcedure("Login", [{name: "Username", type: sql.VarChar(30), value: req.body.Username}, {name: "Password", type: sql.VarChar(50), value: req.body.Password}], function(result, err) {
        if (result.length > 0) {
            req.session.user = req.body;
            res.redirect("/");
        } else {
            res.render('login', {failMessage: "The username or password was incorrect."});
        }
    })
}

function attemptRegister(req, res) {
    callProcedure("RegisterUser", [{name: "Username", type: sql.VarChar(30), value: req.body.Username}, {name: "Password", type: sql.VarChar(50), value: req.body.Password}], function(result, err) {
        if (err) {
            res.redirect("/register");
        } else {
            req.session.user = req.body;
            res.redirect("/");
        }
    })
}

function checkForLogin(req, res, next) {
    if (req.session.user || (req.path == '/login') || (req.path == '/css/site.css') || (req.path == '/register')) {
        next();
    } else {
        res.redirect('/login');
    }
}

function logout(req, res) {
    req.session.user = undefined;
    res.redirect('/');
}

function pieceSearch(req, res) {
    callProcedure("PiecesWithTitle", [{name: "Title", type: sql.VarChar(50), value: req.body.Title}], function(result, err) {
        if (err) {
            res.redirect("/searchResults");
        } else {
            res.send(result);
        }
    })
}

function callProcedure(proc_name, inputs, callback) {
    sql.connect(config).then(pool => {
        var connection = pool.request();
        for (var i = 0; i < inputs.length; i++) {
            connection = connection.input(inputs[i].name, inputs[i].type, inputs[i].value);
        }
        return connection.execute(proc_name);
    }).then(result => {
        callback(result.recordset, null);
    }).catch(err => {
        callback([], err);
    })
}
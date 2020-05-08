const express = require('express');
const fileUpload = require('express-fileupload');
const app = express();
const port = 80;
var sql = require('mssql');
var session = require('express-session');
var cookieParser = require('cookie-parser');
var bcrypt = require('bcrypt');
var saltRounds = 10;

//Setting various parameters
app.set('view engine', 'pug');
app.use(express.json());
app.use(fileUpload({
    limits: {fileSize: 50*1024*1024},
    useTempFIles: true,
    tempFileDir: '/tmp'
}));
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
app.post('/postPiece', (req, res) => postPiece(req, res));
app.post('/import', (req, res) => importPieces(req, res));

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
    callProcedure("GetPassword", [{name: "Username", type: sql.VarChar(30), value: req.body.Username}], function(result, err) {
        if (result.length > 0) {
            console.log(`test`);
            // console.log(result[0].length);
            bcrypt.compare(req.body.Password,result[0].Password, function(err,result) {
                if (result) {
                    req.session.user = req.body;
                    res.redirect("/");
                } else {
                    res.render('login', {failMessage: "The username or password was incorrect."});
                }
            });
        } else {
            res.render('login', {failMessage: "The username or password was incorrect."});
        }
    });
}

function attemptRegister(req, res) {
    bcrypt.hash(req.body.Password,saltRounds,function(err, hash){
        callProcedure("RegisterUser", [{name: "Username", type: sql.VarChar(30), value: req.body.Username}, {name: "Password", type: sql.NVarChar(80), value: hash}], function(result, err) {
            if (err) {
                res.redirect("/register");
            } else {
                req.session.user = req.body;
                res.redirect("/");
            }
        })
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
        if (err || result.length == 0) {
            res.redirect("/searchResults");
        } else {
            callProcedure("GetPieceData", [{name: "ID", type: sql.Int, value: result[0].ID}], function(result, err) {
                if (err) {
                    res.redirect("/searchResults");
                } else {
                    res.writeHead(200, {
                        "Content-Type": "application/pdf",
                        "Content-Disposition": "attachment; filename=sheet.pdf"
                    });
                    res.end(result[0].Sheet);
                }
            })
        }
    })
}

function postPiece(req, res) {
    console.log(req.files);
    uploadPiece(req.body.Title, req.files.Sheet.data, req.body.Copyright, 1, null, false, function(err) {
        if (err) {
            res.redirect("/");
        } else {
            res.redirect("/postPiece");
        }
    })
}

function importPieces(req, res) {
    var fileData = JSON.parse(req.body.Meta);
    for (var i = 0; i < fileData.length; i++) {
        var filename = fileData[i].filename;
        req.files.Sheets.forEach(sheet => {
            if (sheet.name == filename) {
                uploadPiece(fileData[i].title, sheet.data, fileData[i].copyright, fileData[i].composerID, fileData[i].publisherID, !!fileData[i].isPaid, function(err) {
                    if (err) console.log(err);
                })
            }
        })
    }
    res.redirect("/");
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

function uploadPiece(title, sheetBuffer, copyright, composerID, publisherID, isPaid, callback) {
    sql.connect(config).then(pool => {
        var ps = new sql.PreparedStatement(pool);
        ps.input('title', sql.VarChar(50));
        ps.input('sheet', sql.VarBinary);
        ps.input('copyright', sql.VarChar(50));
        ps.input('cID', sql.Int);
        ps.input('pID', sql.Int);
        ps.input('paid', sql.Bit);
        return ps.prepare('EXEC PostPiece @title, @sheet, @copyright, @cID, @pID, @paid', function(err) {
            if (err) {callback(err); return;}
            ps.execute({title: title, sheet: sheetBuffer, copyright: copyright, cID: composerID, pID: publisherID, paid: isPaid}, function(err, records) {
                if (err) {callback(err); return;}
                ps.unprepare(function(err) {
                    callback(err);
                })
            })
        })
    }).catch(err => {
        callback(err);
    })
}
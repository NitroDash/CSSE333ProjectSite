const express = require('express');
const app = express();
const port = 80;
var Connection = require('tedious').Connection;
var Request = require('tedious').Request;
var session = require('express-session');
var cookieParser = require('cookie-parser');

app.use(express.json());
app.use(express.urlencoded({extended:true}));
app.use(session({secret: "asufghaunefnw98fn", resave: true, saveUninitialized: true}));
app.use(cookieParser());

app.use('/', checkForLogin, express.static('public', {extensions: ['html', 'htm']}));
app.post('/login', (req, res) => attemptLogin(req, res));
app.post('/register', (req, res) => attemptRegister(req, res));
app.post('/searchResults', (req, res) => pieceSearch(req, res));
app.listen(port, () => console.log(`App listening at http://localhost:${port}`));

var config = {
  server: 'golem.csse.rose-hulman.edu',
  authentication: {
    type: 'default',
    options: {
      userName: 'SheetMusicClient',
      password: 'HJCszqVxEe1'
    }
  }
}

function sanitize(input) {
    return input;
}

function attemptLogin(req, res) {
    executeQuery(`EXEC [Login] '${sanitize(req.body.Username)}', '${sanitize(req.body.Password)}'`, function(result, err) {
        if (result.length > 0) {
            req.session.user = req.body;
            res.redirect("/index");
        } else {
            res.redirect("/");
        }
    })
}

function attemptRegister(req, res) {
    executeQuery(`EXEC [RegisterUser] '${sanitize(req.body.Username)}', '${sanitize(req.body.Password)}'`, function(result, err) {
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

function pieceSearch(req, res) {
    executeQuery(`EXEC [PiecesWithTitle] [${req.body.Title}]`, function(result, err) {
        if (err) {
            res.redirect("/searchResults");
        } else {
            res.send(result);
        }
    })
}

function executeQuery(query, callback) {
    var connection = new Connection(config);
    connection.connect();
    connection.on('connect', function(err) {
        if (err) {
            console.log(err);
            callback([], "ERROR: Connection failed");
        } else {
            executeStatement(query, connection, callback);
        }
    })
}

function executeStatement (query, connection, callback) {
    var result = [];
  request = new Request(query, function (err, rowCount) {
    if (err) {
      console.log(err);
        callback([], err);
    } else {
      console.log(rowCount + ' rows')
        callback(result, null);
        connection.close();
    }
  })

  request.on('row', function (columns) {
      result.push(columns);
    /*columns.forEach(function (column) {
      if (column.value === null) {
        console.log('NULL')
      } else {
        console.log(column.value)
      }
    })*/
  })

  connection.execSql(request)
}
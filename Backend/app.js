const express = require('express');
const app = express();
const port = 3000;
var Connection = require('tedious').Connection;
var Request = require('tedious').Request;

app.get('/', (req, res) => requestAndReturn(res));
app.get('/login/user/:user/pass/:pass', (req, res) => attemptLogin(req.params.user, req.params.pass, res));
app.listen(port, () => console.log(`App listening at http://localhost:${port}`))

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

function attemptLogin(user, pass, res) {
    executeQuery(`EXEC [Login] '${sanitize(user)}', '${sanitize(pass)}'`, function(result, err) {
        res.send(result.length > 0);
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
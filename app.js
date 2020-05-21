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
app.get(['/index', '/'], checkForLogin, (req, res) => {res.render('index', {'user':  req.session.user.Username})});
app.get('/login', (req, res) => res.render('login'));
app.get('/postPiece', checkForLogin, (req, res) => renderPiecePostPage(req, res));
app.get('/dataImport', (req, res) => {res.render('dataImport')});
app.get('/postReview', checkForLogin, (req, res) => renderPostReviewPage(req, res, req.query.id));
app.get('/piece', checkForLogin, (req, res) => renderPiecePage(req, res, req.query.id));
app.get('/paidPiece', checkForLogin, (req, res) => renderPaidPiecePage(req, res, req.query.id));
app.get('/userProfile', checkForLogin, (req, res) => renderProfilePage(req, res, req.query.id));
app.get('/pdfs', checkForLogin, (req, res) => renderPDF(req, res, req.query.id));
app.get('/pdfPreview', checkForLogin, (req, res) => renderPDFPreview(req, res, req.query.id));
app.get('/register', (req, res) => {res.render('register')});
app.get('/datadump', (req, res) => getAllData(req, res));

//Posts to various forms
app.post('/login', (req, res) => attemptLogin(req, res));
app.post('/register', (req, res) => attemptRegister(req, res));
app.post('/searchResults', checkForLogin, (req, res) => pieceSearch(req, res));
app.post('/postPiece', checkForLogin, (req, res) => postPiece(req, res));
app.post('/postReview', checkForLogin, (req, res) => postReview(req, res));
app.post('/import', (req, res) => importData(req, res));

//Catchall for .html files that haven't been converted to views yet
app.use('/', checkForLogin, express.static('public', {extensions: ['html', 'htm']}));

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
    if (req.body.Password != req.body.PasswordRepeat) {
        res.render('register', {failMessage: "The entered passwords must match."});
        return;
    }
    bcrypt.hash(req.body.Password,saltRounds,function(err, hash){
        callProcedure("RegisterUser", [{name: "Username", type: sql.VarChar(30), value: req.body.Username}, {name: "Password", type: sql.NVarChar(80), value: hash}], function(result, err) {
            if (err) {
                res.render("register", {failMessage: "That username already exists. Please choose another."});
            } else {
                if (req.body.isComposer) {
                    callProcedure("RegisterComposerForUser", [{name: "ComposerName", type: sql.VarChar(30), value: req.body.Username}], function(result, err) {})
                }
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
    callProcedure("PiecesMatchingSearch", [{name: "searchTerm", type: sql.VarChar(50), value: req.body.Title}], function(result, err) {
        if (err || result.length == 0) {
            res.render("searchResults", {results:[]});
        } else {
            let piecesLeft = result.length;
            let results = []; 
            for (let i = 0; i < result.length; i++) {
                callProcedure("GetShortPieceData", [{name: "ID", type: sql.Int, value: result[i].ID}], function(pieceData, err) {
                    piecesLeft--;
                    if (!err && pieceData.length > 0) {
                        results.push(pieceData[0]);
                        console.log(pieceData[0].IsPaid)
                    }
                    if (piecesLeft == 0) {
                        res.render("searchResults", {'results': results});
                    }
                })
            }
        }
    })
}

/*function renderIndexPage(req, res, username) {
    callProcedure("GetShortPieceData", [{name: "ID", type: sql.Int, value: pieceID}], function(pieceData, err) {
        if (err) {
            res.render("piece");
        } else {
            callProcedure("ReviewsOfPiece", [{name: "PieceID", type: sql.Int, value: pieceID}], function(reviews, err) {
                res.render("piece", {'pieceData': pieceData[0], 'reviews': reviews});
            })
        } 
    }) 
}*/

function renderPiecePostPage(req, res) {
    callProcedure("DumpTags", [], function(tags, err) {
        if (err) {
            res.render('postPiece', {tags: []});
        } else {
            res.render('postPiece', {tags: tags});
        }
    })
}

function renderPiecePage(req, res, pieceID) {
    callProcedure("GetShortPieceData", [{name: "ID", type: sql.Int, value: pieceID}], function(pieceData, err) {
        if (err) {
            res.render("piece");
        } else {
            callProcedure("ReviewsOfPiece", [{name: "PieceID", type: sql.Int, value: pieceID}], function(reviews, err) {
                res.render("piece", {'pieceData': pieceData[0], 'reviews': reviews});
            })
        } 
    }) 
}

function renderPaidPiecePage(req, res, pieceID) {
    callProcedure("GetShortPaidPieceData", [{name: "ID", type: sql.Int, value: pieceID}], function(pieceData, err) {
        if (err) {
            res.render("paidPiece");
        } else {
            callProcedure("ReviewsOfPiece", [{name: "PieceID", type: sql.Int, value: pieceID}], function(reviews, err) {
                res.render("piece", {'pieceData': pieceData, 'reviews': reviews});
            })
        } 
    }) 
}

function renderProfilePage(req, res, username) {
    callProcedure("PiecesReviewedBy", [{name: "username", type: sql.VarChar(30), value: username}], function(reviewed, err) {
        if (err) {
            res.render("userProfile");
        } else {
            callProcedure("PiecesWrittenBy", [{name: "username", type: sql.VarChar(30), value: username}], function(written, err) {
                res.render("userProfile", {'user': username, 'reviewedPieces': reviewed, 'writtenPieces': written});
            })
        }
    }) 
}


function renderPostReviewPage(req, res, pieceID) {
    callProcedure("GetShortPieceData", [{name: "ID", type: sql.Int, value: pieceID}], function(pieceData, err) {
        if (err) {
            res.render("postReview");
        } else {
            res.render("postReview", {'pieceData': pieceData[0]});
        }
    })
}

function renderPDF(req, res, pieceID) {
    callProcedure("GetPieceData", [{name: "ID", type: sql.Int, value: pieceID}], function(pieceData, err) {
        if (err || pieceData.length == 0) {
            res.send("Piece PDF not found.");
        } else {
            res.writeHead(200, {
                "Content-Type": "application/pdf"
            });
            res.end(pieceData[0].Sheet);   
        }
    })
}

function renderPDFPreview(req, res, pieceID) {
    callProcedure("GetPaidPieceData", [{name: "ID", type: sql.Int, value: pieceID}], function(pieceData, err) {
        if (err || pieceData.length == 0) {
            res.send("Piece PDF not found.");
        } else {
            res.writeHead(200, {
                "Content-Type": "application/pdf"
            });
            res.end(pieceData[0].Preview);   
        }
    })
}

function postPiece(req, res) {
    callProcedure("RetrieveComposer", [{name: "user", type: sql.VarChar(30), value: req.session.user.Username}], function(result, err) {
        if (err || result.length == 0){
            console.log(err);
            res.redirect("/");
        } else {
            uploadPiece(req.body.Title, req.files.Sheet.data, req.body.Copyright, result[0].ComposerID, null, req.body.isPaid, req.files.Preview ? req.files.Preview.data : null, req.body.Price, function(result, err) {
                if (err) {
                    res.redirect("/");
                } else {
                    for (let [key, value] of Object.entries(req.body)) {
                        if (key.substr(0,4) == "tag-") {
                            callProcedure("AddTag", [{name: "tag_name", type: sql.VarChar(50), value: key.substr(4)}, {name: "piece_id", type: sql.Int, value: result[0].PieceID}], function(result, err) {if (err) console.log(err)});
                        }
                    }
                    res.redirect("/postPiece");
                }
            })
        }
    })
}

function postReview(req, res) {
    //const queryString = location.search;
    //const urlParams = new URLSearchParams(queryString);
    //const pieceID = urlParams.get('piece?id')
    uploadReview(req.query.id, req.session.user.Username, req.body.stars, req.body.text, function(err) {
        if (err) {
            res.redirect("/");
        } else {
            res.redirect("/piece?id="+req.query.id);
        }
    })
}

function importData(req, res) {
    var data = JSON.parse(req.files.Data.data.toString());
    var composersLeft = data.Composers.length;
    data.Composers.forEach(comp => {
        callProcedure("RegisterComposer", [{name: "ComposerName", type: sql.VarChar(30), value: comp.Name}, {name: "ComposerID", type: sql.Int, value: comp.ID}], function(result, err) {
            if (err) console.log(err);
            composersLeft--;
            if (composersLeft <= 0) {
                data.Users.forEach(user => {
                    callProcedure("RegisterUser", [{name: "username", type: sql.VarChar(30), value: user.Username}, {name: "password", type: sql.NVarChar(80), value: user.Password},{name: "composerID", type: sql.Int, value: user.ComposerID}], function(result, err) {if (err) console.log(err)});
                })
                data.Publishers.forEach(pub => {
                    callProcedure("RegisterPublisher", [{name: "PubName", type: sql.VarChar(40), value: pub.Name}, {name: "PubID", type: sql.VarChar(50), value: pub.ID}], function(result, err) {if (err) console.log(err)});
                })
                data.Tags.forEach(tag => {
                    callProcedure("CreateTag", [{name: "tag_name", type: sql.VarChar(30), value: tag.Name}], function(result, err) {if (err) console.log(err)});
                })
                var piecesLeft = data.Pieces.length;
                data.Pieces.forEach(piece => {
                    callProcedure("PostPieceFromDump", [{name: "ID", type: sql.Int, value: piece.ID},{name: "title", type: sql.VarChar(50), value: piece.Title},{name: "timeuploaded", type: sql.DateTime, value: piece.TimeUploaded},{name: "copyright", type: sql.VarChar(50), value: piece.Copyright},{name: "publisherID", type: sql.Int, value: piece.PublisherID},{name: "isPaid", type: sql.Bit, value: piece.IsPaid},{name: "price", type: sql.Money, value: piece.Price}], function(result, err) {
                        if (err) console.log(err);
                        piecesLeft--;
                        if (piecesLeft <= 0) {
                            updateSheet(data.Pieces, 0);
                        }
                    });
                })
                data.Writes.forEach(write => {
                    callProcedure("AddComposer", [{name: "pieceID", type: sql.Int, value: write.PieceID}, {name: "composerID", type: sql.Int, value: write.ComposerID}], function(result, err) {if (err) console.log(err)});
                })
                data.Reviews.forEach(review => {
                    callProcedure("PostReview", [{name: "username", type: sql.VarChar(30), value: review.UserID}, {name: "pieceID", type: sql.Int, value: review.PieceID},{name: "numStars", type: sql.SmallInt, value: review.Stars},{name: "text", type: sql.VarChar(2000), value: review.Text},{name: "time", type: sql.DateTime, value: review.Timestamp}], function(result, err) {if (err) console.log(err)});
                })
                data.PieceTags.forEach(hasTag => {
                    callProcedure("AddTag", [{name: "tag_name", type: sql.VarChar(30), value: hasTag.TagName}, {name: "piece_id", type: sql.Int, value: hasTag.PieceID}], function(result, err) {if (err) console.log(err)});
                })
            }
        });
    })
    res.redirect("/dataImport");
}

function updateSheet(sheets, entry) {
    if (entry >= sheets.length) return;
    callProcedure("UpdateSheetFromDump", [{name: "PieceID", type: sql.Int, value: sheets[entry].ID}, {name: "PSheet", type: sql.VarBinary, value: sheets[entry].Sheet ? Buffer.from(sheets[entry].Sheet.data) : null}, {name: "PPrev", type: sql.VarBinary, value: sheets[entry].Preview ? Buffer.from(sheets[entry].Preview.data) : null}], function(result, err) {
        if (err) console.log(err);
        updateSheet(sheets, ++entry);
    });
}

function getAllData(req, res) {
    const dumpProcs = ["Composers", "Pieces", "Users", "Reviews", "Tags", "PieceTags", "Publishers", "Writes"];
    let finishedRequests = 0;
    var results = {};
    dumpProcs.forEach(procName => {
        callProcedure("Dump"+procName, [], function(result, err) {
            finishedRequests++;
            results[procName] = result;
            if (finishedRequests >= dumpProcs.length) {
                res.set({"Content-disposition": "attachment"}).send(results);
            }
        })
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

function uploadPiece(title, sheetBuffer, copyright, composerID, publisherID, isPaid, previewBuffer, price, callback) {
    sql.connect(config).then(pool => {
        var ps = new sql.PreparedStatement(pool);
        ps.input('title', sql.VarChar(50));
        ps.input('sheet', sql.VarBinary);
        ps.input('copyright', sql.VarChar(50));
        ps.input('cID', sql.Int);
        ps.input('pID', sql.Int);
        var query, args;
        if (isPaid) {
            ps.input('preview', sql.VarBinary);
            ps.input('price', sql.Money);
            query = 'EXEC PostPaidPiece @title, @sheet, @copyright, @cID, @pID, @preview, @price';
            args = {title: title, sheet: sheetBuffer, copyright: copyright, cID: composerID, pID: publisherID, preview: previewBuffer, price: price};
        } else {
            ps.input('paid', sql.Bit);
            query = 'EXEC PostPiece @title, @sheet, @copyright, @cID, @pID, @paid';
            args = {title: title, sheet: sheetBuffer, copyright: copyright, cID: composerID, pID: publisherID, paid: false};
        }
        return ps.prepare(query, function(err) {
            if (err) {callback(err); return;}
            ps.execute(args, function(err, records) {
                if (err) {console.log(err); callback([], err); return;}
                ps.unprepare(function(err) {
                    callback(records.recordset, err);
                })
            })
        })
    }).catch(err => {
        callback([], err);
    })
}

function uploadReview(pieceID, userID, stars, text, callback) {
    sql.connect(config).then(pool => {
        var ps = new sql.PreparedStatement(pool);
        ps.input('username', sql.VarChar(30));
        ps.input('pieceID', sql.Int);
        ps.input('numStars', sql.Int);
        ps.input('text', sql.VarChar(2000));
        return ps.prepare('EXEC PostReview @username, @pieceID, @numStars, @text', function(err) {
            if (err) {callback(err); return;}
            ps.execute({username: userID, pieceID: pieceID, numStars: stars, text: text}, function(err, records) {
                if (err) {callback(err); return;}
                //console.log(records.rowsAffected)
                ps.unprepare(function(err) {
                    callback(err);
                })
            })
        })
    }).catch(err => {
        callback(err);
    })
}
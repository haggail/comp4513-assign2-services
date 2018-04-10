var mongoose = require('mongoose');
var express = require('express');
var parser = require('body-parser');
var md5 = require('crypto-md5');

// connect to mongodb
mongoose.connect('mongodb://haggail:12345@ds111638.mlab.com:11638/heroku_7dsxmj2b');
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error: '));
db.once('open', function callback() {
    console.log('connected to mongo');
});

// define company schema
var companySchema = new mongoose.Schema({
    symbol: String,
    name: String,
    sector: String,
    subindustry: String,
    address: String,
    date_added: String,
    CIK: Number,
    frequency: Number 
});

// define portfolio schema
var portfolioSchema = new mongoose.Schema({
    id: Number,
    symbol: String,
    user: Number,
    owned: Number,
});

// define price schema
var priceSchema = new mongoose.Schema({
    date: String,
    open: Number,
    high: Number,
    low: Number,
    close: Number,
    volume: Number,
    name: String
});

// define user schema
var userSchema = new mongoose.Schema({
    id: Number,
    first_name: String,
    last_name: String,
    email: String,
    salt: String,
    password: String
});

// "compile" the schema into a model
var Company = mongoose.model('Company', companySchema);
var Portfolio = mongoose.model('Portfolio', portfolioSchema);
var Price = mongoose.model('Price', priceSchema);
var User = mongoose.model('User', userSchema);


// create an express app
var app = express();
app.use(function (req, res, next) {
    //res.setHeader('Access-Control-Allow-Origin', 'https://wiggly-kitty.herokuapp.com');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5000');
    next();
});	

// tell node to use json and HTTP header features in body-parser
app.use(parser.json());
app.use(parser.urlencoded({extended: true}));

/* Company data */
// retrieve symbol and name of all companies
app.route('/api/companies')
    .get((req, resp) => {
        Company.find({}, {symbol: 1, name: 1}, (err, data) => {
            if (err) {
                resp.json({message: 'Unable to connect to companies'});
            } else {
                resp.json(data);
            }
        });
    });
	
// retrieve company info based on specified stock symbol
app.route('/api/companies/:symbol')
    .get((req, resp) => {
        Company.find({symbol: req.params.symbol}, (err, data) => {
            if (err) {
                resp.json({message: 'Unable to connect to companies'});
            } else {
                resp.json(data);
            }
        });
        
        
    });

/* Portfolio data */
// retrieve all portfolio info
app.route('/api/portfolios')
    .get((req, resp) => {
       
        Portfolio.find({}, (err, data) => {
            if (err) {
                resp.json({message: 'Unable to connect to portfolios'});
            } else {
                // return JSON retrieved by Mongo as response
                resp.json(data);
            }
        });
    });

// retrieve percentage summary of portfolio info for specified user
app.route('/api/portfolios/:user')
    .get((req, resp) => {
        Portfolio.find({user: req.params.user}, (err, data) => {
            if (err) {
                resp.json({message: 'Unable to connect to portfolios'});
            } else {
                var dataToDisplay = [];
                
                data.map((entry, ind) => {
                    Portfolio.aggregate([
                    {$match: {symbol: entry.symbol}},
                    {$group: {
                        _id: "$symbol",
                        total: {$sum: "$owned"}
                    }},
                    {$project: {
                        _id: 1, percentOwned: {$divide: [entry.owned, "$total"]}
                    }}
                    ], (err2, data2) => {
                        if (err2) {
                            var newObject = {message: "Unable to connect to portfolios"};
                        } else {
                            var newObject = {_id: data2[0]._id, percentOwned: data2[0].percentOwned};
                            console.log(newObject);
                            dataToDisplay.push(newObject);
                            if (data.length === ind + 1) {
                                resp.json(dataToDisplay);
                            }
                        }
                        
                    });
                });
                
            }
        });
    });

/* Price data */
// retrieve all price info
app.route('/api/prices')
    .get((req, resp) => {
        Price.find({}, (err, data) => {
            if (err) {
                resp.json({message: 'Unable to connect to prices'});
            } else {
                resp.json(data);
            }
        });
    });

// retrieve a stock's price info from a specified month
app.route('/api/prices/monthly/:symbol/:month')
    .get((req, resp) => {
        Price.find({name: req.params.symbol, date: {$regex:  new RegExp("^2017-" + req.params.month) }} , (err, data) => {
            if (err) {
                resp.json({message: 'Unable to connect to prices'});
            } else {
                resp.json(data);
            }
        });
    });

// retrieve specified stock's average close value for each month
app.route('/api/prices/average/:symbol')
    .get((req, resp) => {
        Price.aggregate([
            {$match: {name: req.params.symbol }},
            {$group: {_id: {$substr: ["$date", 0, 7] }, average: {$avg: "$close"}}},
            {$sort: {_id: -1}}
            ], (err, data) => {
                if (err) {
                    resp.json({message: 'Unable to connect to prices'});
                } else {
                    resp.json(data);
                }
            });
    });

// retrieve specified stock's price info from specified date
app.route('/api/prices/date/:symbol/:date')
    .get((req, resp) => {
        
        Price.find(
            {name: req.params.symbol,
            date: req.params.date
            }, (err, data) => {
                if (err) {
                    resp.json({message: 'Unable to connect to prices'});
                } else {
                    resp.json(data);
                }
            });
    });

// retrieve specified stock's most recent price info
app.route('/api/prices/recent/:symbol')
    .get((req, resp) => {  
        Price.aggregate([
            {$match: {name: req.params.symbol}},
            {$match: {date: {$regex: /^2017-12/}}},
            {$sort: {date: -1}},
            {$limit: 1}
            ], (err, data) => {
                if (err) {
                    resp.json({message: 'Unable to connect to prices'});
                } else {
                    resp.json(data);
                }
            });
    });

/* User Data */
// find user email, return salt
app.route('/api/users/')
    .post((req, resp) => {
    var login = req.body.user
        User.find({"email": login}, (err, data) => {
                if (err) {
                    resp.json({message: 'Unable to connect to users'});
                } else {
                    resp.json(data);
                }
            });
    });


// use express to listen to port
app.set('port', (process.env.PORT || 5000));
app.listen(app.get('port'), () => {
    console.log("Server running at port: " + app.get('port'));
});
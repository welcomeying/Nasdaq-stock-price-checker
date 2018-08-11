/*
*
*
*       Complete the API routing below
*
*
*/

'use strict';

var expect = require('chai').expect;
var MongoClient = require('mongodb');
var request = require('request');

const CONNECTION_STRING = process.env.DB; //MongoClient.connect(CONNECTION_STRING, function(err, db) {});

function StockHandler() {
  
  this.getData = function(stock, callback) {
    request('https://api.iextrading.com/1.0/stock/' + stock + '/price', function (err, res, body) {
       if (!err && res.statusCode == 200) {
          callback('stockData',{stock: stock.toUpperCase(), price: body});
        } else {
          console.log('issue!');
          return;
        }
      })
    }
  
  this.getLikesData = function(stock, like, ip, callback) {
    MongoClient.connect(CONNECTION_STRING, function(err, db) {
      if (!like) {
        db.collection('stock_likes').find({stock: stock}).toArray(function(err, data) {
          if (data.length > 0) {
            callback('likesData',{stock: stock, likes: data[0].likes.length});
          }
          else {
            callback('likesData',{stock: stock, likes: 0});
          }
        })
      }
      else {
        db.collection('stock_likes').findAndModify(
          {stock: stock},
          [],
          {$addToSet: {likes: ip}},
          {new: true, upsert: true},
          function(err, data) {
            callback('likesData',{stock: stock, likes: data.value.likes.length});
          })
      }
      db.close();
    });
  }
}

module.exports = function (app) {
  
  var stockPrices = new StockHandler();
  
  app.route('/api/stock-prices')
    .get(function (req, res){
      let stock = req.query.stock;
      let like = req.query.like || false;
      let stockData = null;
      let likesData = null;
      let isArray = Array.isArray(stock);
      if (isArray) {          
        stockData = [];
        likesData = [];
      }
      let ip = req.connection.remoteAddress;
    
      function callback(dataType, obj) {
        if (!isArray){
          if (dataType == 'stockData') {
            
            stockData = obj;
          }
          else {
            likesData = obj;
          }
          if (stockData && likesData !== null) {
            stockData.likes = likesData.likes;
            res.json({stockData});
          }
        }
        else {
          if (dataType == 'stockData') {
            stockData.push(obj);
          }
          else {
            likesData.push(obj);
          }
          if (stockData.length == 2 && likesData.length == 2) {
            if (stockData[0].stock == likesData[0].stock) {
              stockData[0].rel_likes = likesData[0].likes - likesData[1].likes;
              stockData[1].rel_likes = likesData[1].likes - likesData[0].likes;
            } 
            else {
              stockData[0].rel_likes = likesData[1].likes - likesData[0].likes;
              stockData[1].rel_likes = likesData[0].likes - likesData[1].likes;
            }
            res.json({stockData});
          }
        }
      }
    
      if (!isArray) {
        stockPrices.getData(stock, callback);
        stockPrices.getLikesData(stock, like, ip, callback);
      }
      else {
        stockPrices.getData(stock[0], callback);
        stockPrices.getLikesData(stock[0], like, ip, callback);
        stockPrices.getData(stock[1], callback);
        stockPrices.getLikesData(stock[1], like, ip, callback);
      }
    });
    
};
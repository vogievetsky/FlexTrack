// Generated by CoffeeScript 1.3.1
(function() {
  var app, client, clientConfig, config, currentFile, debug, emptyGif, events, express, fs, geoip, knox, script, sendFilesToS3, useragent;

  fs = require('fs');

  geoip = require('geoip-lite');

  express = require('express');

  useragent = require('express-useragent');

  knox = require('knox');

  app = express();

  config = require('./config');

  debug = false;

  if (config.s3) {
    console.log('Got S3 config');
    client = knox.createClient(config.s3);
    sendFilesToS3 = function() {
      fs.readdir('track', function(err, files) {
        if (err) {
          console.log("ERROR: Can not read dir");
          return;
        }
        files.forEach(function(file) {
          var myFile, s3File;
          myFile = "track/" + file;
          s3File = "/" + (config.s3.path || '') + file;
          console.log("Sending " + myFile + " to S3");
          client.putFile(myFile, s3File, function(err, res) {
            if (err || res.statusCode !== 200) {
              console.log("ERROR: Failed to upload " + myFile + " to " + s3File + " [" + res.statusCode + " " + err + "]");
              return;
            }
            fs.unlink(myFile, function(err) {
              if (err) {
                console.log("ERROR: Failed to delete " + myFile);
              }
            });
          });
        });
      });
    };
  } else {
    console.log('No S3 config');
    sendFilesToS3 = function() {};
  }

  app.use(useragent.express());

  app.use(express.compress());

  app.disable('x-powered-by');

  app.enable('trust proxy');

  emptyGif = Buffer('\x47\x49\x46\x38\x39\x61\x01\
\x00\x01\x00\xf0\x01\x00\xff\xff\xff\x00\x00\x00\
\x21\xf9\x04\x01\x0a\x00\x00\x00\x2c\x00\x00\x00\
\x00\x01\x00\x01\x00\x00\x02\x02\x44\x01\x00\x3b');

  clientConfig = {
    h: config.host
  };

  script = "(function(c) {\n  try {\n    var num = 0;\n    var initTime = +new Date();\n    window.flextrack = function(a) {\n      if (Object.prototype.toString.call(a) != '[object Object]') return false;\n      a.N_ = num++;\n      a.P_ = document.location.pathname;\n      a.S_ = +new Date() - initTime;\n      a.R_ = document.referrer || 'Direct';\n      var params = [];\n      for (var k in a) params.push(encodeURIComponent(k) + \"=\" + encodeURIComponent(String(a[k])));\n      var i = new Image();\n      i.src = 'http://' + c.h + '/m.gif?' + params.join('&');\n      return true;\n    };\n  } catch (e) {}\n})(" + (JSON.stringify(clientConfig)) + ");";

  events = [];

  currentFile = null;

  app.get('/script.js', function(req, res) {
    res.set('Content-Type', 'application/javascript');
    res.send(script);
  });

  app.get('/m.gif', function(req, res) {
    var event, file, geo, ip, k, time, ua, v, _ref;
    if (req.xhr) {
      res.send(500);
      return;
    }
    time = (new Date()).toISOString();
    file = 'track-' + time.replace(/:\d\d\.\d\d\dZ$/, '') + '.json';
    if (debug) {
      console.log("I have " + events.length + " events for " + file);
    }
    if (events.length && currentFile !== file) {
      fs.writeFile("track/" + currentFile, events.join('\n'), function(err) {
        if (err) {
          console.log('ERROR: Could not write file', err);
          return;
        }
        setTimeout(sendFilesToS3, 50);
      });
      events = [];
    }
    currentFile = file;
    event = {};
    _ref = req.query;
    for (k in _ref) {
      v = _ref[k];
      if (k === 'N_') {
        k = 'Number';
      }
      if (k === 'P_') {
        k = 'Path';
      }
      if (k === 'R_') {
        k = 'Referrer';
      }
      if (k === 'S_') {
        k = 'SessionLength';
      }
      event[k] = v;
    }
    event['Time'] = time;
    ip = req.ip;
    event['IP'] = ip;
    geo = geoip.lookup(ip) || {
      country: 'NoIP',
      region: 'NoIP',
      city: 'NoIP',
      ll: [0, 0]
    };
    event['Country'] = geo.country || 'N/A';
    event['Region'] = geo.region || 'N/A';
    event['City'] = geo.city || 'N/A';
    event['Lat'] = geo.ll[0];
    event['Lon'] = geo.ll[1];
    ua = req.useragent;
    event['Browser'] = ua.Browser || 'N/A';
    event['BrowserVersion'] = ua.Version || 'N/A';
    event['OS'] = ua.OS || 'N/A';
    event['Platform'] = ua.Platform || 'N/A';
    event['Language'] = req.acceptedLanguages[0] || 'N/A';
    event = JSON.stringify(event);
    events.push(event);
    res.set('Content-Type', 'image/gif');
    res.send(emptyGif);
  });

  app.get('/ping', function(req, res) {
    res.send('pong');
  });

  app.get('/geo', function(req, res) {
    var geo, ip;
    ip = req.ip;
    geo = geoip.lookup(ip) || {
      country: 'NoIP',
      region: 'NoIP',
      city: 'NoIP'
    };
    res.send("IP: " + ip + "\nCountry: " + geo.country + "\nRegion: " + geo.region + "\nCity: " + geo.city + "\nIPs: [" + req.ips + "]");
  });

  console.log("Started server on port 9090");

  app.listen(9090);

}).call(this);

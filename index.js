var entities = require('entities');
var q = require('q');
var superagent = require('superagent');

// Fetch user ids every five minutes 

var ULIST_INTERVAL = 300000; 

//Util (arg parsing)

function argify(str) {
  str+='\0';

  var isp=0;
  var inq=0;
  var args = [];
  var carg = '';

  for(var i=0;i<str.length;i++) {
    if(inq) {
      if(str[i] === '\'') {
        if(carg)
          args.push(carg);
        carg = '';
        inq = 0;
        continue;
      }
      carg+=str[i];
    } else if(str[i].match(/[\s\0]/)) {
      if(!isp) {
        if(carg)
          args.push(carg);
        carg = '';
        isp = 1;
      }
    } else if (str[i] === '\''){
      inq = 1;
    } else {
      isp = 0;
      carg+=str[i];
    }
    
  }
  return args;
};

function getUlist(token) {
  var p = q.defer();
  superagent
    .get('https://slack.com/api/users.list?token=' + encodeURIComponent(token))
    .end(function(err, r) {
      if(err) 
        p.reject(err);
      else if(!r.body.ok && !r.body.error) 
        p.reject(new Error('Invalid response object'));
      else if(!r.body.ok) 
        p.reject(new Error(r.body.error));
      else {
        var ulist = {};
        r.body.members.forEach(function(e) {ulist[e.id]=e.name;});
        p.resolve(ulist);
      }
    });
  return p.promise;
}


// Handlers are passed an object containing a req and args attribute. The
// former is the original request object and the later is the command's parsed
// argument list. Each handler must return a promise that resolves to either
// the desired return object or a simple string (in which case the default user
// name will be used to send messages).


// Consumes a list of handlers and a default username with which to respond.
// The username passed in is used as a default unless the username property is
// explicitly specified in the response object by the handler.

function create(handlers, username, slacktoken, apitoken) {
  username = username || 'slackbot';
  var app = require('express')();
  var ulist = {};
  
  function refreshUlist() {
    getUlist(apitoken).then(function(r) {
      ulist = r;
    }, function(e) {
      console.error(e.stack);
    });
  }

  var olisten = app.listen.bind(app);
  app.listen = function() {
    refreshUlist();
    setInterval(refreshUlist, ULIST_INTERVAL);
    var args = Array.prototype.slice.call(arguments);
    olisten.apply(null, args);
  };

  app.use(function(req, res, n) {
    var data = '';
    req.on('data', function(c) {data+=c;});
    req.on('end', function() {
      var result = {};
      data.split('&').forEach(function(e) {
        var s = e.split('=');	
        result[entities.decodeXML(decodeURIComponent(s[0]))] = entities.decodeXML(decodeURIComponent(s[1])).replace(/\+/g,' ');
      });
      req.body = result;
      n();
    });
  });

  app.post('/*', function(req, res) {
    if(!req.body.text) {
      res.end();
      return;
    }

    if(req.body.token !== slacktoken) {
      console.error('WARNING REQUEST BEARING INVALID SLACK TOKEN POSTED (IGNORING)');
      res.end();
      return;
    }

    req.body.text = req.body.text.replace(/<@.*?>/g, function(e) {
      var name = ulist[e.substr(2, e.length-3)];
      return name ? ('@' + name) : e;
    });

    var args = argify(req.body.text);

    var handler = handlers[args[0].slice(1)];
    if(handler) {
      handler({ ulist: ulist, trigger: args[0][0], req: req.body, args: args.slice(1) }).then(function(obj) {
        if(typeof obj === 'string') {
          res.json({ username: username, text: obj });
          return;
        }
        if (!obj.username) obj.username = username;

        res.json(obj);
      }).then(null, function(e) {
        console.error(e.stack || e);
        res.json({text: 'internal error!'});
      });
    } else {
      res.end();
    }
  });

  return app;
}

module.exports = create;

#Description

A tiny module which simplifies the creation of trigger based slackbots by
allowing one to define handlers that behave in a command-argument style
fashion.

#Usage

The module consumes the following positional arguments and returns an express
app suitable for use as the target of an outgoing webhook.
  
  - **handlers**: An object whose keys correspond to commands and whose values
    correspond to handlers of those commands. 

  - **name**: The default user name used by the bot, this can be overwritten by a
  handler that returns a response object containing the user_name property.

  - **slack token**: The token provided by the outgoing webhook used to verify
  requests. Any request whose token does not match the one provided is dropped.

  - **api token**: Your slack API token used for user name resolution.

  A handler is a function which consumes a single object with the following
  properties and returns a promise that resolves to the message payload. This
  can either be a simple string or a response object of the kind expected by the
  webhook.

   - **trigger**: The bot trigger (i.e the first character of the posted message)
   - **req**: The original request made by the webhook
   - **args**: An array containing the tokenized argument list. Anything within single quotes
     is considered a single argument.
   - **ulist**: An object mapping slack uids to nicks

The corresponding outgoing webhook must have the 'trigger word(s)' field set to
a single character, this is the character which precedes each command intended
for the bot.

E.G

if trigger word(s) is ~ then ```~command arg1 arg2 'this is arg3'``` will result in
the 'command' handler being called with an object containing args: ```['arg1',
'arg2', 'this is arg 3']```

##Example
```javascript
var slack = require('slacktrigger');
var q = require('q');

var handlers = {};

handlers.argdump = function(opts) {
  return q(JSON.stringify(opts.args));
};

handlers.greetme = function(opts) {
  return q('hello ' + opts.req.user_name );
};

handlers.ping = function() {
  return q('pong');
};

var app = slack(handlers, //handlers
    'testbot', //default bot name (can be overwritten in a handler by returning a request object containing 'username')
    '<slack token>', //slack token (provided by the outgoing webhook)
    '<api token>'); //api token

// Sample input/output (assumes % is the trigger specified in the outgoing webhook):
//
// user: %argdump one two 'arg three' => ['one', 'two', 'arg three' ]
// user: %greetme => user
// user: %ping => pong
```

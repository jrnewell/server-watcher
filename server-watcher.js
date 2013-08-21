#!/usr/bin/env node

var gaze = require('gaze');
var program = require('commander');
var globule = require('globule');
var fs = require('fs');
var path = require('path');
var readline = require('readline');
var sys = require('sys');
var spawn = require('child_process').spawn;
var async = require('async');

var list = function(val) {
  return val.split(';');
}

program
  .version(require('./package.json').version)
  .option('-p, --patterns <pattern>', 'Semicolon-separated list of patterns [**/*]', list, ["**/*"])
  .option('-i, --ignore-patterns <pattern>', 'Semicolon-separated list to ignore', list)
  .option('-d, --ignore-directories', 'Ignore directoy updates')
  .option('-v, --verbose', 'Output extra data to stderr')
  .option('-s, --server <server>', 'server to monitor')
  .option('-c, --compilation-command <command>', 'command to recompile server')
  .parse(process.argv);

var patterns = program.patterns;
var ignorePatterns = program.ignorePatterns;
var ignoreDirectories = program.ignoreDirectories;
var verbose = (typeof program.verbose !== 'undefined')
var server = program.server;
var serverName = path.basename(server);
var compilationCommand = program.compilationCommand.split(/\s+/);

if (verbose) {
  console.error("patterns: " + patterns);
  console.error("ignorePatterns: " + ignorePatterns);
  console.error("ignoreDirectories: " + ignoreDirectories);
  console.error("server: " + server);
  console.error("serverName: " + serverName);
  console.error("compilationCommand: " + compilationCommand);
}

// colors
var red = '\x1B[0;31m';
var green = '\x1B[0;32m';
var colorReset = '\x1B[0m';

var logInfo = function(str) {
  console.log(green + "[" + serverName + "] " + str + colorReset);
}

var logError = function(str) {
  console.error(red + "[" + serverName + "] " + str + colorReset);
}

var verboseOut = function(str) {
  if (verbose) {
    console.log(str);
  }
};

var callbackOptional = function(callback, err) {
  if (typeof callback === 'function') {
    callback(err)
  }
}

var compileServer = function(callback) {
  if (typeof compilationCommand !== 'undefined') {
    verboseOut("spawning compile command: " + program.compilationCommand);
    var spawnProc = spawn(compilationCommand[0], compilationCommand.slice(1));
    spawnProc.on('exit', function(code) {
      var cbWrapper = function(err) {
        callback(err, code);
      }
      if (code === 0) {
        callbackOptional(cbWrapper, null);
      }
      else {
        logError("compilation errors, waiting for file changes before restarting");
        callbackOptional(cbWrapper, null);
      }
    });

    spawnProc.on('error', function(err) {
      callbackOptional(function(err) {
        callback(err, 1);
      }, err);
    });

    spawnProc.stdout.on('data', function (data) {
      process.stdout.write(data);
    });

    spawnProc.stderr.on('data', function (data) {
      process.stderr.write(data);
    });
  }
  else {
    callbackOptional(function(err) {
      callback(err, 0);
    }, null);
  }
}

var killSignalSent = false;
var killServer = function(callback) {
  verboseOut("spawning killall command: " + serverName);
  killSignalSent = true;
  var spawnProc = spawn("killall", [serverName]);
  spawnProc.on('exit', function(code) {
    callbackOptional(callback, null);
  });
  spawnProc.on('error', function(err) {
    callbackOptional(callback, err);
  });
}

var runServer = function(callback) {
  verboseOut("spawning server: " + server);
  var spawnProc = spawn(server);
  spawnProc.on('exit', function(code) {
    if (code !== 0 && !killSignalSent) {
      logError("server exiting with errors, type 'rs' to restart");
    }
    killSignalSent = false;
    callbackOptional(callback, null);
  });

  spawnProc.on('error', function(err) {
    callbackOptional(callback, err);
  });

  spawnProc.stdout.on('data', function (data) {
    process.stdout.write(data);
  });

  spawnProc.stderr.on('data', function (data) {
    process.stderr.write(data);
  });
}

var recompileAndRestart = function() {
  logInfo("recompiling and restarting server");

  async.waterfall([
    function(callback) {
      killServer(callback);
    },
    function(callback) {
      compileServer(callback);
    },
    function(status, callback) {
      if (status == 0) {
        runServer();
      }
      callback(null);
    },
  ], function (err, result) {
    if (err) {
      logError(err.toString());
      exitWatcher(1);
    }
  });
}

var exitWatcher = function(code) {
  killServer(function(err) {
    process.exit(code);
  });
}

// watch files funciton
watchServer = function() {
  gaze(patterns, function(err, watcher) {

    // On changed/added/deleted
    this.on('all', function(event, filepath) {

      verboseOut("new event: " + filepath  + " was " + event);

      if (typeof ignoreDirectories !== 'undefined') {
        if (fs.existsSync(filepath)) {
          stats = fs.statSync(filepath);
          if (stats.isDirectory()) {
            verboseOut("ignoring pattern because it is a directoy");
            return;
          }
        }
      }

      if (typeof ignorePatterns !== 'undefined') {
        if (globule.isMatch(ignorePatterns, filepath, {matchBase: true})) {
          verboseOut("ignoring pattern because it is a directoy");
          return;
        }
      }
      
      recompileAndRestart();
    });
  });
};

async.waterfall([
  function(callback) {
    logInfo("recompiling and starting server");
    killServer(callback);
  },
  function(callback) {
    compileServer(callback);
  },
  function(status, callback) {
    if (status == 0) {
      runServer();
    }
    callback(null);
  },
  function(callback) {
    watchServer();
    callback(null);
  },
], function (err, result) {
  if (err) {
    logError(err.toString());
    exitWatcher(1);
  }
});

// add console input
function completer(line) {
  var completions = 'rs quit exit'.split(' ');
  var hits = completions.filter(function(c) { return c.indexOf(line) == 0 });
  // show all completions if none found
  return [hits.length ? hits : completions, line];
}

var rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  completer: completer
});

rl.on('line', function (cmd) {
  cmd = cmd.toLowerCase().trim();
  if (cmd === 'rs') {
    recompileAndRestart();
  }
  else if (cmd === 'quit' || cmd === 'exit') {
    logInfo("exiting");
    exitWatcher(0);
  }
});

rl.on('SIGINT', function() {
  exitWatcher(0);
});


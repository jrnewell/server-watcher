# Server Watcher

A simple utility to recompile and respawn servers on file changes.

## Installation

```ShellSession

npm -g install server-watcher

```

## Usage

```

Usage: server-watcher [options]

  Options:

    -h, --help                           output usage information
    -V, --version                        output the version number
    -p, --patterns <pattern>             Semicolon-separated list of patterns [**/*]
    -i, --ignore-patterns <pattern>      Semicolon-separated list to ignore
    -d, --ignore-directories             Ignore directoy updates
    -v, --verbose                        Output extra data to stderr
    -s, --server <server>                server to monitor
    -c, --compilation-command <command>  command to recompile server

```

See examples directory for example scripts.

## License

[MIT License](http://en.wikipedia.org/wiki/MIT_License)
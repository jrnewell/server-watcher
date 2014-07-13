#!/usr/bin/env bash

usage() {
  echo "Usage: `basename $0` server" >&2
}

if [ $# -eq 0 ]; then
  usage
  exit 1
fi

exec server-watcher \
  --patterns "$GOPATH/src/**/*" \
  --ignore-directories \
  --server "$GOPATH/bin/$1" \
  --compilation-command "go install $1"
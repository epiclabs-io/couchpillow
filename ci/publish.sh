#!/bin/bash

if ((${#} < 3)); then
	echo "usage: publish.sh <npm_username> <npm_pasword> <npm_email>"
	exit 1;
fi
npm version minor
cp package.json ./dist/
cp README.md ./dist/
node node_modules/npm-cli-login/bin/npm-cli-login.js -u "$1" -p "$2" -e "$3"
npm publish ./dist/
npm logout

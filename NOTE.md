# Development note
## Update node version on Ubuntu 
> sudo npm cache clean -f

> sudo npm install -g n

> sudo n stable

To upgrade to latest version (and not current stable) version, you can use
> sudo n latest

Or
> sudo n 14.16.0


## Compile serialport

> npm install --save-dev electron-rebuild

Every time you run "npm install", run this:

> ./node_modules/.bin/electron-rebuild

On Windows if you have trouble, try:
> .\node_modules\.bin\electron-rebuild.cmd


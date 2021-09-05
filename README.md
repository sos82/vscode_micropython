# On Ubuntu need upgrade node version
> sudo npm cache clean -f
> sudo npm install -g n
> sudo n stable

To upgrade to latest version (and not current stable) version, you can use
> sudo n latest
> sudo n 14.16.0




npm install --save-dev electron-rebuild

# Every time you run "npm install", run this:
./node_modules/.bin/electron-rebuild
Run election-rebuild error can not detect version => npm install --save-dev electron

# On Windows if you have trouble, try:
.\node_modules\.bin\electron-rebuild.cmd

https://www.electronjs.org/docs/tutorial/using-native-node-modules
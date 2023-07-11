## Dependencies

|iterm|version|
|---|---|
|xterm.js|5.2.1|
|xterm-addon-fit|0.7.0|
|xterm-addon-search|0.12.0|
|xterm-addon-web-links|0.8.0|
|xterm-addon-unicode11|0.5.0|
|xterm-addon-webgl|0.15.0|
|xterm-addon-search-bar|0.2.0|

## Build for Andorid

```sh
export GOOS=android
export GOARCH=arm64
go build -ldflags='-w -s'

echo "build done"
../termux-elf-cleaner --api-level 24 go-ttyd
echo "clean done, now running..."
./go-ttyd --port 8888 sh
```

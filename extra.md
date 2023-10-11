## Dependencies

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

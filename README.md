# taiwanmobile-usage-balance

A simple CLI tool for [Taiwan Mobile (台灣大哥大)](https://www.taiwanmobile.com/index.html) user to check their amount of data used.

## Screenshot
I use alias to run this script.

![a screenshot of script executing result](assets/example.png)

## Project setup
```shell
$ yarn install
$ cp .env.template .env
# fill in .env
```

## Run Script
```shell
$ node src/index.js
# or
$ yarn data-balance
```

## Remove Captcha Image If Not Deleted
```shell
$ rm captcha-img.png
```

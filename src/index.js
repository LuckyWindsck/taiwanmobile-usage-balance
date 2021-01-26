const child_process = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const puppeteer = require('puppeteer');

const projectRoot = (pathSegment) => path.resolve(__dirname, '..', pathSegment);

require('dotenv').config({ path: projectRoot('.env') })

const { PHONE_NUMBER, PASSWORD, INIT_DATA_BALANCE_IN_GB } = process.env;

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  await page.goto('https://www.taiwanmobile.com/cs/queryPrepaid.htm');
  await page.waitForSelector('#login-form'); // Login form
  await page.type('#account', PHONE_NUMBER); // Account input box
  await page.type('#password', PASSWORD); // Password input box
  await page.$eval('[name="keep90d"]', (element) => { element.checked = false; }); // Remember me check box
  await page.click('a.btn-lg'); // Login button

  const { node, isCaptchaPoped } = await Promise.any([
    {
      promise: page.waitForSelector('#captcha-pop.show'), // Captcha
      isCaptchaPoped: true,
    },
    {
      promise: page.waitForSelector('#app table tbody'), // Login successfully
      isCaptchaPoped: false,
    },
  ].map(({ promise, isCaptchaPoped }) => promise.then((node) => ({ node, isCaptchaPoped }))));

  if (isCaptchaPoped) {
    const dataUrl = await node.$eval('#captcha-img', (captchaImg) => {
      const canvas = document.createElement('canvas');
      canvas.width = captchaImg.naturalWidth;
      canvas.height = captchaImg.naturalHeight;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(captchaImg, 0, 0);

      return canvas.toDataURL();
    });

    const base64String = dataUrl.slice(dataUrl.indexOf(',') + 1);
    const imgBuffer = Buffer.from(base64String, 'base64');
    const imgPath = projectRoot('captcha-img.png');

    let captchaText;

    try {
      fs.writeFileSync(imgPath, imgBuffer);
      child_process.execSync(`open ${imgPath}`);

      captchaText = await new Promise((resolve) => {
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });

        rl.question('Please input captcha: ', (text) => {
          resolve(text);
          rl.close();
        });
      });
    } finally {
      child_process.execSync(`rm ${imgPath} 2> /dev/null`);
    }

    await page.type('#captcha-text', captchaText);
    await page.click('#captcha-yes');
  }

  const tbody = await page.waitForSelector('#app table tbody'); // Data Balance Table Body
  const dataBalanceInGB = await tbody.$$eval('tr:nth-of-type(n + 2)', (rows) => {
    // TODO: better function name
    const convert = (sourceAmount, sourceUnit, targetUnit) => {
      // TODO: lowercase
      const unitList = ['KB', 'MB', 'GB'];
      const sourceIndex = unitList.indexOf(sourceUnit);
      if (sourceIndex === -1) { /* TODO: handle exception */ }
      const targetIndex = unitList.indexOf(targetUnit);
      if (targetIndex === -1) { /* TODO: handle exception */ }
      const power = sourceIndex - targetIndex;

      return sourceAmount * (1024 ** power);
    }

    const ths = rows.map((row) => row.querySelector('th'));
    const dataRowIndex = ths.findIndex((th) => th?.innerText === '上網');
    const dataRowSpan = ths[dataRowIndex].rowSpan;
    const dataBalance = rows.slice(dataRowIndex, dataRowIndex + dataRowSpan)
        .map((row) => (
          row.querySelector('td:nth-of-type(2)')
            .innerText
            .match(/(?<balance>\d*(\.\d*)?)(?<unit>.*$)/)
            .groups
        ))
        .map(({balance, unit}) => convert(balance, unit, 'GB'))
        .reduce((sum, num) => sum + num, 0);

    return dataBalance;
  });

  const roundedDataBalance = dataBalanceInGB.toFixed(3);

  if (INIT_DATA_BALANCE_IN_GB) {
    console.log(`${roundedDataBalance} / ${INIT_DATA_BALANCE_IN_GB} GB`);
  } else {
    console.log(`${roundedDataBalance} GB`);
  }

  await browser.close();
})();

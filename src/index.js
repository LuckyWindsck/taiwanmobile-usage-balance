const childProcess = require('child_process');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const readline = require('readline');

const projectRoot = (pathSegment) => path.resolve(__dirname, '..', pathSegment);

const imageToDataUri = (image) => {
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  canvas.getContext('2d').drawImage(image, 0, 0);

  return canvas.toDataURL();
};

const dataUriToBuffer = (dataUri) => {
  const base64String = dataUri.slice(dataUri.indexOf(',') + 1);
  const buffer = Buffer.from(base64String, 'base64');

  return buffer;
};

const promptCaptchaText = async (captchaImg) => {
  const imgDataUri = await captchaImg.evaluate(imageToDataUri);
  const imgBuffer = dataUriToBuffer(imgDataUri);
  const imgPath = projectRoot('captcha-img.png');

  try {
    fs.writeFileSync(imgPath, imgBuffer);
    childProcess.execSync(`open ${imgPath}`);

    const captchaText = await new Promise((resolve) => {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

      rl.question('Please input captcha: ', (text) => {
        resolve(text);
        rl.close();
      });
    });

    return captchaText;
  } finally {
    childProcess.execSync(`rm ${imgPath} 2> /dev/null`);
  }
};

const submitCaptcha = async (page, captchaPopElement) => {
  const captchaImg = await captchaPopElement.$('#captcha-img');
  const captchaText = promptCaptchaText(captchaImg);

  await page.type('#captcha-text', captchaText);
  await page.click('#captcha-yes');
};

const submitLoginForm = async (page) => {
  const { PHONE_NUMBER, PASSWORD } = process.env;

  await page.waitForSelector('#login-form'); // Login form
  await page.type('#account', PHONE_NUMBER); // Account input box
  await page.type('#password', PASSWORD); // Password input box
  await page.$eval('[name="keep90d"]', (element) => { element.checked = false; }); // Remember me check box
  await page.click('a.btn-lg'); // Login button
};

const getBalanceTable = async (page) => {
  await page.goto('https://www.taiwanmobile.com/cs/queryPrepaid.htm');
  await submitLoginForm(page);

  let element = await Promise.any([
    page.waitForSelector('#captcha-pop.show'), // Captcha
    page.waitForSelector('#app table tbody'), // Data Balance Table Body, Login successfully
  ]);

  if (element.id === 'captcha-pop') {
    await submitCaptcha(page, element);
    element = await page.waitForSelector('#app table');
  }

  return element;
};

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
};

const getDataBalance = async (balanceTable, targetUnit = 'GB') => {
  const rawDataBalance = await balanceTable.$$eval('tbody tr:nth-of-type(n + 2)', (rows) => {
    const ths = rows.map((row) => row.querySelector('th'));
    const dataRowIndex = ths.findIndex((th) => th?.innerText === '上網');
    const dataRowSpan = ths[dataRowIndex].rowSpan;
    const rawTexts = (
      rows.slice(dataRowIndex, dataRowIndex + dataRowSpan)
        .map((row) => row.querySelector('td:nth-of-type(2)').innerText)
    );

    return rawTexts;
  });

  const balanceRegExp = /(?<balance>\d*(\.\d*)?)(?<sourceUnit>.*$)/;
  const dataBalanceInGB = (
    rawDataBalance
      .map((rawTexts) => rawTexts.match(balanceRegExp))
      .map(({ groups: { balance, sourceUnit } }) => convert(balance, sourceUnit, targetUnit))
      .reduce((sum, num) => sum + num, 0)
  );

  return dataBalanceInGB;
};

(async () => {
  dotenv.config({ path: projectRoot('.env') });

  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  const balanceTable = await getBalanceTable(page);
  const dataBalanceInGB = await getDataBalance(balanceTable, 'GB');
  const roundedDataBalance = dataBalanceInGB.toFixed(3);
  const { INIT_DATA_BALANCE_IN_GB } = process.env;

  if (INIT_DATA_BALANCE_IN_GB) {
    console.log(`${roundedDataBalance} / ${INIT_DATA_BALANCE_IN_GB} GB`);
  } else {
    console.log(`${roundedDataBalance} GB`);
  }

  await browser.close();
})();

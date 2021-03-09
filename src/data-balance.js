const childProcess = require('child_process');
const fs = require('fs');
const readline = require('readline');

const {
  convert,
  dataUriToBuffer,
  imageToDataUri,
  projectRoot,
} = require('./util');

const submitLoginForm = async (page) => {
  const { PHONE_NUMBER, PASSWORD } = process.env;

  await page.waitForSelector('#login-form'); // Login form
  await page.type('#account', PHONE_NUMBER); // Account input box
  await page.type('#password', PASSWORD); // Password input box
  await page.$eval('[name="keep90d"]', (element) => { element.checked = false; }); // Remember me check box
  await page.click('a.btn-lg'); // Login button
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

const getBalanceTable = async (page) => {
  await page.goto('https://www.taiwanmobile.com/cs/queryPrepaid.htm');
  await submitLoginForm(page);

  let element = await Promise.any([
    page.waitForSelector('#captcha-pop.show'), // Captcha
    page.waitForSelector('#app table'), // Data Balance Table Body, Login successfully
  ]);

  if (element.id === 'captcha-pop') {
    await submitCaptcha(page, element);
    element = await page.waitForSelector('#app table');
  }

  return element;
};

module.exports = {
  async getDataBalance(page, targetUnit = 'GB') {
    const balanceTable = await getBalanceTable(page);
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
  },
};

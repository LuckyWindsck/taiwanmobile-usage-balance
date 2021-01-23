const puppeteer = require('puppeteer');

require('dotenv').config();

const { PHONE_NUMBER, PASSWORD } = process.env;

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  await page.goto('https://www.taiwanmobile.com/cs/queryPrepaid.htm');
  await page.waitForSelector('#login-form'); // Login form
  await page.type('#account', PHONE_NUMBER); // Account input box
  await page.type('#password', PASSWORD); // Password input box
  await page.$eval('[name="keep90d"]', (element) => { element.checked = false; }); // Remember me check box
  await page.click('a.btn-lg'); // Login button

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

  console.log(`上網傳輸量餘額: ${dataBalanceInGB.toFixed(3)} GB`);

  await browser.close();
})();

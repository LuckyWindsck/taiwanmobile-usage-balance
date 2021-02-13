const dotenv = require('dotenv');
const puppeteer = require('puppeteer');

const { projectRoot } = require('./util');
const { getDataBalance } = require('./data-balance');

(async () => {
  dotenv.config({ path: projectRoot('.env') });

  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  const dataBalanceInGB = await getDataBalance(page, 'GB');
  const roundedDataBalance = dataBalanceInGB.toFixed(3);
  const { INIT_DATA_BALANCE_IN_GB } = process.env;

  if (INIT_DATA_BALANCE_IN_GB) {
    console.log(`${roundedDataBalance} / ${INIT_DATA_BALANCE_IN_GB} GB`);
  } else {
    console.log(`${roundedDataBalance} GB`);
  }

  await browser.close();
})();

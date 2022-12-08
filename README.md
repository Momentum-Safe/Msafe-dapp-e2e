# Msafe-dapp-e2e

This repository contains an end-to-end test for the Msafe dapp. The test checks the functionality of the dapp and ensures that it works as expected.

> Due to limitations with Puppeteer, this test can only run in a desktop environment.

To use this test, clone the repository and install the dependencies:

```bash
git clone https://github.com/Momentum-Safe/Msafe-dapp-e2e.git
cd Msafe-dapp-e2e
npm install
```

Then, run the test using the following command:
```bash
export APPURL=$APPURL
export PRIKEY=$FAUCET_PRIVATE_KEY
npm run start
```

The test will output the results to the console. If any tests fail, the error message will be displayed along with the stack trace.

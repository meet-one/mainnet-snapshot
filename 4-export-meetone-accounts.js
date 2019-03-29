const CODE = 'eosiomeetone';
const TABLE = 'accounts';
const LIMIT = 10000;
const DEFAULT_OUTPUT_FILE_NAME_PREFIX = '4-meetone-accounts@';

// parse arguments
{
  const CONST = require('./const.js')
  const po = require('commander')
  po
    .version('0.1.0')
    .option('-u, --url <TEXT>'
      , 'the http/https URL where nodeos is running. Default to '
      + CONST.LOCAL.URL
    )
    .option('-k, --kylin', 'Equal to --url ' + CONST.KYLIN.URL)
    .option('-m, --mainnet', 'Equal to --url ' + CONST.MAINNET.URL)
    .option('-s, --sidechain', 'Equal to --url ' + CONST.SIDECHAIN.URL)
    .option('-o, --output <FILE>', 'Write to FILE, will be overwritten!')
    .option('-p, --output-prefix <NAME>', 'Output filename prefix')
    .on('--help', function () {
      console.log('')
      console.log('Examples:')
      console.log('  ' + process.argv0 + ' ' + process.argv[1]
        + ' --url http://kylin.fn.eosbixin.com')
    })
    .parse(process.argv)

  if (po.url) {
    url = po.url
    if (po.kylin) {
      console.log('--kylin is overridden, use ' + url)
    }
    if (po.mainnet) {
      console.log('--mainnet is overridden, use ' + url)
    }
  } else if (po.kylin) {
    url = CONST.KYLIN.URL
  } else if (po.mainnet) {
    url = CONST.MAINNET.URL
  } else if (po.sidechain) {
    url = CONST.SIDECHAIN.URL
  } else {
    url = CONST.LOCAL.URL
  }

  let u = new URL(url)
  url = u.origin
  console.log('URL: ' + url)

  if (po.output) {
    outputPath = po.output
  } else {
    if (po.outputPrefix) {
      outputPath = po.outputPrefix
    } else if (po.kylin) {
      outputPath = CONST.KYLIN.NAME + '-'
    } else if (po.mainnet) {
      outputPath = CONST.MAINNET.NAME + '-'
    } else if (po.sidechain) {
      outputPath = CONST.SIDECHAIN.NAME + '-'
    } else if (po.url) {
      outputPath = u.hostname + '-'
    } else {
      outputPath = CONST.LOCAL.NAME + '-'
    }

    const moment = require('moment')
    outputPath += DEFAULT_OUTPUT_FILE_NAME_PREFIX
      + moment().format('YYYY-MM-DD[T]HH-mm-ss.SSS[Z]ZZ') + '.txt'
  }
  console.log('Output file: ' + outputPath)
}

const EosApi = require('eosjs-api');
options = {
  httpEndpoint: url,
  verbose: false,
  logger: {
    log: null,//console.log,
    error: console.error
  },
  fetchConfiguration: {}
};
eos = EosApi(options);

const fs = require('fs');
const ws = fs.createWriteStream(outputPath, {
  encoding: 'utf8',
  autoClose: true
});

let last_one = '';
let retry = 0;

cb = (res) => {
  retry = 0;
  if (res.rows) {
    var buffer = '';
    res.rows.forEach(e => {
      buffer += e.scope + '\n';
    });
    ws.write(buffer);
  }
  if (res.more) {
    if (res.more > last_one) {
      last_one = res.more;
      console.log('Next: ' + last_one);
      eos.getTableByScope(CODE, TABLE, ' ' + last_one, -1, LIMIT).then(cb, err_cb)
    } else {
      ws.end();
      console.log('Duplicated, exit!');
    }
  } else {
    ws.end();
    console.log('Done!');
  }
};

err_cb = (err) => {
  if (retry++ < 3) {
    console.log('Retry on ' + last_one + ', ' + retry + ' time(s)');
    eos.getTableByScope(CODE, TABLE, ' ' + last_one, -1, LIMIT).then(cb, err_cb);
  } else {
    console.log('Retry failed on ' + last_one);
  }
};

eos.getTableByScope(CODE, TABLE, 0, -1, LIMIT).then(cb, err_cb);

const bip39 = require('bip39')
const hdkey = require('hdkey')
const ethUtil = require('ethereumjs-util')
const Transaction = require('ethereumjs-tx')
const Web3 = require('web3')
const GHUSD = require('./contracts/ghusd')

// true = use mainnet config, false = use testnet config
const MAINNET = false
const RPC_MAINNET = 'https://api.ghuchain.com'
const RPC_TESTNET = 'https://testapi.ghuchain.com'

const web3 = MAINNET ? new Web3(RPC_MAINNET) : new Web3(RPC_TESTNET)

// Generate master seed phrase
const mnemonic = bip39.generateMnemonic()
console.log(`mnemonic: ${mnemonic}`)

bip39.mnemonicToSeed(mnemonic).then((seed) => {
  const root = hdkey.fromMasterSeed(seed)
  const masterPrivateKey = root.privateKey.toString('hex')
	console.log(`masterPrivateKey: ${masterPrivateKey}\n`)

  const walletAddress = deriveAddress(root, 0)
  // Deriving addresses for example
  deriveAddress(root, 1)
  deriveAddress(root, 2)
  deriveAddress(root, 3)

  // FUND ACCOUNT WITH GHU

  // Send GHU or call any of the example transactions
  sendGHU(walletAddress)
  sendGHUSD(walletAddress)
})

function deriveAddress(root, path) {
  console.log(`ADDRESS ${path}`)
  const addrNode = root.derive(`m/44'/60'/0'/0/${path}`)

  const privKey = addrNode._privateKey.toString('hex')
  console.log(`private key: ${privKey}`)
  
  const pubKey = ethUtil.privateToPublic(addrNode._privateKey)
  const addr = ethUtil.publicToAddress(pubKey).toString('hex')
  const checksumAddr = ethUtil.toChecksumAddress(addr)
  console.log(`address: ${checksumAddr}\n`)

  return {
    address: checksumAddr,
    privateKey: privKey,
  }
}

async function serializeTx({ fromPrivKey, to, gasLimit, gasPrice, value, data }) {
  const nonce = await web3.eth.getTransactionCount(from, 'pending')

  const txParams = {
    to,
    nonce: web3.utils.toHex(nonce),
    gasLimit: web3.utils.numberToHex(gasLimit || 21000),
    gasPrice,
    value: web3.utils.numberToHex(value || '0'),
    data,
  }

  const tx = new Transaction(txParams)
  tx.sign(Buffer.from(fromPrivKey, 'hex'))
  const serializedTx = ethUtil.addHexPrefix(tx.serialize().toString('hex'))
	console.log(`serializedTx: ${serializedTx}`)
  return serializedTx
}

async function sendTx(serializedTx) {
  web3.eth.sendSignedTransaction(serializedTx)
    .once('transactionHash', (hash) => resolve(hash))
    .on('error', (err) => reject(err))
}

/* ==================== */
/* EXAMPLE TRANSACTIONS */
/* ==================== */

async function sendGHU(walletAddress) {
  const serializedTx = await serializeTx({
    fromPrivKey: walletAddress.privateKey,
    to: '0xD5D087daABC73Fc6Cc5D9C1131b93ACBD53A2428',
    value: 1e18 // 1 GHU = 1e18. Number or String to handle big numbers.
  })
  sendTx(serializedTx)
}

async function sendGHUSD(walletAddress) {
  // Construct data. Get this from the ABI: /contracts/ghusd.js
  const data = web3.eth.abi.encodeFunctionCall(
    {
      "constant": false,
      "inputs": [
        {
          "name": "to",
          "type": "address"
        },
        {
          "name": "amount",
          "type": "uint256"
        }
      ],
      "name": "transfer",
      "outputs": [
        {
          "name": "success",
          "type": "bool"
        }
      ],
      "payable": false,
      "stateMutability": "nonpayable",
      "type": "function"
    }, 
    ['0xD5D087daABC73Fc6Cc5D9C1131b93ACBD53A2428', 1e18],
  )

  const serializedTx = await serializeTx({
    fromPrivKey: walletAddress.privateKey,
    to: MAINNET ? GHUSD.mainnet : GHUSD.testnet,
    gasLimit: 100000,
    value: 0,
    data,
  })
  sendTx(serializedTx)
}

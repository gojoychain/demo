const bip39 = require('bip39')
const hdkey = require('hdkey')
const ethUtil = require('ethereumjs-util')
const Transaction = require('ethereumjs-tx')
const Web3 = require('web3')
const GHUSD = require('./contracts/ghusd')
const ANS = require('./contracts/ans')

/* ====== */
/* CONFIG */
/* ====== */
const MAINNET = false // true to make transactions on the mainnet

const RPC_MAINNET = 'https://api.ghuchain.com'
const RPC_TESTNET = 'https://testapi.ghuchain.com'
const web3 = MAINNET ? new Web3(RPC_MAINNET) : new Web3(RPC_TESTNET)

async function runDemo() {
  // Generate master seed phrase
  const mnemonic = generateMnemonic()

  // Generate root
  const root = await deriveRoot(mnemonic)

  // Derive wallet address at path 0
  const walletAddress = deriveAddress(root, 0)

  // Deriving addresses for example
  deriveAddress(root, 1)
  deriveAddress(root, 2)
  deriveAddress(root, 3)

  // FUND ACCOUNT WITH GHU

  // Send transactions
  // await sendGHU(walletAddress)
  // await sendGHUSD(walletAddress)
  // await assignName(walletAddress)
  // await setMinLimit(walletAddress)

  // Call contracts (does not require GHU to execute)
  // await resolveName()
}
runDemo()

function generateMnemonic() {
  const mnemonic = bip39.generateMnemonic()
  console.log(`mnemonic: ${mnemonic}`)
  return mnemonic
}

async function deriveRoot(mnemonic) {
  const seed = await bip39.mnemonicToSeed(mnemonic)
  const root = hdkey.fromMasterSeed(seed)
  const masterPrivateKey = root.privateKey.toString('hex')
  console.log(`masterPrivateKey: ${masterPrivateKey}\n`)
  return root
}

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

async function serializeTx({ walletAddress, to, gasLimit, gasPrice, value, data }) {
  // Get the current nonce
  const nonce = await web3.eth.getTransactionCount(walletAddress.address, 'pending')

  // Construct params
  const txParams = {
    to,
    nonce: web3.utils.toHex(nonce),
    gasLimit: web3.utils.numberToHex(gasLimit || 21000),
    gasPrice,
    value: web3.utils.numberToHex(value || '0'),
    data,
  }

  // Sign and serialize tx
  const tx = new Transaction(txParams)
  tx.sign(Buffer.from(walletAddress.privateKey, 'hex'))
  const serializedTx = ethUtil.addHexPrefix(tx.serialize().toString('hex'))
	console.log(`serializedTx: ${serializedTx}`)
  return serializedTx
}

async function sendTx(serializedTx) {
  return new Promise((resolve, reject) => {
    web3.eth.sendSignedTransaction(serializedTx)
    .once('transactionHash', (hash) => resolve(hash))
    .on('error', (err) => reject(err))
  })
}

/* ==================== */
/* EXAMPLE TRANSACTIONS */
/* ==================== */

// Sends 1 GHU (18 decimals) to 0xD5D087daABC73Fc6Cc5D9C1131b93ACBD53A2428
async function sendGHU(walletAddress) {
  const serializedTx = await serializeTx({
    walletAddress,
    to: '0xD5D087daABC73Fc6Cc5D9C1131b93ACBD53A2428',
    value: '1000000000000000000',
  })

  try {
    const txid = await sendTx(serializedTx)
    console.log(`txid: ${txid}`)
  } catch (err) {
    console.error(`tx error: ${err.message}`)
  }
}

// Sends 1 GHUSD (18 decimals) to 0xD5D087daABC73Fc6Cc5D9C1131b93ACBD53A2428
async function sendGHUSD(walletAddress) {
  // Construct data. Get this from the ABI: /contracts/ghusd.js
  // https://web3js.readthedocs.io/en/1.0/web3-eth-abi.html#encodefunctioncall
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
    [
      'D5D087daABC73Fc6Cc5D9C1131b93ACBD53A2428', // first input: to (address)
      '1000000000000000000' // second input: amount (uint256)
    ],
  )

  const serializedTx = await serializeTx({
    walletAddress,
    to: MAINNET ? GHUSD.mainnet : GHUSD.testnet,
    gasLimit: 100000,
    value: 0,
    data,
  })

  try {
    const txid = await sendTx(serializedTx)
    console.log(`txid: ${txid}`)
  } catch (err) {
    console.error(`tx error: ${err.message}`)
  }
}

// Assigns a name in the Address Name Service Contract
async function assignName(walletAddress) {
  // Construct data. Get this from the ABI: /contracts/ans.js
  // https://web3js.readthedocs.io/en/1.0/web3-eth-abi.html#encodefunctioncall
  const data = web3.eth.abi.encodeFunctionCall(
    {
      "type": "function",
      "stateMutability": "nonpayable",
      "payable": false,
      "outputs": [
        {
          "type": "bool",
          "name": "success"
        }
      ],
      "name": "assignName",
      "inputs": [
        {
          "type": "string",
          "name": "name"
        }
      ],
      "constant": false
    }, 
    ['testname'], // first input: name (string)
  )

  const serializedTx = await serializeTx({
    walletAddress,
    to: MAINNET ? ANS.mainnet : ANS.testnet,
    gasLimit: 100000,
    value: 0,
    data,
  })

  try {
    const txid = await sendTx(serializedTx)
    console.log(`txid: ${txid}`)
  } catch (err) {
    console.error(`tx error: ${err.message}`)
  }
}

// Sets the min limit for an address in the Address Name Service Contract
async function setMinLimit(walletAddress) {
  // Construct data. Get this from the ABI: /contracts/ans.js
  // https://web3js.readthedocs.io/en/1.0/web3-eth-abi.html#encodefunctioncall
  const data = web3.eth.abi.encodeFunctionCall(
    {
      "type": "function",
      "stateMutability": "nonpayable",
      "payable": false,
      "outputs": [
        {
          "type": "bool",
          "name": "success"
        }
      ],
      "name": "setMinLimit",
      "inputs": [
        {
          "type": "address",
          "name": "addr"
        },
        {
          "type": "uint8",
          "name": "minLimit"
        }
      ],
      "constant": false
    }, 
    [
      'D5D087daABC73Fc6Cc5D9C1131b93ACBD53A2428', // first input: addr (address)
      4, // second input: minLimit (uint8)
    ],
  )

  const serializedTx = await serializeTx({
    walletAddress,
    to: MAINNET ? ANS.mainnet : ANS.testnet,
    gasLimit: 100000,
    value: 0,
    data,
  })

  try {
    const txid = await sendTx(serializedTx)
    console.log(`txid: ${txid}`)
  } catch (err) {
    console.error(`tx error: ${err.message}`)
  }
}

// Creates a new GRC223 Token
async function createToken(walletAddress) {

}

// Resolves a name in the Address Name Service Contract.
// This does not require any GHU to execute.
async function resolveName() {
  const contractAddr = MAINNET ? ANS.mainnet : ANS.testnet
  const contract = new web3.eth.Contract(ANS.abi, contractAddr)

  try {
    const resolvedAddr = await contract.methods.resolveName('testname').call()
    console.log(`resolved address: ${resolvedAddr}`)
  } catch (err) {
    console.error(`tx error: ${err.message}`)
  }
}

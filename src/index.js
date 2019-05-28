const bip39 = require('bip39')
const hdkey = require('hdkey')
const ethUtil = require('ethereumjs-util')
const Transaction = require('ethereumjs-tx')
const Web3 = require('web3')
const JRC223 = require('./contracts/jrc223')
const JUSD = require('./contracts/jusd')
const ANS = require('./contracts/ans')

/* =============== */
/* CONFIG 初始化配置 */
/* =============== */
const MAINNET = false // true to make transactions on the mainnet

const RPC_MAINNET = 'https://api.gojoychain.com'
const RPC_TESTNET = 'https://testapi.gojoychain.com'
const web3 = MAINNET ? new Web3(RPC_MAINNET) : new Web3(RPC_TESTNET)

async function runDemo() {
  // Generate master seed phrase
  const mnemonic = generateMnemonic()

  // Generate root
  const root = await deriveRoot(mnemonic)

  // Derive wallet address at path 0
  const walletAddress = deriveAddress(root, 0)

  // Deriving other addresses from same root as example
  deriveAddress(root, 1)
  deriveAddress(root, 2)
  deriveAddress(root, 3)

  // FUND ACCOUNT WITH JOY

  // Send transactions
  await sendJOY(walletAddress)
  // await sendJUSD(walletAddress)
  // await assignName(walletAddress)
  // await setMinLimit(walletAddress)
  // await createToken(walletAddress)

  // Call transactions (does not require JOY to execute)
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

function toLowestDenom(value, decimals) {
  if (!value || !decimals) {
    return ''
  }

  return web3.utils.toBN(value)
    .mul(web3.utils.toBN(10).pow(web3.utils.toBN(decimals)))
    .toString(10);
}

/* ========================= */
/* SEND TRANSACTIONS 发送交易 */
/* ========================= */

// Sends 1 JOY (18 decimals) to 0xD5D087daABC73Fc6Cc5D9C1131b93ACBD53A2428
async function sendJOY(walletAddress) {
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

// Sends 1 JUSD (18 decimals) to 0xD5D087daABC73Fc6Cc5D9C1131b93ACBD53A2428
async function sendJUSD(walletAddress) {
  // Construct data. Get this from the ABI: /contracts/jusd.js
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
    to: MAINNET ? JUSD.mainnet : JUSD.testnet,
    gasLimit: 100000,
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
    data,
  })

  try {
    const txid = await sendTx(serializedTx)
    console.log(`txid: ${txid}`)
  } catch (err) {
    console.error(`tx error: ${err.message}`)
  }
}

// Creates a new JRC223 Token
async function createToken(walletAddress) {
  const name = 'Test Token'
  const symbol = 'TTT'
  const decimals = 18
  const totalSupply = toLowestDenom(100, decimals) // 100 tokens total supply
  const owner = walletAddress.address

  let params = web3.eth.abi.encodeParameters(
    ['string', 'string', 'uint8', 'uint256', 'address'],
    [name, symbol, decimals, totalSupply, owner],
  )
  params = web3.utils.stripHexPrefix(params)
  const data = JRC223.bytecode + params

  const serializedTx = await serializeTx({
    walletAddress,
    gasLimit: 2000000,
    data,
  })

  try {
    const txid = await sendTx(serializedTx)
    console.log(`txid: ${txid}`)
  } catch (err) {
    console.error(`tx error: ${err.message}`)
  }
}

/* ============================ */
/* CALL TRANSACTIONS 调用静态函数 */
/* ============================ */

// Resolves a name in the Address Name Service Contract.
// This does not require any JOY to execute.
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

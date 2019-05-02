const bip39 = require('bip39')
const hdkey = require('hdkey')
const ethUtil = require('ethereumjs-util')
const Web3 = require('web3')

const RPC_MAINNET = 'https://api.ghuchain.com'
const RPC_TESTNET = 'https://testapi.ghuchain.com'
const web3 = new Web3(RPC_TESTNET)

// Generate master seed phrase
const mnemonic = bip39.generateMnemonic()
console.log(`mnemonic: ${mnemonic}`)

bip39.mnemonicToSeed(mnemonic).then((seed) => {
  const root = hdkey.fromMasterSeed(seed)
  const masterPrivateKey = root.privateKey.toString('hex')
	console.log(`masterPrivateKey: ${masterPrivateKey}\n`)

  deriveAddress(root, 0)
  deriveAddress(root, 1)
  deriveAddress(root, 2)
  deriveAddress(root, 3)
})

function deriveAddress(root, path) {
  console.log(`ADDRESS ${path}`)
  const addrNode = root.derive(`m/44'/60'/0'/0/${path}`); // line 1
  console.log(`private key: ${addrNode._privateKey.toString('hex')}`)
  
  const pubKey = ethUtil.privateToPublic(addrNode._privateKey);
  const addr = ethUtil.publicToAddress(pubKey).toString('hex');
  const address = ethUtil.toChecksumAddress(addr);
  console.log(`address: ${address}\n`)
}

function generateTx() {

}

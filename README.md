# SIGHASH_ANYONECANPAY

For working example code see [http://sighash_anyonecanpay.dashevo.io](http://sighash_anyonecanpay.dashevo.io)


Start with `Init Wallet` and `Create pledge denomination`.

The first time click `Use transaction`. Subsequently click `Add Input`. You can continue clicking `create pledge denomincation` and `Add Input` until you reach your funding goal using the same mnemonic. Or you can initialize multiple mnemonics at the same time and combine their inputs.

## Local Install

```sh
npm install
npm run local
```

## Dependencies

We will be using the `js-dash-sdk` which imports `wallet-lib` and `dapi-client` for interfacing with the Dash Blockchain (broadcasting transactions) and `dashcore-lib` for lower level transaction manipulation.

Both are installed with:
`npm i dash`

```js
import Dash from 'dash'
import Dashcore from '@dashevo/dashcore-lib`

const client = new Dash.Client();
```

To setup the the Dash client please see [the docs](https://dashplatform.readme.io/docs/tutorial-connecting-to-evonet)


## Transactions

A Transaction consumes Unspent Transaction Outputs (UTXOs) as Inputs and produces new UTXOs as Outpus.

Using `dashcore-lib` a UTXO is represented as an object with the following shape:

```js
var utxo = new UnspentOutput({
  "txid" : "3912bd2b0c78706db809fff3ab51ac81ef20e0a53f61e4a2369cff0c4084c55c",
  "vout" : 0,
  "address" : "XuUGDZHrKLo841CyamDbG5W7n59epA71h2",
  "scriptPubKey" : "76a914fd1a0216dc01bc90b68b39bbe755de834be5dddd88ac",
  "amount" : 4.22900307
});
```

[See docs](https://github.com/dashevo/dashcore-lib/blob/master/docs/core-concepts/unspentoutput.md)

We can assemble a transaction with an array of UTXO objects for Inputs and an array of UTXO objects for ouputs.

Each Input UTXO carries its own signature in the `script` or `scriptPubKey` field. By using the special signing flag `SIGHASH_ANYONECANPAY` we are essentially saying: 

*I sign this Input to be spent to this Output `address` and Output `amount`, anyone else can use my Input and build a transaction with it. As long as the Output stays the same, it can be spent (broadcast to the network and mined).*

In regular transaction the Output Array of UTXOs is usually the recipient and the change address that returns the remainder to your own wallet.

Since we sign our Input to be spent to 1 specific output we can't add a change address.

Instead we have to prepare the exact denomination we want to spent first, and then create and sign our Input.

Let's do that next.

Further reading:
[SIGHASH_FLAGS](https://en.bitcoin.it/wiki/Contract#SIGHASH_flags)
[Example 3: Assurance contracts](https://en.bitcoin.it/wiki/Contract#Example_3:_Assurance_contracts)
[Transaction Wiki](https://en.bitcoin.it/wiki/Transaction)
[Tansaction Mastering Bitcoin](https://www.oreilly.com/library/view/mastering-bitcoin/9781491902639/ch05.html)

## Creating the 0x81 Transaction

### 1. Create the denomination UTXO we want to spend:

We need to send the amount we want to spend to an address we control (own the privateKey), so we can sign the UTXO we create from it in the next step.

We create a new address / key pair from which we will pledge:

```js
  const pledgeFromAddress = client.account.getUnusedAddress('internal')

  const privateKey = client.account.getPrivateKeys([
    pledgeFromAddress.address,
  ])[0].privateKey
```

We create and broadcast a transaction from our wallet to this address and the amount we want to pledge:

```js
  const transaction = client.account.createTransaction({
    recipients: [
      {
        recipient: pledgeFromAddress.address,
        satoshis: 1e6,
        deductFee: false
      },
    ],
  })

  const transactionId = await client.account.broadcastTransaction(transaction)
```

### 2. Create and sign the Input UTXO

We assemble the UTXO which will become our signed Input:

```js
  const pledgeUtxo = {
    txId: transactionId,
    outputIndex: 0,
    address: pledgeFromAddress.address,
    script: transaction.outputs[0]._script,
    satoshis: transaction.outputs[0]._satoshis,
  }
```

Create a transaction from the UTXO and sign it with our private key using the SIGHASH_ANYONECANPAY flag:
```js
    const tx = new Dashcore.Transaction()
    .from([pledgeUtxo])
    .to("yPeRRTJg44yBdDmhvLSVvdUyc3DyA1Expw", 1e6)
    .sign([privateKey], 0x81) // Sign the Input with SIGHASH_ALL|SIGHASH_ANYONECANPAY
```

To store the transaction (and Input) in a portable format, we can convert it to a hex representation of JSON:
```js
  const txHex = Buffer.from(JSON.stringify(tx.toJSON())).toString('hex')
```



### 3. Combine and broadcasst the redeem transaction

Once we have enough signed Inputs to match the Output amount including the network fee, we can combine them into a single transaction.

We start with the entire transaction of the first input:
```js
  const txJSON = JSON.parse(Buffer.from(txHex, 'hex'))

  const redeemTransaction = new Dashcore.Transaction(txJSON)
```
And then add the remaining inputs to it:

```js
  const txInputJSON = JSON.parse(Buffer.from(txInputHex, 'hex'))

  const txInput = new Dashcore.Transaction(txJSON)

  redeemTransaction.addInput(txInput.inputs[0])
```

Now we can broadcast the redeem transaction:

```js
  const transactionId = await client.account.broadcastTransaction(redeemTransaction)
```

## Gotchas

There are a few things you might expect to work or to work differently. To save you some time, here are some gotchas:

### 1. Using an internal `payFromAddress`

Using an internal address for the UTXO has two issue. The first is, the wallet might spend the UTXO in a different transaction, redenring the Input unusable for the redeem transaction. The second is that `wallet-lib` has a bug and throws an error (`message: "invalid transaction: Missing inputs. Code:-25"`.
) when broadcasting future transactions after a single `SIGHASH_ANYONECANPAY` transaction is broadcast from a mnemonic derived address, rendering the entire mnemonic unusable.
The solution to both issues is to *hide* the UTXO in a derivation path that `wallet-lib` doesn't track. This way, as far as `wallet-lib` is concerned the coins have left the wallet. They won't be spent in a different transaction and `wallet-lib` doesn't try to track them and throw the `missing input` error.

One example path could be a [dip 9 path](https://github.com/dashpay/dips/blob/master/dip-0009.md), though they are supposed to be non-financial:

```js
const specialFeatureKey = client.account.keyChain.HDPrivateKey.derive(
  `m/9'/1'/4'/1'/1` // LIVENET: to m/9'/1'/4'/1'/1
)

const privateKey = specialFeatureKey.privateKey.toString()

const pledgeFromAddress = specialFeatureKey.publicKey.toAddress().toString()
```

### 2. Converting and storing just the Input

To save storage space one would think to just convert the Input to a hex representation of JSON or to serial the transaction or the input directly into its raw hex representation. However going this route throws the following error when combining the inputs into the redeem transaction:

```
message: "Unable to verify signature: Unrecognized script kind, or not enough information to execute script.This usually happens when creating a transaction from a serialized transaction"
```

Evidently some information is lost during the conversion, even though when verifying the signature / script on the input returns true:

```js
const input = Dashcore.Transaction.Input(
  JSON.parse(Buffer.from(inputHex, 'hex').toString())
)

const verification = Dashcore.Script.Interpreter().verify(
  input.script
)

console.log('verification :>> ', verification)
```

### 3. Verifying scripts and signatures

As mentioned above in `2.` verifying an Input script that has been converted to JSON and instantiated, verifies to `true` but when combined in the redeemTransaction fails to pass the `.isFullySigned()` method.

On the other hand, verifying the Output script with `Interpreter.verify()` returns false, but `.isFullySigned()` validates the transaction anyways:

```js
const verification = Dashcore.Script.Interpreter().verify(
    redeemTransaction.outputs[0].script
    )
    
console.log('verification :>> ', verification)

redeemTransaction.isFullySigned()
```

You will have to check manually if the Input satoshis exceed the output satoshis by the network fee amount since `redeemTransaction.isFullySigned()` will always return true if the inputs' scripts are signed, even if inputs are missing.

The method `Input.isFullySigned()` used in isolation throws
```
Dashcore.Transaction.Input(input.toJSON()).isFullySigned()
Uncaught NodeError
```

### 4. Paying the Network fee

If you set a funding goal and raise enough Inputs to match it, the final input must exceed the Output script's `satoshis` by the network fee. You can add an additional Input just for the fee, paying for the transaction, unless you hit the max Inputs limit that a transaction can have according to Network consensus.

One consideration is to subtract the fee from the Output UTXO and collect Inputs up to the full funding goal amount, then the fee is already included in the inputs.


```js
  const feeSatoshis = 3000 // Depends on the amount of Inputs

  const pledgeUtxo = {
    txId: transactionId,
    outputIndex: 0,
    address: pledgeFromAddress.address,
    script: transaction.outputs[0]._script,
    satoshis: transaction.outputs[0]._satoshis - feeSatoshis,
  }
```

## Documentation

[dash platform tutorial](https://dashplatform.readme.io/docs/intro-to-testnet)
[js-dash-sdk](https://dashevo.github.io/js-dash-sdk/#/)
[dashcore-lib]()
[wallet-lib](https://dashevo.github.io/wallet-lib/#/)

**Recommendations**


* On its main page (https://dashevo.github.io/wallet-lib/#/) and throughout the documentation, where appropriate, `wallet-lib` should reference `dashcore-lib` for additional, lower level transaction manipulation features
  

* To add clarity, wallet-lib should show an example of an UTXO object on its `createTransaction` page: https://dashevo.github.io/wallet-lib/#/account/createTransaction and reference https://github.com/dashevo/dashcore-lib/blob/master/docs/core-concepts/unspentoutput.md




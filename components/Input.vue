<template>
  <v-card outlined class="pa-4">
    <v-card-title>Input #{{ vidx }}</v-card-title>
    <v-text-field v-model="mnemonic" label="mnemonic" />
    <v-btn :loading="isConnecting" @click="connect()">Init Wallet</v-btn>
    Balance:
    <v-chip>{{ walletBalance }}</v-chip>
    <v-text-field v-model="pledgeAmount" label="Pledge Amount" />
    <v-btn :loading="isCreatingDenom" @click="createPledgeDenom()"
      >Create pledge denomination</v-btn
    >
    <v-textarea
      v-model="pledgeFromTransaction"
      label="pledge from transaction"
    />
    <v-text-field
      v-model="pledgeFromTransactionId"
      label="pledge from transaction id"
    />
  </v-card>
</template>

<script>
import Dash from 'dash'
import Dashcore from '@dashevo/dashcore-lib'

export default {
  props: {
    vidx: { type: Number, default: 0 },
    goalAmount: { type: Number, default: 3000000 },
    feeSatoshis: { type: Number, default: 1000 },
    toAddress: { type: String, default: '' },
    initmnemonic: { default: '', type: String },
  },
  data: () => {
    return {
      mnemonic: '',
      // 'neither neither apple collect warm trip luggage path tenant test liquid effort',
      // '',
      //  'catch fine embrace frequent prepare cruise relax faculty artwork yard sustain report'
      walletBalance: -1,
      isConnecting: false,
      isCreatingDenom: false,
      client: null,
      pledgeFromTransaction: '',
      pledgeFromTransactionId: '',
      pledgeFromAddress: '',
      pledgeAmount: 1500000,
    }
  },
  created() {
    this.mnemonic = this.initmnemonic
    this.connect()
    this.loopRefreshBalance()
  },
  methods: {
    async loopRefreshBalance() {
      if (this.client && this.client.account) {
        this.walletBalance = this.client.account.getTotalBalance()
      }
      await this.$sleep(1000)
      this.loopRefreshBalance()
    },
    async createPledgeDenom() {
      this.isCreatingDenom = true

      const specialFeatureKey = this.client.account.keyChain.HDPrivateKey.derive(
        `m/9'/1'/4'/1'/1` // TODO production LIVENET switch to 9/5
      )

      const privateKey = specialFeatureKey.privateKey.toString()

      this.pledgeFromAddress = specialFeatureKey.publicKey
        .toAddress()
        .toString()

      const transaction = this.client.account.createTransaction({
        recipients: [
          {
            recipient: this.pledgeFromAddress,
            satoshis: parseInt(this.pledgeAmount),
          },
        ],
      })

      this.pledgeFromTransaction = JSON.stringify(
        transaction.toJSON(),
        null,
        ' '
      )

      console.log('Broadcasting pledgeUtxo txs:')
      const transactionId = await this.client.account.broadcastTransaction(
        transaction
      )

      console.log('transactionId :>> ', transactionId)

      this.pledgeFromTransactionId = transactionId

      const pledgeUtxo = {
        txId: transactionId,
        outputIndex: 0,
        address: this.pledgeFromAddress,
        script: transaction.outputs[0]._script,
        satoshis: transaction.outputs[0]._satoshis,
      }

      console.log('pledgeUtxo :>> ', pledgeUtxo)

      console.log(
        'Pledge UTXO transaction successfully broadcast:',
        '\nWallet:',
        this.client.wallet.exportWallet(),
        '\ntxId:',
        transactionId,
        '\nfromAddress:',
        this.pledgeFromAddress
      )

      const tx = new Dashcore.Transaction()
        .from([pledgeUtxo])
        .to(this.toAddress, this.goalAmount - this.feeSatoshis)
        .sign([privateKey], 0x81) // 0x81 === SIGHASH_ALL|SIGHASH_ANYONECANPAY

      console.log('partially signed transaction :>> ', tx)

      this.$emit('setTx', tx)
      this.isCreatingDenom = false
    },
    async connect() {
      const { mnemonic } = this
      this.isConnecting = true

      console.log('Initializing Dash.Client with mnemonic: ', mnemonic)

      let clientOpts = {
        passFakeAssetLockProofForTests: process.env.LOCALNODE,
        dapiAddresses: process.env.DAPIADDRESSES,
        wallet: typeof mnemonic !== 'undefined' ? { mnemonic } : undefined,
      }

      // Remove undefined keys
      clientOpts = JSON.parse(JSON.stringify(clientOpts))

      // if (clientOpts.wallet) clientOpts.wallet.adapter = localforage

      console.dir({ clientOpts }, { depth: 100 })

      if (this.client) this.client.disconnect()

      this.client = new Dash.Client(clientOpts)

      console.log('client.wallet :>> ', this.client.wallet)

      Object.entries(this.client.getApps().apps).forEach(([name, entry]) =>
        console.log(name, entry.contractId.toString())
      )

      this.client.account = await this.client.wallet.getAccount()

      console.log(
        'client connected, address',
        this.client.account.getUnusedAddress().address
      )

      console.log('init total Balance', this.client.account.getTotalBalance())
      this.walletBalance = this.client.account.getTotalBalance()
      this.isConnecting = false
    },
  },
}

//   const pledgeUtxo = {
//     txId: transactionId,
//     outputIndex: 0,
//     address: this.toAddress, // pledgeFromAddress.address,
//     script: transaction.outputs[0]._script,
//     satoshis: transaction.outputs[0]._satoshis,
//   }

//   console.log('pledgeUtxo :>> ', pledgeUtxo)
//   console.log(
//     'Pledge UTXO transaction successfully broadcast:',
//     '\nWallet:',
//     client.wallet.exportWallet(),
//     '\ntxId:',
//     transactionId,
//     '\nfromAddress:',
//     pledgeFromAddress.address
//   )

//   const privateKey = client.account.getPrivateKeys([
//     pledgeFromAddress.address,
//   ])[0].privateKey

//   const tx = new Dashcore.Transaction()
//     .from([pledgeUtxo]) // Feed information about what unspent outputs one can use
//     .to(campaignRecipient, parseInt(campaignSatoshis)) // Add an output with the given amount of satoshis
//     .sign([privateKey], 0x81) // Signs all the inputs it can

//   /// START ASSEMBLE
//   // const tx2hex =
//   //   '7b2268617368223a2266393166313837633061623637323462326466666365613432323233393266626165393666633763366635356663373732316664356539306639633438366639222c2276657273696f6e223a332c22696e70757473223a5b7b227072657654784964223a2235346234666538636437386465316135313366343464326231303633343636333035306464366132393739376666653362303837303737616630623066386239222c226f7574707574496e646578223a302c2273657175656e63654e756d626572223a343239343936373239352c22736372697074223a2234383330343530323231303064613961313933633665393133666266623739396365303936383033316636306663393136616466383132653661306364633736656435373234333039343331303232303630313530656332333863333534643232666461666531353361633262613666386136356331663565616330313432386566633038336162343663616535313838313231303238653462303063636239393332306565626539376665336165626236333235643265303832656237643738623765373534376662343137316233653363326236222c22736372697074537472696e67223a223732203078333034353032323130306461396131393363366539313366626662373939636530393638303331663630666339313661646638313265366130636463373665643537323433303934333130323230363031353065633233386333353464323266646166653135336163326261366638613635633166356561633031343238656663303833616234366361653531383831203333203078303238653462303063636239393332306565626539376665336165626236333235643265303832656237643738623765373534376662343137316233653363326236222c226f7574707574223a7b227361746f73686973223a313030383030302c22736372697074223a223736613931346138393738303939356361383532666463633863653436343638333332393030306362623734313638386163227d7d5d2c226f757470757473223a5b7b227361746f73686973223a323030303030302c22736372697074223a223736613931343234376631366634653936666437303538366135623434303263646637633835343264303466326138386163227d5d2c226e4c6f636b54696d65223a307d'
//   // const tx2Json = JSON.parse(Buffer.from(tx2hex, 'hex'))

//   // const newTx2 = new Dashcore.Transaction(tx2Json)

//   // console.log('newTx2 :>> ', newTx2)

//   // tx.addInput(newTx2.inputs[0])
//   // console.log(
//   //   'tx with added input :>> ',
//   //   tx,
//   //   Buffer.from(JSON.stringify(tx.toJSON())).toString('hex')
//   // )

//   // const txBroadcast = await client.account.broadcastTransaction(tx)
//   // console.log('txBroadcast :>> ', txBroadcast)

//   /// END ASSEMBLE

//   console.log(
//     'tx :>> ',
//     tx,
//     Buffer.from(JSON.stringify(tx.toJSON())).toString('hex')
//   )

//   console.log('Created and signed input :>> ', tx.inputs[0])
//   console.log(
//     'JSON.stringify(tx.inputs[0]) :>> ',
//     JSON.stringify(tx.inputs[0])
//   )
//   return [
//     Buffer.from(JSON.stringify(tx.inputs[0].toJSON())).toString('base64'),
//     Buffer.from(JSON.stringify(tx.toJSON())).toString('hex'),
//   ]
</script>

<style></style>

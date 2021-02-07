<template>
  <div>
    <v-row>
      <v-col cols="10" class="mx-auto" border="primary">
        <v-alert class="mx-auto">
          <a
            href="https://github.com/dashameter/sighash_anyonecanpay"
            target="_blank"
            >Read the docs</a
          ><br />
          Watch the debug console for thrown errors.
        </v-alert>
        <v-card outlined max-width="500px" class="mx-auto">
          <v-text-field
            v-model="inputCount"
            label="Number of inputs"
            :rules="[(value) => value > 0 || 'At least 1']"
          />
          <v-text-field v-model="goalAmount" label="Funding goal in duffs" />
          <v-text-field v-model="feeSatoshis" label="Transaction fee" />
          <v-text-field v-model="toAddress" label="Payout Address" />
        </v-card>
        <v-divider />
      </v-col>
    </v-row>
    <v-row>
      <v-sheet class="mx-auto pa-4">
        <v-row>
          <v-col v-for="(n, vidx) in parseInt(inputCount || 1)" :key="vidx">
            {{ vidx }}
            <VInput
              :key="vidx"
              :vidx="n"
              :initmnemonic="initmnemonics[vidx]"
              :goal-amount="parseInt(goalAmount)"
              :to-address="toAddress"
              :fee-satoshis="parseInt(feeSatoshis)"
              @setTx="setTxx(vidx, $event)"
            />
            <v-textarea v-model="inputs[vidx]" label="0x81 transaction" />
            <v-btn label="add input1" @click="useTx(vidx)">
              Use this transaction
            </v-btn>
            <v-textarea v-model="inputsJson[vidx]" label="0x81 input" />
            <v-btn label="add input1" @click="addInputDirect(vidx)">
              Add Input from memory
            </v-btn>
            <v-textarea v-model="inputsHex[vidx]" label="0x81 input hex" />
            Dashcore.Script.Interpreter().verify(): <br />
            <strong> {{ verifyInput(vidx) }}</strong
            ><br />
            <v-btn label="add input1" @click="addInputHex(vidx)">
              Add Input from Hex
            </v-btn>
          </v-col>
        </v-row>
        <v-divider />
        Output:
        <v-divider />
        Dashcore.Script.Interpreter().verify(): <br />
        <strong> {{ verifyRedeemTxOutput() }}</strong
        ><br />
        transaction.isFullySigned(): <br />
        <strong> {{ isRedeemTxFullySigned() }}</strong
        ><br />
        Redeem Tx with combined Inputs:
        <v-textarea :value="redeemTx" label="Redeem Tx" />
        <v-btn @click="broadcastRedeemTx()"> broadcast Redeem Tx </v-btn>
        <v-alert>
          Redeem Result:<br />
          {{ redeemResult }}
        </v-alert>
      </v-sheet>
    </v-row>
  </div>
</template>

<script>
import Vue from 'vue'
import Dash from 'dash'
import Dashcore from '@dashevo/dashcore-lib'
import VInput from '~/components/Input'

export default {
  components: { VInput },
  data: () => {
    return {
      inputCount: 2,
      inputs: {},
      inputsJson: {},
      inputsHex: {},
      initmnemonics: [],
      client: null,
      goalAmount: 3000000,
      feeSatoshis: 1000,
      toAddress: 'yPeRRTJg44yBdDmhvLSVvdUyc3DyA1Expw',
      redeemTxRaw: null,
      input1: '',
      input2: '',
      mnemonic:
        'shock immense hand zoo mean seat vehicle artwork element month story water',
      redeemResult: '',
    }
  },
  computed: {
    redeemTx() {
      return this.redeemTxRaw
    },
  },
  created() {
    console.log('this.$route :>> ', this.$route)
    const initm1 =
      // 'pride dolphin pluck orphan crunch erode soft damage metal corn risk slot',
      // 'shock immense hand zoo mean seat vehicle artwork element month story water',
      // 'catch fine embrace frequent prepare cruise relax faculty artwork yard sustain report',
      'luggage vacuum solution element rigid have provide enough defense champion frog camera'
    this.initmnemonics.push(initm1)

    const initm2 =
      // 'injury slender heart powder shove canal crash exile nest cement impact chair',
      // 'economy annual cool rally minute toast gas oyster august lamp sail isolate',
      //   'neck neither tired bargain pizza quantum anxiety wait hire network nasty joke'
      'essay love suffer inquiry buffalo advance glue boil arrive glove clutch oyster'
    this.initmnemonics.push(initm2)

    this.redeemTxRaw = new Dashcore.Transaction()
  },
  methods: {
    isRedeemTxFullySigned() {
      let res
      try {
        res = this.redeemTxRaw.isFullySigned()
      } catch (e) {
        res = e.message
      }
      return res
    },
    verifyRedeemTxOutput() {
      let res
      try {
        res = Dashcore.Script.Interpreter().verify(
          this.redeemTxRaw.outputs[0].script
        )
      } catch (e) {
        res = e.message
      }
      return res
    },
    verifyInput(vidx) {
      let res
      try {
        const json = JSON.parse(
          Buffer.from(this.inputsHex[vidx], 'hex').toString()
        )

        const input = Dashcore.Transaction.Input(json)

        res = Dashcore.Script.Interpreter().verify(input.script)
      } catch (e) {
        res = e.message
      }
      return res
    },
    reload() {
      this.$router.push('/0x81/?inputCount=' + this.inputCount)
    },
    setTxx(vidx, tx) {
      console.log('setinput, vidx,tx :>> ', vidx, tx)

      Vue.set(this.inputs, vidx, tx)

      Vue.set(this.inputsJson, vidx, JSON.stringify(tx.toJSON()))

      Vue.set(
        this.inputsHex,
        vidx,
        Buffer.from(JSON.stringify(tx.inputs[0].toJSON())).toString('hex')
      )
    },
    useTx(vidx) {
      //   this.redeemTxRaw.addInput(this.input1.inputs[0])
      this.redeemTxRaw = this.inputs[vidx]
      let verification
      verification = Dashcore.Script.Interpreter().verify(
        this.redeemTxRaw.inputs[0].script
      )
      console.log('verification :>> ', verification)

      verification = Dashcore.Script.Interpreter().verify(
        this.redeemTxRaw.outputs[0].script
      )
      console.log('verification :>> ', verification)
    },
    addInputDirect(vidx) {
      this.redeemTxRaw.addInput(this.inputs[vidx].inputs[0])
    },
    addInputHex(vidx) {
      //   this.redeemTxRaw.addInput(this.input2.inputs[0])

      // const tx2hex = Buffer.from(
      //   JSON.stringify(this.inputs[vidx].toJSON())
      // ).toString('hex')

      // const tx2 = new Dashcore.Transaction(
      //   JSON.parse(Buffer.from(tx2hex, 'hex'))
      // )
      // this.redeemTxRaw.addInput(tx2.inputs[0])

      console.log(
        '      const in2 = Dashcore.Transaction.Input( :>> ',
        JSON.parse(Buffer.from(this.inputsHex[vidx], 'hex').toString())
      )
      let verification
      const in2 = Dashcore.Transaction.Input(
        JSON.parse(Buffer.from(this.inputsHex[vidx], 'hex').toString())
      )
      verification = Dashcore.Script.Interpreter().verify(in2.script)
      console.log('in2 verification :>> ', verification)

      this.redeemTxRaw.addInput(in2)
      verification = Dashcore.Script.Interpreter().verify(
        this.redeemTxRaw.inputs[0].script
      )
      console.log('verification :>> ', verification)
      verification = Dashcore.Script.Interpreter().verify(
        this.redeemTxRaw.inputs[1].script
      )
      console.log('verification :>> ', verification)
      verification = Dashcore.Script.Interpreter().verify(
        this.redeemTxRaw.outputs[0].script
      )
      console.log('verification :>> ', verification)
      // debugger
    },
    async broadcastRedeemTx() {
      await this.connect()
      let res
      try {
        const redeemTxId = await this.client.account.broadcastTransaction(
          this.redeemTxRaw
        )
        console.log('redeemTxId :>> ', redeemTxId)
        res = redeemTxId
      } catch (e) {
        res = e.message
      }
      this.redeemResult = res
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
